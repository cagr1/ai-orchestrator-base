# Technical Documentation (v4)

This document explains the internal architecture, data flow, invariants, and extension points of the orchestrator.

## 1) System Architecture

**Core components**
- `runner.js`: orchestration engine (deterministic batch selection + validation + audit)
- `system/`: run state, plans, tasks, evidence, context, and dashboards
- `skills/`: reusable skill prompts (domain knowledge)
- `agents/`: role definitions (planner/executor/qa/reviewer) + prompt scaffolds
- `templates/` and `domain-packs/`: task patterns for common modules and non-dev workflows

**Key design principle**
- Task state lives **only** in `system/tasks.yaml`. `system/state.json` is execution control only.

## 2) Execution Flow

**Init**
1. `node runner.js init "<goal>"`
2. Creates `system/goal.md`, `system/state.json`, empty `system/tasks.yaml`
3. Creates `system/context.md` and `system/status.md`

**Plan**
1. `node runner.js plan "<prompt>"`
2. Writes `system/plan_request.md` (goal + context + tasks + skills summary)
3. Planner/LLM updates `system/plan.md` and `system/tasks.yaml`

**Run**
1. `node runner.js run`
2. Validates tasks (schema + skills + R9 + deps + cycles)
3. Recalculates blocked/pending from dependencies
4. Validates evidence for done tasks (R10)
5. Selects deterministic batch (priority then id)
6. Writes context + status + run history

## 3) Files and Their Roles

**System**
- `system/goal.md`: immutable high-level objective
- `system/plan.md`: phase plan (specification)
- `system/plan_request.md`: compact planner input
- `system/tasks.yaml`: task state source of truth
- `system/state.json`: execution control, run lock, counters
- `system/memory.md`: append-only decisions
- `system/context.md`: compact context snapshot
- `system/status.md`: progress + risks dashboard
- `system/events.log`: audit log
- `system/runs/<run_id>/history.log`: per-run history
- `system/evidence/<task_id>.json`: task proof

**Config**
- `system/config.json`: limits, skills enabled, evidence policy, retention, providers

**Generated**
- `system/skills_index.json`
- `system/provider.json`
- `system/cost.json`
- `system/splits/*.yaml`

## 4) Invariants and Guardrails

**R9 Task Size**
- Output and input list limited, description length bounded
- Violations halt planning validation

**R10 No Implicit Tasks**
- Evidence files must point only to allowed outputs
- Enforced in `run` and `verify`

**Planner Guardrail**
- Planner allowed only in planning phase or tasks.yaml absent

**Concurrency**
- Optimistic lock on `tasks.yaml` prevents overwrites

## 5) Determinism

- Batch selection is deterministic: `priority` then `id`
- Tasks saved in deterministic order

## 6) Evidence System

- Evidence required by default
- Auto evidence from `git diff --name-only` or manual file list
- Redaction applied to evidence summary

## 7) CLI Summary

**Planning**
- `plan`, `validate`, `skills`, `split`

**Execution**
- `run`, `resume`, `done`, `fail`, `retry`, `verify`, `evidence`

**Observability**
- `status`, `context`

**Ops**
- `provider`, `cost`

## 8) Extension Points

- Add new skills in `skills/` and enable in `system/config.json`
- Add module templates in `templates/modules/`
- Add domain packs in `domain-packs/`
- Replace planner/executor prompt scaffolds in `agents/prompts/`

## 9) Known Gaps / Future Improvements

- No built-in LLM integration (planner/executor is manual or external)
- Evidence automation is git-diff based only
- Cost tracking is local and not tied to real provider billing
- No structured spec coverage enforcement (spec_ref not required yet)

## 10) Suggested Next Steps

- Add provider adapters (Kilo/OpenAI/Anthropic/local)
- Add spec coverage enforcement and accept criteria checks
- Add task templates for more domains (ERP, logistics, BI, CRM)
