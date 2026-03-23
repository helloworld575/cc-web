# AI Features Configuration

This project has AI-powered blog tools using the Claude API.

## Setup

Add your Claude API key to `.env.local`:

```
CLAUDE_API_KEY=sk-ant-...
```

## Available Skills

Call `POST /api/ai` with `{ skill, content }`:

| Skill | Description |
|-------|-------------|
| `polish` | Rewrites blog content to be more engaging and well-structured |
| `brief` | Generates a 1-2 sentence excerpt for the blog list page |
| `title` | Suggests 3 SEO-friendly titles (returns JSON array) |
| `tags` | Suggests 5 relevant tags (returns JSON array) |

## Usage in Admin Editor

The admin blog editor (`/admin/blog/[slug]`) has an AI panel with buttons for each skill.
Results are applied directly to the relevant fields.
