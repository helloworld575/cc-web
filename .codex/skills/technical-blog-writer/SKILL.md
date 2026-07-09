---
name: technical-blog-writer
description: >-
  Write practical technical blog posts for ThomasLee's site. Use when Codex
  needs to draft a Chinese or English technical blog, implementation note, build
  diary, feature walkthrough, debugging post, NAS deployment note, AI workflow
  case study, or any blog post that should avoid broad summaries and instead
  include concrete tips, sanitized code snippets, file paths, tests, and
  operational details.
invocable: true
hierarchy:
  domain: content
  category: article
  subcategory: technical-blog
  path:
    - content
    - article
    - technical-blog
  order: 8
lookup:
  invoke: content/article/technical-blog-writer
  aliases:
    - technical blog writer
    - blog writing
    - 技术博客
    - 博客撰写
  keywords:
    - blog
    - technical writing
    - code snippet
    - implementation
    - 技术博客
    - 脱敏代码
prompt:
  output: text
  mode: transform
  template: |-
    Write a practical technical blog post from this implementation context.

    Topic:
    {{topic}}

    Context:
    {{content}}
---
# Technical Blog Writer

Write narrow, useful technical posts that feel like a working engineer's notebook, not a project brochure.
The default register is objective technical analysis: precise claims, bounded scope, implementation details, and source-backed statements.

## Workflow

1. Pick one small implementation slice. Prefer a page, component, API route, deployment script, test, or bug fix over the whole project.
2. Gather concrete facts: touched files, symptoms, constraints, command output, test names, route names, database tables, and deployment behavior.
3. Build the article around the reader's next reusable move: what can be copied, adapted, measured, or verified?
4. Include sanitized code snippets only when they teach a tactic. Keep snippets short and label what was removed.
5. End with verification: tests, smoke checks, screenshots, logs, or observable behavior.
6. When external documents, release notes, papers, or benchmark reports are used, record the source title, publisher or authors, publication date, URL, and the exact claim supported by that source.

## Article Shape

Use this structure by default:

- Title: specific implementation outcome, not a slogan.
- Opening: one concrete problem and why it hurt.
- "The small decision": the constraint or trade-off that shaped the solution.
- "Implementation notes": 2-4 sections, each centered on a file, API, component, or command.
- "Reusable tips": bullets that the reader can apply elsewhere.
- "Verification": commands run and the exact behavior checked.
- "References": required when the post uses external documents, official release notes, papers, or benchmark reports.

Skip sections that would become filler. A 700-word useful post is better than a 2,000-word recap.

## Code Snippets

Snippet rules:

- Show 8-30 lines, not entire files.
- Prefer code that reveals a pattern: auth gating, streaming parser, cache boundary, test setup, deployment check, or UI state split.
- Replace secrets, domains, IPs, passwords, tokens, and private paths with placeholders such as `<NAS_HOST>`, `<API_KEY>`, or `<ADMIN_PASSWORD>`.
- Add a one-sentence explanation before or after each snippet.
- Do not paste generated logs unless a short excerpt teaches the debugging point.

Good snippet framing:

```tsx
// Sanitized: only the state split matters here.
const canManage = status === 'authenticated';
return <SubscriptionBriefsTool canManage={canManage} />;
```

Bad snippet framing:

```text
Here is the whole component...
```

## Style Rules

- Avoid broad claims like "AI changes everything", "full-stack productivity leap", or "from zero to one" unless the post proves it with a concrete mechanism.
- Prefer objective construction such as "The implementation changes X because Y fails under Z" over first-person narration.
- Reduce first-person and second-person pronouns, including "I", "we", "you", "我", "我们", "你", and "你们", unless they appear in quoted material, UI text, or code comments that must be preserved.
- Avoid vague qualifiers such as "maybe", "probably", "roughly", "approximately", "大概", "可能", "似乎", and "差不多" unless the uncertainty is material and explicitly bounded.
- Avoid subjective evaluation terms such as "很好", "优秀", "惊艳", "舒服", "good", or "great" unless tied to a measurement, benchmark, user study, or observed behavior.
- Avoid metaphorical or imprecise verbs such as "pin down", "钉住", "打磨", and similar wording when a concrete verb is available. Prefer "constrain", "validate", "serialize", "paginate", "rate-limit", "normalize", "render", "persist", "deploy", or the domain-specific action.
- Use technical terminology when it describes the actual mechanism: API contract, schema migration, streaming parser, SSE event, backpressure, idempotency, pagination boundary, rate limit, cache invalidation, auth gate, evaluation harness, benchmark protocol, model card, system card, or deployment artifact.
- State claims as inspectable propositions: input, method, output, metric, limitation, and verification path.
- Name files and routes inline: `app/tools/page.tsx`, `/api/subscriptions/briefs`.
- Mention tests by name when available.
- Use Chinese by default for ThomasLee's blog unless the user asks for English.
- Keep the tone technical, concise, and evidence-oriented. The target shape is closer to an applied engineering paper than casual conversation.

## References

When sources are used:

- Add a final section named `## 参考资料` for Chinese posts or `## References` for English posts.
- Each entry must include: title, publisher or authors, date when available, URL, and one sentence explaining which claim or technical detail the source supports.
- Prefer primary sources: official documentation, model cards, system cards, release notes, benchmark papers, source repositories, and standards documents.
- Mark secondary sources explicitly when used, and do not use them to support technical claims that can be verified from a primary source.
- Do not include a source that was not actually opened or inspected.

## Final Checklist

Before publishing or returning the draft, verify:

- The post is about one small thing.
- At least two practical tips are included.
- At least one sanitized code snippet is included when code changed.
- No secrets, real API keys, raw passwords, private tokens, or sensitive internal URLs are present.
- The verification section says what was actually run or checked.
- Referenced documents are listed in the final references section with URLs and claim-level relevance.
