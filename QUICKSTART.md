# Quickstart (2-Minute Flow)

Use this when you want to run the orchestrator without reading full docs.

## 1) Go to orchestrator folder

```bash
cd ".agents"
```

## 2) Start a new run

```bash
node runner.js start "Your project goal here"
```

This initializes a new run and immediately prints the first required action.

## 3) Ask Kilo.ai to execute the required action

When runner prints `[ACTION]`, do that action in Kilo.ai chat (Planner/Executor/QA/Reviewer/Memory).

## 4) Continue one step at a time

```bash
node runner.js next
```

Repeat:
- Kilo executes requested action
- You run `node runner.js next`

Until `phase=complete` or `halted=true`.

## 5) Check state anytime

```bash
node runner.js status
```

## 6) Final run output

Check:
- `system/runs/<run_id>/summary.md`
- `system/runs/<run_id>/events.log`

## Common errors

- `Cannot find module scripts/init-project.js`:
  - You are in the wrong folder. Run commands inside `.agents`.
- `require is not defined in ES module scope`:
  - Ensure `.agents/package.json` exists with `"type": "commonjs"`.
- `HALT: invalid_tasks_schema`:
  - Fix `system/tasks.md` to include required columns:
    - `id | skill | estado | resultado`
