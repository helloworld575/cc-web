# ThomasLee 的博客

基于 **Next.js 16** 和 **SQLite** 的个人博客与工具箱。

📖 [English](./README.md) · 📚 [完整文档](./docs/zh/)

## 功能

- 📝 **博客** — TOAST UI Markdown 编辑器，支持预览、图片上传和 AI 辅助编辑
- 📒 **日记** — 按日期记录的私人日记，支持 markdown
- ✅ **待办** — 任务列表，支持截止日期
- 🖼️ **文件** — 图片上传，按相册组织
- 🤖 **AI 对话** — 多服务商聊天（OpenAI + Anthropic），支持流式响应和历史记录
- 📰 **订阅** — 定时抓取网页/RSS，按需整合 AI 摘要
- 🐦 **发布到 X** — 把博客或日记转成推文/推文串，可附加站点图片
- 🔮 **命理** — 中国传统占卜（八字、紫微、六爻、梅花易数）

## 安装

**需要 Node.js 20.19+**。

```bash
git clone <仓库地址>
cd my-site
./setup.sh
```

安装脚本会：
- 检查 Node.js 版本
- 询问管理员密码和 Claude API key（可选）
- 生成 `.env.local`
- 使用 `npm ci` 安装锁定版本的 npm 依赖
- 创建 SQLite、博客内容和上传目录

启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，登录地址 `/login`。

## 环境变量

`.env.local` 必填：

```bash
ADMIN_PASSWORD=<设置强密码>                 # 生产环境禁止使用 "changeme"
NEXTAUTH_SECRET=<openssl rand -base64 32>  # 会话签名密钥
NEXTAUTH_URL=http://localhost:3000         # 站点 URL
```

可选：

```bash
# X / Twitter（发布到 X 功能）
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# Claude 默认 AI 对话服务商（可选）
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-opus-4-8
CLAUDE_API_HOST=https://www.right.codes/claude
CLAUDE_MAX_TOKENS=32000
AI_CHAT_CONNECT_TIMEOUT_MS=30000
AI_CHAT_FIRST_TOKEN_TIMEOUT_MS=60000
AI_CHAT_STREAM_IDLE_TIMEOUT_MS=30000
CLAUDE_CODE_WORKER_URL=http://claude-worker:8787
CLAUDE_PERMISSION_MODE=dontAsk
CLAUDE_ALLOWED_TOOLS=Read,Glob,Grep
CLAUDE_DISALLOWED_TOOLS=Bash,Edit,Write,NotebookEdit

# Right Code GPT-5.5（可选）
RIGHT_CODE_GPT_API_KEY=
RIGHT_CODE_GPT_API_URL=https://www.right.codes/codex
RIGHT_CODE_GPT_MODEL=gpt-5.5
RIGHT_CODE_GPT_MAX_TOKENS=32000
RIGHT_CODE_GPT_API_STYLE=responses

# AI 生图工具（可选）
GPT_IMAGE_API_KEY=
GPT_IMAGE_API_URL=https://www.right.codes/draw
GPT_IMAGE_MODEL=gpt-image-2-pro
GPT_IMAGE_API_MODE=images
GPT_IMAGE_GROUP=vip_2_image

# Cloudflare Tunnel（部署用）
CLOUDFLARE_TUNNEL_TOKEN=

# Synology NAS 部署（./deploy-to-nas.sh 读取）
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
SUBSCRIPTION_CRON_SECRET=
SUBSCRIPTION_DAILY_HOUR=8
SUBSCRIPTION_CRON_REQUEST_TIMEOUT_MS=600000
CONTAINER_LOG_MAX_SIZE=10m
CONTAINER_LOG_MAX_FILES=5
```

AI 服务商暂时改为 `.env.local` 只读配置。`/admin/ai-config` 只展示并测试 Claude 与 Right Code GPT，新增、编辑、删除 provider API 会返回 403。Claude 默认调用 `https://www.right.codes/claude/v1/messages` 和 `claude-opus-4-8`。AI 对话默认允许 30 秒建立上游连接、60 秒等待首个可见文本，并在连续 30 秒没有新可见文本时结束流；可通过 `AI_CHAT_CONNECT_TIMEOUT_MS`、`AI_CHAT_FIRST_TOKEN_TIMEOUT_MS`、`AI_CHAT_STREAM_IDLE_TIMEOUT_MS` 调整。AI 对话会保存完整历史，但只把最近的对话窗口发送给上游模型，以降低上下文占用。生图默认调用 right.codes 原生 `/v1/images/generations`；只有旧网关需要 chat-completions 时才设置 `GPT_IMAGE_API_MODE=chat`。

