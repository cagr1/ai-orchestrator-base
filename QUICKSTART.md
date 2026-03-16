# Quickstart (v3.0)

Use this when you want to run the orchestrator without reading full docs.

## 1) Install dependencies

```bash
npm ci
```

## 2) Initialize a new run

```bash
node runner.js init "Your project goal here"
```

This creates `system/goal.md`, `system/state.json`, `system/tasks.yaml`, and `system/memory.md`.

## 3) Plan tasks (provider-agnostic)

Populate `system/tasks.yaml` with tasks. You can do this manually or by asking any LLM to act as the Planner (see [`agents/planner.md`](agents/planner.md)).

Each task must include:
- `id`, `title`, `description`, `skill`, `estado`, `priority`, `depends_on`
- `input[]` and `output[]` (used for R10 evidence validation)

## 4) Run one round (prints the next parallel batch)

```bash
node runner.js run
```

Runner will:
- Recalculate task states from dependencies
- Validate dependencies + cycles
- Enforce R9 (task size limits)
- Enforce R10 for any task already marked `done` (requires evidence)
- Print a deterministic parallel batch to execute next

## 5) Execute tasks + record evidence

For each executed task:
- Apply the real file changes in the project
- Mark the task as `done` (or `failed`) in `system/tasks.yaml`
- Create `system/evidence/{task_id}.json` listing `files_changed` and a short `summary`

Then run again:

```bash
node runner.js run
```

If you hit the per-session limit (`max_tasks_per_run`), runner will pause. Continue with:

```bash
node runner.js resume
node runner.js run
```

## 6) Check status anytime

```bash
node runner.js status
```

## Common errors

- `Cannot find module 'js-yaml'`:
  - Run `npm ci`
- `RUN LOCKED since ...`:
  - Another run is active, or a previous run crashed. Wait for TTL or delete the lock by editing `system/state.json` if you know what you're doing.
- `Missing evidence for done task: T...`:
  - Create `system/evidence/{task_id}.json` for every task marked `done`.
