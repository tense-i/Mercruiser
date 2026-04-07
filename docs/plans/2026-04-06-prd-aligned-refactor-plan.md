# Mercruiser PRD 对齐重构方案

日期：2026-04-06

## 1. 结论

当前系统不是局部缺陷，而是产品模型、交互流、状态机、数据实现四层同时偏离 PRD v3.1。现状更接近“看起来像 studio 的前端壳子”，而不是“可驱动生产的 studio 产品”。

核心判断：
- 不是继续美化页面就能解决。
- 必须把系统重构成**系列治理层 + 单集六工位生产线**。
- 必须由**状态机 / 门禁 / 返工污染规则**驱动，而不是由 tab 和局部字段 patch 驱动。

## 2. 现状问题摘要

### 2.1 产品骨架错误
- PRD 要求“系列治理 + 单集工业化生产线”的双层体系。
- 当前实现仍然以 dashboard 卡片、超长表单页、tab 工作台为主。
- 用户无法建立正确的工位心智，也无法理解何时可以进入下一阶段。

### 2.2 工位流转没有真实落地
- 剧本、主体、分镜、故事板、成片虽然在页面里出现，但缺少真实的工位锁定、解锁、确认、返工提示、下游失效标记。
- 结果是：用户能编辑，但系统没有明确说明这会如何影响下游。

### 2.3 状态机错误
- 现有 currentStage 基本按“有没有数据”推进，不按 PRD 的真实门禁推进。
- 实际会出现 script 仍在 editing、storyboard 仍未收敛、但 episode.currentStage 已经到 final_cut 的错误状态。

### 2.4 交互设计大量假动作
- 返回、搜索、分享、下载、资源入口、批处理按钮、故事板/成片多个按钮并未形成真实业务闭环。
- 这类交互会直接破坏用户信任。

### 2.5 业务命令模型不对
- 当前命令更像字段 patch，不像生产线业务命令。
- 缺少 confirm / lock / unlock / refresh downstream / assemble final cut / export 等核心动作。

### 2.6 并发写保护未闭环
- 后端有 revision conflict 机制，但前端大部分编辑操作没有接 expectedRevision。
- PRD v3.1 要求修复并发写入保护，但现在只是后端半实现。

## 3. 重构目标

把系统从当前的：
- dashboard 驱动
- tab 驱动
- mock 数据驱动
- CRUD/patch 驱动

重构成 PRD 要的：
- **系列治理层**
- **单集六工位生产线**
- **门禁驱动**
- **返工影响可见**
- **Agent 作为生产协调器**
- **从原文到成片的业务闭环**

## 4. 新信息架构

### 4.1 顶层结构

#### A. 系列治理层
负责：
- 系列概览
- 系列设定
- 系列策略
- 系列共享资产
- 全局资产导入
- 集数列表与状态
- 风险 / 用量 / 告警

#### B. 单集生产线层
负责六工位：
1. 概览
2. 剧本
3. 主体
4. 分镜
5. 故事板
6. 成片

### 4.2 全局导航
保留：
- Dashboard
- Series
- Tasks
- Settings

删除当前假的一级资源导航：
- Characters
- Environments
- Assets

这些能力应作为“系列共享资产 / 全局资产库”的业务模块存在，而不是未接通的导航入口。

## 5. 单集工作区重构方案

单集页不再是 tab playground，而是统一骨架的六工位工作区。

### 5.1 页面骨架

#### 顶部
- 面包屑：Series / EP xx / 当前工位
- 当前工位状态
- 锁定状态
- 下游污染状态
- 主 CTA：进入下一工位 / 完成当前工位 / 恢复下游

#### 左侧
- 六工位纵向流程导航
- 每个工位显示：
  - 状态
  - 是否锁定
  - 是否 dirty
  - 门禁原因

#### 主工作区
- 只展示当前工位的主任务

#### 右侧辅助区
- 门禁说明
- Agent 建议
- 风险提示
- 下游影响
- 恢复操作
- 最近任务记录

### 5.2 六工位职责

#### 概览工位
- 当前集状态
- 当前推荐动作
- 缺失输入
- 已完成工位
- 待恢复对象
- 用量与告警
- 最近 workflow 运行

#### 剧本工位
- 原文输入
- 章节列表
- 当前章节编辑区
- 剧本确认状态
- “确认剧本”按钮
- 解锁剧本时必须展示对下游的影响范围

必须支持：
- 保存草稿
- 生成章节
- 确认剧本
- 解锁剧本
- 解锁后标记下游 dirty

#### 主体工位
- 本集主体
- 系列共享主体
- 从全局导入
- 每个资产的状态与主版本
- 是否共享 / 是否 linked global

