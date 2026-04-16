# ThomasLee 的博客

基于 **Next.js 14** 和 **SQLite** 的个人博客与工具箱。

📖 [English](./README.md) · 📚 [完整文档](./docs/zh/)

## 功能

- 📝 **博客** — Markdown 文章，AI 辅助编辑（摘要、标签、标题、翻译、润色）
- 📒 **日记** — 按日期记录的私人日记，支持 markdown
- ✅ **待办** — 任务列表，支持截止日期
- 🖼️ **文件** — 图片上传，按相册组织
- 🤖 **AI 对话** — 多服务商聊天（OpenAI + Anthropic），支持流式响应
- 📰 **订阅** — 从博客、GitHub、X/Twitter、RSS、Reddit 生成 AI 摘要
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
ADMIN_PASSWORD=changeme                    # 登录密码
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

# Cloudflare Tunnel（部署用）
CLOUDFLARE_TUNNEL_TOKEN=
```

AI 服务商通过管理后台 `/admin/ai-config` 配置，无需环境变量。

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

参见 `deploy-to-nas.sh` —— 构建 AMD64 镜像、通过 SCP 推送、用 Cloudflared tunnel 暴露。

## 测试

```bash
npm test          # 跑一次
npm run test:watch
```

152+ 测试覆盖所有 API 路由、认证、频率限制、流式响应。

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
├── .claude/skills/   # AI 技能（web 应用 + Claude Code 共用）
├── content/posts/    # 博客 markdown 文件
├── uploads/          # 用户上传图片
├── data/site.db      # SQLite 数据库
├── docs/             # 使用 / API / 开发文档（中英文）
└── tests/            # Vitest 测试
```

## AI 技能

AI 行为以可复用的"技能"定义在 `.claude/skills/<name>/SKILL.md`。内置技能：

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

个人项目 —— 欢迎 fork 自用。
