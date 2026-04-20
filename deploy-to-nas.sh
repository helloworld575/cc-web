#!/bin/bash
set -euo pipefail

NAS_USER="ThomasLee"
NAS_HOST="192.168.31.92"
NAS_PATH="/volume1/docker/my-site"
PACKAGE_FILE="my-site-deploy.tar.gz"
REMOTE_STAGE_BASE="${NAS_PATH}/.codex-deploy-stage"

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "python or python3 is required"
  exit 1
fi

if [ -n "${1:-}" ]; then
  export NAS_PASSWORD="$1"
fi

"${PYTHON_BIN}" - <<'PY'
import os
import posixpath
import shlex
import sys
import tarfile
import tempfile
from pathlib import Path

try:
    import paramiko
except ImportError as exc:
    raise SystemExit("paramiko is required. Install it with `python -m pip install --user paramiko`.") from exc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

NAS_USER = os.environ.get("NAS_USER", "ThomasLee")
NAS_HOST = os.environ.get("NAS_HOST", "192.168.31.92")
NAS_PATH = os.environ.get("NAS_PATH", "/volume1/docker/my-site")
PACKAGE_FILE = os.environ.get("PACKAGE_FILE", "my-site-deploy.tar.gz")
REMOTE_STAGE_BASE = os.environ.get("REMOTE_STAGE_BASE", f"{NAS_PATH}/.codex-deploy-stage")
NAS_PASSWORD = os.environ.get("NAS_PASSWORD")

if not NAS_PASSWORD:
    raise SystemExit("NAS_PASSWORD is required. Pass it as the first script argument or env var.")

root = Path.cwd()
compose_file = root / "docker-compose.nas.yml"
env_file = root / ".env.local"
if not env_file.exists():
    fallback_env = root / "tests" / ".env.local"
    if fallback_env.exists():
        env_file = fallback_env
    else:
        raise SystemExit("Missing .env.local and tests/.env.local")

if not compose_file.exists():
    raise SystemExit("Missing docker-compose.nas.yml")

include_roots = [
    ".claude",
    ".codex",
    "app",
    "components",
    "docs",
    "lib",
    "scripts",
    "tests",
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
    "docker-compose.nas.yml",
    "middleware.ts",
    "next.config.mjs",
    "package-lock.json",
    "package.json",
    "postcss.config.mjs",
    "setup.sh",
    "skills-lock.json",
    "tailwind.config.ts",
    "tsconfig.json",
    "vitest.config.ts",
]
exclude_prefixes = {
    ".git/",
    "node_modules/",
    ".next/",
    ".idea/",
    "data/",
    "uploads/",
    "log/",
}
exclude_exact = {
    ".env.local",
    "tests/.env.local",
    PACKAGE_FILE,
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
    packaged = []
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
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def to_sftp_path(shell_path: str) -> str:
    prefix = "/volume1/"
    if shell_path.startswith(prefix):
        return shell_path[len(prefix):]
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
                # Allow races or pre-existing directories with restrictive stat behavior.
                sftp.stat(current)


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp_dir:
        package_path = Path(tmp_dir) / PACKAGE_FILE
        packaged = create_package(package_path)
        if not packaged:
            raise SystemExit("Package is empty; nothing to deploy.")
        print(f"Packaged {len(packaged)} files into {package_path.name}")

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(NAS_HOST, username=NAS_USER, password=NAS_PASSWORD, timeout=20)
        sftp = client.open_sftp()

        remote_stage = REMOTE_STAGE_BASE
        remote_package = posixpath.join(remote_stage, PACKAGE_FILE)
        remote_env = posixpath.join(NAS_PATH, ".env.local")
        remote_compose = posixpath.join(NAS_PATH, "docker-compose.nas.yml")
        remote_stage_sftp = to_sftp_path(remote_stage)
        remote_path_sftp = to_sftp_path(NAS_PATH)

        try:
            for cmd in [
                f"mkdir -p {shlex.quote(remote_stage)}",
                f"mkdir -p {shlex.quote(NAS_PATH)}",
            ]:
                code, out, err = run_remote(client, cmd, timeout=60)
                if code != 0:
                    raise RuntimeError(f"Remote mkdir failed\nOUT:\n{out}\nERR:\n{err}")

            ensure_sftp_dir(sftp, remote_stage_sftp)
            ensure_sftp_dir(sftp, remote_path_sftp)

            print("Uploading env and compose files")
            sftp.put(str(env_file), to_sftp_path(remote_env))
            sftp.put(str(compose_file), to_sftp_path(remote_compose))

            print(f"Uploading package {PACKAGE_FILE}")
            sftp.put(str(package_path), to_sftp_path(remote_package))

            extract_dir = posixpath.join(remote_stage, "src")
            remote_cmds = [
                f"rm -rf {shlex.quote(extract_dir)}",
                f"mkdir -p {shlex.quote(extract_dir)}",
                f"tar -xzf {shlex.quote(remote_package)} -C {shlex.quote(extract_dir)}",
                f"cd {shlex.quote(extract_dir)} && docker build -t my-site:latest .",
                f"cd {shlex.quote(NAS_PATH)} && docker compose -f docker-compose.nas.yml up -d",
                f"cd {shlex.quote(NAS_PATH)} && docker compose -f docker-compose.nas.yml ps",
            ]
            for cmd in remote_cmds:
                print(f"Running remote command: {cmd}")
                code, out, err = run_remote(client, cmd, timeout=1800)
                if out.strip():
                    print(out)
                if err.strip():
                    print(err, file=sys.stderr)
                if code != 0:
                    raise RuntimeError(f"Remote command failed: {cmd}")
        finally:
            cleanup_cmd = f"rm -rf {shlex.quote(remote_stage)}"
            run_remote(client, cleanup_cmd, timeout=120)
            sftp.close()
            client.close()

    print(f"Deployment completed to {NAS_HOST}:{NAS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
PY
