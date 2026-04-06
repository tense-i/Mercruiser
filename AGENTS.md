# AGENTS.md — Repo playbook for coding agents

This repository uses a traceable "Context Engineering" workflow:
every task MUST have a Context Manifest that records what context was loaded/excluded and why,
to keep reasoning bounded under the token window and reproducible. (Everything is Context)

Project development follows the **superpowers** approach and skill workflows.
Use relevant superpowers skills as guidance for planning, implementation, debugging, testing, and review.

---

## 0) Repo context layout (authoritative)

- env中存在硅基流动的api key,可以使用这个来进行真实的测试。
- `rules/` : small, always-on rules (autoload). Keep minimal.
  - `rules/10_release.md` : release and commit discipline (version management, tag workflow, auto-commit after test pass)
- `memory/` : long-lived memory
  - `memory/FACTS.md`        : project facts (stable, atomic)
  - `memory/EXPERIENCE.md`   : pitfalls / playbooks (trigger -> symptom -> diagnosis -> fix -> prevention)
  - (optional) `memory/DECISIONS.md` : ADR-lite decisions
- `skills/` : task-triggered playbooks (load only when relevant)
- `docs/`   : on-demand background docs (load only specific sections)

---

## 1) Task closeout and memory updates

After completing a task, decide based on actual outcomes whether memory files should be updated.
Only write memory when the result is stable, reusable, and worth retaining.

Reference checklist:
- Updated `memory/FACTS.md`: <what/where>
- Updated `memory/EXPERIENCE.md`: <what/where>
- (optional) Updated `memory/DECISIONS.md`: <what/where>

---

## 2) Task Completion

- **Fix root causes, not symptoms.** No workarounds, no band-aids, no "minimal fixes." If the architecture is wrong, restructure it. Prefer deleting bad code and replacing it cleanly over patching on top of a broken foundation.
- **Finish what you start.** Complete the full task. Don't implement half a feature. Implementation decisions are your job, not questions to ask.
- **Never use these patterns** — they are all ways of asking permission to continue. Just do the work:
  - ❌ "如果你要，我下一步可以..."
  - ❌ "你要我直接...吗？"
  - ❌ "要不要我帮你..."
  - ❌ "是否需要我..."
  - ❌ "我可以帮你...，要我做吗？"
  - ❌ "下一步可以..."（as an offer, not a description of what you ARE doing）
  - ❌ Any sentence ending with "...吗？" that asks whether to proceed with implementation
  - ✅ Instead: "接下来我会 xxx" then execute.

## 2) Development Workflow Rules (Mandatory)

### Superpowers Development Workflow

This project uses the **superpowers** development model.
superpowers is responsible for planning, implementation, debugging, testing, and review activities.
All feature development must follow this workflow:

```
1. Use superpowers to clarify requirements and create the task plan
2. Implement against the task plan and keep progress tracked
3. After implementation, pass tests/builds/required verification
4. Complete verification before marking work as done
```

#### Key Rules

- **Do not skip planning and jump straight into coding**. Every new feature or module must be planned with superpowers before implementation starts.
- **Prefer the superpowers skill that best matches the task**. For example: planning, TDD, debugging, code review, and pre-completion verification should each use the corresponding skill.
- **Do not mark work as Done immediately after coding**. It must first pass tests and complete verification.
- **UI changes must be verified with CDP (chrome-devtools MCP):**
  - After modifying components, styles, or layouts, must verify effects via chrome-devtools MCP
  - Verification flow: `npm run dev` → open page via CDP at `http://localhost:3000` → screenshot to confirm rendering → check console for errors
  - Interactive changes (buttons, forms, navigation) require CDP click/input simulation with screenshots
  - Responsive layout changes require CDP device emulation to verify both desktop and mobile viewports

#### Recommended superpowers skill mapping

- **Task planning**: `writing-plans`, `product-requirements`
- **Task execution/orchestration**: `subagent-driven-development`, `executing-plans`
- **Implementation method**: `test-driven-development`, `dev`
- **Debugging/troubleshooting**: `systematic-debugging`, `root-cause-analyzer`
- **Code review/pre-completion verification**: `requesting-code-review`, `verification-before-completion`

