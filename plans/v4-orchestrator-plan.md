# Plan v4.0: Orchestrator Ready-for-Use Improvements (3 Blocks)

## Block 1: Core Workflow (SDD-ready)
- End-to-end `plan` workflow: CLI creates planner request, Planner produces `plan.md` + `tasks.yaml`.
- `runner.js plan` validation: enforce skills in config, R9 checks, dependency integrity.
- Add `runner.js done|fail|retry` commands to update tasks safely (no manual YAML edits).
- Evidence automation: generate `files_changed` from git diff or hash snapshots, not manual JSON.
- Add `verify` command to check evidence vs outputs and block invalid tasks.
- Add task acceptance criteria field to tasks.yaml and enforce it in review.
- Implement “working set” tracking: top 5–10 active files stored in context.
- Add `context.md` lifecycle rules (max size, refresh triggers, auto-trim).
- Add unit tests for new CLI commands (plan/done/fail/verify).
- Add integration test: full SDD workflow (prompt -> plan -> tasks -> evidence -> complete).

## Block 2: Safety, Consistency, and Collaboration
- Deterministic task IDs and stable sorting for multi-actor edits.
- Multi-actor safety: optimistic lock on tasks.yaml to avoid conflicts.
- Add `pause/resume` reasons and audit log in `system/events.log`.
- Add run history summaries (per run) with diffs and outcomes.
- Add “spec coverage” report: % tasks mapped to spec sections.
- Add “progress dashboard” summary in `system/status.md`.
- Add “dependency health” checks (long chains, cycles, bottlenecks).
- Add “risk flags” in tasks (security, data migration, performance).
- Add redaction/safety rules for secrets and PII in evidence/logs.
- Add data retention policy for memory and evidence.
- Add skill hygiene enforcement in CI (size limits, frontmatter, references).

## Block 3: Expansion (Templates, Domains, Providers)
- Introduce task templates for common modules (auth, CRUD, payments, analytics).
- Add “domain packs” for non-dev work (data analysis, finance analysis, ops).
- Add `skills/` registry index (searchable) and `runner.js skills` command.
- Add optional “task splitting” helper: auto-split tasks that violate R9.
- Add `review` automation hooks (tests, lint, checks) per task output.
- Add cost budget tracking for LLM runs per task.
- Add pluggable provider adapters (Kilo, OpenAI, Anthropic, local).
- Add prompt scaffolds per agent type (planner/executor/qa/reviewer).
- Add documentation: “SDD flow” quickstart and example projects.
