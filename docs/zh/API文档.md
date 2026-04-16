# API 文档

本站所有 API 端点的完整参考。

## 身份验证

除 `/api/auth/*` 和 `/api/uploads/*` 外，所有 `/api/*` 端点均需要有效的 NextAuth 会话。

通过 `POST /api/auth/callback/credentials`（密码为 `ADMIN_PASSWORD`）登录。

错误响应：
- `401 Unauthorized` — 未登录
- `429 Too Many Requests` — 超过频率限制（按 IP，不同端点限额不同）

---

## 博客

### `GET /api/blog`
返回所有博客元数据。

```json
[
  { "slug": "...", "title": "...", "date": "...", "brief": "..." }
]
```

### `GET /api/blog/[slug]`
返回完整文章，包含 markdown 正文。

### `POST /api/blog`
创建新文章。
```json
{ "slug": "my-post", "title": "...", "date": "2026-04-16", "content": "...", "brief": "..." }
```

### `PUT /api/blog/[slug]` / `DELETE /api/blog/[slug]`
更新 / 删除文章。

---

## 日记

### `GET /api/diary`
列出所有日记。

### `POST /api/diary`
```json
{ "date": "2026-04-16", "content": "markdown 内容" }
```

### `GET /api/diary/[id]` / `PUT /api/diary/[id]` / `DELETE /api/diary/[id]`

---

## 待办

### `GET /api/todos`
列出所有待办。

### `POST /api/todos`
```json
{ "text": "买牛奶", "deadline": "2026-04-20" }
```

### `PUT /api/todos/[id]` / `DELETE /api/todos/[id]`

---

## 文件（图片）

### `GET /api/files`
分页列出文件，支持筛选。

Query 参数：`page`、`pageSize`（最大 100）、`search`、`from`、`to`、`album_id`

### `POST /api/files`
上传图片。`multipart/form-data` 格式，字段 `file`，可选 `album_id`。

允许后缀：`.jpg`、`.jpeg`、`.png`、`.gif`、`.webp`

### `GET /api/uploads/<filename>`
公开端点，返回文件内容，带长期缓存。

---

## AI 服务商

### `GET /api/ai-providers`
列出配置的服务商（API key 会打码）。

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
轻量连接测试。Body：`{"provider_id": 1}`。返回 `{"ok": true, "text": "...", "model": "..."}`。

---

## AI 对话

### `POST /api/ai-chat`
流式聊天端点，返回 SSE（`text/event-stream`）。

```json
{
  "provider_id": 1,
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

每个 SSE 事件：`data: {"text": "片段"}\n\n`

---

## 订阅

### `GET /api/subscriptions` / `POST /api/subscriptions`
管理订阅源。

```json
{ "name": "Hacker News", "url": "https://news.ycombinator.com", "category": "other", "enabled": 1, "fetch_interval": 3600 }
```

### `POST /api/subscriptions/fetch`
抓取内容并生成 AI 摘要。

```json
{ "source_id": 1 }   // 省略则抓取全部
```

### `GET /api/subscriptions/briefs`
列出生成的摘要。Query 参数 `source_id` 可过滤。

### `DELETE /api/subscriptions/briefs?id=<id>`

---

## X / Twitter

### `POST /api/x-post`

**单条推文（JSON）：**
```json
{ "text": "hello world" }
```

**推文串（JSON）：**
```json
{ "thread": ["1/ 第一条", "2/ 第二条", "3/ 第三条"] }
```

**带图片（multipart/form-data）：**
- 字段 `text` — 推文正文
- 字段 `images` — 最多 4 张图片文件

### `GET /api/x-auth`
检查访问令牌是否已配置。

---

## 频率限制

按 IP 的每分钟请求限额：

| 端点组 | 限额 |
|--------|-----|
| `ai-chat` | 30 |
| `ai-providers` | 20 |
| `subscriptions` | 20 |
| `subscriptions-fetch` | 5 |
| `x-post` | 10 |
| `ai-test` | 10 |

超限返回 `429 Too Many Requests`。

---

## 技能系统

技能是带 YAML frontmatter 的 markdown 文件，位于 `.claude/skills/<name>/SKILL.md`：

```yaml
---
name: my-skill
description: 此技能的作用
system: "发给 AI 的 system prompt"
prompt: "带 {{content}} 占位符的用户 prompt 模板"
output: content
---
```

使用场景：
- 博客编辑器（`article-brief`、`article-polish`、`article-tags`、`article-title` 等）
- 订阅抓取器（`subscription` 技能生成摘要）
- Post to X（`blog-to-x` 技能生成推文）
