# Mercruiser Studio Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** 将现有原型重构为基于 Next.js App Router 和 Vercel AI SDK 的 local-first 全栈 Mercruiser Studio MVP，并完整对齐 PRD v2.1 的 Agent 驱动生产流程。

**Architecture:** 使用 Next.js App Router 重建应用壳层，建立文件系统仓储作为 local-first 数据源，补上 workflow engine / gate engine，再在 route handlers 中接入 ScriptAgent、AssetAgent、ProductionAgent 与恢复链路，最后补齐六工位页面、任务中心和设置中心。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Vercel AI SDK v6, Zod, Vitest.

---

### Task 1: Stabilize the Next.js shell and route map

**Files:**
- Create/Modify: `app/layout.tsx`
- Create/Modify: `app/page.tsx`
- Create/Modify: `app/tasks/page.tsx`
- Create/Modify: `app/settings/page.tsx`
- Create/Modify: `app/series/[seriesId]/page.tsx`
- Create/Modify: `app/series/[seriesId]/episodes/[episodeId]/page.tsx`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Review/Delete: obsolete Vite entrypoints

**Step 1: Route-level smoke checks**

Verify the route tree and shell map match the PRD information architecture.

**Step 2: Keep the shared shell stable**

Sidebar, navigation, and page frames should remain reusable while the workflow-specific UI grows underneath.

**Step 3: Verify**

Run: `npm install`  
Run: `npm run typecheck`

### Task 2: Expand the domain schema for PRD v2.1 workflow objects

**Files:**
- Modify: `lib/domain/schema.ts`
- Modify: `lib/domain/types.ts`
- Create: `lib/domain/commands.ts`
- Modify: `data/studio.json`
- Create/Modify: `tests/repository/studio-repository.test.ts`

**Step 1: Write failing schema tests**

Cover:
- `SourceDocument`
- `GeneratedScript`
- `Chapter.scene`
- `Chapter.dialogues[]`
- `Asset.prompt`
- `Asset.chapterIds[]`
- `Asset.images[]`
- `Shot` 12-field structure
- `WorkflowRun`
- `GateSnapshot`

**Step 2: Extend the workspace root**

Add workflow-oriented root collections and typed status fields without breaking local-first persistence.

**Step 3: Seed realistic workflow data**

Seed:
- imported source text
- script-generated chapters
- partially extracted assets
- partially completed asset images
- gate snapshots blocking downstream actions

**Step 4: Verify**

Run: `npm run test -- repository`

### Task 3: Add workflow engine and gate engine

**Files:**
- Create: `lib/workflow/stage-definitions.ts`
- Create: `lib/workflow/workflow-engine.ts`
- Create: `lib/workflow/gate-engine.ts`
- Modify: `lib/server/repository/studio-repository.ts`
- Modify: `lib/view-models/*`
- Create: `tests/workflow/gate-engine.test.ts`

**Step 1: Write failing gate tests**

Cover:
- 剧本完成 -> 主体可触发
- 所有资产完成 + selectedVersion -> 分镜可触发
- 分镜表 ready -> 分镜图片可触发
- 审校未通过 -> 不可导出

**Step 2: Encode stage definitions**

Support:
- `script_generation`
- `asset_extraction`
- `asset_rendering`
- `shot_generation`
- `shot_rendering`
- `storyboard`
- `final_cut`
- `export`

**Step 3: Surface gate state**

Repository and view models should expose:
- `currentStage`
- `availableActions`
- `blockedReasons`
- `requiredInputs`

**Step 4: Verify**

Run: `npm run test -- workflow`

### Task 4: Build workflow-aware workstation UI

**Files:**
- Modify/Create: `components/layout/*`
- Modify/Create: `components/dashboard/*`
- Modify/Create: `components/series/*`
- Modify/Create: `components/episode/*`
- Modify: `app/**/*.tsx`

**Step 1: Overview tab**

Show current workflow stage, gate summary, and next recommended action.

**Step 2: Script workstation**

Add:
- source import area
- “从原文生成剧本” trigger
- chapter list with `scene` and `dialogues` support

**Step 3: Subjects workstation**

Add:
- “提取本集主体” trigger
- prompt editor
- image version / selectedVersion UI
- face lock and voice binding affordances

**Step 4: Shots workstation**

Add:
- “生成分镜表” trigger
- director plan preview
- 12-field structured shot editor
- hard-disabled gate when assets are incomplete

**Step 5: Storyboard / Final Cut**

Add:
- shot image generation controls
- @图N reference review
- take selection
- multi-track final-cut shell

**Step 6: Verify**

Run: `npm run typecheck`

### Task 5: Implement mutation APIs and workflow-safe command handling

**Files:**
- Modify/Create: `app/api/studio/route.ts`
- Modify/Create: `app/api/tasks/[taskId]/retry/route.ts`
- Create: `lib/server/request-guard.ts`
- Create/Modify: `tests/api/studio-route.test.ts`

**Step 1: Write failing API tests**

Cover:
- not-found behavior
- stage command dispatch
- gate-blocked command rejection
- retry behavior re-executing workflow recipes

**Step 2: Implement typed command endpoints**

Expose safe operations for:
- source import
- script generation
- asset extraction
- asset image completion / version selection
- shot generation
- shot image selection
- settings updates

**Step 3: Make retry real**

Retry should run a real recovery recipe, not only relabel task status.

**Step 4: Verify**

Run: `npm run test -- api`

### Task 6: Implement stage-specific AI agents with AI SDK

**Files:**
- Modify/Create: `app/api/agent/route.ts`
- Modify/Create: `lib/ai/provider.ts`
- Modify/Create: `lib/ai/prompts.ts`
- Modify/Create: `lib/ai/tools.ts`
- Modify/Create: `lib/ai/agent-service.ts`
- Modify/Create: `components/agent/agent-panel.tsx`
- Create/Modify: `tests/ai/agent-service.test.ts`

**Step 1: Write failing orchestration tests**

Cover:
- `ScriptAgent`: source text -> generated chapters
- `AssetAgent`: chapters -> assets
- `ProductionAgent`: script + completed assets -> director plan + shots
- `RecoveryAgent`: failed task -> recovery action
- fallback behavior without credentials

**Step 2: Implement provider resolution**

Support AI Gateway when configured, otherwise local provider fallback via env.

**Step 3: Split prompt/tool surfaces by stage**

Do not rely on a single generic prompt. Separate:
- `ScriptAgent`
- `AssetAgent`
- `ProductionAgent`
- `RecoveryAgent`
- `workflowCoordinator`

**Step 4: Render the agent panel**

Allow users to:
- ask for next-step guidance
- trigger stage actions
- inspect tool output
- see gate-aware warnings and blocked reasons

**Step 5: Verify**

Run: `npm run test -- ai`

### Task 7: Finish recovery flows, docs, and full verification

**Files:**
- Modify: `README.md`
- Modify: `memory/FACTS.md`
- Modify: `memory/EXPERIENCE.md`
- Review: all changed files

**Step 1: Update docs**

Document:
- workflow stages
- gate rules
- local-first data path behavior
- AI provider configuration

**Step 2: Run full verification**

Run: `npm run test`  
Run: `npm run typecheck`

**Step 3: Review and simplify**

Remove dead code, reduce duplicated workflow logic, and ensure triggers / gates are encoded in one place.

**Step 4: Update memory files**

Record stable facts and repository-specific pitfalls uncovered during the rebuild.
