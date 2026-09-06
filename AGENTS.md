# helix-mini 开发约束

## 项目定位

helix-mini 是一个单用户、本地运行的 Agent Web 工作台。优先保持实现简单、可运行、易调试，并为后续增加工具和工作流保留清晰接口。

## 技术约束

- 使用 Next.js App Router、TypeScript 和 React。
- API 使用 Next.js Route Handler。
- 优先采用成熟、维护良好的依赖，避免重复手写已有基础能力。
- 当前不使用数据库，不使用 Docker，不引入外部任务队列。
- 持久化文件只能写入项目目录内的 `.data/`。
- `.data/`、`node_modules/`、`.next/` 和本地环境文件不得提交到 Git。

## Agent 与模型

- 模型通过 OpenAI 兼容的 Chat Completions API 接入。
- 模型配置优先级为：`.data/model-config.json` > 环境变量 > Mock 模式。
- API Key 不能写入日志、接口响应或 Git；页面只显示脱敏值。
- Agent 执行必须支持流式输出和取消操作。
- 新增工具时，优先通过独立的工具接口和注册表接入，不把工具逻辑直接写进 API 路由。

## API 与日志

- 新增或修改 API 时，同步更新 `app/api/openapi/route.ts`。
- API 日志应包含方法、路径、状态码、请求 ID、关联运行 ID 和耗时。
- 使用 `pino` 写结构化 JSONL 日志，日志文件位于 `.data/logs/`。
- 日志不得记录 API Key；用户输入和模型输出只在确有调试价值时记录，并控制长度。
- 每次修改代码并完成验证后，清理 `.data/logs/` 中的旧日志，避免历史测试数据影响后续调试。

## UI 约束

- 默认使用浅色、简约、清晰的界面风格。
- 聊天页面的消息区独立滚动，输入区固定在底部。
- 长列表需要分页或独立滚动，不能让页面高度无限增长。
- 重要状态需要明确展示，例如当前模型、运行中、失败和取消。

## 验证要求

完成代码修改后运行：

```bash
npx tsc --noEmit
npm run build
```

涉及 API、持久化、流式输出或模型配置时，补充对应的接口级手动验证。

## Git 协作

- 使用清晰的 Conventional Commit 风格提交信息，例如 `feat: ...`、`fix: ...`。
- 不使用破坏性 Git 操作覆盖用户已有改动。
- 只有在用户要求或已明确授权时才推送远程仓库。