必须支持：
- 提取主体
- 编辑主体
- 生成图
- 选主版本
- 确认主体工位

#### 分镜工位
- 章节到镜头映射
- 镜头结构化字段
- 资产引用健康状态
- 连戏警告
- 待刷新的镜头

必须支持：
- 生成分镜
- 编辑镜头
- 查看 broken/stale refs
- 确认分镜工位

#### 故事板工位
- 镜头卡序列
- image/video takes
- 当前选定 take
- 字幕 / 音频 / 参考主体
- 连戏检查结果

必须支持：
- 生成镜头图
- 选择 take
- 标记故事板完成
- 将选定结果装配进成片

#### 成片工位
- 多轨时间线
- 视频轨 / 对白轨 / 音效轨 / BGM 轨
- 装配结果
- 导出状态
- 导出前检查

最小闭环必须支持：
- 从 storyboard 选定 take 自动装配 video track
- 时间线最小编辑
- 锁定关键项
- 触发导出
- 导出前 gate check

## 6. 状态机重构方案

### 6.1 工位状态

建议统一：

```ts
type StationStatus =
  | 'idle'
  | 'editing'
  | 'generating'
  | 'ready'
  | 'completed'
  | 'locked'
  | 'dirty'
  | 'blocked';
```

配套元数据：

```ts
type StationMeta = {
  status: StationStatus;
  locked: boolean;
  dirty: boolean;
  canEnter: boolean;
  canEdit: boolean;
  blockingReasons: string[];
};
```

### 6.2 Episode 工作流状态

不要只靠 currentStage，建议变成：

```ts
type EpisodeWorkflowState = {
  currentStation: 'overview' | 'script' | 'subjects' | 'shots' | 'storyboard' | 'final-cut';
  stations: Record<StationId, StationMeta>;
  recommendedAction: RecommendedAction | null;
  downstreamDirty: {
    subjects: boolean;
    shots: boolean;
    storyboard: boolean;
    finalCut: boolean;
  };
  warnings: WorkflowWarning[];
};
```

### 6.3 核心门禁规则

#### 剧本 → 主体
前提：
- 有 source document
- 有 chapters
- 剧本已确认或已锁定

#### 主体 → 分镜
前提：
- 已提取主体
- 本集必须资产均有选定主版本
- 无 broken asset refs

#### 分镜 → 故事板
前提：
- 已生成镜头
- 镜头结构完成
- 分镜已确认

#### 故事板 → 成片
前提：
- 每个镜头至少有选定 take
- 必要 storyboard item 完成

#### 成片 → 导出
前提：
- timeline 有内容
- 无阻塞 gate
- 用量未 block
- 导出所需字段完备

### 6.4 返工污染规则

#### 修改剧本后
标记：
- 主体 dirty
- 分镜 dirty
- 故事板 dirty
- 成片 dirty

策略：
- 不静默清空已有数据
- 保留已有数据
- 明确标注待刷新
- 禁止继续导出
- 告知影响范围

#### 修改主体后
标记：
- 分镜 dirty
- 故事板 dirty
- 成片 dirty

#### 修改镜头后
标记：
- 故事板 dirty
- 成片 dirty

#### 修改已选 storyboard take 后
标记：
- 成片 dirty

## 7. 命令模型重构

### 7.1 保留的基础命令
- createSeries
- importSeries
- createEpisode
- createEpisodeFromSource
- importSourceDocument
- updateSettings

### 7.2 新增业务命令

#### 剧本工位
- generateScriptFromSource
- saveChapterDraft
- confirmScript
- unlockScript

#### 主体工位
- extractAssetsFromScript
- updateAssetDraft
- generateAssetImages
- selectAssetImage
- confirmAssets
- promoteAssetToShared
- promoteAssetToGlobal
- importGlobalAssetToSeries

#### 分镜工位
- generateShotsFromChapters
- updateShotDraft
- confirmShots
- refreshDirtyShots

#### 故事板工位
- generateShotImages
- selectStoryboardTake
- updateStoryboardMeta
- confirmStoryboard

#### 成片工位
- assembleFinalCutFromStoryboard
- updateTimelineItem
- lockTimelineItem
- exportEpisode

#### 工作流恢复
- refreshDownstreamFromScript
- refreshDownstreamFromAssets
- refreshDownstreamFromShots

### 7.3 并发保护要求
以下命令必须强制 expectedRevision：
- saveChapterDraft
- updateAssetDraft
- selectAssetImage
- updateShotDraft
- selectStoryboardTake
- updateTimelineItem

