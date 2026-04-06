# Mercruiser Studio PRD v3.1 Business Logic Remediation Plan

**Goal:** 让当前 local-first Studio 从 PRD v2.1 基线升级到 v3.1 的 P0 业务逻辑基线，重点补齐最新治理模型与关键缺陷修复。

## Context Manifest

### Loaded context
- `prd.md`（重点：4.7/4.8、10、11、12、13、14、16、17）
- `docs/plans/2026-04-06-mercruiser-studio-design.md`
- `docs/plans/2026-04-06-full-project-remediation.md`
- `data/studio.json`
- `lib/domain/{schema,commands,types}.ts`
- `lib/server/repository/{file-store,studio-repository}.ts`
- `lib/workflow/{gate-engine,workflow-engine}.ts`
- `lib/view-models/studio.ts`
- `components/{episode,series,settings,tasks,dashboard}/**/*`
- `tests/**/*`

### Excluded context
- `node_modules/`, `.next/`
- `mercruiser-studio-web/`
- secret/env files
- P1/P2 的完整协作系统、字幕/高级编辑/TTS 深度能力

## Scope decisions
1. **本次必须落地的 P0**
   - 门禁与编辑冲突：引入实体修订号/快照、上游修改的级联影响提示、下游锁定资源的可编辑但可追踪行为
   - 资产引用一致性：镜头引用状态 `valid/stale/broken`、删除/替换/主版本切换后的引用同步
   - 并发写入保护：批量生成任务带参数快照与版本检查，冲突项默认跳过并记录原因
   - 全局资产库：跨系列可复用资产的基础数据模型、导入/升级链路、系列页可见性
   - 生成参数模板：用户/系列/全局三个 scope 的预设数据与应用逻辑
   - API 用量监控：记录、聚合、阈值告警与设置页展示
   - 连戏与多模态基础：基础 continuity context / 警告字段、音频前置相关字段与只读业务展示
2. **本次明确不做完整实现的部分**
   - 多成员协作/权限执行、成片高级编辑、字幕/TTS 深度工作流
   - 但要保留结构和只读视图，避免后续再次重构核心模型

## Workstreams

### 1. Domain + seed data refresh
- 扩展 schema/types：实体 `version/revision`、全局资产、生成参数模板、API usage records/alerts、批量任务项、级联影响 warning、多模态/音频字段
- 更新 `data/studio.json` 提供可验证的真实样例数据

### 2. Repository + workflow repair
- 在 `file-store`/repository 层实现乐观并发保护、批量任务快照、引用状态重算
- 修正 gate engine：把 locked / stale / broken / selected-version / continuity 风险纳入门禁
- 让脚本/资产/分镜编辑在存在下游依赖时走“新版本 + 旧引用继续可用”的业务逻辑，而不是静默覆盖

### 3. View-model + UI governance surfaces
- `SeriesView` 暴露 shared + global assets、系列/集级预设引用
- `EpisodeWorkspaceView` 暴露 asset ref status、cascade warnings、continuity context、multimodal fields
- `SettingsCenter` 暴露 API 用量总览/明细、预警设置、预设管理
- `SeriesDetail` 展示全局资产导入/升级结果
- `EpisodeWorkspace` 展示引用损坏/过期、并发冲突跳过、预览/多模态/连戏信息

### 4. Verification
- 补齐 repository/api/workflow tests
- 保持 `npm run typecheck` + `npm test` 全绿
- 如涉及真实 AI provider 路径，再补一次 smoke 验证

## Team lanes
- Lane A: domain/schema/repository/workflow
- Lane B: settings/series/episode view-model + UI surfaces
- Lane C: tests, seed data, regression verification
