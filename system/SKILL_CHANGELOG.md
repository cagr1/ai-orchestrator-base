# Skill Changelog

Track all skill updates with semantic versioning.

## Format
- Date:
- Skill:
- Version:
- Change type: `add` | `update` | `deprecate` | `remove`
- Summary:
- Triggered by project:
- Validation:

## Entries

### 2026-03-02
- Skill: process/orchestration-runner
- Version: v1.1.0
- Change type: update
- Summary: Runner now starts a fresh run when a new CLI goal is provided and resets plan/tasks to avoid cross-project mixing.
- Triggered by project: printx_ec brief simulation
- Validation: Manual runner test with complex goal prompt.
