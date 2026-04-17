---
name: bug-triage
description: Use when a runtime, parsing, state, or orchestration bug in OrchestOS must be diagnosed from logs, evidence files, tasks.yaml, or code flow. Do not use for feature implementation.
---

# Bug triage workflow

1. Restate the concrete symptom.
2. List only verified facts from logs/evidence/code.
3. Identify the first breakpoint, not downstream noise.
4. Separate:
   - root cause
   - side effects
   - non-goals
5. Return:
   - exact root cause
   - smallest patch scope
   - validation checklist

Never propose broad refactors during loop-closure stage.