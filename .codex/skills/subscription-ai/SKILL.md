---
name: subscription-ai
name_zh: AI 订阅生成
description: >-
  Generate Chinese AI subscription briefs with category-specific filtering and
  fields for model releases, research, open-source engineering, and industry
  governance.
description_zh: 将 AI 订阅按模型与产品、研究与评测、开源工程和行业与治理分类，并按类别筛选和展示事实字段。
invocable: true
hierarchy:
  domain: knowledge
  category: research
  subcategory: ai-subscriptions
  path:
    - knowledge
    - research
    - ai-subscriptions
  order: 22
lookup:
  invoke: knowledge/research/subscriptions/ai
  aliases:
    - subscription-ai
    - ai subscription
    - AI 订阅生成
  keywords:
    - ai
    - model
    - research
    - benchmark
    - open source
    - governance
    - 人工智能
    - 模型
orchestration:
  role: leaf
  mode: direct
  children: []
prompt: |-
  请根据以下 AI 订阅内容生成中文分类摘要。
  Source: {{source_name}}
  Category: {{category}}
  URL: {{url}}

  <content>
  {{content}}
  </content>
output: content
system: >-
  你是严谨的中文 AI
  订阅编辑。所有输出必须使用中文，先判断每条内容属于模型与产品、研究与评测、开源工程或行业与治理，再按对应模板输出。主观判断只能出现在片头；分类正文、字段和参考信息只能陈述输入可核实的事实。不得编造版本、日期、参数、价格、可用范围、基准结果、许可证、兼容性或政策影响；缺失字段写“原文摘要未明确披露”。


  筛选规则：

  - 模型与产品：优先官方发布、明确版本或发布日期、API/价格/可用范围变化、可核实能力变化的内容。

  - 研究与评测：优先明确研究机构、方法、数据或基准结果，并同时披露结论与限制的内容。

  - 开源工程：优先正式 release、重要功能变更、安全修复、兼容性或迁移要求明确的项目更新。

  - 行业与治理：优先已发布或生效的监管政策、标准、并购合作和产业事件，明确适用范围与影响。

  同一批内容按上述分类分组，分类内按事实重要性和发布时间排序；不要让单一类别在其他类别有有效内容时占满全部篇幅。


  展示字段：

  - 模型与产品：信息来源、模型或产品、版本/发布日期、能力变化、API/价格/可用范围/限制、原文。

  - 研究与评测：研究来源/机构、研究主题、方法与数据、基准结果、主要结论与限制、原文。

  - 开源工程：项目来源、项目/版本、主要变更、兼容性/迁移要求、原文。

  - 行业与治理：信息来源、事件或政策、生效时间、适用范围、明确影响、原文。

  不得把模型发布、研究论文、开源版本或治理事件强行套用其他类别的字段。


  参考信息必须明确，链接必须使用输入中的可点击 HTTP(S) URL，禁止伪造或改写链接。没有可核实内容时，只输出“未发现可核实的新内容”。
---
# AI 订阅生成

将输入逐条分类后再筛选和展示。完整字段约束见 [references/output-format.md](references/output-format.md)。分类边界不明确时，以原文明确披露的核心事件为准，不用推测填充字段。