否则 PRD v3.1 的并发写保护无法成立。

## 8. 新 View Model 设计

新的 EpisodeWorkspaceView 应直接服务 UI，而不是只做数据拼接：

```ts
type EpisodeWorkspaceView = {
  series: ...
  episode: ...
  workflow: {
    currentStation: StationId;
    stations: Record<StationId, {
      status: StationStatus;
      locked: boolean;
      dirty: boolean;
      canEnter: boolean;
      canEdit: boolean;
      progress: number;
      blockingReasons: string[];
    }>;
    recommendedAction: {
      label: string;
      command: string;
      reason: string;
    } | null;
    downstreamImpactSummary: string[];
  };
  overview: ...
  scriptStation: ...
  subjectStation: ...
  shotStation: ...
  storyboardStation: ...
  finalCutStation: ...
  governance: {
    usageSummary: ...
    alerts: ...
    continuityWarnings: ...
    dirtyResources: ...
  };
};
```

原则：
- UI 不自行推导业务规则
- 后端直接返回工位真相

## 9. 文件重组方案

### 9.1 前端组件重组

```txt
components/episode/
  episode-workspace.tsx
  episode-header.tsx
  episode-station-nav.tsx
  episode-side-panel.tsx
  stations/
    overview-station.tsx
    script-station.tsx
    subjects-station.tsx
    shots-station.tsx
    storyboard-station.tsx
    final-cut-station.tsx
```

### 9.2 业务逻辑重组

```txt
lib/studio/
  commands/
    series-commands.ts
    script-commands.ts
    asset-commands.ts
    shot-commands.ts
    storyboard-commands.ts
    final-cut-commands.ts
  workflow/
    episode-workflow.ts
    gate-engine.ts
    dirty-propagation.ts
  view-models/
    build-dashboard-view.ts
    build-series-view.ts
    build-episode-view.ts
```

repository 层职责收缩为：
- 读写 workspace
- 分发 command handler

## 10. 第一轮改造中删什么、留什么

### 10.1 第一轮直接删掉
- AppShell 里所有无实现按钮
- EpisodeWorkspace 里所有空动作
- 假搜索、假分享、假导出、假资源导航

### 10.2 第一轮保留
- 路由层
- 基础 schema/type
- repository 原子写机制
- usage alert 基础设施
- global asset / preset 的基础结构

### 10.3 第一轮不要优先碰
- AI provider 抽象
- Settings Center 大框架
- Tasks Page 外观
- 样式系统

当前首要问题是工作流骨架，不是视觉系统。

## 11. 实施顺序

### Phase 1：止血
- 下线假交互
- 收缩导航
- 只保留真正可走通的动作

### Phase 2：状态机重建
- 重写 commands
- 重写 gate engine
- 重写 dirty propagation
- 重写 episode view model

### Phase 3：打通剧本 → 主体 → 分镜
最小闭环：
- 原文导入
- 章节生成
- 剧本确认
- 资产提取
- 资产图生成
- 选主版本
- 生成分镜

### Phase 4：补故事板
- 镜头图生成
- 选 take
- 故事板确认

### Phase 5：补成片
- 从 storyboard 自动装配 timeline
- 时间线最小编辑
- 导出 gate

### Phase 6：最后修首页和系列页体验
- dashboard
- series governance page

## 12. 文件级处置原则

### 12.1 直接删 / 下线假交互
- components/layout/app-shell.tsx 中的假入口
- components/episode/episode-workspace.tsx 中所有未实现动作

### 12.2 核心重做
- components/episode/episode-workspace.tsx
- lib/workflow/gate-engine.ts
- lib/workflow/workflow-engine.ts
- lib/domain/commands.ts
- lib/view-models/studio.ts

### 12.3 结构性大改
- lib/server/repository/studio-repository.ts
- components/series/series-detail.tsx
- components/dashboard/dashboard-home.tsx

### 12.4 可保留骨架
- app/page.tsx
- app/series/[seriesId]/page.tsx
- app/series/[seriesId]/episodes/[episodeId]/page.tsx
- app/api/studio/route.ts
- lib/domain/types.ts

## 13. 重构必须遵守的原则

1. 没有实现就不要显示可点击入口。
2. 工位状态必须真实，不允许“看起来完成”。
3. 上游返工必须明确告诉用户影响范围。
4. 下游污染优先标脏，不要静默覆盖。
5. UI 只展示 workflow truth，不自己发明规则。

## 14. 最终判断

本次重构的本质，不是继续修页面细节，而是：

**把系统重构成一个由状态机驱动的六工位生产线，而不是一个堆满卡片和假按钮的 studio 外壳。**
