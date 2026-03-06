# Skill Evolution Workflow

This file defines how to convert new implementation learnings into reusable skills.

## Goal
Capture repeatable engineering decisions from project execution and promote them into `skills/` with versioned history.

## Promotion Flow
1. Detect a new learning during execution or review.
2. Register it in `system/memory.md` with context and impact.
3. Create a proposal in `system/skill-proposals/` using the template.
4. Validate the proposal with acceptance checks.
5. Update the target skill in `skills/`.
6. Record the change in `system/SKILL_CHANGELOG.md`.

## Promotion Criteria
- Reusable in at least 2 projects.
- Improves quality, speed, or reliability.
- Has a clear "when to apply" condition.
- Includes a concrete example.
- Includes anti-patterns or boundaries.

## Ownership
- Planner: detect if a task needs a skill update.
- Executor: propose concrete rule changes.
- QA: verify the new rule is testable.
- Reviewer: approve promotion and request changelog entry.

---

## Skill Hygiene Policy (Size Limits)

To maintain readability and reduce instruction conflict risk, skills should follow these size guidelines:

| Size Category | Lines | Description |
|---------------|-------|-------------|
| **Ideal** | 60-120 | Optimal for focused execution |
| **Maximum** | 150 | Hard limit before splitting required |
| **Warning** | 120+ | Consider splitting |

### When to Split a Skill
- When the skill exceeds 150 lines
- When the skill covers multiple distinct concerns (e.g., config + creative + engineering)
- When different execution contexts need only subsets of the skill

### Splitting Strategy
1. Identify logical sections with distinct purposes
2. Create focused sub-skills (60-120 lines each)
3. Update original skill to reference sub-skills
4. Maintain backward compatibility by keeping original as entry point

### Example: design-taste.md
- Original: 226 lines (exceeded max)
- Split into:
  - `design-taste-config.md` (~45 lines) - Configuration & Architecture
  - `design-taste-engineering.md` (~65 lines) - Engineering & Performance
  - `design-taste-anti-slop.md` (~35 lines) - Forbidden Patterns
  - `design-taste-creative.md` (~100 lines) - Creative Arsenal & Motion
  - `design-taste-checklist.md` (~12 lines) - Pre-flight Checklist
