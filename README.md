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

# Synology NAS deploy (used by ./deploy-to-nas.sh)
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
```

AI providers are configured through the admin UI at `/admin/ai-config` — no env var needed.

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

## Testing

```bash
npm test          # run once
npm run test:watch
```

152+ tests covering all API routes, auth, rate limiting, and streaming responses.

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
├── .claude/skills/   # AI skills (used by web app + Claude Code)
├── content/posts/    # Blog markdown files
├── uploads/          # User-uploaded images
├── data/site.db      # SQLite database
├── docs/             # Usage, API, and development docs (EN + ZH)
└── tests/            # Vitest tests
```

## AI Skills

The app runtime still reads `.claude/skills/<name>/SKILL.md` via `lib/skills.ts`.
For Codex-native discovery, mirror those skills into `.codex/skills/` with:

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

Personal project — feel free to fork for your own use.
