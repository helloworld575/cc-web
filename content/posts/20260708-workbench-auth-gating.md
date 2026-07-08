---
title: "工作台里的一个小技巧：公开结果，隐藏动作"
date: 2026-07-08
brief: "一次很小的工作台改造：未登录用户可以看订阅摘要结果，但看不到 AI 聊天、图片生成、抓取和整合按钮。"
---

# 工作台里的一个小技巧：公开结果，隐藏动作

这次我只想记录工作台里的一个小改动：不是重做页面，也不是再堆一个 AI 功能，而是把「结果展示」和「发起动作」拆开。

场景很具体。`/tools` 是公开工作台，里面有待办、命理、AI 聊天、图片生成、订阅摘要和 skills 目录。问题在于，未登录用户也能看到 AI Chat、Image 这些入口，还能在订阅页看到抓取和整合按钮。虽然后端大部分接口已经做了鉴权，但界面上把不能用的能力展示出来，会制造误导，也会把“公开阅读”和“后台操作”混在一起。

我最后定下的规则很简单：

- 已经生成的订阅摘要可以公开展示。
- 会消耗模型、触发抓取、写入数据或删除数据的动作，只在登录后展示。
- 工作台不是后台，后台能力不要伪装成公开功能。

## 小决策：不要隐藏整个订阅页

最容易的做法是未登录时直接隐藏订阅 tab。但这样会把已经整合好的摘要也藏掉，不符合我想要的使用方式。订阅摘要本质上更像阅读结果，抓取和整合才是操作能力。

所以这里拆成两层：

- `/api/subscriptions/briefs` 的 `GET` 公开，用来读取已有结果。
- `DELETE`、`crawl`、`integrate` 继续要求登录。
- 前端订阅页保留列表，只根据登录状态隐藏动作按钮。

脱敏后的 API 形态大概是这样：

```ts
// app/api/subscriptions/briefs/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sourceId = url.searchParams.get('source_id');
  const limit = Number.parseInt(url.searchParams.get('limit') || '50');

  const rows = sourceId
    ? db.prepare('SELECT ... WHERE source_id = ? LIMIT ?').all(sourceId, limit)
    : db.prepare('SELECT ... ORDER BY fetched_at DESC LIMIT ?').all(limit);

  return Response.json(rows);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // delete stored brief
}
```

这里的小技巧是：不要用“这个页面是否公开”来决定所有接口的权限，而要按动作分类。读取结果、触发生成、删除数据，应该是三种不同的边界。

## 工作台 tab 用登录态做减法

工作台页面用 `useSession()` 读登录态，然后构造 tab 列表。未登录时，不把 AI Chat 和 Image 放进数组里；登录后再出现。

```tsx
// app/tools/page.tsx
const { status } = useSession();
const isAuthenticated = status === 'authenticated';

const tabs = [
  ['todos', t('toolsTitle')],
  ['bazi', t('bazi')],
  ...(isAuthenticated
    ? [
        ['ai-chat', t('aiChat')],
        ['image', 'Image'],
      ]
    : []),
  ['subscriptions', t('subscriptions')],
  ['skills', copy.tabLabels.skills],
] as const;
```

这比“渲染后再把按钮禁用”更干净。禁用按钮仍然会让人误以为功能在当前页面可用；直接不展示，读者看到的就是当前身份真正能做的事。

还有一个容易漏掉的细节：如果用户原本在 AI tab，session 失效后不能继续停在一个已经不可见的 tab 上。

```tsx
useEffect(() => {
  if (!isAuthenticated && (tab === 'ai-chat' || tab === 'image')) {
    setTab('todos');
  }
}, [isAuthenticated, tab]);
```

这个保护很小，但能避免 UI 状态和可见 tab 列表不一致。

## 订阅组件只隐藏动作，不隐藏结果

订阅摘要组件接收一个 `canManage`，结果列表照常渲染，抓取、整合、删除这些动作才被包起来。

```tsx
// components/SubscriptionBriefsTool.tsx
export default function SubscriptionBriefsTool({ canManage = false }) {
  return (
    <div>
      {canManage && (
        <div className="flex items-center gap-2">
          <button onClick={crawlAll}>Fetch subscriptions</button>
          <button onClick={integrateAll}>Integrate briefs</button>
        </div>
      )}

      {filteredBriefs.map(brief => (
        <article key={brief.id}>
          <a href={brief.url}>{brief.title}</a>
          <ReactMarkdown>{brief.brief}</ReactMarkdown>
          {canManage && <button onClick={() => deleteBrief(brief.id)}>Delete</button>}
        </article>
      ))}
    </div>
  );
}
```

我喜欢这个切法，因为组件职责非常清楚：它不是一个“后台订阅管理器”，而是一个“摘要阅读器，可选带管理动作”。

## 一个测试先把需求钉住

这类改动最怕的是之后又顺手把按钮放回来了。所以我给公开工作台加了一个 e2e，用 mock 的订阅摘要证明两件事：

1. 未登录看不到 AI Chat 和 Image tab。
2. 未登录仍然能看到订阅摘要结果，但看不到 Fetch 和 Integrate。

```ts
// e2e/tools-auth-gating.spec.ts
await page.goto('/tools');

await expect(page.getByTestId('tools-tab-ai-chat')).toHaveCount(0);
await expect(page.getByTestId('tools-tab-image')).toHaveCount(0);

await page.getByTestId('tools-tab-subscriptions').click();
await expect(page.getByRole('link', { name: 'Visible Brief' })).toBeVisible();
await expect(page.getByText('Public digest text from a stored result.')).toBeVisible();
await expect(page.getByRole('button', { name: 'Fetch subscriptions' })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Integrate briefs' })).toHaveCount(0);
```

这个测试不关心页面长什么样，只关心权限边界是否被正确呈现。对个人工作台来说，这比截图测试更有价值。

## 可复用的小技巧

这次改动有几个可以复用的点：

- 如果一个页面同时有公开结果和私有动作，先把它们拆成 `canRead` 和 `canManage`，不要只用一个大开关。
- 对公开页面，优先隐藏不可用动作，而不是展示一个永远会失败的按钮。
- API 权限按动作分层：`GET`、`POST`、`DELETE` 不一定共享同一套开放程度。
- e2e 不一定要测完整流程，可以 mock 结果，只验证公开页面该显示什么、不该显示什么。

## 验证

这次我实际跑了这些检查：

```bash
npm test -- tests/api/subscriptions/briefs.test.ts
node scripts/run-managed-command.mjs --label playwright-e2e-tools-auth-green --clear-port 3001 -- node ./node_modules/playwright/cli.js test e2e/tools-auth-gating.spec.ts
```

前一个测试保证未登录也能读取已有订阅摘要，删除仍然需要登录。后一个测试保证公开工作台隐藏 AI 和订阅操作入口，同时继续展示订阅摘要结果。

这个改动很小，但它让工作台的边界更清楚：公开页面负责展示，登录态负责操作。个人工具越做越多时，这种边界比单个按钮的样式更重要。
