# ThomasLee's Blog

Personal blog & toolbox built with **Next.js 16** and **SQLite**.

📖 [中文版](./README.zh-CN.md) · 📚 [Full docs](./docs/en/)

## Features

- 📝 **Blog** — TOAST UI Markdown editor with preview, image uploads, and AI-assisted editing
- 📒 **Diary** — Private date-based journal with markdown
- ✅ **Todos** — Task list with deadlines
- 🖼️ **Files** — Image uploads organized into albums
- 🤖 **AI Chat** — Multi-provider chat (OpenAI + Anthropic) with streaming history
- **Claude Code Worker** — Admin-only web UI that proxies prompts to an isolated Claude Code worker container
- 📰 **Subscriptions** — Scheduled web/RSS crawling with on-demand AI briefs
- 🐦 **Post to X** — Turn blog posts or diary entries into tweets/threads, attach site images
- 🔮 **Fortune** — Chinese divination (BaZi, ZiWei, I Ching, Plum Blossom)

## Setup

**Requires Node.js 20.19+**.

```bash
git clone <your-repo-url>
cd my-site
./setup.sh
```

The setup script will:
- Check Node.js version
- Prompt for admin password and (optional) Claude API key
- Generate `.env.local`
- Install locked npm dependencies with `npm ci`
- Create the SQLite, content, and upload directories

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

# Optional fallback Claude provider (right.codes messages API by default)
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-opus-4-8
CLAUDE_API_HOST=https://www.right.codes/claude
CLAUDE_MAX_TOKENS=32000
AI_CHAT_CONNECT_TIMEOUT_MS=30000
AI_CHAT_FIRST_TOKEN_TIMEOUT_MS=60000
AI_CHAT_STREAM_IDLE_TIMEOUT_MS=30000
CLAUDE_CODE_WORKER_URL=http://claude-worker:8787
CLAUDE_PERMISSION_MODE=dontAsk
CLAUDE_ALLOWED_TOOLS=Read,Glob,Grep
CLAUDE_DISALLOWED_TOOLS=Bash,Edit,Write,NotebookEdit
CLAUDE_SYSTEM_PROMPT=You are ThomasLee's personal assistant.

# Optional Right Code GPT-5.5 provider
RIGHT_CODE_GPT_API_KEY=
RIGHT_CODE_GPT_API_URL=https://www.right.codes/codex
RIGHT_CODE_GPT_MODEL=gpt-5.5
RIGHT_CODE_GPT_MAX_TOKENS=32000
RIGHT_CODE_GPT_API_STYLE=responses

# Optional AI image tool
GPT_IMAGE_API_KEY=
GPT_IMAGE_API_URL=https://www.right.codes/draw
GPT_IMAGE_MODEL=gpt-image-2-pro
GPT_IMAGE_API_MODE=images
GPT_IMAGE_GROUP=vip_2_image

# Synology NAS deploy (used by ./deploy-to-nas.sh)
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
SUBSCRIPTION_CRON_SECRET=
SUBSCRIPTION_CRON_INTERVAL_SECONDS=86400
```

AI providers are temporarily env-only. `/admin/ai-config` is a read-only verification page for the Claude and Right Code GPT providers configured in `.env.local`; POST/PUT/DELETE provider APIs return 403. By default Claude calls use `https://www.right.codes/claude/v1/messages`, send Anthropic-style text blocks with ephemeral cache control, and stream tokens back to the UI as SSE. AI chat limits provider connection setup to 30 seconds, waits up to 60 seconds for the first visible text, and ends a stream after 30 seconds without additional visible text; override those defaults with `AI_CHAT_CONNECT_TIMEOUT_MS`, `AI_CHAT_FIRST_TOKEN_TIMEOUT_MS`, and `AI_CHAT_STREAM_IDLE_TIMEOUT_MS`. Right Code GPT-5.5 calls use the Responses API at `https://www.right.codes/codex/v1/responses`, send `input_text` message blocks, and stream SSE responses back to the chat UI. AI chat stores full transcripts but sends only the recent conversation window upstream to reduce model context usage. The admin UI also exposes `/admin/claude-code`, which calls an internal Claude Code worker through `/api/claude-code`. The worker maps `CLAUDE_API_KEY`, `CLAUDE_API_HOST`, and `CLAUDE_MODEL` into Claude Code's Anthropic environment variables, defaults to a personal-assistant system prompt, and returns plain text rather than Claude Code JSON events. The Tools page also includes an AI Image tool backed by `GPT_IMAGE_API_KEY` and `GPT_IMAGE_API_URL`; it defaults to the right.codes native `/v1/images/generations` endpoint. Set `GPT_IMAGE_API_MODE=chat` only for legacy chat-completions image gateways that still need `GPT_IMAGE_GROUP`.

