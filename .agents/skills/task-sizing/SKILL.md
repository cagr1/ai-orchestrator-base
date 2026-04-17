---
name: task-sizing
description: Use when a task may be too large for safe execution in OrchestOS, especially when output truncation, oversized files[], or parsing failures appear.
---

# Task sizing workflow

Evaluate whether a task is safely executable.

Check:
- number of output files
- output file types (.css, .md, .jsx, .tsx)
- risky words: full, complete, entire, responsive, wireframe, design system, scaffold
- whether one task mixes documentation and implementation
- whether one task is likely to exceed a safe single-response payload

Return:
- risk score
- why it is oversized or safe
- how to split it deterministically
- smallest safe replacement tasks

Do not redesign the whole planner.