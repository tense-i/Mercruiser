# Mercruiser Studio

Mercruiser Studio 是一个 local-first 的 AI 短剧 / 漫剧生产工作区。

当前版本基于：
- `Next.js 16` App Router
- `Vercel AI SDK v6`
- 本地 JSON 仓储
- 单仓前后端一体化

## 已实现的 P0 主线

- 系列管理首页
- 系列详情与共享主体资产
- 单集六工位：
  - 概览
  - 剧本
  - 主体
  - 分镜
  - 故事板
  - 成片
- 任务中心与失败重试
- 设置中心基础治理
- Agent 面板
  - 无密钥时走 `mock` 模式
  - 配置 `SILICONFLOW_API_KEY` 后切到真实 AI SDK 调用
  - 也支持 `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY`

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 按需配置环境变量

```bash
cp .env.example .env.local
```

3. 启动应用

```bash
npm run dev
```

## 验证

```bash
npm run test
npm run typecheck
```

## 数据说明

- 默认工作区文件：`data/studio.json`
- 可通过 `MERCRUISER_DATA_PATH` 指向别的本地 JSON 文件
- 所有 UI 写操作和 agent 工具调用都会通过仓储层原子写入该文件

## Workflow

当前实现已经对齐 PRD v2.1 的主线阶段：

1. 原文导入 / 剧本生成
2. 主体提取
3. 资产图片生成
4. 分镜生成
5. 分镜图片 / 故事板
6. 成片装配

门禁规则由 workflow / gate engine 输出，不再只靠页面提示。

## SiliconFlow

如果环境里存在 `SILICONFLOW_API_KEY`，系统会自动把真实 provider 切到 SiliconFlow 的 OpenAI-compatible chat endpoint。

本仓库已做过真实连通验证：
- provider 模式识别成功
- 模型列表读取成功
- 最小文本生成成功

## 目录

- `app/`：页面与 route handlers
- `components/`：UI 组件
- `lib/domain/`：zod schema 与命令模型
- `lib/server/repository/`：local-first 数据仓储
- `lib/ai/`：agent prompt、tools 与 provider 封装
- `data/studio.json`：工作区 seed 数据
