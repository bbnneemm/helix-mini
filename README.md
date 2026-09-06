# helix-mini

本地单用户 Agent Web。首次运行会自动进入 Mock 模式；配置 `.env.local` 中的 `MODEL_BASE_URL`、`MODEL_API_KEY` 和 `MODEL_NAME` 后使用真实的 OpenAI 兼容接口。

```bash
npm install
npm run dev
```

会话数据保存在项目目录 `.data/`，不会使用数据库或 Docker。
