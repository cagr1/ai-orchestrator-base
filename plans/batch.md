BATCH 1:
Objective:
Implement real disk-write verification before marking auto-executed tasks as done.
Files:
runner.js
Constraints:
Only change the run command execution path (AUTO_EXECUTE loop). Do not change CLI commands or planner flow.
Exact task:
In task execution, snapshot declared task.output files before write, snapshot again after write, and fail task if none of those declared files changed on disk. Only mark done when at least one declared output changed.

BATCH 2:
Objective:
Align evidence output with real changed files.
Files:
runner.js
Constraints:
Do not alter evidence schema keys.
Exact task:
Update evidence creation in auto-execution to use the verified changed declared outputs (not raw parsed file list) for files_changed and summary.

BATCH 3:
Objective:
Add regression test coverage for “no real file change => task fails”.
Files:
tests/phase_sdd_flow.test.js (or closest runner-flow test file), tests/run-all.js (only if needed)
Constraints:
Use existing test style and runner invocation patterns.
Exact task:
Add a test that executes a task whose LLM output does not modify any declared output file and assert task is not marked done (must become failed path).

BATCH 4:
Objective:
Remove duplicated OpenRouter implementation and keep one canonical call path.
Files:
runner.js, providers/openrouter.js
Constraints:
Do not change request/response contract used by runLLM.
Exact task:
Delete in-file OpenRouter request logic duplication from runner.js and route all model calls through providers/openrouter.js only.

BATCH 5:
Objective:
Verify no remaining duplicate OpenRouter code paths.
Files:
runner.js, providers/openrouter.js, relevant tests if broken
Constraints:
No refactor beyond duplication cleanup.
Exact task:
Search and remove dead/unused OpenRouter helper functions/imports so only one implementation remains referenced.

BATCH 6:
Objective:
Add existing-project detection and context injection in planner integration.
Files:
src/integrations/auto-planner.js
Constraints:
Do not change endpoint contracts; keep current planner output format.
Exact task:
Before planner LLM call, detect project signals (package.json, *.csproj, *.sln, composer.json, requirements.txt, pyproject.toml), gather minimal stack context + current file list + completed tasks, and inject this into planner prompt payload with existing_project: true/false.

BATCH 7:
Objective:
Move dashboard terminal out of Prompt tab into always-visible bottom panel.
Files:
src/web/public/dashboard/index.html (plus its linked JS/CSS files only if already separate)
Constraints:
Keep existing EventSource/Socket wiring behavior.
Exact task:
Relocate terminal markup to a persistent lower panel visible across tabs, with collapse toggle, without breaking current log stream rendering.

BATCH 8:
Objective:
Create/complete separate Execution tab for run monitoring.
Files:
src/web/public/dashboard/index.html and linked dashboard script file
Constraints:
Do not move intake controls back into this tab.
Exact task:
Ensure Execution tab shows run history entries with per-task badges (model, cost, duration) and pause/resume controls wired to existing APIs/events.

BATCH 9:
Objective:
Simplify Objective (Intake) tab to only intake controls.
Files:
src/web/public/dashboard/index.html and linked dashboard script file
Constraints:
No terminal content inside Objective tab.
Exact task:
Keep only: large objective textarea, existing-project toggle/field, and primary actions (Iniciar Proyecto, Generar Plan, Ejecutar), removing mixed monitoring elements.

BATCH 10:
Objective:
Add explicit existing-project planning rules to planner agent prompt.
Files:
agents/planner.md
Constraints:
Do not change output schema instructions.
Exact task:
Add rule block: when existing_project=true, first tasks must analyze structure/dependencies/key code before proposing modifications; avoid proposing blind file recreation.

BATCH 11:
Objective:
Add existing-project safety rules to executor agent prompt.
Files:
agents/executor.md
Constraints:
Keep current executor response format requirements.
Exact task:
Add rules: read before modify, extend existing files instead of overwrite-by-default, and require diff-aware edits when file already exists.

BATCH 12:
Objective:
Pass existing-file context into execution prompt for relevant outputs.
Files:
runner.js
Constraints:
Only include concise snippets/metadata to control token cost.
Exact task:
When building execution prompt, for each declared output that already exists, include compact pre-edit context (path + current content excerpt or hash+excerpt) so executor applies modifications rather than recreating blindly.

BATCH 13:
Objective:
Consolidate root documentation into README.md + CLAUDE.md.
Files:
README.md, CLAUDE.md, TECHNICAL.md, USAGE.md, QUICKSTART.md, DOCUMENTACION.md, PROMPTS.md, CHAT_PROMPT_TEMPLATE.md, CONTINUE_FROM_HOME.md
Constraints:
No new features or workflows; preserve existing factual content.
Exact task:
Merge relevant content into README.md/CLAUDE.md, then remove obsolete root docs listed above.

BATCH 14:
Objective:
Resolve domain-packs/ status (integrate if used, delete if unused).
Files:
domain-packs/**, system/config.json (or actual skill-selector config file)
Constraints:
No new domain-pack mechanism.
Exact task:
Check whether domain-packs are referenced by runtime skill selection; if unreferenced, delete domain-packs/; if referenced, wire references to existing skill selector config only.

BATCH 15:
Objective:
Document opencode.json as non-orchestration local-dev config.
Files:
CLAUDE.md (or single canonical dev doc), optional inline comment in opencode.json
Constraints:
Do not integrate opencode.json into runner/provider flow.
Exact task:
Add explicit note that opencode.json is local development/editor config and not used by OrchestOS orchestration runtime.