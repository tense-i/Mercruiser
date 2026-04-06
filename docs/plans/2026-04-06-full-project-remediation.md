# Mercruiser Studio Full Project Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对整个 Mercruiser Studio 做一次产品级 review 与修复，直到核心生产链路达到“可实际使用”的完整度，并补上真实 SiliconFlow 验证。

**Architecture:** 继续保持 Next.js App Router + local-first JSON 仓储 + workflow/gate engine 的单仓架构，不引入新依赖。优先修复“看起来完整但实际不可操作”的断点：缺失交互、命令/视图不一致、workflow 状态推进不完整、AI 面板与真实 provider 验证不足。

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Vercel AI SDK v6, SiliconFlow OpenAI-compatible API.

---

## Context Manifest

### Loaded context
- `AGENTS.md` — 全局执行协议、team/verification/cleanup 约束
- `rules/00_core.md` — Context Engineering、结果汇报格式、Context Manifest 要求
- `memory/FACTS.md`
- `memory/EXPERIENCE.md`
- Skills:
  - `/Users/zh/.codex/skills/team/SKILL.md`
  - `/Users/zh/.codex/skills/writing-plans/SKILL.md`
  - `/Users/zh/.codex/skills/verification-before-completion/SKILL.md`
- Product/spec context:
  - `README.md`
  - `package.json`
  - `prd.md`
  - `docs/plans/2026-04-06-mercruiser-studio.md`
  - `docs/plans/2026-04-06-mercruiser-studio-design.md`
- Code inspected for current gap analysis:
  - `app/page.tsx`
  - `app/series/[seriesId]/page.tsx`
  - `app/series/[seriesId]/episodes/[episodeId]/page.tsx`
  - `app/api/studio/route.ts`
  - `components/dashboard/dashboard-home.tsx`
  - `components/series/series-detail.tsx`
  - `components/episode/episode-workspace.tsx`
  - `components/tasks/task-center.tsx`
  - `components/settings/settings-center.tsx`
  - `components/agent/agent-panel.tsx`
  - `lib/domain/commands.ts`
  - `lib/domain/schema.ts`
  - `lib/view-models/studio.ts`
  - `lib/server/repository/studio-repository.ts`
  - `lib/ai/provider.ts`
  - `tests/integration/siliconflow-smoke.mjs`

### Excluded context
- `node_modules/`, `.next/` — generated artifacts, not source of truth
- `mercruiser-studio-web/` — legacy prototype, only revisit if parity questions appear
- secret files such as `.env.local` — explicitly excluded; runtime env only for execution-based verification
- unrelated docs/history/logs — skipped to keep context bounded

### Baseline evidence
- `npm run typecheck` ✅
- `npm test` ✅
- Initial product review found multiple apparent-complete / actually-inert surfaces:
  - dashboard/series CTA buttons are non-functional
  - episode workspace contains several action-looking buttons with no mutation path
  - asset type naming and UI filters are inconsistent (`role/scene/tool` vs `character/scene/prop`)
  - repository command coverage and UI editing coverage are incomplete
  - real SiliconFlow verification exists only as a narrow smoke script and must be re-run after fixes

---

## Workstreams

### Task 1: Close the product interaction gaps in the main UI

**Files:**
- Modify: `components/dashboard/dashboard-home.tsx`
- Modify: `components/series/series-detail.tsx`
- Modify: `components/episode/episode-workspace.tsx`
- Modify: `components/tasks/task-center.tsx`
- Modify: `components/settings/settings-center.tsx`
- Modify: `components/agent/agent-panel.tsx`

**Focus:**
- Remove or wire up inert primary CTAs
- Make asset / shot / source / timeline interactions actually editable
- Keep UI labels aligned with domain concepts from PRD
- Prefer deleting fake affordances over shipping dead buttons

### Task 2: Repair domain / repository / workflow mismatches

**Files:**
- Modify: `lib/domain/commands.ts`
- Modify: `lib/domain/schema.ts`
- Modify: `lib/view-models/studio.ts`
- Modify: `lib/server/repository/studio-repository.ts`
- Modify: `app/api/studio/route.ts`

**Focus:**
- Align asset types and workstation expectations
- Ensure every surfaced UI edit has a matching command + repository mutation
- Advance workflow/gate state consistently after mutations
- Replace placeholder production data flows where they block usability

### Task 3: Strengthen AI/provider flow and deep verification

**Files:**
- Modify: `lib/ai/provider.ts`
- Modify: `lib/ai/agent-service.ts`
- Modify: `lib/ai/tools.ts`
- Modify: `tests/ai/*.test.ts`
- Modify: `tests/api/*.test.ts`
- Modify: `tests/repository/*.test.ts`
- Modify: `tests/workflow/*.test.ts`
- Review: `tests/integration/siliconflow-smoke.mjs`

**Focus:**
- Keep mock fallback intact
- Validate provider selection and settings alignment
- Add regression coverage for newly repaired paths
- Re-run real SiliconFlow smoke verification after implementation

### Task 4: Final verification and memory/doc closeout

**Files:**
- Modify: `README.md` (if behavior or verification steps change)
- Modify: `memory/FACTS.md` / `memory/EXPERIENCE.md` only if new stable facts emerge

**Verify:**
- `npm run typecheck`
- `npm test`
- `npm run test:integration:siliconflow`
- Manual evidence from updated route/view-model behavior via code-backed checks
