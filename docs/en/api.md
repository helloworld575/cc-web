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

Returns the created todo row:
```json
{ "id": 1, "text": "buy milk", "done": 0, "deadline": "2026-04-20", "created_at": "2026-04-25 12:00:00" }
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

Response:
```json
{ "ok": true, "filename": "uuid.png", "url": "/uploads/uuid.png" }
```

### `GET /uploads/<filename>`

`/api/uploads/<filename>` remains the internal rewrite target for compatibility. Public pages should use `/uploads/<filename>` so CDN rules can match one stable path.
Public endpoint — serves the uploaded file with long-term caching.

---

## AI Providers

### `GET /api/ai-providers`
List configured providers (API keys are masked). If `CLAUDE_API_KEY` or `RIGHT_CODE_GPT_API_KEY` is set in `.env.local`, env-backed providers are included first and the first configured env provider remains the default.

### `POST /api/ai-providers`
```json
{
  "name": "Claude",
  "api_type": "anthropic",
  "api_url": "https://www.right.codes/claude",
  "api_key": "sk-...",
  "model": "claude-opus-4-8",
  "system_prompt": "",
  "max_tokens": 32000,
  "is_default": true
}
```

### `PUT /api/ai-providers/[id]` / `DELETE /api/ai-providers/[id]`

When an env-backed provider is present, newly saved or updated database providers are stored as non-default even if `is_default` is submitted.

### `POST /api/ai-providers/test`
Lightweight connection test. Body: `{"provider_id": 1}`. Use `{"provider_id": -1}` to test the env-backed Claude provider or `{"provider_id": -2}` to test the env-backed Right Code GPT-5.5 provider. Right Code GPT-5.5 is tested through `https://www.right.codes/codex/v1/responses`. Returns `{"ok": true, "text": "...", "model": "..."}`.

---

## Claude Code

### `GET /api/claude-code`
Returns the latest 50 saved personal-assistant conversations for the signed-in administrator. Claude session UUIDs and message bodies are not included in the list response.

### `GET /api/claude-code/:id`
Returns one saved conversation with its user-facing message history. Internal Claude session UUIDs are never returned to the browser.

### `DELETE /api/claude-code/:id`
Deletes an idle conversation. A conversation with an active turn returns `409 CLAUDE_CHAT_BUSY`.

### `POST /api/claude-code`
Admin-only proxy to the internal Claude Code worker. The browser calls the site; the site forwards the request to `CLAUDE_CODE_WORKER_URL`. The first turn creates a server-owned conversation and Claude session; later turns provide only the numeric `chat_id`.

Request body:

```json
{ "message": "Summarize this workspace", "cwd": "default" }
```

Follow-up request:

```json
{ "chat_id": 12, "message": "Now list the three highest risks" }
```

Successful responses use `text/plain`, include `X-Claude-Chat-ID`, and contain only user-facing text. The workspace cannot change after the first turn. Failed and cancelled turns do not overwrite the last successful transcript. Docker Compose sets the worker URL to `http://claude-worker:8787` and persists the worker's Claude session directory.

---

## AI Image

### `POST /api/ai-image`
Generate an image with the configured `GPT_IMAGE_API_URL` / `GPT_IMAGE_API_KEY`. By default the backend calls the right.codes native images endpoint at `/v1/images/generations` and returns JSON to the browser. Set `GPT_IMAGE_API_MODE=chat` only for legacy gateways that require `/v1/chat/completions`.

Request body:

```json
{
  "prompt": "Generate a product photo",
  "reference_image": "data:image/png;base64,..."
}
```

`reference_image` is optional and must be a PNG, JPG, or WebP data URL.

Upstream request shape:

```json
{
  "model": "gpt-image-2-pro",
  "prompt": "<prompt>",
  "image": "data:image/png;base64,...",
  "size": "1024x1024",
  "response_format": "url"
}
```

Override the default model with `GPT_IMAGE_MODEL`.

In native image mode, `image` and `size` are optional. In legacy chat mode, `GPT_IMAGE_GROUP` is sent both as the `group` request field and the `New-Api-Group` header for New API compatible gateways.

If the upstream image service returns HTML, invalid JSON, an empty body, or a provider error, the route returns bounded JSON containing a safe `code` and `error`. Raw HTML, provider diagnostics, internal hosts, and exception messages are not exposed.

---

## AI Chat

### `GET /api/ai-chat`
List saved chat summaries, newest first. Optional query param: `provider_id`.

```json
[
  { "id": 1, "provider_id": 1, "title": "Hello", "created_at": "...", "updated_at": "..." }
]
```

### `POST /api/ai-chat`
Streaming chat endpoint. Returns SSE (`text/event-stream`) and saves the completed transcript to `ai_chat_history`. The stored transcript remains complete, but the upstream model request is compacted to the recent conversation window. Right Code GPT-5.5 providers with base URL `https://www.right.codes/codex` use the Responses API (`/v1/responses`) and stream `response.output_text.delta` events.

```json
{
  "chat_id": 1,
  "provider_id": 1,
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

The first SSE event can include `data: {"chat_id": 1}\n\n`; content events use `data: {"text": "chunk"}\n\n`.

### `GET /api/ai-chat/[id]`
Return a saved chat with parsed `messages`.

### `PUT /api/ai-chat/[id]` / `DELETE /api/ai-chat/[id]`
Update or delete a saved chat.

---

## Subscriptions

### `GET /api/subscriptions` / `POST /api/subscriptions`
Manage subscription sources.

```json
{ "name": "AI News", "url": "https://example.com/feed.xml", "category": "rss", "topic": "ai", "enabled": 1, "fetch_interval": 86400 }
```

### `POST /api/subscriptions/crawl`
Fetch content into `subscription_items` without calling AI.

```json
{ "source_id": 1 }   // or omit for all enabled sources
```

### `POST /api/subscriptions/integrate`
Generate AI briefs from stored crawl items. The endpoint returns HTTP 503 when no AI provider is available. Per-source failures are returned with `success: false` and are never persisted in `subscription_briefs`.

`POST /api/subscriptions/fetch` remains a compatibility alias for `/api/subscriptions/integrate`.

### `POST /api/subscriptions/daily`
Cron/admin endpoint that crawls all enabled sources first, then idempotently publishes one `ai` and one `security` blog post for the current `Asia/Shanghai` date. Daily post bodies contain deterministic facts and clickable source links; only the intro may contain editorial judgment.

### `GET /api/subscriptions/briefs`
List generated briefs, including both fetch `category` and content `topic`. Query param `source_id` to filter.

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

Skills are markdown files in `.codex/skills/<name>/SKILL.md` with YAML frontmatter:

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
