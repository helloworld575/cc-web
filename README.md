# ThomasLee's Blog

Personal blog & toolbox built with **Next.js 14** and **SQLite**.

📖 [中文版](./README.zh-CN.md) · 📚 [Full docs](./docs/en/)

## Features

- 📝 **Blog** — Markdown posts with AI-assisted editing (brief, tags, title, translate, polish)
- 📒 **Diary** — Private date-based journal with markdown
- ✅ **Todos** — Task list with deadlines
- 🖼️ **Files** — Image uploads organized into albums
- 🤖 **AI Chat** — Multi-provider chat (OpenAI + Anthropic) with streaming
- 📰 **Subscriptions** — AI-generated briefs from blogs, GitHub, X/Twitter, RSS, Reddit
- 🐦 **Post to X** — Turn blog posts or diary entries into tweets/threads, attach site images
- 🔮 **Fortune** — Chinese divination (BaZi, ZiWei, I Ching, Plum Blossom)

## Setup

**Requires Node.js 18+**.

```bash
git clone <your-repo-url>
cd my-site
./setup.sh
```

The setup script will:
- Check Node.js version
- Prompt for admin password and (optional) Claude API key
- Generate `.env.local`
- Install npm dependencies

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in at `/login`.

## Environment Variables

Required in `.env.local`:

```bash
ADMIN_PASSWORD=<set-a-strong-password>     # "changeme" is blocked in production
NEXTAUTH_SECRET=<openssl rand -base64 32>  # session signing key
NEXTAUTH_URL=http://localhost:3000         # site URL
```

Optional:

```bash
# X / Twitter (for Post to X feature)
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# Cloudflare Tunnel (for deploy)
CLOUDFLARE_TUNNEL_TOKEN=

# Optional fallback AI chat provider
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_API_HOST=https://api.anthropic.com

# Optional AI image tool
GPT_IMAGE_API_KEY=
GPT_IMAGE_API_URL=https://right.codes

# Synology NAS deploy (used by ./deploy-to-nas.sh)
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
```

AI providers are configured through the admin UI at `/admin/ai-config`. If no provider is stored in SQLite, AI chat exposes the `CLAUDE_*` environment configuration as the default provider. The Tools page also includes an AI Image tool backed by `GPT_IMAGE_API_KEY` and `GPT_IMAGE_API_URL`.

## Production

```bash
npm run build
npm start
```

Or run with Docker:

```bash
docker compose up -d
```

### Deploy to Synology NAS

`./deploy-to-nas.sh` reads the root `.env.local`, uploads that env file plus `docker-compose.nas.yml`, builds `my-site:latest` on the NAS, and runs:

```bash
docker compose --env-file .env.local -f docker-compose.nas.yml up -d
```

Required deploy vars live in `.env.local`: `NAS_HOST`, `NAS_USER`, `NAS_PATH`, `NAS_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`.
The deploy script writes timestamped logs to `log/deploy/` and always attempts to remove the remote staging directory and close SSH/SFTP sessions before exiting.

## Testing

```bash
npm test          # run once
npm run test:managed
npm run e2e
npm run e2e:headed
npm run test:watch
```

152+ tests covering all API routes, auth, rate limiting, and streaming responses.
The Playwright suite runs against `.tmp/e2e-runtime`, uses mock streaming for AI chat and fortune flows, and always goes through the managed runner so port `3001`, child processes, and temp artifacts are cleaned up after each run.

Use the managed runner when a command may leave ports or child processes behind:

```bash
npm run dev:managed
node scripts/run-managed-command.mjs --label e2e-local --clear-port 3001 -- <your-e2e-command>
```

Managed logs are written to `log/automation/`.

## Workflow Rules

- If a code change affects behavior, operations, testing, or deployment, update the relevant README/docs in the same change set.
- Finished change sets should be committed and pushed to Git instead of being left only in the local worktree.
- Reserve `./deploy-to-nas.sh` for large or release-worthy changes. Small updates should usually stop after Git push.
- After tests, e2e runs, or NAS deployments, make sure spawned processes, occupied ports, SSH/SFTP sessions, and temporary staging files are fully cleaned up.

## Migration

1. Copy the project folder including `data/` (SQLite DB), `content/` (blog markdown), `uploads/` (photos)
2. Run `./setup.sh` on the new machine
3. Start the server

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | SQLite (`better-sqlite3`) |
| Auth | NextAuth.js (credentials) |
| Styling | Tailwind CSS |
| Markdown | `react-markdown` + `gray-matter` |
| Editor | `@uiw/react-md-editor` |
| Testing | Vitest |

## Project Layout

```
my-site/
├── app/              # Next.js App Router (pages + API routes)
├── components/       # Shared React components
├── lib/              # Server utilities (db, auth, fetchers, x api, skills)
├── .codex/skills/    # AI skills (runtime source + Codex catalog)
├── content/posts/    # Blog markdown files
├── uploads/          # User-uploaded images
├── data/site.db      # SQLite database
├── docs/             # Usage, API, and development docs (EN + ZH)
└── tests/            # Vitest tests
```

## AI Skills

The app runtime reads `.codex/skills/<name>/SKILL.md` via `lib/skills.ts`.
After changing skill metadata or prompt contracts, normalize the catalog with:

```bash
npm run codex:skills
```

Built-in skills:

| Skill | Purpose |
|-------|---------|
| `article-brief` | Generate blog excerpts |
| `article-polish` | Rewrite for clarity |
| `article-tags` | Extract tags |
| `article-title` | Generate SEO titles |
| `article-translate-en` | Translate ZH → EN |
| `subscription` | News-focused brief of subscribed content |
| `blog-to-x` | Convert blog/diary → tweets/threads |
| `bazi-fortune`, `ziwei-fortune`, `liuyao-fortune`, `meihua-fortune` | Chinese divination |

See [docs/en/development.md](./docs/en/development.md#adding-an-ai-skill) for how to add your own.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `better-sqlite3` build error | `npm rebuild better-sqlite3` |
| Hydration mismatch in Nav | Make sure locale cookie matches or clear cookies |
| AI proxy rejects streaming test | Use `/api/ai-providers/test` endpoint (non-streaming) |
| X post fails with empty `{}` | Check app has Read+Write permissions, regenerate access tokens |
| Fortune streaming stops early | Increase `max_tokens` in `app/api/fortune/route.ts` |

## Documentation

- [Usage Guide](./docs/en/how-to-use.md)
- [API Reference](./docs/en/api.md)
- [Development Guide](./docs/en/development.md)

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

Personal project — feel free to fork for your own use.
