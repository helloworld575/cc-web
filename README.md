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
- 📰 **Subscriptions** — Manage web/RSS sources, fetch manually, and review stored briefs
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

# Optional sec_ai_tool integration (deployed separately)
# SECURITY_API_URL=http://127.0.0.1:3001
SECURITY_API_KEY=

# Optional fallback Claude provider (rightapi.ai messages API by default)
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-opus-4-8
CLAUDE_API_HOST=https://www.rightapi.ai/claude
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
RIGHT_CODE_GPT_API_URL=https://www.rightapi.ai/codex
RIGHT_CODE_GPT_MODEL=gpt-5.5
RIGHT_CODE_GPT_MAX_TOKENS=32000
RIGHT_CODE_GPT_API_STYLE=responses

# Optional AI image tool
GPT_IMAGE_API_KEY=
GPT_IMAGE_API_URL=https://www.rightapi.ai/draw
GPT_IMAGE_MODEL=gpt-image-2-pro
GPT_IMAGE_API_MODE=images
GPT_IMAGE_GROUP=vip_2_image

# Synology NAS deploy (used by ./deploy-to-nas.sh)
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
CONTAINER_LOG_MAX_SIZE=10m
CONTAINER_LOG_MAX_FILES=5
```

AI providers are temporarily env-only. `/admin/ai-config` is a read-only verification page for the Claude and Right Code GPT providers configured in `.env.local`; POST/PUT/DELETE provider APIs return 403. By default Claude calls use `https://www.rightapi.ai/claude/v1/messages`, send Anthropic-style text blocks with ephemeral cache control, and stream tokens back to the UI as SSE. AI chat limits provider connection setup to 30 seconds, waits up to 60 seconds for the first visible text, and ends a stream after 30 seconds without additional visible text; override those defaults with `AI_CHAT_CONNECT_TIMEOUT_MS`, `AI_CHAT_FIRST_TOKEN_TIMEOUT_MS`, and `AI_CHAT_STREAM_IDLE_TIMEOUT_MS`. Right Code GPT-5.5 calls use the Responses API at `https://www.rightapi.ai/codex/v1/responses`, send `input_text` message blocks, and stream SSE responses back to the chat UI. AI chat stores full transcripts but sends only the recent conversation window upstream to reduce model context usage. The admin UI also exposes `/admin/claude-code`, which calls an internal Claude Code worker through `/api/claude-code`. Personal-assistant conversations are stored in SQLite; the server owns each Claude session UUID, starts the first turn with `--session-id`, resumes later turns with `--resume`, and locks the workspace for the lifetime of a conversation. The worker maps `CLAUDE_API_KEY`, `CLAUDE_API_HOST`, and `CLAUDE_MODEL` into Claude Code's Anthropic environment variables, defaults to a personal-assistant system prompt, and returns only user-facing text. Docker Compose persists both `/workspaces` and Claude's `/home/claude/.claude` session state. The Tools page also includes an AI Image tool backed by `GPT_IMAGE_API_KEY` and `GPT_IMAGE_API_URL`; it defaults to the rightapi.ai native `/v1/images/generations` endpoint. Set `GPT_IMAGE_API_MODE=chat` only for legacy chat-completions image gateways that still need `GPT_IMAGE_GROUP`.

AI upstream failures are normalized to bounded JSON error codes. Proxy HTML, provider diagnostics, internal hosts, and raw exception messages are never returned to the browser. Image reference files are resized in the browser and encoded as WebP before upload to reduce request latency.

WeChat sources require an administrator to provide a legitimate HTTPS RSS feed in Admin → Subscriptions, such as an RSSHub or WeChat2RSS feed that the administrator operates or has permission to use. The app does not claim official WeChat support and does not automatically scrape or bypass platform restrictions. Recommended accounts to verify before adding a feed include Tencent Security/Xuanwu, Alibaba Security Response, Changting, NSFOCUS, and Qi-Anxin.

Public discovery is exposed through `/sitemap.xml`, `/robots.txt`, and `/feed.xml`. Blog detail pages publish canonical, Open Graph, Twitter, and `BlogPosting` JSON-LD metadata from the saved article fields. Admin, API, tools, and login surfaces are excluded from the sitemap and return `X-Robots-Tag: noindex, nofollow, noarchive`. The navigation theme control switches between light and dark surfaces, follows the system preference on first visit, and persists an explicit choice locally.

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

### Optional security service

`sec_ai_tool` is a separately deployed second-party service. Keep its source,
Compose project, runner image, artifact/state volumes, egress policy, and
frontend independent from this repository. The sibling repository includes the
workbench at `/app/` and the API on the same origin; follow its
`docs/nas-cc-web.md` deployment contract and bind it to a separate local port
(default `3001`). Do not copy the sibling source into this deployment package
or attach its runner to cc-web's public network.

When cc-web needs a server-side integration, set a dedicated endpoint and key in
`.env.local`:

