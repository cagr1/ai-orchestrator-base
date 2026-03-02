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