所有 AI 上游失败都会转换成长度受限的 JSON 错误码，浏览器不会收到代理 HTML、服务商诊断、内部地址或底层异常文本。参考图会先在浏览器缩放并转为 WebP，再发送到生图接口。

订阅现在把内容主题（`ai` 或 `security`）与抓取类型（`rss`、`github` 等）分开。由于现有 X 源不稳定，系统会初始化公开 RSS/Atom 替代源。`/api/subscriptions/crawl` 逐条保存原文链接、来源、首次发现时间和发布时间，并使用稳定 external ID 避免更新后重复入库。`/api/subscriptions/daily` 会等待抓取完成，再按上海自然日各发布一篇 AI 日报和安全日报。片头是唯一允许编辑判断的区域；正文由可核实条目和可点击原文链接确定性渲染，AI 服务异常或代理 HTML 不会写进日报。每日主题状态可保证重试幂等。手动 AI 摘要仍由 `/api/subscriptions/integrate` 提供，旧 `/api/subscriptions/fetch` 是兼容入口。

微信订阅需要管理员在“管理 — 订阅”中手动提供合法的 HTTPS RSS 地址，例如由管理员自行部署或确认来源的 RSSHub、WeChat2RSS feed。系统不提供官方微信接口，也不会自动抓取或绕过平台限制；推荐先核验腾讯安全/玄武、阿里安全响应、长亭、绿盟、奇安信等账号的授权 feed，再录入 URL。

网站通过 `/sitemap.xml`、`/robots.txt` 和 `/feed.xml` 提供公开发现入口。博客详情页以已保存的文章字段生成 canonical、Open Graph、Twitter 和 `BlogPosting` JSON-LD 元数据；管理端、API、工具页和登录页不进入 sitemap，并返回 `X-Robots-Tag: noindex, nofollow, noarchive`。导航栏支持浅色/深色主题切换，首次访问遵循系统偏好，主动选择会保存在本地。

## 质量门禁

使用以下检查保持代码风格和架构一致：

```bash
npm run lint          # 格式、架构和 TypeScript 检查
npm run verify        # lint + API/单元测试 + 生产构建
npm run verify:large  # verify + 完整 Playwright e2e
```

架构审查 agent 的说明位于 `.codex/agents/architecture-reviewer.md`。

## 生产部署

```bash
npm run build
npm start
```

或使用 Docker：

```bash
docker compose up -d
```

### 部署到群晖 NAS

现在可以直接运行 `./deploy-to-nas.sh`。脚本会读取根目录 `.env.local`，上传环境文件和 `docker-compose.nas.yml`，在 NAS 上构建 `my-site:latest`，然后执行：

```bash
docker compose --env-file .env.local -f docker-compose.nas.yml up -d
```

部署所需变量统一放在 `.env.local`：`NAS_HOST`、`NAS_USER`、`NAS_PATH`、`NAS_PASSWORD`、`CLOUDFLARE_TUNNEL_TOKEN`。NAS compose 会额外启动 `subscription-cron`，在 `Asia/Shanghai` 时区的 `SUBSCRIPTION_DAILY_HOUR`（默认 08:00）调用 `/api/subscriptions/daily`。建议配置独立的 `SUBSCRIPTION_CRON_SECRET`，兼容回退值为 `ADMIN_PASSWORD`。自动文章写入持久目录，并与镜像内置文章分层读取，因此容器升级后两类文章都不会丢失。
部署日志会按时间写入 `log/deploy/`，脚本退出前会尽量清理远端暂存目录并关闭 SSH / SFTP 会话。

容器日志统一使用带轮转的 `json-file` 驱动，默认每个文件 10 MB、每个服务保留 5 个文件；可用 `CONTAINER_LOG_MAX_SIZE` 和 `CONTAINER_LOG_MAX_FILES` 调整。部署脚本会验证 NAS 上每个容器实际生效的日志驱动和容量限制。

排查生产问题前先采集经过脱敏的 NAS 日志：

```bash
npm run nas:logs
npm run nas:logs -- --service app --service claude-worker --since 1h --grep "ai-chat|claude"
```

日志快照保存在 `log/nas/`。AI Chat、Claude worker 和订阅抓取使用单行 JSON 日志，包含 `request_id`、事件、耗时、结果数量或输出大小以及安全错误码；不会记录提示词、凭据、Authorization 请求头或原始上游响应。排查单次请求时，应使用同一个 `request_id` 关联 app 与 worker 日志。

