# API Documentation

Complete reference for all API endpoints in this site.

## Authentication

All `/api/*` endpoints (except `/api/auth/*` and `/api/uploads/*`) require a valid NextAuth session.

Log in via `POST /api/auth/callback/credentials` with password `ADMIN_PASSWORD`.

Responses:
- `401 Unauthorized` — no session
- `429 Too Many Requests` — rate limit exceeded (per-IP, varies by endpoint)

---

## Blog

### `GET /api/blog`
Returns all blog post metadata.

```json
[
  { "slug": "...", "title": "...", "date": "...", "brief": "..." }
]
```

### `GET /api/blog/[slug]`
Returns full post including markdown content.

### `POST /api/blog`
Create a new post.
```json
{ "slug": "my-post", "title": "...", "date": "2026-04-16", "content": "...", "brief": "..." }
```

### `PUT /api/blog/[slug]` / `DELETE /api/blog/[slug]`
Update/delete a post.

---

## Diary

### `GET /api/diary`
List all diary entries.

### `POST /api/diary`
```json
{ "date": "2026-04-16", "content": "markdown content" }
```

### `GET /api/diary/[id]` / `PUT /api/diary/[id]` / `DELETE /api/diary/[id]`

---

## Todos

### `GET /api/todos`
List all todos.

### `POST /api/todos`
```json
{ "text": "buy milk", "deadline": "2026-04-20" }
```

### `PUT /api/todos/[id]` / `DELETE /api/todos/[id]`

---

## Files (Photos)

### `GET /api/files`
List files with pagination and filters.

Query params: `page`, `pageSize` (max 100), `search`, `from`, `to`, `album_id`

### `POST /api/files`
Upload an image. Uses `multipart/form-data` with field `file` and optional `album_id`.

Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

### `GET /api/uploads/<filename>`
Public endpoint — serves the uploaded file with long-term caching.

---

## AI Providers

### `GET /api/ai-providers`
List configured providers (API keys are masked).

### `POST /api/ai-providers`
```json
{
  "name": "Claude",
  "api_type": "anthropic",
  "api_url": "https://api.anthropic.com",
  "api_key": "sk-...",
  "model": "claude-opus-4-6",
  "system_prompt": "",
  "max_tokens": 4096,
  "is_default": true
}
```

### `PUT /api/ai-providers/[id]` / `DELETE /api/ai-providers/[id]`

### `POST /api/ai-providers/test`
Lightweight connection test. Body: `{"provider_id": 1}`. Returns `{"ok": true, "text": "...", "model": "..."}`.

---

## AI Chat

### `POST /api/ai-chat`
Streaming chat endpoint. Returns SSE (`text/event-stream`).

```json
{
  "provider_id": 1,
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

Each SSE event: `data: {"text": "chunk"}\n\n`

---

## Subscriptions

### `GET /api/subscriptions` / `POST /api/subscriptions`
Manage subscription sources.

```json
{ "name": "Hacker News", "url": "https://news.ycombinator.com", "category": "other", "enabled": 1, "fetch_interval": 3600 }
```

### `POST /api/subscriptions/fetch`
Fetch content and generate AI briefs.

```json
{ "source_id": 1 }   // or omit for all
```

### `GET /api/subscriptions/briefs`
List generated briefs. Query param `source_id` to filter.

### `DELETE /api/subscriptions/briefs?id=<id>`

---

## X / Twitter

### `POST /api/x-post`

**Single tweet (JSON):**
```json
{ "text": "hello world" }
```

**Thread (JSON):**
```json
{ "thread": ["1/ first", "2/ second", "3/ third"] }
```

**Tweet with images (multipart/form-data):**
- Field `text` — tweet text
- Field `images` — up to 4 image files

### `GET /api/x-auth`
Check whether access tokens are configured.

---

## Rate Limits

Per-IP limits (requests per minute):

| Endpoint group | Limit |
|----------------|-------|
| `ai-chat` | 30 |
| `ai-providers` | 20 |
| `subscriptions` | 20 |
| `subscriptions-fetch` | 5 |
| `x-post` | 10 |
| `ai-test` | 10 |

Exceeded → `429 Too Many Requests`.

---

## Skills System

Skills are markdown files in `.claude/skills/<name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: What this skill does
system: "System prompt sent to the AI"
prompt: "User prompt template with {{content}} placeholder"
output: content
---
```

Used by:
- Blog editor (`article-brief`, `article-polish`, `article-tags`, `article-title`, etc.)
- Subscription fetcher (`subscription` skill for generating briefs)
- Post to X (`blog-to-x` skill for tweet generation)