```dotenv
SECURITY_API_URL=http://127.0.0.1:3001
SECURITY_API_KEY=<a-random-key-configured-in-sec_ai_tool>
```

Authenticated administrators call `/api/security/...`; the Next.js BFF accepts
only the documented security API paths and GET/POST methods, injects the key on
the server, streams uploads and downloads, and strips cookies, incoming
authorization, forwarding headers, and internal response headers. The browser
never receives the service key. If the security endpoint or key is absent, the
BFF returns `503 SECURITY_NOT_CONFIGURED` and the main site remains available.

For containerized cc-web, `127.0.0.1` means the app container. Use a dedicated
DNS/LAN endpoint or a reviewed reverse proxy reachable from that container when
the two Compose projects run on the same NAS. Keep the security service's
allowlist and controlled egress settings in its own environment file; static,
API, and domain assessments must retain its fail-closed authorization and
egress policy.

### Local/offline development without NAS

The base Next.js application, unit tests, lint, and production build do not
require NAS access, SSH credentials, a Cloudflare Tunnel token, the `sec_ai_tool`
repository, or a Docker daemon. With the normal local `.env.local`, use:

```bash
npm run dev
npm test
npm run lint
npm run build
```

Leave the optional security variables empty for this path. The authenticated
`/api/security/*` BFF is still present, but when the endpoint or server-side key
is absent it returns `503` with `SECURITY_NOT_CONFIGURED`; that is an expected
configuration state, not a scanner finding. A full `docker compose up` is a
separate deployment workflow:
the Claude worker and `cloudflared` require their own credentials and external
services, so it is not the offline development entry point. When Docker is
unavailable, `docker compose config` can still validate YAML, while `build` and
`up` require both the Docker client and a running engine.

### Deploy to Synology NAS

`./deploy-to-nas.sh` reads the root `.env.local`, uploads that env file plus `docker-compose.nas.yml`, builds `my-site:latest` and `my-site-claude-worker:latest` on the NAS, and runs:

```bash
docker compose --env-file .env.local -f docker-compose.nas.yml up -d
```

Required deploy vars live in `.env.local`: `NAS_HOST`, `NAS_USER`, `NAS_PATH`, `NAS_PASSWORD`, and `CLOUDFLARE_TUNNEL_TOKEN`. Claude Code worker deployment also requires `CLAUDE_API_KEY`; `CLAUDE_API_HOST` and `CLAUDE_MODEL` are optional overrides. The NAS stack contains the app, Claude worker, and Cloudflare tunnel; there is no subscription scheduler. Generated posts use a persistent writable directory layered over the immutable posts bundled in the image, so both sets survive container upgrades.

The NAS deployment package contains only cc-web, its worker, and its
Cloudflare Tunnel. It does not copy or build `../sec_ai_tool`; deploy that
repository separately (for example under `/volume1/docker/sec-ai-tool`) with
its own `runner/docker-compose.nas.yml`, immutable runner image, environment,
egress network, and volumes. The sibling NAS profile binds its frontend/API to
loopback port `3001` by default, so it can run alongside cc-web's port `3000`.
Use a dedicated hostname or reviewed reverse proxy for external access, and
keep `/app/`, `/v1`, `/health`, and `/docs` on the security service origin.
The two deploy scripts can be run independently and neither stages the other
repository.

Container logs use the `json-file` driver with explicit rotation: 10 MB per file and 5 files per service by default. Override these limits with `CONTAINER_LOG_MAX_SIZE` and `CONTAINER_LOG_MAX_FILES`. Deployment verifies the effective logging driver and limits on every NAS container.

Use the sanitized NAS log collector before diagnosing production issues:

```bash
npm run nas:logs
npm run nas:logs -- --service app --service claude-worker --since 1h --grep "ai-chat|claude"
```

Snapshots are written to `log/nas/`. AI Chat, Claude worker, and subscription crawl logs are one-line JSON containing a `request_id`, event name, duration, result counts or output size, and safe error codes. Prompts, credentials, authorization headers, and raw upstream bodies are excluded or redacted. Correlate the same `request_id` across app and worker logs when investigating a request.
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

The current suite contains 390 Vitest tests across 65 files plus 38 Playwright e2e flows covering API routes, auth, rate limiting, streaming responses, editors, uploads, skills, subscriptions, and the tools workspace.
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
| AI image never starts | Default `GPT_IMAGE_API_URL` should point at a native images base such as `https://www.rightapi.ai/draw`; set `GPT_IMAGE_API_MODE=chat` only for legacy `/v1/chat/completions` gateways |
| X post fails with empty `{}` | Check app has Read+Write permissions, regenerate access tokens |
| Fortune streaming stops early | Increase `CLAUDE_MAX_TOKENS` in `.env.local` |

## Documentation

- [Usage Guide](./docs/en/how-to-use.md)
- [API Reference](./docs/en/api.md)
- [Development Guide](./docs/en/development.md)

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

Personal project — feel free to fork for your own use.
