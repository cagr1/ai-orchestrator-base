# Agent Context for AI Assistants

This file provides context for AI assistants working with this orchestrator codebase.

## System Overview

AgentOS is a deterministic parallel orchestrator for multi-agent software development. The system:
- Reads tasks from `system/tasks.yaml`
- Executes tasks automatically via LLM (OpenRouter) or manually
- Validates evidence against declared outputs (R10 anti-hallucination)
- Maintains memory via Engram HTTP API with file fallback

## Key Files

- `runner.js`: Orchestration engine (batch selection, validation, LLM execution)
- `providers/openrouter.js`: OpenRouter API bridge
- `system/tasks.yaml`: Task state source of truth
- `system/state.json`: Execution control (lock, counters)
- `agents/*.md`: Agent role definitions (planner, executor, qa, reviewer)

## Agent Roles

### Planner
Generates tasks based on project goal. Reads `system/goal.md` and outputs to `system/tasks.yaml`.

### Executor
Executes assigned tasks. Reads relevant skill files, makes real file changes, outputs JSON `{files: [{path, content}]}`.

### QA
Verifies task completion by checking `system/evidence/{task_id}.json` and inspecting actual files.

### Reviewer
Scores task quality (1-10) based on skill compliance and evidence.

## Reusable Goal Prompts

### Landing Page (premium)
```
Execute plans/premium-upgrade-plan.md for this landing page in phased delivery.
Prioritize: hero impact, motion consistency, gallery smoothness, lighthouse mobile >= 90.
Do not break existing design language; improve it incrementally.
```

### SaaS / Dashboard
```
Build and refine this SaaS app in phases: planning, core flows, QA/review, performance, accessibility.
Prioritize information hierarchy, system consistency, and error-proof UX.
Require testability and predictable component patterns.
```

### API / Backend
```
Execute phased implementation with strict quality gates:
architecture, contracts, validation, error handling, tests, and security.
Do not progress tasks without QA/reviewer pass signals in tasks.yaml.
```

## Execution Rules

1. Tasks verify file hashes BEFORE and AFTER each action
2. If executor claims done but no real files changed, the completion is REJECTED
3. All file changes must be REAL changes to project files
4. QA and Reviewer verify `system/evidence/{task_id}.json` exists with real changes
5. No evidence = automatic fail

## Workflow

1. `node runner.js init "goal"` - Initialize project
2. Planner generates tasks in `system/tasks.yaml`
3. `node runner.js run` - Execute batch
4. Executor makes changes, marks done
5. QA verifies, Reviewer scores
6. Repeat until all tasks complete

## Local Development Config

`opencode.json` is a local development/editor configuration file for the opencode AI assistant. It is NOT used by the OrchestOS orchestration runtime and has no effect on task execution, LLM provider selection, or any runner.js behavior.

## Evidence Format

```json
{
  "task_id": "T1",
  "executed_at": "2024-03-03T11:00:00Z",
  "files_changed": ["src/database/schema.sql"],
  "summary": "Created PostgreSQL schema"
}
```
