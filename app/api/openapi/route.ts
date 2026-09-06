import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: { title: "helix-mini API", version: "0.1.0", description: "本地单用户 Agent Web API" },
  servers: [{ url: "/", description: "当前 helix-mini 服务" }],
  paths: {
    "/api/conversations": {
      get: { summary: "获取会话列表", responses: { "200": { description: "会话列表", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Conversation" } } } } } } },
      post: { summary: "创建会话", responses: { "200": { description: "新会话", content: { "application/json": { schema: { $ref: "#/components/schemas/Conversation" } } } } } }
    },
    "/api/conversations/{id}": {
      parameters: [{ $ref: "#/components/parameters/ConversationId" }],
      get: { summary: "获取会话和消息", responses: { "200": { description: "会话详情" }, "404": { description: "会话不存在" } } },
      delete: { summary: "删除会话", responses: { "204": { description: "删除成功" } } }
    },
    "/api/conversations/{id}/messages": {
      parameters: [{ $ref: "#/components/parameters/ConversationId" }],
      post: { summary: "发送消息并流式获取 Agent 回复", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["content"], properties: { content: { type: "string", example: "帮我总结这段内容" } } } } } }, responses: { "200": { description: "SSE 事件流", content: { "text/event-stream": { schema: { type: "string", example: "event: token\\ndata: {\\\"token\\\":\\\"你好\\\"}\\n\\n" } } } }, "400": { description: "内容不能为空" }, "404": { description: "会话不存在" } } },
      delete: { summary: "停止当前运行", responses: { "204": { description: "停止请求已处理" } } }
    },
    "/api/model-config": {
      get: { summary: "获取模型配置（API Key 脱敏）", responses: { "200": { description: "当前模型配置" } } },
      put: { summary: "保存模型配置", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["baseUrl", "model"], properties: { baseUrl: { type: "string", example: "https://api.openai.com/v1" }, apiKey: { type: "string", example: "sk-..." }, model: { type: "string", example: "gpt-4o-mini" } } } } } }, responses: { "200": { description: "保存后的脱敏配置" }, "400": { description: "配置无效" } } },
      delete: { summary: "清除模型配置", responses: { "204": { description: "清除成功" } } }
    }
  },
  components: {
    parameters: { ConversationId: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "会话 ID" } },
    schemas: { Conversation: { type: "object", required: ["id", "title", "createdAt", "updatedAt"], properties: { id: { type: "string", format: "uuid" }, title: { type: "string" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } } }
  }
};

export function GET() { return NextResponse.json(spec); }
