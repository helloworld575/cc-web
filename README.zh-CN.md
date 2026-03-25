# ThomasLee 的博客

基于 Next.js 14 的个人博客与工具箱 — 博客、待办、日记、文件上传，以及 AI 命理分析（八字、紫微斗数、六爻、梅花易数）。

## 安装

需要 **Node.js >= 18** 和 **Docker**。

```bash
git clone <仓库地址>
cd my-site
./setup.sh
```

脚本会自动：
- 检查环境依赖
- 询问管理员密码和 Claude API 密钥
- 生成 `.env.local` 配置文件
- 安装 npm 依赖
- 通过 Docker 启动 MongoDB

然后启动开发服务器：

```bash
npm run dev
```

打开 http://localhost:3000，登录地址 http://localhost:3000/login。

## 生产部署

```bash
npm run build
npm start
```

## 迁移到其他机器

1. 复制项目文件夹（包含 `data/`、`content/`、`uploads/`）
2. 在新机器上运行 `./setup.sh`
3. 完成

## 常见问题

| 问题 | 解决方法 |
|---|---|
| `better-sqlite3` 编译失败 | `npm rebuild better-sqlite3` |
| MongoDB 连接失败 | `docker compose ps` 检查状态 |
| 命理推演中途停止 | 增大 `app/api/fortune/route.ts` 中的 `max_tokens` |
