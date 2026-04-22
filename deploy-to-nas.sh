#!/bin/bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
PACKAGE_FILE="${PACKAGE_FILE:-my-site-deploy.tar.gz}"

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "python or python3 is required"
  exit 1
fi

export ENV_FILE PACKAGE_FILE

"${PYTHON_BIN}" - <<'PY'
import os
import posixpath
import re
import shlex
import sys
import tarfile
import tempfile
import time
import traceback
from datetime import datetime
from pathlib import Path

try:
    import paramiko
except ImportError as exc:
    raise SystemExit("paramiko is required. Install it with `python -m pip install --user paramiko`.") from exc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

root = Path.cwd()
log_dir = root / "log" / "deploy"
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / f"{datetime.now().astimezone().strftime('%Y%m%d-%H%M%S')}-deploy-to-nas.log"
log_handle = log_file.open("a", encoding="utf-8")


def log(message: str, level: str = "INFO") -> None:
    line = f"[{datetime.now().astimezone().isoformat(timespec='seconds')}] [{level}] {message}"
    print(line)
    log_handle.write(f"{line}\n")
    log_handle.flush()


def log_multiline(prefix: str, content: str, level: str = "INFO") -> None:
    for line in content.rstrip().splitlines():
        log(f"{prefix}{line}", level=level)


def load_dotenv(path: Path) -> None:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def require_env(names: list[str]) -> None:
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        raise SystemExit(
            f"Missing required values in {ENV_FILE}: {', '.join(missing)}"
        )


def should_reject_admin_password(admin_password: str) -> bool:
    return admin_password == "changeme"


ENV_FILE = os.environ.get("ENV_FILE", ".env.local")
PACKAGE_FILE = os.environ.get("PACKAGE_FILE", "my-site-deploy.tar.gz")

env_file = (root / ENV_FILE).resolve()
if not env_file.exists():
    raise SystemExit(
        f"Missing {ENV_FILE}. Create the root .env.local before deploying."
    )

load_dotenv(env_file)

compose_file_name = os.environ.get("NAS_COMPOSE_FILE", "docker-compose.nas.yml")
compose_file = root / compose_file_name
if not compose_file.exists():
    raise SystemExit(f"Missing {compose_file_name}")

require_env([
    "ADMIN_PASSWORD",
    "NAS_HOST",
    "NAS_USER",
    "NAS_PATH",
    "NAS_PASSWORD",
    "CLOUDFLARE_TUNNEL_TOKEN",
])

if should_reject_admin_password(os.environ["ADMIN_PASSWORD"]):
    raise SystemExit('Refusing to deploy with ADMIN_PASSWORD="changeme". Set a strong password in .env.local.')

NAS_HOST = os.environ["NAS_HOST"]
NAS_USER = os.environ["NAS_USER"]
NAS_PATH = os.environ["NAS_PATH"]
NAS_PASSWORD = os.environ["NAS_PASSWORD"]
NAS_IMAGE_NAME = os.environ.get("NAS_IMAGE_NAME", "my-site:latest")
NAS_ENV_FILE = os.environ.get("NAS_ENV_FILE", ".env.local")
REMOTE_STAGE_BASE = os.environ.get("NAS_REMOTE_STAGE_BASE", f"{NAS_PATH}/.codex-deploy-stage")
REMOTE_PACKAGE_NAME = os.environ.get("NAS_PACKAGE_FILE", PACKAGE_FILE)

include_roots = [
    ".claude",
    "app",
    "components",
    "content",
    "lib",
    "public",
]
include_files = [
    ".dockerignore",
    ".env.example",
    ".gitignore",
    "AGENTS.md",
    "Dockerfile",
    "README.md",
    "README.zh-CN.md",
    "deploy-to-nas.sh",
    compose_file_name,
    "middleware.ts",
    "next-env.d.ts",
    "next.config.mjs",
    "package-lock.json",
    "package.json",
    "postcss.config.mjs",
    "setup.sh",
    "tailwind.config.ts",
    "tsconfig.json",
]
exclude_prefixes = {
    ".git/",
    ".idea/",
    ".next/",
    "data/",
    "log/",
    "node_modules/",
    "uploads/",
}
exclude_exact = {
    ".env.local",
    "tests/.env.local",
    PACKAGE_FILE,
    REMOTE_PACKAGE_NAME,
}


def should_include(rel_posix: str) -> bool:
    if rel_posix in exclude_exact:
        return False
    for prefix in exclude_prefixes:
        if rel_posix.startswith(prefix):
            return False
    if rel_posix in include_files:
        return True
    return any(rel_posix == root_name or rel_posix.startswith(f"{root_name}/") for root_name in include_roots)


def create_package(target: Path) -> list[str]:
    packaged: list[str] = []
    with tarfile.open(target, "w:gz") as archive:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if not should_include(rel):
                continue
            archive.add(path, arcname=rel)
            packaged.append(rel)
    return packaged


