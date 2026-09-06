"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false, loading: () => <p className="docs-loading">正在加载 API 文档…</p> });

export default function DocsPage() {
  return <main className="docs-page"><div className="docs-header"><a href="/">← 返回 helix-mini</a><h1>helix-mini API 文档</h1></div><SwaggerUI url="/api/openapi" /></main>;
}