使用 Cloudflare 时，建议为 `/uploads/*` 和 `/_next/image*` 配置一年边缘缓存；`/_next/image*` 的缓存键保留 `url`、`w`、`q` 参数。`/api/*` 与 `/admin/*` 必须绕过缓存。上传文件接口已经提供 immutable 缓存头、ETag 与 Range 支持。

## 测试

```bash
npm test          # 跑一次
npm run test:managed
npm run e2e
npm run e2e:headed
npm run test:watch
```

当前包含 42 个文件中的 238 项 Vitest 测试，以及 23 条 Playwright e2e 流程，覆盖 API、认证、频率限制、流式响应、编辑器、上传和工具工作台。

如果本地命令可能留下监听端口或子进程，优先使用受控执行入口：

```bash
npm run dev:managed
node scripts/run-managed-command.mjs --label e2e-local --clear-port 3000 -- <你的 e2e 命令>
```

受控执行日志会写到 `log/automation/`。

## 工作规则

- 只要改动影响功能、运维、测试或部署流程，就要在同一组变更里同步更新 README / 文档。
- 一组已完成的改动不应只停留在本地工作区，应提交并推送到 Git。
- `./deploy-to-nas.sh` 只用于大改动、发布级变更或明确要求的 NAS 部署，小改动通常到 Git 推送为止。
- 测试、e2e 和 NAS 部署结束后，要确认相关进程、占用端口、SSH / SFTP 会话以及临时目录都已彻底清理。

## 迁移

1. 复制项目文件夹，包含 `data/`（SQLite 数据库）、`content/`（博客 markdown）、`uploads/`（图片）
2. 在新机器上运行 `./setup.sh`
3. 启动服务器

## 技术栈

| 分层 | 选型 |
|------|------|
| 框架 | Next.js 16（App Router）|
| 语言 | TypeScript |
| 数据库 | SQLite（`better-sqlite3`）|
| 认证 | NextAuth.js（credentials）|
| 样式 | Tailwind CSS |
| Markdown | `react-markdown` + `gray-matter` |
| 编辑器 | `@toast-ui/editor` |
| 测试 | Vitest |

## 项目结构

```
my-site/
├── app/              # Next.js App Router（页面 + API）
├── components/       # 共享 React 组件
├── lib/              # 服务端工具（db、auth、fetchers、x api、skills）
├── .codex/skills/    # AI 技能（运行时源 + Codex 技能目录）
├── content/posts/    # 博客 markdown 文件
├── uploads/          # 用户上传图片
├── data/site.db      # SQLite 数据库
├── docs/             # 使用 / API / 开发文档（中英文）
└── tests/            # Vitest 测试
```

## AI 技能

AI 行为以可复用的"技能"定义在 `.codex/skills/<name>/SKILL.md`。修改 skill 元数据或 prompt contract 后，可运行 `npm run codex:skills` 做一次规范化。内置技能：

| 技能 | 用途 |
|------|------|
| `article-brief` | 生成博客摘要 |
| `article-polish` | 润色改写 |
| `article-tags` | 提取标签 |
| `article-title` | 生成 SEO 标题 |
| `article-translate-en` | 中译英 |
| `subscription` | 订阅源的新消息摘要 |
| `blog-to-x` | 博客 / 日记 → 推文 / 推文串 |
| `bazi-fortune`、`ziwei-fortune`、`liuyao-fortune`、`meihua-fortune` | 命理占卜 |

如何新增技能见 [docs/zh/开发指南.md](./docs/zh/开发指南.md#添加-ai-技能)。

## 常见问题

| 问题 | 解决方法 |
|------|---------|
| `better-sqlite3` 编译失败 | `npm rebuild better-sqlite3` |
| 导航栏 hydration 不匹配 | 确保 locale cookie 正确，或清除 cookie |
| AI 代理拒绝流式测试 | 用 `/api/ai-providers/test` 端点（非流式）|
| 生图返回服务商拒绝或无权限 | 检查 `GPT_IMAGE_API_KEY` 是否开通 draw/image 渠道；页面会隐藏上游 HTML，只显示安全错误 |
| 发 X 推文返回空 `{}` | 确认 App 权限为 Read+Write，重新生成 access token |
| 命理流式响应中途停止 | 增大 `app/api/fortune/route.ts` 中的 `max_tokens` |

## 文档

- [使用指南](./docs/zh/使用指南.md)
- [API 文档](./docs/zh/API文档.md)
- [开发指南](./docs/zh/开发指南.md)

## 授权

本项目采用 MIT License，详见 [LICENSE](./LICENSE)。

个人项目 —— 欢迎 fork 自用。