AI upstream failures are normalized to bounded JSON error codes. Proxy HTML, provider diagnostics, internal hosts, and raw exception messages are never returned to the browser. Image reference files are resized in the browser and encoded as WebP before upload to reduce request latency.

Subscriptions now separate crawling from AI summarization. `/api/subscriptions/crawl` fetches RSS/blog/GitHub/X/Reddit content into `subscription_items` without calling AI. `/api/subscriptions/integrate` reads the latest stored items and creates `subscription_briefs` with the provider-neutral `subscription` skill. The old `/api/subscriptions/fetch` endpoint remains as a compatibility alias for integration.

## Quality Gates

Use these checks to keep code style and architecture consistent:

```bash
npm run lint          # format, architecture, and TypeScript checks
npm run verify        # lint + API/unit tests + production build
npm run verify:large  # verify + full Playwright e2e suite
```

The architecture reviewer instructions live at `.codex/agents/architecture-reviewer.md`.

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

`./deploy-to-nas.sh` reads the root `.env.local`, uploads that env file plus `docker-compose.nas.yml`, builds `my-site:latest` and `my-site-claude-worker:latest` on the NAS, and runs:

```bash
docker compose --env-file .env.local -f docker-compose.nas.yml up -d
```

Required deploy vars live in `.env.local`: `NAS_HOST`, `NAS_USER`, `NAS_PATH`, `NAS_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`. Claude Code worker deployment also requires `CLAUDE_API_KEY`; `CLAUDE_API_HOST` and `CLAUDE_MODEL` are optional overrides. NAS compose also starts `subscription-cron`, which calls `/api/subscriptions/crawl` daily. Set `SUBSCRIPTION_CRON_SECRET` for a dedicated bearer token, or it will fall back to `ADMIN_PASSWORD`; adjust the cadence with `SUBSCRIPTION_CRON_INTERVAL_SECONDS`.
The deploy script writes timestamped logs to `log/deploy/` and always attempts to remove the remote staging directory and close SSH/SFTP sessions before exiting.

For Cloudflare, add cache rules for `/uploads/*` and `/_next/image*` with a one-year edge TTL. Keep the `url`, `w`, and `q` query parameters in the cache key for `/_next/image*`. Bypass cache for `/api/*` and `/admin/*`. Uploaded files already send immutable browser/CDN cache headers, ETags, and range support.

## Testing

```bash
npm test          # run once
npm run test:managed
npm run e2e
npm run e2e:headed
npm run test:watch
```

The current suite contains 238 Vitest tests across 42 files plus 23 Playwright e2e flows covering API routes, auth, rate limiting, streaming responses, editors, uploads, and the tools workspace.
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
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite (`better-sqlite3`) |
| Auth | NextAuth.js (credentials) |
| Styling | Tailwind CSS |
| Markdown | `react-markdown` + `gray-matter` |
| Editor | `@toast-ui/editor` |
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
| AI image returns a provider or invalid-response error | Check `GPT_IMAGE_API_URL` and account image-channel permission; raw upstream HTML is intentionally hidden |
| AI image never starts | Default `GPT_IMAGE_API_URL` should point at a native images base such as `https://www.right.codes/draw`; set `GPT_IMAGE_API_MODE=chat` only for legacy `/v1/chat/completions` gateways |
| X post fails with empty `{}` | Check app has Read+Write permissions, regenerate access tokens |
| Fortune streaming stops early | Increase `CLAUDE_MAX_TOKENS` in `.env.local` |

## Documentation

- [Usage Guide](./docs/en/how-to-use.md)
- [API Reference](./docs/en/api.md)
- [Development Guide](./docs/en/development.md)

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

Personal project — feel free to fork for your own use.
