# OrchestOS Agent Guidance

## Objective
Close the core execution loop reliably:
Input -> Plan -> T1 -> real file -> T2 -> real file -> ...

## Current priority
- Do not redesign architecture while loop closure is incomplete.
- Prefer surgical fixes over broad refactors.
- Treat logs, evidence, tasks.yaml, and state files as source of truth.
- Never “fix everything” in one patch.

## Working rules
- One blocker at a time.
- First find the exact breakpoint.
- Then apply the smallest defensible patch.
- Always preserve evidence.
- If a task fails, prefer fail-fast over silent continuation.

## Validation rules
- Every patch must include:
  1. exact root cause
  2. exact diff
  3. validation checklist
- No merge without a real repro run.

## Current recurring issues
- oversized task outputs can cause truncation
- parse failures must be explicit and evidenced
- task sizing is an architectural concern, not a one-off patch