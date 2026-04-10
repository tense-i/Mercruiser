# Agent Layer Refactor — PRD v1.0

**日期**：2026-04-11  
**状态**：In Progress  
**范围**：`lib/ai/` + `app/api/agent/` + `lib/ai/script-analysis.ts`

---

## 1. 背景与目标

### 1.1 已完成（本 PR 基线）

本次改造的第一阶段已完成，修复了 Agent 层三个结构性缺陷：

| 问题 | 修复 |
|---|---|
| `runFallbackAgent` 是基于正则的假 Agent，config.toml 有 key 也不会触发真实推理 | 删除，改为友好提示 |
| SiliconFlow 模式关闭了 tools（`useSiliconFlowCompatibility`），退化为纯 prompt | 删除 bypass，所有供应商统一走 `system + messages + tools` |
| route.ts 不读 config.toml，只依赖 env var 凭证 | 接入 `readConfig()` + `getEffectiveApiKey()`，config.toml 为优先凭证来源 |

新增 `run_pipeline_analysis` SubAgent 工具，验证了 Vercel AI SDK v6 的 deep agent 模式（tool 内部调用 `generateText`）。

### 1.2 参考研究

- **FilmAgent**（arXiv:2501.12909）：Director / Screenwriter / Actor / Cinematographer 四角色专业化，Critique-Correct-Verify（CCV）协作模式，Debate-Judge 多镜头选优机制。
- **Elser.AI / Seko 短剧平台**：角色一致性锚点、全流程自动化、创作者可控节点设计。

### 1.3 目标

对标 FilmAgent 研究结论，分三个优先级渐进优化：
1. **P0**：最小改动，直接提升生成质量（本次编码范围）
2. **P1**：增加跨集连戏记忆工具
3. **P2**：完整 CCV 协作循环

---

## 2. 现状问题诊断

### 2.1 Prompt 设计

**ScriptAgent** (`lib/ai/script-analysis.ts:analyzeSourceTextToChapters`)
- 无角色 profile 预提取，对白质量不稳定
- 单次生成无自我审查（无 CCV）
- 无连戏上下文（不知道前几集主角形象）

**AssetAgent** (`analyzeChaptersToAssets`)
- 输出缺少 `consistencyAnchors`：角色标志性视觉元素列表
- 无法为后续 shot 的 `referenceAssetNames` 提供足够锚定信息

**ProductionAgent** (`generateShotsFromScript`)
- 硬编码「每章 1 条分镜」，复杂场景不足
- `directorPlan` 生成后未反馈给 shot 生成上下文
- 无连戏约束字段（前一镜头摄像机位置不传递）

### 2.2 Tools 设计

| 缺失工具 | 用途 | 优先级 |
|---|---|---|
| `get_series_context` | 读取系列视觉风格指南、共享主体的一致性锚点 | P1 |
| `verify_script_quality` | CCV 模式：Critique Agent 对章节做叙事审查 | P2 |
| `get_character_profiles` | 读取当前集已确认角色的详细 profile | P1 |
| `update_asset_prompt` | 允许 agent 修正主体的生成 prompt | P1 |
| `check_shot_continuity` | 分析相邻镜头连戏（场景/角色/光线） | P2 |

### 2.3 Agent 系统 Prompt

`lib/ai/prompts.ts` 的系统 prompt 问题：
- 注入的是原始数据 dump（`JSON.stringify(stationStates)`），缺乏叙事摘要
- 无系列视觉风格约束
- 无连戏记忆（前几集已确定的主体外形）

---

## 3. P0 改造规格（本次编码）

### 3.1 AssetBlueprint Schema 扩展

**文件**：`lib/ai/script-analysis.ts`

在 `AssetBlueprintSchema` 增加 `consistencyAnchors` 字段：

```typescript
const AssetBlueprintSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['character', 'scene', 'prop']),
  description: z.string().min(1),
  prompt: z.string().min(1),
  chapterIndexes: z.array(z.number().int().positive()).min(1).max(8),
  // NEW: 标志性视觉元素，用于跨镜头/跨集一致性锚定
  consistencyAnchors: z.array(z.string()).default([]),
});
```

**AssetAgent prompt 增量**：
```
6. consistencyAnchors 列出该主体最关键的 2-5 个视觉识别特征（服装颜色/发型/体型/道具等），用简洁词组，如 ["红色连帽衫", "左手腕纹身"]
```

**影响范围**：`AssetAnalysisSchema` / `AssetBlueprint` type / shot 生成时的 `assetText` 序列化

### 3.2 ProductionAgent：directorPlan 注入 shot 上下文

**文件**：`lib/ai/script-analysis.ts`

`generateShotsFromScript` 内部将 `directorPlan` 内联到 shot 生成 prompt：

