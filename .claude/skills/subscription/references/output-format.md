# Brief Output Format Reference

This document defines the exact output format for subscription briefs. The AI must follow this structure to ensure consistent, parseable output across all source categories.

## Template

```markdown
### Latest from [source_name]

**What's New** — [2-3 sentences. Lead with the single most important update. Be specific: names, numbers, dates. This is the hook — if the reader only reads this, they should get the gist.]

**Key Updates**

1. **[Concise title]** — [One sentence: what happened + why it matters. Include date if available.]
2. **[Concise title]** — [Same format.]
3. **[Concise title]** — [Same format.]
[3-6 items total, ranked by importance not chronology]

**Worth Noting** — [One sentence connecting the dots. What trend or pattern emerges? This is the "so what" — the insight the reader wouldn't get from scanning headlines.]
```

## Examples

### Good Example — X/Twitter Source

```markdown
### Latest from 宝玉's X

**What's New** — 宝玉近期密集分享AI编程工具对比和实战技巧。最重要的是一篇Claude Code vs Cursor的深度对比（获500+转发），结论是Claude Code在大型重构任务上显著领先。

**Key Updates**

1. **Claude Code vs Cursor深度对比** (4月12日) — 通过同一个React项目重构任务对比两款工具，Claude Code在理解项目上下文和跨文件修改上明显占优，但Cursor的UI交互更友好
2. **Grok 3越狱提示词** (4月10日) — 公开了一段可绕过Grok 3内容限制的系统提示词，引发安全讨论
3. **Karpathy LLM课程中文翻译** (4月8日) — 完成了Andrej Karpathy 1小时LLM入门课的双语字幕翻译，涵盖推理、训练、微调和安全

**Worth Noting** — 宝玉的内容重心正从"AI新闻转发"转向"实操指南"，反映出中文AI社区从追热点到求落地的转变。
```

### Good Example — GitHub Source

```markdown
### Latest from anthropics/claude-code

**What's New** — 过去一周发布7个版本(v2.1.101–v2.1.110)，重点新增全屏TUI模式、手机推送通知、1小时prompt缓存。发布节奏异常密集，信号明确：团队在冲刺团队级+移动端场景。

**Key Updates**

1. **全屏TUI模式** (v2.1.110, 4月15日) — 新增`/tui fullscreen`命令，无闪烁渲染，配合`autoScrollEnabled`配置使用
2. **手机推送通知** (v2.1.110, 4月15日) — Remote Control激活时可向手机推送通知，适合长时间运行任务
3. **1小时prompt缓存** (v2.1.108, 4月14日) — `ENABLE_PROMPT_CACHING_1H`环境变量支持更长缓存TTL，旧的Bedrock专用flag已废弃
4. **Session自动回顾** (v2.1.108, 4月14日) — 回到会话时自动提供上下文，可通过`/recap`手动触发
5. **团队入职指南生成** (v2.1.101, 4月10日) — `/team-onboarding`从本地使用模式生成团队上手指南

**Worth Noting** — 7天7个版本的节奏说明Claude Code正从个人终端工具转型为always-on的团队协作平台。
```

### Bad Example — Too Vague

```markdown
### Latest from some-blog

**What's New** — This blog has some interesting recent posts about technology.

**Key Updates**

1. **New post about AI** — An article was published about artificial intelligence.
2. **Another update** — Something interesting was shared.

**Worth Noting** — The blog is active.
```

Problems: no dates, no specifics, no names, "interesting" is filler, "active" says nothing.

## Rules

1. **Date everything** — "April 14" or "2 days ago", never just "recently"
2. **Name names** — People, companies, projects, version numbers
3. **Quantify** — "500+ retweets", "v2.1.110", "7 releases in 6 days"
4. **150-250 words total** — Every word earns its place
5. **Match source language** — Chinese content → Chinese brief, English → English
6. **Rank by importance** — Not chronology. Lead with what matters most.
7. **Honest about empty content** — If nothing new, say "No significant updates since last check" in one sentence. Don't pad.

## Category-Specific Guidance

| Category    | What to focus on |
|-------------|-----------------|
| `x`         | Most-engaged tweets, group by theme, note RT vs original |
| `github`    | Latest release headline changes, notable commits, ignore bots |
| `selfblog`  | Author's actual take (not just topic), what makes their view distinctive |
| `rss`       | 3-5 most recent entries, one sentence each with the core argument |
| `newsletter`| Curated highlights, editor's picks |
| `reddit`    | Top-voted posts, community sentiment (excited? skeptical?) |
| `other`     | Best-effort extraction of recent, notable content |
