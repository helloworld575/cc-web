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

### Blog

- Browse all posts at `/blog`
- Search posts by title or content using the search bar
- Filter by date range
- Click any post title to read the full article
- Each post includes: title, date, brief, tags, and full content in markdown

### Files

- View public files/photos at `/files`
- Organized by albums
- Photos are served via `/api/uploads/<filename>` with long-term caching

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
3. Fill in:
   - **Name** — e.g., "Claude"
   - **API Type** — `openai` or `anthropic`
   - **API URL** — base URL (e.g., `https://api.anthropic.com`)
   - **API Key** — your secret key
   - **Model** — e.g., `claude-opus-4-6` or `gpt-4o`
4. Check **Set as default** for at least one provider
5. Click **Test Connection** to verify
6. Click **Save**

Then go to **Tools → AI Chat** and select your provider from the dropdown. Completed chats are saved automatically, grouped by provider, and can be reopened from the history list.

---

## Subscriptions

Track latest updates from blogs, GitHub repos, X accounts, and more.

### Adding a source

1. Go to **Admin → Subscriptions**
2. Click **+ New Source**
3. Fill in:
   - **Name** — display name
   - **URL** — the source URL
   - **Category** — `github`, `x`, `selfblog`, `rss`, `newsletter`, `reddit`, or `other`
   - **Fetch interval** — seconds between auto-fetches (default 3600 = 1 hour)
4. Click **Save**

### Viewing briefs

1. Go to **Tools → Subscriptions**
2. Click **Refresh All** to fetch and summarize latest content
3. AI-generated briefs show:
   - **What's New** — headline summary
   - **Key Updates** — 3-6 ranked items
   - **Worth Noting** — trend insight

Each brief is generated using the `subscription` skill, powered by your default AI provider.

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
