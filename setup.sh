#!/bin/bash
set -e

echo "================================"
echo "  ThomasLee Blog - Setup"
echo "================================"
echo

# ── Check prerequisites ──────────────────────────────────────────────────────
check() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is not installed."
    echo "  $2"
    exit 1
  fi
}

check node   "Install from https://nodejs.org (>= 18)"
check npm    "Comes with Node.js"
check docker "Install from https://www.docker.com/get-started"

echo "[ok] node $(node -v), npm $(npm -v), docker found"
echo

# ── Collect env values ────────────────────────────────────────────────────────
if [ -f .env.local ]; then
  echo ".env.local already exists."
  read -rp "Overwrite? (y/N): " overwrite
  if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
    echo "Keeping existing .env.local"
    SKIP_ENV=1
  fi
fi

if [ -z "$SKIP_ENV" ]; then
  read -rp "Admin password [changeme]: " ADMIN_PASSWORD
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-changeme}

  read -rp "Claude API Key (required): " CLAUDE_API_KEY
  while [ -z "$CLAUDE_API_KEY" ]; do
    echo "  API key cannot be empty. Get one at https://console.anthropic.com"
    read -rp "Claude API Key: " CLAUDE_API_KEY
  done

  read -rp "Claude model [claude-sonnet-4-6]: " CLAUDE_MODEL
  CLAUDE_MODEL=${CLAUDE_MODEL:-claude-sonnet-4-6}

  read -rp "Claude API host (press Enter for default): " CLAUDE_API_HOST

  NEXTAUTH_SECRET=$(openssl rand -base64 32)

  # Write .env.local
  cat > .env.local <<EOF
# Auth
ADMIN_PASSWORD=$ADMIN_PASSWORD
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000

# Claude AI
CLAUDE_API_KEY=$CLAUDE_API_KEY
CLAUDE_MODEL=$CLAUDE_MODEL
EOF

  if [ -n "$CLAUDE_API_HOST" ]; then
    echo "CLAUDE_API_HOST=$CLAUDE_API_HOST" >> .env.local
  fi

  cat >> .env.local <<EOF

# MongoDB (fortune history)
MONGODB_URI=mongodb://localhost:27017/thomaslee-blog
EOF

  echo
  echo "[ok] .env.local created"
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo
echo "Installing npm dependencies..."
npm install --silent
echo "[ok] dependencies installed"

# ── Create directories ────────────────────────────────────────────────────────
mkdir -p content/posts uploads data
echo "[ok] data directories ready"

# ── Start MongoDB ─────────────────────────────────────────────────────────────
echo
echo "Starting MongoDB via Docker..."
if docker compose up -d 2>/dev/null; then
  echo "[ok] MongoDB running on port 27017"
else
  echo "[warn] Docker failed. MongoDB is optional — the app will work without history."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo
echo "================================"
echo "  Setup complete!"
echo "================================"
echo
echo "  Start dev server:  npm run dev"
echo "  Then open:         http://localhost:3000"
echo "  Admin login:       http://localhost:3000/login"
echo
