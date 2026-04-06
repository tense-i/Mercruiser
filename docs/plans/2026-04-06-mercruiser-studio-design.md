# Mercruiser Studio Rebuild Design

## Goal

把当前的原型升级为一个可运行的 local-first Studio：同仓内包含 Next.js 前端、App Router 后端、Vercel AI SDK agent 编排、文件持久化，并完整落地 PRD v2.1 定义的 Agent 驱动生产工作流。

## Design Baseline

这份设计以当前 `prd.md` v2.1 为业务基线。
本次修订的重点不是再补页面，而是把第 5 章新增的“Agent 驱动生产工作流”提升为系统一级概念：

- 阶段 Agent
- 阶段输入 / 输出结构
- 阶段门禁
- 阶段状态流转
- 失败恢复

## PRD v2.1 Delta

相较于上一轮规划，v2.1 带来了 5 个关键变化：

1. 单集主线被明确拆成 5 个前置阶段：
   - 原文导入 / 剧本生成
   - 主体提取
   - 资产图片生成
   - 分镜生成
   - 分镜图片生成
2. 每个阶段都有明确的：
   - 触发方式
   - Agent 职责
   - 输入输出结构
   - 前置门禁
   - 后置状态
3. `Asset` 和 `Shot` 的数据结构变重：
   - `Asset` 新增 `prompt`、`chapterIds`、`images[]`、`state`、`parentAssetId`、`variantName`
   - `Shot` 升级为完整 12 字段生产对象，并附带 `prompt` / `videoDesc` / `images[]`
4. 门禁从“UI 提示”变成“系统硬约束”：
   - 剧本完成后才可提取主体
   - 所有资产完成且有 selectedVersion 后才可生成分镜
   - 分镜表完成后才可生成分镜图
5. Agent 不再只是一个通用 chat panel，而是至少要分化为：
   - `ScriptAgent`
   - `AssetAgent`
   - `ProductionAgent`
   - `RecoveryAgent`

## Recommended Architecture

### 方案 A：Next.js App Router + 本地 JSON 仓库 + Workflow / Gate Engine + AI SDK Route Handlers

优点：
- 单仓前后端一体化，最符合 local-first
- 数据模型、门禁、API、页面和 agent 服务都在同一个类型系统下
- 能较快实现 PRD v2.1 里的阶段约束
- 后续可平滑迁移到 SQLite / Postgres

缺点：
- 数据量和并发写入上限有限
- 需要显式补 workflow / gate 层，不能只靠页面逻辑

### 方案 B：Next.js + SQLite + Drizzle

优点：
- 关系建模更自然
- 门禁与历史回放查询更强

缺点：
- 当前重构成本更高
- 会显著增加 migration / schema / 运维负担

### 结论

继续采用方案 A，但需要在现有设计上新增两层：

- `workflow engine`：决定当前所处阶段、下一步动作、阶段输入输出
- `gate engine`：统一判断门禁、阻塞原因和解锁条件

## System Architecture

### 1. Shell 与路由

- 使用 Next.js App Router
- 顶层页面：
  - `/` 工作区首页
  - `/series/[seriesId]` 系列详情
  - `/series/[seriesId]/episodes/[episodeId]` 单集执行页
  - `/tasks` 任务中心
  - `/settings` 设置中心

### 2. Local-First Data Layer

本地数据持久化继续使用 `data/studio.json`，但 root document 要扩展为 workflow-first 结构：

- `series`
- `episodes`
- `sourceDocuments`
- `chapters`
- `assets`
- `shots`
- `storyboards`
- `finalCuts`
- `tasks`
- `settings`
- `agentRuns`
- `workflowRuns`
- `gateSnapshots`

实现约束：
- 所有读写必须经过仓储层
- 所有数据先经过 zod 解析
- 阶段门禁判断必须由 gate engine 输出，不能只在 UI 文案层判断
- 失败恢复必须基于任务记录和 gate snapshot，而不是只改状态字面值

### 3. Domain Model

按 PRD v2.1，核心模型应扩展为 8 组：

- 系列治理：
  - `Series`
  - `SeriesPolicy`
  - `SeriesPromptStrategy`
- 单集生产：
  - `Episode`
  - `EpisodeProgress`
  - `WorkstationGateState`
- 原文 / 剧本：
  - `SourceDocument`
  - `GeneratedScript`
  - `Chapter`
  - `DialogueLine`
- 主体工位：
  - `Asset`
  - `AssetImageVersion`
  - `AssetVariant`
  - `AssetExtractionResult`
- 分镜工位：
  - `DirectorPlan`
  - `Shot`
  - `ShotImageVersion`
  - `ShotTrackGroup`
- 故事板 / 成片：
  - `StoryboardItem`
  - `TimelineTrack`
  - `ExportDraft`
- 任务与恢复：
  - `TaskRecord`
  - `RetryRecipe`
  - `FailureReason`
- Agent 编排：
  - `AgentRun`
  - `WorkflowRun`
  - `WorkflowStepAudit`

关键字段要求：

- `Chapter`
  - `scene`
  - `dialogues[]`
- `Asset`
  - `prompt`
  - `chapterIds[]`
  - `images[]`
  - `state`
  - `parentAssetId`
  - `variantName`
- `Shot`
  - PRD 定义的 12 个核心字段
  - `prompt`
  - `videoDesc`
  - `images[]`
  - `track`
  - `trackId`

### 4. Workflow Engine

新增显式 workflow engine，用于编码 PRD v2.1 的阶段主线：