def run_remote(client: "paramiko.SSHClient", cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    stdin, stdout, stderr = client.exec_command(f"sh -lc {shlex.quote(cmd)}", timeout=timeout)
    del stdin
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def run_remote_step(client: "paramiko.SSHClient", label: str, cmd: str, timeout: int = 300) -> None:
    log(f"{label}: {cmd}")
    started_at = time.monotonic()
    code, out, err = run_remote(client, cmd, timeout=timeout)
    if out.strip():
        log_multiline("[remote stdout] ", out)
    if err.strip():
        log_multiline("[remote stderr] ", err, level="WARN")
    duration = time.monotonic() - started_at
    if code != 0:
        raise RuntimeError(f"{label} failed with exit code {code} after {duration:.1f}s")
    log(f"{label} finished in {duration:.1f}s")


def to_sftp_path(shell_path: str) -> str:
    match = re.match(r"^/volume\d+/(.+)$", shell_path)
    if match:
        return match.group(1)
    raise RuntimeError(f"Cannot map shell path to SFTP path: {shell_path}")


def ensure_sftp_dir(sftp: "paramiko.SFTPClient", sftp_path: str) -> None:
    current = ""
    for part in sftp_path.strip("/").split("/"):
        current = f"{current}/{part}" if current else part
        try:
            sftp.stat(current)
        except IOError:
            try:
                sftp.mkdir(current)
            except IOError:
                sftp.stat(current)


def main() -> int:
    client: "paramiko.SSHClient | None" = None
    sftp: "paramiko.SFTPClient | None" = None
    remote_stage: str | None = None
    with tempfile.TemporaryDirectory() as tmp_dir:
        package_path = Path(tmp_dir) / REMOTE_PACKAGE_NAME
        packaged = create_package(package_path)
        if not packaged:
            raise SystemExit("Package is empty; nothing to deploy.")
        log(f"Using env file: {env_file}")
        log(f"Packaged {len(packaged)} files into {package_path.name}")
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            log(f"Connecting to NAS {NAS_HOST} as {NAS_USER}")
            client.connect(NAS_HOST, username=NAS_USER, password=NAS_PASSWORD, timeout=20)
            log("SSH connection established")
            sftp = client.open_sftp()
            log("SFTP session opened")

            remote_stage = REMOTE_STAGE_BASE
            remote_package = posixpath.join(remote_stage, REMOTE_PACKAGE_NAME)
            remote_env = posixpath.join(NAS_PATH, NAS_ENV_FILE)
            remote_compose = posixpath.join(NAS_PATH, compose_file_name)
            remote_stage_sftp = to_sftp_path(remote_stage)
            remote_path_sftp = to_sftp_path(NAS_PATH)

            run_remote_step(client, "Prepare remote stage", f"mkdir -p {shlex.quote(remote_stage)}", timeout=60)
            run_remote_step(client, "Prepare NAS deploy path", f"mkdir -p {shlex.quote(NAS_PATH)}", timeout=60)

            ensure_sftp_dir(sftp, remote_stage_sftp)
            ensure_sftp_dir(sftp, remote_path_sftp)
            log("Verified SFTP directories")

            log("Uploading environment file")
            sftp.put(str(env_file), to_sftp_path(remote_env))
            log("Uploading compose file")
            sftp.put(str(compose_file), to_sftp_path(remote_compose))
            log(f"Uploading package {REMOTE_PACKAGE_NAME}")
            sftp.put(str(package_path), to_sftp_path(remote_package))

            extract_dir = posixpath.join(remote_stage, "src")
            compose_cmd = (
                f"docker compose --env-file {shlex.quote(NAS_ENV_FILE)} "
                f"-f {shlex.quote(compose_file_name)}"
            )
            remote_cmds = [
                ("Reset extracted source", f"rm -rf {shlex.quote(extract_dir)}", 120),
                ("Create extract directory", f"mkdir -p {shlex.quote(extract_dir)}", 120),
                ("Extract deployment package", f"tar -xzf {shlex.quote(remote_package)} -C {shlex.quote(extract_dir)}", 600),
                ("Build Docker image", f"cd {shlex.quote(extract_dir)} && docker build -t {shlex.quote(NAS_IMAGE_NAME)} .", 1800),
                ("Start compose stack", f"cd {shlex.quote(NAS_PATH)} && {compose_cmd} up -d", 600),
                ("Inspect compose stack", f"cd {shlex.quote(NAS_PATH)} && {compose_cmd} ps", 180),
            ]
            for label, cmd, timeout in remote_cmds:
                run_remote_step(client, label, cmd, timeout=timeout)
        finally:
            if client is not None and remote_stage is not None:
                try:
                    run_remote_step(client, "Remote cleanup", f"rm -rf {shlex.quote(remote_stage)}", timeout=120)
                except Exception as cleanup_error:
                    log(f"Remote cleanup failed: {cleanup_error}", level="WARN")
            if sftp is not None:
                try:
                    sftp.close()
                    log("SFTP session closed")
                except Exception as close_error:
                    log(f"SFTP close failed: {close_error}", level="WARN")
            if client is not None:
                try:
                    client.close()
                    log("SSH session closed")
                except Exception as close_error:
                    log(f"SSH close failed: {close_error}", level="WARN")

    log(f"Deployment completed to {NAS_HOST}:{NAS_PATH}")
    log(f"Deployment log saved to {log_file.relative_to(root).as_posix()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        log("Deployment failed with an exception", level="ERROR")
        log_multiline("", traceback.format_exc(), level="ERROR")
        raise
    finally:
        log_handle.close()
PY