```typescript
// Phase 1: 生成 directorPlan（当前已有）
// Phase 2: 将 directorPlan 作为约束注入 shot 序列生成
const shotPrompt = [
  ...
  '导演规划（必须遵守）：',
  `- 主题：${directorPlan.theme}`,
  `- 视觉风格：${directorPlan.visualStyle}`,
  `- 叙事结构：${directorPlan.narrativeStructure}`,
  `- 音效方向：${directorPlan.soundDirection}`,
  `- 转场策略：${directorPlan.transitionStrategy}`,
  '',
  '章节列表：',
  chapterText,
].join('\n');
```

当前代码在同一次 `generateText` 里生成 directorPlan + shots，需要拆分为两次调用。

### 3.3 系统 Prompt 升级

**文件**：`lib/ai/prompts.ts`

`buildAgentSystemPrompt` 改为结构化叙事摘要，而非 JSON dump：

```typescript
// 旧：`工位进度：${JSON.stringify(episodeView.episode.stationStates)}`
// 新：按工位逐一说明状态，用自然语言
if (episodeView) {
  const stations = episodeView.episode.stationStates;
  contextLines.push('', '## 生产线状态');
  contextLines.push(`- 剧本工位：${stations.script}`);
  contextLines.push(`- 主体工位：${stations.subjects}`);
  contextLines.push(`- 分镜工位：${stations.shots}`);
  contextLines.push(`- 故事板工位：${stations.storyboard}`);
  // ...
}
```

增加共享主体的 `consistencyAnchors` 摘要，让 agent 在建议时知道视觉约束。

---

## 4. P1 改造规格（下一迭代）

### 4.1 `get_series_context` Tool

返回：
```typescript
{
  series: { name, status, visualStyle, narrativeGenre },
  sharedAssets: Array<{ name, type, consistencyAnchors, prompt }>,
  previousEpisodeSummary?: string,  // 上一集 directorPlan.theme + 关键主体
}
```

### 4.2 ScriptAgent 两阶段生成

Phase 1：角色人物志提取
```typescript
type CharacterProfile = {
  name: string;
  gender: string;
  occupation: string;
  personalityTraits: string[];
  speakingStyle: string;
  physicalDescription: string;
}
```

Phase 2：将 `CharacterProfile[]` 注入章节生成 prompt，约束对白风格。

### 4.3 `update_asset_prompt` Tool

允许 orchestrator agent 在发现主体 prompt 不准确时触发修正：
```typescript
tool({
  inputSchema: z.object({ assetId: z.string(), newPrompt: z.string() }),
  execute: async ({ assetId, newPrompt }) =>
    studioRepository.dispatch({ type: 'updateAssetPrompt', assetId, newPrompt })
})
```

---

## 5. P2 改造规格（长期）

### 5.1 Critique-Correct-Verify（CCV）循环

在 `analyzeSourceTextToChapters` 后增加 DirectorCritiqueAgent 审查轮次：

```
ScriptAgent 生成初稿
    ↓
DirectorCritiqueAgent 审查（叙事完整性、与原文覆盖率、角色一致性）
    ↓
ScriptAgent 修正（最多 2 轮）
    ↓
验证通过 → 落库
```

### 5.2 多镜头候选 + Cinematographer 选优

每章节生成 2-3 候选镜头，由第二个 Agent 调用按以下维度评分：
- `actionReasonableness`：动作合理性
- `themeConsistency`：主题一致性
- `continuityScore`：前后镜头连贯性

---

## 6. 文件影响矩阵

| 文件 | P0 | P1 | P2 |
|---|---|---|---|
| `lib/ai/script-analysis.ts` | ✏️ Schema + prompt | ✏️ 两阶段生成 | ✏️ CCV 循环 |
| `lib/ai/prompts.ts` | ✏️ 叙事摘要格式 | ✏️ 注入系列上下文 | — |
| `lib/ai/tools.ts` | — | ✏️ 新增 3 个 tools | ✏️ 新增 verify/check tools |
| `lib/domain/types.ts` | ✏️ Asset 增 consistencyAnchors | ✏️ CharacterProfile 类型 | — |
| `lib/server/repository/studio-repository.ts` | — | ✏️ updateAssetPrompt dispatch | — |

---

## 7. 验收标准

### P0 验收
- [ ] `AssetBlueprint` 包含 `consistencyAnchors` 字段，不为空数组
- [ ] `generateShotsFromScript` 拆分为 directorPlan 生成 + shots 生成两次调用
- [ ] shots prompt 包含 directorPlan 约束字段
- [ ] `buildAgentSystemPrompt` 输出自然语言工位摘要（无 JSON.stringify）
- [ ] `npx tsc --noEmit` 无新增错误
- [ ] `npx vitest run` 全部通过

### P1 验收
- [ ] `get_series_context` tool 可调用，返回共享主体 consistencyAnchors
- [ ] ScriptAgent 两阶段生成结果质量可感知（对白风格贴合角色 profile）

---

## 8. 不在范围内

- 视频生成 / 配音 / 剪辑集成
- 前端 UI 修改
- 数据库迁移（仍用 local JSON）
- 换 AI SDK 框架（维持 Vercel AI SDK v6）
