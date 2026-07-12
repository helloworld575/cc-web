#!/usr/bin/env python3
"""Fetch sanitized Docker Compose logs from the configured NAS."""

import argparse
import re
import shlex
import sys
from datetime import datetime
from pathlib import Path

try:
    import paramiko
except ImportError as exc:
    raise SystemExit(
        "paramiko is required. Install it with `python -m pip install --user paramiko`."
    ) from exc


SERVICES = ("app", "claude-worker", "subscription-cron", "cloudflared")
SAFE_SINCE = re.compile(r"^[A-Za-z0-9:TZ+_.-]{1,40}$")
SENSITIVE_KEY = re.compile(r"PASSWORD|TOKEN|SECRET|API[_-]?KEY|CREDENTIAL|COOKIE", re.I)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read sanitized logs from the NAS Compose stack.")
    parser.add_argument("--service", action="append", choices=SERVICES, help="Service to include; repeat as needed.")
    parser.add_argument("--since", default="30m", help="Docker log time window, for example 30m, 2h, or an ISO timestamp.")
    parser.add_argument("--tail", type=int, default=200, help="Maximum lines per service.")
    parser.add_argument("--grep", dest="pattern", help="Only keep output lines matching this case-insensitive regex.")
    parser.add_argument("--audit", action="store_true", help="Also print container status and logging-driver configuration.")
    parser.add_argument("--env-file", default=".env.local", help="Local environment file containing NAS credentials.")
    parser.add_argument("--no-save", action="store_true", help="Do not save a copy under log/nas/.")
    return parser.parse_args()


def read_env(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(f"Missing environment file: {path}")
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def sanitize(text: str, env: dict[str, str]) -> str:
    sanitized = text
    secrets = [
        (key, value)
        for key, value in env.items()
        if SENSITIVE_KEY.search(key) and len(value) >= 6
    ]
    for key, value in sorted(secrets, key=lambda item: len(item[1]), reverse=True):
        sanitized = sanitized.replace(value, f"[REDACTED:{key}]")
    sanitized = re.sub(r"(?i)(bearer\s+)[^\s,;]+", r"\1[REDACTED]", sanitized)
    sanitized = re.sub(r"\bsk-[A-Za-z0-9_-]{8,}\b", "[REDACTED]", sanitized)
    sanitized = re.sub(
        r"(?i)([?&](?:key|token|secret|password)=)[^&#\s]+",
        r"\1[REDACTED]",
        sanitized,
    )
    return sanitized


def run_remote(client: "paramiko.SSHClient", command: str, timeout: int = 60) -> tuple[int, str]:
    stdin, stdout, stderr = client.exec_command(f"sh -lc {shlex.quote(command)}", timeout=timeout)
    del stdin
    output = stdout.read().decode("utf-8", errors="replace")
    error = stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), output + error


def main() -> int:
    args = parse_args()
    if args.tail <= 0 or args.tail > 10000:
        raise SystemExit("--tail must be between 1 and 10000")
    if not SAFE_SINCE.fullmatch(args.since):
        raise SystemExit("--since contains unsupported characters")

    env = read_env(Path(args.env_file).resolve())
    required = ["NAS_HOST", "NAS_USER", "NAS_PASSWORD"]
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise SystemExit(f"Missing required NAS settings: {', '.join(missing)}")

    remote_path = env.get("NAS_PATH", "/volume1/docker/my-site")
    compose_file = env.get("NAS_COMPOSE_FILE", "docker-compose.nas.yml")
    compose = (
        f"docker compose --env-file {shlex.quote(env.get('NAS_ENV_FILE', '.env.local'))} "
        f"-f {shlex.quote(compose_file)}"
    )
    services = args.service or list(SERVICES)
    commands: list[tuple[str, str]] = []
    if args.audit:
        commands.extend([
            (
                "docker_logging",
                "docker version --format 'server={{.Server.Version}}'; "
                "docker info --format 'default={{.LoggingDriver}} plugins={{json .Plugins.Log}}'",
            ),
            ("compose_ps", f"cd {shlex.quote(remote_path)} && {compose} ps"),
            (
                "log_config",
                f"cd {shlex.quote(remote_path)} && "
                f"for id in $({compose} ps -q); do "
                "docker inspect --format '{{.Name}}|{{.HostConfig.LogConfig.Type}}|{{json .HostConfig.LogConfig.Config}}' $id; "
                "done",
            ),
        ])
    commands.append((
        "recent_logs",
        f"cd {shlex.quote(remote_path)} && {compose} logs --no-color --timestamps "
        f"--since={shlex.quote(args.since)} --tail={args.tail} "
        + " ".join(shlex.quote(service) for service in services),
    ))

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        env["NAS_HOST"],
        username=env["NAS_USER"],
        password=env["NAS_PASSWORD"],
        timeout=20,
    )

    sections: list[str] = []
    try:
        for label, command in commands:
            status, output = run_remote(client, command)
            cleaned = sanitize(output, env).rstrip()
            sections.append(f"### {label} status={status}\n{cleaned}")
            if status != 0:
                break
    finally:
        client.close()

    transcript = "\n".join(sections) + "\n"
    if args.pattern:
        matcher = re.compile(args.pattern, re.I)
        transcript = "\n".join(
            line for line in transcript.splitlines()
            if line.startswith("### ") or matcher.search(line)
        ) + "\n"

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(transcript, end="")

    if not args.no_save:
        log_dir = Path("log/nas")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"{datetime.now().astimezone().strftime('%Y%m%d-%H%M%S')}-nas-logs.log"
        log_path.write_text(transcript, encoding="utf-8")
        print(f"Saved sanitized log snapshot to {log_path}")

    return 0 if all("status=0" in section.splitlines()[0] for section in sections) else 1


if __name__ == "__main__":
    raise SystemExit(main())
