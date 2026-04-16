# Tweet Output Format Reference

## JSON Output Schema

The skill must output **only** valid JSON — no markdown fences, no commentary.

### Single tweet
```json
{"mode": "single", "tweet": "Your tweet text here (≤280 chars)"}
```

### Thread
```json
{
  "mode": "thread",
  "tweets": [
    "1/ Hook tweet — the most compelling point",
    "2/ Supporting detail",
    "3/ More context",
    "4/ Call to action or link"
  ]
}
```

## Character Counting

- X counts characters, not bytes — CJK characters = 1 character each
- URLs are shortened to 23 characters regardless of actual length
- Emojis = variable (most are 2 characters in X's counting)
- **Safe limit: 270 characters** to leave room for counting edge cases

## Thread Examples

### Good — Blog post about a technical discovery

```json
{
  "mode": "thread",
  "tweets": [
    "1/ 今天发现一个让 Claude Code 效率翻倍的技巧：用 CLAUDE.md 记录项目上下文\n\n不是简单的 README，而是写给 AI 的"项目记忆"——包含架构决策、命名规范、常见坑",
    "2/ 实测效果：\n- 首次对话就能理解项目结构\n- 不再重复问"用什么框架"\n- 代码风格自动保持一致\n\n省了大量来回解释的时间",
    "3/ 关键是写法：不要写文档式的说明，要写成"如果你是新来的工程师，第一天需要知道什么"\n\n具体模板和写法见博客 👇\nhttps://thomaslee.site/blog/claude-md-tips"
  ]
}
```

### Good — Short diary insight as single tweet

```json
{"mode": "single", "tweet": "调试了一整天的 bug，最后发现是时区问题 🤦\n\n教训：所有日期存 UTC，显示时再转本地时区。听起来是常识，但每次都要重新学一遍"}
```

### Bad — Too generic, no hook

```json
{"mode": "single", "tweet": "写了一篇新博客，讲了一些技术内容，感兴趣的可以看看"}
```
Problem: No specific content, no reason to click, no value in the tweet itself.

## Style Principles

1. **Hook first** — Lead with the result, insight, or surprise. NOT "I wrote a post about..."
2. **Be specific** — "提升了40%性能" beats "性能提升很多"
3. **Standalone value** — Each tweet should deliver value even without clicking the link
4. **Natural voice** — Write like you're texting a smart friend, not writing a press release
5. **Language match** — Chinese blog → Chinese tweets, English → English
