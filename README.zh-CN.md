# ThomasLee 的博客

基于 **Next.js 14** 和 **SQLite** 的个人博客与工具箱。

📖 [English](./README.md) · 📚 [完整文档](./docs/zh/)

## 功能

- 📝 **博客** — 大尺寸 Markdown 编辑器，支持工具栏、预览开关和 AI 辅助编辑
- 📒 **日记** — 按日期记录的私人日记，支持 markdown
- ✅ **待办** — 任务列表，支持截止日期
- 🖼️ **文件** — 图片上传，按相册组织
- 🤖 **AI 对话** — 多服务商聊天（OpenAI + Anthropic），支持流式响应和历史记录
- 📰 **订阅** — 定时抓取网页/RSS，按需整合 AI 摘要
- 🐦 **发布到 X** — 把博客或日记转成推文/推文串，可附加站点图片
- 🔮 **命理** — 中国传统占卜（八字、紫微、六爻、梅花易数）

## 安装

**需要 Node.js 18+**。

```bash
git clone <仓库地址>
cd my-site
./setup.sh
```

安装脚本会：
- 检查 Node.js 版本
- 询问管理员密码和 Claude API key（可选）
- 生成 `.env.local`
- 安装 npm 依赖

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

# Claude default AI chat provider (optional)
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_API_HOST=https://api.anthropic.com

# AI Image tool (optional)
GPT_IMAGE_API_KEY=
GPT_IMAGE_API_URL=https://right.codes

# Cloudflare Tunnel（部署用）
CLOUDFLARE_TUNNEL_TOKEN=

# Synology NAS 部署（./deploy-to-nas.sh 读取）
NAS_HOST=
NAS_USER=
NAS_PATH=/volume1/docker/my-site
NAS_PASSWORD=
SUBSCRIPTION_CRON_SECRET=
SUBSCRIPTION_CRON_INTERVAL_SECONDS=86400
```

AI 服务商暂时改为 `.env.local` 只读配置。`/admin/ai-config` 只展示并测试 Claude 与 Right Code GPT，新增、编辑、删除 provider API 会返回 403。AI 对话会保存完整历史，但只把最近的对话窗口发送给上游模型，以降低上下文占用。

订阅现在拆成抓取和整合两步：`/api/subscriptions/crawl` 抓取 RSS、博客、GitHub、X、Reddit 等内容并写入 `subscription_items`，不调用 AI；需要摘要时再点平台上的“整合摘要”，由 `/api/subscriptions/integrate` 读取已抓取内容并生成 `subscription_briefs`。旧 `/api/subscriptions/fetch` 保留为整合入口的兼容别名。

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

部署所需变量统一放在 `.env.local`：`NAS_HOST`、`NAS_USER`、`NAS_PATH`、`NAS_PASSWORD`、`CLOUDFLARE_TUNNEL_TOKEN`。NAS compose 会额外启动 `subscription-cron`，每天调用 `/api/subscriptions/crawl` 抓取订阅原始内容；建议配置 `SUBSCRIPTION_CRON_SECRET`，未配置时会回退使用 `ADMIN_PASSWORD`，抓取间隔可用 `SUBSCRIPTION_CRON_INTERVAL_SECONDS` 调整。
部署日志会按时间写入 `log/deploy/`，脚本退出前会尽量清理远端暂存目录并关闭 SSH / SFTP 会话。

## 测试

```bash
npm test          # 跑一次
npm run test:managed
npm run test:watch
```

152+ 测试覆盖所有 API 路由、认证、频率限制、流式响应。

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
| 框架 | Next.js 14（App Router）|
| 语言 | TypeScript |
| 数据库 | SQLite（`better-sqlite3`）|
| 认证 | NextAuth.js（credentials）|
| 样式 | Tailwind CSS |
| Markdown | `react-markdown` + `gray-matter` |
| 编辑器 | `@uiw/react-md-editor` |
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
| 发 X 推文返回空 `{}` | 确认 App 权限为 Read+Write，重新生成 access token |
| 命理流式响应中途停止 | 增大 `app/api/fortune/route.ts` 中的 `max_tokens` |

## 文档

- [使用指南](./docs/zh/使用指南.md)
- [API 文档](./docs/zh/API文档.md)
- [开发指南](./docs/zh/开发指南.md)

## 授权

本项目采用 MIT License，详见 [LICENSE](./LICENSE)。

个人项目 —— 欢迎 fork 自用。
