# Project Facts

## Context Engineering Workflow
- This repository uses a traceable Context Engineering workflow: every task must leave behind a Context Manifest under `docs/plans/`.
- The authoritative repository context layout is:
  - `rules/` for minimal always-on rules
  - `memory/` for long-lived facts/experience/decisions
  - `skills/` for task-triggered playbooks
  - `docs/` for on-demand background material
- `today.md` is the repository scratchpad for temporary goals, hypotheses, commands, and raw findings. Stable conclusions should be distilled into `memory/*`.

## Mercruiser Studio Baseline
- The runtime stack is now `Next.js 16` App Router + `Vercel AI SDK v6` + local JSON persistence.
- The local-first workspace source of truth lives at `data/studio.json` unless `MERCRUISER_DATA_PATH` overrides it.
- All workspace mutations are funneled through `lib/server/repository/studio-repository.ts`; UI and agent routes should not write JSON files directly.
- The PRD v3.1 baseline extends the local workspace schema with `globalAssets`, `generationPresets`, `apiUsageRecords`, `usageAlerts`, per-entity `revision`, and shot-level asset reference snapshots/status so gate logic and UI can reason about stale/broken downstream dependencies.
- The AI surface is split into:
  - `app/api/agent/route.ts` for chat/agent orchestration
  - `lib/ai/tools.ts` for structured workspace tool calls
  - `lib/ai/agent-service.ts` for deterministic mock fallback when no provider credentials are configured
- If `SILICONFLOW_API_KEY` exists, the runtime now prefers SiliconFlow as the real provider and uses an OpenAI-compatible chat endpoint.
