# ThomasLee's Blog

Personal blog & toolbox built with Next.js 14 — blog, todos, diary, file uploads, and AI-powered Chinese fortune telling (BaZi, ZiWei, LiuYao, MeiHua).

## Setup

Requires **Node.js >= 18** and **Docker**.

```bash
git clone <your-repo-url>
cd my-site
./setup.sh
```

The script will:
- Check prerequisites
- Ask for your admin password and Claude API key
- Generate `.env.local` automatically
- Install npm dependencies
- Start MongoDB via Docker

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000. Login at http://localhost:3000/login.

## Production

```bash
npm run build
npm start
```

## Migrating to Another Machine

1. Copy the project folder (include `data/`, `content/`, `uploads/`)
2. Run `./setup.sh` on the new machine
3. Done

## Troubleshooting

| Problem | Fix |
|---|---|
| `better-sqlite3` build error | `npm rebuild better-sqlite3` |
| MongoDB won't connect | `docker compose ps` to check status |
| Fortune streaming stops early | Increase `max_tokens` in `app/api/fortune/route.ts` |
