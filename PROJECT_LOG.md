# PROJECT_LOG

This is the project narrative for a new engineer joining OrchestOS. It is intentionally candid. The repo moved quickly, and several phases were driven by bugs found only after live use.

## Phase 1 - Foundations (2026-03-02)

What was built:
The entire first operating system for OrchestOS landed in one day. The repo gained the runner, role prompts, a large skill catalog, `system/config.json`, startup scripts, a bootstrap flow, smoke coverage, evidence capture, `tasks.yaml`, resumable state, deterministic batch selection, validation rules (R9/R10/R11), and end-to-end simulation tests. This is the day the project became more than a prompt bundle.

What broke or was risky:
The speed of the build meant that many guarantees were introduced as rules before they were battle-tested in real runs. Early March is heavy on feature addition and lighter on real-world failure reports. Some commits are best read as "systemization" rather than bug fixes.

What was learned:
The team quickly converged on a core principle that still appears in `NEXT_ACTIONS.md` and `PROJECT_STATE.md`: real execution must leave observable evidence. That principle drove the v2.0 evidence system and most of v3.0's defensive work.

Architecture changes:
The architecture shifted from a loose orchestration concept to a stateful runtime with:
- `system/state.json` for lifecycle state and locks
- `system/tasks.yaml` as the execution contract
- `system/evidence/*.json` as proof of actual file changes
- `runner.js` as the central state machine

## Phase 2 - Quality & Improvements (2026-03-06)

What was built:
v3.1 added retry accounting, permanent failure states, corrective tasks, and memory compaction. Skill hygiene also became a first-class concern: long skills were split into sub-skills, a size policy was documented, and tests were added to keep the modular structure honest.

What broke:
This phase was a response to maintainability pressure rather than one catastrophic bug. The runtime needed better failure semantics, and the skills library had started to sprawl.

What was learned:
Two important lessons showed up here and kept paying off later:
- A failed task needs a lifecycle, not just a red status. That is why `failed_permanent`, retry limits, and corrective tasks exist.
- Prompt assets need governance. Skill files are code, and once they grow unchecked they become another source of silent breakage.

Architecture changes:
The runtime gained a richer failure model, and the skills subsystem became more modular. This was also the start of treating tests as architectural documentation, not just correctness checks.

## Phase 3 - Dashboard & UI (2026-03-15 to 2026-04-14)

What was built:
March 15 expanded the CLI flow, the SDD flow, safety around `tasks.yaml`, and domain packs/templates/providers. Then, on April 7, the project grew a serious web dashboard: API routes, a web server, realtime updates, dashboard services, and a browser UI for planning/running. April 14 cleaned up that dashboard and refactored it again into the v7 model with a combined `project/start` path and an auto-planner.

What broke:
This was the phase where the project started colliding with real operator UX. The first dashboard versions exposed issues that pure CLI testing had not surfaced:
- path handling failed in directories with spaces
- the memory path was too entangled with Engram
- the dashboard depended on CDN assets
- UI structure and runtime flow were disconnected enough that "create", "plan", and "run" did not yet feel like one loop

What was learned:
The dashboard was not just a front-end skin. It became another runtime client, and that meant service contracts had to be stable. Real-time state, task generation, project root management, and browser affordances all had to line up with the runner's state machine.

Architecture changes:
The architecture moved from a pure CLI orchestrator to a two-surface system:
- backend runtime in `runner.js`
- web control plane in `src/web/**`

By the end of this phase, the auto-planner had also become part of the core architecture rather than an optional helper.

## Phase 4 - Runtime Integration (2026-04-15)

What was built:
April 15 was the integration day. Existing-project detection was added to the planner, dashboard/runtime wiring was tightened, and multiple sync fixes landed across the runner, planner, provider layer, and dashboard service. The project was clearly trying to become a closed loop instead of a collection of adjacent features.

What broke:
This phase exists because the previous dashboard work still left seams:
- planner context could ignore existing project signals
- runtime and dashboard state could drift
- provider execution settings still needed tuning

What was learned:
The repo had reached the point where integration bugs mattered more than isolated feature gaps. A feature was no longer "done" if the file existed; it had to survive the path from UI event to planner to executor to filesystem to dashboard refresh.

Architecture changes:
The planner, provider, and dashboard service became tightly coupled parts of the execution loop. This is the moment OrchestOS started acting like a runtime product instead of a toolkit.

## Phase 5 - First Live Runs (2026-04-21 to 2026-04-23)

What was built:
This is the first phase backed by explicit "run real, then fix" discipline in the repo memory. New operating docs were written (`NEXT_ACTIONS.md`, `PROJECT_STATE.md`, `WORKFLOW_RULES.md`, `SYSTEM_MAP.md`), the execution loop was hardened, the dashboard learned to auto-resume after a paused batch, project creation was guarded against overwriting active work, and the auto-planner learned to split broad CSS tasks and synthesize a final frontend integration step.

What broke:
Live runs exposed issues that the earlier tests did not fully catch:
- `tasks.yaml` save conflicts could silently lose state transitions
- dependency failures needed a hard block in the runtime loop
- generic CSS tasks were too large and got truncated
- generated frontend assets could exist without being linked into `index.html`
- the dashboard could recreate or resume projects in confusing ways

What was learned:
The team explicitly adopted a better debugging rule: test or reproduce first, fix the source, and then validate in a real run. `PROJECT_STATE.md` now treats browser confirmation and clean reruns from a wiped `project_root` as the standard for saying the loop is actually closed.

Architecture changes:
The auto-planner became more than a task list generator. It now enforces execution-shape constraints:
- split oversized CSS work into bounded sections
- require asset tasks to read `index.html`
- create a final integration task so the HTML consumes generated CSS/JS

At the same time, the dashboard service became responsible for preserving and resuming runtime state, not just triggering processes.

## Phase 6 - Current state and open work

Current state:
The repo now has a working runner, evidence-backed execution, deterministic task selection, retry/failure handling, a browser dashboard, and an auto-planner that can generate bounded frontend plans. `PROJECT_STATE.md` says the loop has been confirmed three times in live runs, with PTASK-BOUND and PINTEGRATION validated on 2026-04-23. I also re-ran `npm test` successfully while preparing this log.

Open work:
The project is not "finished"; it is in an output-quality and UX phase. The biggest open issue is `PSKILL-CONTRACT`: skill files still route model selection but are not injected into the executor prompt, which explains why live output can be structurally correct but content-poor. The dashboard also still has open UX debt around duplicated project-root controls, silent goal reuse, kanban refresh after config save, and richer realtime status.

The honest summary:
OrchestOS did not grow in a straight line. It started as a disciplined CLI orchestrator, became a test-heavy runtime, then became a dashboard product, and only after live runs did it start to feel operationally trustworthy. The current codebase reflects that history: strong guardrails, good tests, some large central files, and a few UX seams still being tightened.

## How to keep this up to date

Use the weekly maintenance skill at `skills/project-log-update.md`.

That skill should:
- run `git log --since="7 days ago"` to find new commits
- read the current `HISTORY.md` and `PROJECT_LOG.md`
- append new resolved items to `HISTORY.md`
- update the "Current state and open work" section in `PROJECT_LOG.md`
- output a short diff summary of what changed

Keep the same rules used for this document:
- use exact commit dates
- source claims from git, code, tests, or the current project state docs
- verify any cited `file:line` reference with `rg -n` before writing it
- write `details not recoverable from git` instead of inventing missing history