1. `script_generation`
2. `asset_extraction`
3. `asset_rendering`
4. `shot_generation`
5. `shot_rendering`
6. `storyboard`
7. `final_cut`
8. `export`

workflow engine 输出：

- `currentStage`
- `availableActions`
- `blockedReasons`
- `requiredInputs`
- `completionProgress`

### 5. Gate Engine

新增 gate engine，把门禁做成统一规则，而不是散落在各工位组件里。

必须覆盖的关键规则：

- 剧本完成后才可触发主体提取
- 所有资产 `completed` 且存在 `selectedVersion` 后才可触发分镜生成
- 分镜表 `ready` 后才可触发分镜图片生成
- 审校未通过不得进入导出
- 已选版本才能进入故事板和成片

### 6. Agent Architecture

Agent 编排需要从“通用协调 Agent”升级为“阶段 Agent + 协调器”：

- `workflowCoordinator`
  - 读取 gate engine 输出
  - 决定当前应调用哪个阶段 Agent
  - 生成下一步建议 / 阻塞原因 / 恢复动作
- `scriptAgent`
  - 输入：小说原文 + 系列设定
  - 输出：按集拆分的 `episodes[].chapters[]`
- `assetAgent`
  - 输入：本集章节
  - 输出：结构化 `assets[]`
- `productionAgent`
  - 输入：本集剧本 + 已生成资产
  - 输出：`directorPlan + shots[]`
- `recoveryAgent`
  - 输入：失败任务 + gate snapshot
  - 输出：恢复动作和重试建议
- `reviewAgent`
  - 输入：阶段产物
  - 输出：质量提示 / 风险 / 连戏提醒

交互方式：

- 前端通过 agent panel 调用 `/api/agent`
- route handler 使用 AI SDK `streamText`
- 不同阶段选择不同 prompt / tool set
- 所有工具都只读写本地工作区，不直接越过仓储层

### 7. UI Composition

#### 首页
- 系列卡片网格
- 最近生产中的系列
- 全局任务摘要
- 风险提示面板

#### 系列详情
- 总览
- 系列设定
- 集数管理
- 共享主体资产
- 系列策略

#### 单集六工位
- `overview`
- `script`
- `subjects`
- `shots`
- `storyboard`
- `final-cut`

页面结构：
- 左侧：导航 / 列表
- 中间：主工作台
- 右侧：Agent panel / Context panel / Inspector / Gate panel

v2.1 新增的工位责任：

- 剧本工位
  - 原文导入区
  - “从原文生成剧本”触发器
  - `scene` / `dialogues` 可视化
- 主体工位
  - “提取本集主体”触发器
  - prompt 编辑区
  - 图片版本 / selectedVersion 显示
- 分镜工位
  - “生成分镜表”触发器
  - 导演规划预览
  - 12 字段镜头表
  - 资产门禁提示
- 故事板工位
  - 分镜图片生成
  - @图N 引用确认
  - take / selectedVersion 管理

### 8. Settings Center

P0 设置中心需要能配置：

- 语言
- Provider / Model
- Prompt 模板
- Skill / Memory
- Agent
- Request logs
- Files / data reset
- 阶段 Agent 配置
- Prompt 模板版本
- 模型分配策略

### 9. Task Recovery

任务中心除了保留当前任务记录能力，还要补：

- 阶段上下文
- 原始输入 / 输出摘要
- 门禁失败原因
- 推荐恢复动作
- 可执行的 retry recipe

## Technical Decisions

### Next.js over Vite

因为我们需要：
- route handlers
- server/client component 分层
- 单仓全栈
- 更顺滑的 Vercel 部署路径

### File-backed Repository over SQLite

P0 更关注工作流闭环、门禁引擎和 agent 编排，而不是复杂查询。
先用 JSON 仓储把阶段状态、门禁和交互跑通，后续再平滑迁移。

### AI SDK over direct provider SDK wiring

因为它能统一：
- streaming
- tool calling
- agent transport
- provider 切换

同时更贴近用户指定的技术栈。

## Validation Strategy

- 单元测试：
  - schema parsing
  - repository mutations
  - workflow engine
  - gate engine
  - asset / shot 数据结构校验
  - task creation / retry rules
- 集成测试：
  - agent route 的 tool loop
  - local-first repository round trip
  - 阶段解锁链路
  - “剧本完成 -> 解锁主体”、“资产全完成 -> 解锁分镜” 这类关键业务流程
- 静态验证：
  - TypeScript
  - Next.js lint

## Delivery Scope for This Build

本次实现聚焦 PRD 的 P0，并且以 v2.1 的 Agent 流程为主线：

- 系列管理
- 原文导入与剧本生成
- 主体提取与资产图片版本
- 分镜生成与 12 字段镜头表
- 分镜图片生成 / 故事板
- 成片装配骨架
- 阶段门禁与任务恢复
- 设置中心基础治理

暂不做：

- 多成员协作
- 多角色审批
- 运营分析
- 深度后期能力
- 真正的视频渲染基础设施

## Acceptance Shape

完成后应具备：

- 从首页进入系列
- 进入单集后完整浏览六工位
- 能导入原文并触发 `ScriptAgent`
- 能触发 `AssetAgent` 提取主体，并维护图片版本与 selectedVersion
- 只有在资产门禁通过后才能触发 `ProductionAgent` 生成分镜表
- 分镜表完成后才能进入分镜图片 / 故事板阶段
- 能在本地修改数据并持久化
- 能通过 agent panel 发起结构化阶段动作
- 任务中心可看到 agent 执行记录、门禁失败原因与恢复动作
- 设置中心可编辑基础 AI / Prompt / Skill 配置
