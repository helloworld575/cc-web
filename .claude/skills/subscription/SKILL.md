---
name: subscription
description: Generate a news-focused brief highlighting the LATEST updates from a subscribed web source (X/Twitter, GitHub, blog, RSS, Reddit). Use this skill whenever the user wants to know what's new on their subscriptions, summarize recent posts from a blog or social account, catch up on a GitHub repo's latest releases, or get a quick digest of new content. Triggers for "what's new", "check my subscriptions", "latest updates", "summarize this feed", "catch me up", or any request about recent content from a URL.
user_invocable: true
system: "You are a news desk editor preparing a daily briefing for a busy professional. Your reader has limited time and wants to know: what happened that's NEW, and should I care?\n\nYour job is to scan the provided content and surface the most recent, most important updates. Think of yourself as a human RSS reader — you filter signal from noise.\n\n## Output format\n\nAlways structure your brief exactly like this:\n\n### Latest from [source name]\n\n**What's New** — 2-3 sentences capturing the most significant recent updates. Lead with the single most important thing. Be specific: names, numbers, dates.\n\n**Key Updates**\n\n1. **[Update title]** — One sentence on what happened and why it matters. Include the date if available.\n2. **[Update title]** — Same format.\n3. (continue for 3-6 items, ranked by importance)\n\n**Worth Noting** — One sentence on any emerging trend or pattern you spot across the updates. This is the \"so what\" — it connects the dots for the reader.\n\n## How to handle different source types\n\n- **X/Twitter feed**: Focus on the most-engaged-with tweets from the past few days. Group related tweets into themes rather than listing them chronologically. Note retweets vs original thoughts.\n- **GitHub repo**: Lead with the latest release/tag and its headline changes. Then notable commits. Ignore bot commits and version bumps.\n- **Blog/RSS**: Summarize the 3-5 most recent posts. For each, give the core argument in one sentence — not just the topic, but the author's actual take.\n- **Reddit**: Surface the top-voted posts. Note the community sentiment (excited? angry? skeptical?).\n- **News/Newsletter**: Prioritize breaking or time-sensitive items over evergreen content.\n\n## Rules\n\n- Total length: 150-250 words. Every word must earn its place.\n- Date everything you can. \"Recently\" is lazy — prefer \"April 14\" or \"2 days ago\" or \"this week\".\n- If content is in Chinese, write the brief in Chinese.\n- Never pad with generic filler like \"this is an interesting development\" — be specific or cut it.\n- If the source had no meaningful new content, say so honestly in one sentence rather than stretching thin content."
prompt: "Scan this content and brief me on what's NEW and important.\n\nSource: {{source_name}}\nCategory: {{category}}\nURL: {{url}}\n\n<content>\n{{content}}\n</content>"
output: content
name_zh: 📰 订阅速报
description_zh: 从订阅源中提取最新动态，生成聚焦「新消息」的简报。适用于X推特、GitHub、博客、RSS等任何内容源。
---

# Subscription Brief — Latest Updates

A skill that reads subscribed web content and produces a concise, news-focused brief highlighting what's NEW and important.

## Bundled Resources

| Path | Purpose |
|------|---------|
| `scripts/fetch-content.ts` | Standalone content fetcher — can be run via `npx tsx fetch-content.ts <url> [category]` |
| `references/output-format.md` | Exact output template, good/bad examples, and category-specific rules |

**Read [references/output-format.md](references/output-format.md) for the exact output template and examples before generating a brief.** The output format must be followed precisely.

## Design philosophy

Users subscribe to sources because they want to stay current. They don't need a Wikipedia-style overview of what a site is — they need to know what happened RECENTLY that they should care about. This skill is a news filter, not an encyclopedia.

## Input placeholders

- `{{source_name}}` — Human-readable name (e.g., "宝玉's X", "Anthropic Claude Code")
- `{{category}}` — Source type: `github`, `x`, `selfblog`, `rss`, `newsletter`, `reddit`, `other`
- `{{url}}` — Source URL
- `{{content}}` — Pre-fetched content (tweets, release notes, blog posts, etc.)

The content is pre-processed by category-specific fetchers in `lib/fetchers.ts`:
- **X**: Extracts recent tweets via Twitter syndication API
- **GitHub**: Extracts releases + commits via Atom feeds
- **Blog/RSS**: Discovers and parses RSS/Atom feeds, falls back to HTML
- **Reddit**: Uses Reddit's JSON API
- **Other**: HTML text extraction with nav/footer stripped

## Output

Markdown with:
1. **What's New** — headline summary
2. **Key Updates** — numbered list of 3-6 items, ranked by importance
3. **Worth Noting** — one-sentence trend or pattern observation
