# Mercruiser Web

Mercruiser Web 是 Mercruiser 的前端 Studio，面向 AI 短剧/漫剧的系列化生产。

本项目不是单次生成工具，而是围绕系列持续生产的执行工作台，核心定位来自产品 PRD：

- 系列原生：以系列作为顶层对象，集数作为执行单元
- Agent 编排驱动：Agent 负责阶段诊断、缺口识别、下一步建议与任务编排
- 生产链路闭环：沿用策划 -> 剧本 -> 资产 -> 分镜 -> 视频 -> 审校 -> 导出主线

## 产品范围（当前版本）

根据 PRD 与交互文档，当前 Web 端围绕以下模块组织：

- 系列工作区：系列列表、新建系列、导入创建
- 系列详情：系列总览、集数管理、共享资产、策略配置
- 集数执行工作台：左侧阶段导航 + 中央阶段内容 + 右侧 Agent 面板
- 任务中心：任务状态查看、失败原因定位与恢复入口
- 设置中心：模型、供应商、Prompt、Skill、Memory、Agent 等运行时治理

## 交互原则

交互定义遵循以下设计原则：

- Studio 感优先：用户始终知道当前系列、集数与阶段
- 系列/集数边界清晰：系列负责规则与共享资产，集数负责具体产出
- Agent 不是聊天外挂：以操作建议与编排入口为核心
- 生成、选择、锁定同等重要：资产、分镜、视频都强调候选与主版本确认

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- better-sqlite3（本地数据存储）

## 本地开发

建议环境：

- Node.js 22+
- npm 10+

安装依赖：

```bash
npm ci
```

启动开发环境：

```bash
npm run dev
```

默认访问地址：

- http://localhost:3000

构建：

```bash
npm run build
```

代码检查：

```bash
npm run lint
```

## 目录概览

- src/app: 页面与 API Route
- src/components: 可复用 UI 组件
- src/lib: 前端共享数据与工具
- src/server: 业务流水线与服务端视图组装
- data: 本地 SQLite 数据
- public/mvp-media: 示例媒体与导出样例

## API 概览

当前已提供 v1 路由（示例）：

- /api/v1/series
- /api/v1/series/[seriesId]
- /api/v1/episodes/[episodeId]
- /api/v1/episodes/[episodeId]/actions
- /api/v1/tasks
- /api/v1/vendors

## GitHub Actions CI/CD

仓库内置两条工作流：

- CI（.github/workflows/ci.yml）
  - main 分支 push/PR 触发
  - 执行 npm ci、npm run lint、npm run build
  - 上传构建产物用于追踪
- CD（.github/workflows/cd.yml）
  - CI 在 main 成功后自动触发部署
  - 支持手动触发 preview 或 production
  - 通过 Vercel CLI 执行部署

必需 Secrets：

- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID

## 相关文档

- docs/2026-04-04-mercruiser-business-prd.md
- docs/2026-04-04-mercruiser-user-interaction-spec.md
- docs/2026-04-04-mercruiser-user-use-cases.md

## 路线图（摘要）

- P0：系列管理、集数管理、Agent 编排工作台、主生产链路、任务与设置基础能力
- P1：系列级策略配置增强、审校与装配增强、导出历史增强
- P2：多角色协作、更深后期能力、运营分析
