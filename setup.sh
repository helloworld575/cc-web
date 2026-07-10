#!/bin/bash
set -euo pipefail

echo "================================"
echo "  ThomasLee Blog - Setup"
echo "================================"
echo

check() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is not installed."
    echo "  $2"
    exit 1
  fi
}

check node "Install Node.js 20.19.0 or newer from https://nodejs.org"
check npm "npm is bundled with Node.js"
check openssl "Install OpenSSL so setup can generate secure secrets"

MIN_NODE_VERSION="20.19.0"
if ! node -e '
const current = process.versions.node.split(".").map(Number);
const required = process.argv[1].split(".").map(Number);
for (let index = 0; index < required.length; index += 1) {
  if ((current[index] ?? 0) > required[index]) process.exit(0);
  if ((current[index] ?? 0) < required[index]) process.exit(1);
}
' "$MIN_NODE_VERSION"; then
  echo "ERROR: Node.js $MIN_NODE_VERSION or newer is required; found $(node -v)."
  exit 1
fi

echo "[ok] node $(node -v) and npm $(npm -v)"
echo

SKIP_ENV=0
if [ -f .env.local ]; then
  echo ".env.local already exists."
  read -rp "Overwrite? (y/N): " overwrite
  if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
    echo "Keeping existing .env.local"
    SKIP_ENV=1
  fi
fi

if [ "$SKIP_ENV" -eq 0 ]; then
  GENERATED_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)
  read -rp "Admin password (leave blank to generate a strong password): " ADMIN_PASSWORD
  if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$GENERATED_ADMIN_PASSWORD
    echo "[info] Generated a strong admin password and saved it to .env.local"
  fi

  read -rp "Claude API Key (optional): " CLAUDE_API_KEY
  read -rp "Claude model [claude-opus-4-8]: " CLAUDE_MODEL
  CLAUDE_MODEL=${CLAUDE_MODEL:-claude-opus-4-8}
  read -rp "Claude API host (press Enter for default): " CLAUDE_API_HOST

  NEXTAUTH_SECRET=$(openssl rand -base64 32)

  cat > .env.local <<EOF
# Auth
ADMIN_PASSWORD=$ADMIN_PASSWORD
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
EOF

  if [ -n "$CLAUDE_API_KEY" ]; then
    cat >> .env.local <<EOF

# Claude AI
CLAUDE_API_KEY=$CLAUDE_API_KEY
CLAUDE_MODEL=$CLAUDE_MODEL
EOF
  fi

  if [ -n "$CLAUDE_API_HOST" ]; then
    echo "CLAUDE_API_HOST=$CLAUDE_API_HOST" >> .env.local
  fi

  echo
  echo "[ok] .env.local created"
fi

echo
echo "Installing npm dependencies..."
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
echo "[ok] dependencies installed"

mkdir -p content/posts uploads data
echo "[ok] SQLite, content, and upload directories are ready"

echo
echo "================================"
echo "  Setup complete!"
echo "================================"
echo
echo "  Start dev server:  npm run dev"
echo "  Then open:         http://localhost:3000"
echo "  Admin login:       http://localhost:3000/login"
echo "  Optional Docker:   docker compose up -d"
echo