For the detailed process, refer to the relevant superpowers skills under `skills/`.

---

## 3) Development Guidelines

### Core Coding Principles

- **ALWAYS search documentation and existing solutions first**
- **Read template files, adjacent files, and surrounding code** to understand existing patterns
- **Learn code logic from related tests**
- **Review implementation after multiple modifications** to same code block
- **Keep project docs (PRD, todo, changelog) consistent** with actual changes when they exist
- **After 3+ failed attempts**, add debug logging and try different approaches. Only ask the user for runtime logs when the issue requires information you literally cannot access (e.g., production environment, device-specific behavior)
- **For frontend projects, NEVER run dev/build/start/serve commands.** Verify through code review, type checking, and linting instead
- **NEVER add time estimates to plans** (e.g. "Phase 1 (3 days)", "Phase 2 (1 week)") — just write the code
- **NEVER read secret files** (.env, private keys), print secret values, or hardcode secrets in code

### Code Comments

- Comment WHY not WHAT. Prefer JSDoc over line comments.
- **MUST comment:** complex business logic, module limitations, design trade-offs.

---

## 5) Tool Preferences

### Package Management

- **Development tools** - Managed via `proto` (Bun, Node.js and pnpm)
- **Python** - Always use `uv`
- **JavaScript/TypeScript** - Check lock file for package manager

### Search and Documentation

- **File search** - Use `fd` instead of `find`
- **Content search** - Use `rg`
- **GitHub** - MUST use `gh` CLI for all GitHub operations
- **Package docs** - Check official documentation for latest usage

---

## 6) Subagents

- **ALWAYS wait for all subagents to complete** before yielding.
- **Spawn subagents automatically when:**
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently
  - Isolation for risky changes or checks


## 8) Context Compression

When compressing context, preserve in priority order:

1. Architecture decisions and design trade-offs (NEVER summarize away)
2. Modified files and their key changes
3. Current task goal and verification status (pass/fail)
4. Open TODOs and known dead-ends
5. Tool outputs (can discard, keep pass/fail verdict only)

---

## 9) Compound Codex Tool Mapping (Claude Compatibility)

This section maps Claude Code plugin tool references to Codex behavior.
Only this block is managed automatically.

**Priority rule**: If any mapping below conflicts with Core Behavioral Guidelines or Task Completion rules above, the higher-level rule wins. Task Completion > Tool Mapping.

Tool mapping:
- **Read**: use shell reads (cat/sed) or rg
- **Write**: create files via shell redirection or apply_patch
- **Edit/MultiEdit**: use apply_patch
- **Bash**: use shell_command
- **Grep**: use rg (fallback: grep)
- **Glob**: use fd (fallback: rg --files)
- **LS**: use ls via shell_command
- **WebFetch/WebSearch**: use curl or Context7 for library docs
- **AskUserQuestion/Question**: ONLY use for genuine goal ambiguity or user-facing preference decisions (naming, visual design, product direction). Present as a numbered list. NEVER use for implementation decisions — make those yourself. This tool is a last resort, not a default.
- **Task/Subagent/Parallel**: use subagents when work is parallelizable, long-running, or benefits from isolation; otherwise work in main thread. Wait for all subagents to complete before yielding. Use multi_tool_use.parallel for parallel tool calls
- **TodoWrite/TodoRead**: use file-based todos in todos/ with todo-create skill
- **Skill**: open the referenced SKILL.md and follow it
- **ExitPlanMode**: ignore

---

## 10) Task Closeout and Memory Updates

After completing a task, decide based on actual outcomes whether memory files should be updated.
Only write memory when the result is stable, reusable, and worth retaining.

Reference checklist:
- Updated `memory/FACTS.md`: <what/where>
- Updated `memory/EXPERIENCE.md`: <what/where>
- (optional) Updated `memory/DECISIONS.md`: <what/where>
