# How to Use — ThomasLee's Site

A guide to using the features of this personal site.

## Table of Contents

1. [Public Features](#public-features)
2. [Admin Features](#admin-features)
3. [AI Chat](#ai-chat)
4. [Subscriptions](#subscriptions)
5. [Post to X](#post-to-x)
6. [Fortune Tools](#fortune-tools)

---

## Public Features

### Theme

- Use the desktop theme control or the mobile navigation drawer to switch between light and dark modes.
- The first visit follows the operating system preference; an explicit choice is stored in `localStorage` and restored on reload.

### Blog

- Browse all posts at `/blog`
- Search posts by title or brief using the search bar
- Posts default to newest first; use the sort selector to switch to oldest first
- Lists are paginated at 10 posts per page after search and sorting
- Click any post title to read the full article
- Publication dates follow the selected English or Chinese locale without timezone shifts
- Article Markdown uses the editor-compatible GFM presentation for tables, task lists, strikethrough, and automatic links

### Files

- View public files/photos at `/files`
- Organized by albums
- Photos are served via the CDN-friendly `/uploads/<filename>` path with long-term caching

### Tools (at `/tools`)

Five tabs available to all logged-in users:

- **Todos** — Quick task list with done/pending filters
- **Diary** — Date-based diary entries with markdown support
- **Fortune** — Chinese divination tools (Bazi, Ziwei, I Ching, Plum Blossom)
- **AI Chat** — Chat with configured AI providers and reopen saved conversation history
- **Subscriptions** — AI-generated briefs of subscribed content

---

## Admin Features

Access the admin panel at `/admin/*` after logging in with your password.

Admin pages:

| Page | Purpose |
|------|---------|
| `/admin/blog` | Create, edit, and delete blog posts with markdown editor |
| `/admin/diary` | Manage diary entries |
| `/admin/tools` | Manage todo list |
| `/admin/files` | Upload photos, organize into albums |
| `/admin/skills` | Edit AI skills (system prompts, templates) |
| `/admin/ai-config` | Configure AI providers (OpenAI, Anthropic) |
| `/admin/subscriptions` | Add/edit/delete subscription sources |
| `/admin/x-post` | Post to X/Twitter with AI-generated tweets |

---

## AI Chat

1. Go to **Admin → AI Config**
2. Click **+ New Provider**
3. Use a Right Code preset or fill in:
   - **Name** — e.g., "Claude"
   - **API Type** — `openai` or `anthropic`
   - **API URL** — base URL (e.g., `https://www.right.codes/codex` or `https://www.right.codes/claude`)
   - **API Key** — your secret key
   - **Model** — e.g., `gpt-5.5` or `claude-opus-4-8`
4. Check **Set as default** for at least one provider
5. Click **Test Connection** to verify
6. Click **Save**

Then go to **Tools → AI Chat** and select your provider from the dropdown. If `CLAUDE_API_KEY` or `RIGHT_CODE_GPT_API_KEY` is set in `.env.local`, env-backed providers stay at the top and the first configured env provider stays as the default while saved providers remain selectable. Right Code GPT-5.5 uses the Responses API at `https://www.right.codes/codex/v1/responses`; saved presets can keep the base URL `https://www.right.codes/codex` because the backend detects it automatically. Completed chats are saved automatically, grouped by provider, and can be reopened or deleted from the history list. The chat panel keeps the composer anchored while the message timeline scrolls, can expand to fullscreen, and markdown tables or fenced CSV/TSV output render as readable tables. Full transcripts stay in history, while only the recent conversation window is sent to the upstream model to reduce context usage.

---

## Subscriptions

Track latest updates from blogs, GitHub repos, X accounts, and more.

### Adding a source

1. Go to **Admin → Subscriptions**
2. Click **+ New Source**
3. Fill in:
   - **Name** — display name
   - **URL** — the source URL
   - **Subscription topic** — `AI` or `Security`
   - **Category** — fetch type such as `rss`, `github`, `selfblog`, `newsletter`, or `reddit`
   - **Fetch interval** — source metadata; daily publishing uses the configured Shanghai schedule
4. Click **Save**

### Viewing briefs

1. Go to **Tools → Subscriptions**
2. Click **Refresh All** to fetch and summarize latest content
3. AI-generated briefs show:
   - **What's New** — headline summary
   - **Key Updates** — 3-6 ranked items
   - **Worth Noting** — trend insight

Each brief is generated using the `subscription` skill, powered by your default AI provider.

The daily scheduler is independent of manual briefs. After crawling finishes it publishes one AI post and one security post. The body always retains explicit, clickable references and uses source-grounded facts; editorial judgment is confined to the intro.

---

## Post to X

Generate and post tweets from your blog posts or diary entries.

1. Go to **Admin → Post to X**
2. Pick source: **Blog Posts**, **Diary**, or **Custom**
3. Select an item (or paste custom text)
4. Click **🤖 Generate Tweet with AI** — produces single tweet or thread
5. Edit the tweet(s) if needed (character count shown)
6. Attach images:
   - **📁 From computer** — pick local files
   - **🖼️ From site files** — pick from your uploaded photos
7. Click **🐦 Post to X**

### Requirements

- Set `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` in `.env.local`
- Your X app must have **Read and Write** permissions

---

## Fortune Tools

Four Chinese divination methods in **Tools → Fortune**:

- **Bazi (八字)** — Four Pillars analysis from birth date/time
- **Ziwei (紫微斗数)** — Purple Star astrology
- **I Ching (周易六爻)** — Hexagram divination
- **Plum Blossom (梅花易数)** — Number-based quick reading

Each method uses an AI skill for detailed interpretation.
