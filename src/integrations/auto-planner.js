const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const callOpenRouter = require('../../providers/openrouter');

const detectTier = (goal, skillTriggers = {}) => {
  const g = goal.toLowerCase();
  const premium = skillTriggers.auto_upgrade_to_premium || [];
  const professional = skillTriggers.auto_upgrade_to_professional || [];
  if (premium.some(t => g.includes(t))) return 'premium';
  if (professional.some(t => g.includes(t))) return 'professional';
  return 'basic';
};

const detectProjectSignals = (rootDir) => {
  const signals = [];
  const patterns = [
    { file: 'package.json', type: 'node' },
    { file: 'package-lock.json', type: 'node' },
    { file: '*.csproj', type: 'dotnet' },
    { file: '*.sln', type: 'dotnet' },
    { file: 'composer.json', type: 'php' },
    { file: 'requirements.txt', type: 'python' },
    { file: 'pyproject.toml', type: 'python' },
    { file: 'Gemfile', type: 'ruby' },
    { file: 'go.mod', type: 'go' },
    { file: 'Cargo.toml', type: 'rust' }
  ];

  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (files.includes('package.json') || files.includes('package-lock.json')) signals.push('node');
    if (dirs.includes('node_modules')) signals.push('node');
    if (files.some(f => f.endsWith('.csproj'))) signals.push('dotnet');
    if (files.some(f => f.endsWith('.sln'))) signals.push('dotnet');
    if (files.includes('composer.json')) signals.push('php');
    if (files.includes('requirements.txt')) signals.push('python');
    if (files.includes('pyproject.toml')) signals.push('python');
    if (files.includes('Gemfile')) signals.push('ruby');
    if (files.includes('go.mod')) signals.push('go');
    if (files.includes('Cargo.toml')) signals.push('rust');
  } catch (e) {
    // directory read failed, no signals
  }

  return signals;
};

const getFileList = (rootDir, maxFiles = 100) => {
  const result = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= maxFiles) break;
      if (entry.isFile()) {
        result.push(entry.name);
      }
    }
  } catch (e) {
    // ignore
  }
  return result;
};

const buildPrompt = ({ goal, tier, skills, runId, iteration, now, existingProject, projectContext }) => `You are a software project planner. Your job is to break down a goal into concrete tasks.

GOAL: ${goal}

PROJECT TIER: ${tier}
AVAILABLE SKILLS (use ONLY these): ${skills.join(', ')}
RUN ID: ${runId}
ITERATION: ${iteration}
TIMESTAMP: ${now}
EXISTING PROJECT: ${existingProject}
${projectContext}

INSTRUCTIONS:
- Return ONLY a valid YAML block, no explanation, no markdown prose.
- Wrap it in \`\`\`yaml ... \`\`\`
- Generate 4–8 tasks covering: setup → core features → testing → polish.
- Each task must be specific and actionable.
- Use only skills from the AVAILABLE SKILLS list above.
- "estado" must always be "pending".
- "priority": 1 (highest) to 5 (lowest).
- "depends_on": list IDs of tasks that must finish first.
- Each task "output" must list at most 2 specific file paths (no directory wildcards like /src or /public). Split large project scaffolds across multiple tasks so each task writes 1–2 files.

REQUIRED YAML SCHEMA:
\`\`\`yaml
version: "3.0"
generated_at: "${now}"
run_id: "${runId}"
tasks:
  - id: "T1"
    title: "Short title"
    description: "Detailed description of what to do"
    skill: "one-of-available-skills"
    estado: "pending"
    priority: 1
    depends_on: []
    input: []
    output:
      - "path/to/output"
metadata:
  total_tasks: 1
  completed: 0
  pending: 1
  failed: 0
  blocked: 0
\`\`\`
`;

const extractYaml = (text) => {
  const match = text.match(/```ya?ml\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text.trim();
};

const REQUIRED_TASK_FIELDS = ['id', 'title', 'description', 'skill', 'estado', 'priority', 'depends_on', 'input', 'output'];

const generateTasks = async ({ goal, systemDir, config, state }) => {
  const tier = detectTier(goal, config.skill_triggers);
  const skills = (config.skills_enabled || {})[tier] || (config.skills_enabled || {}).basic || [];
  const runId = state.run_id || `plan-${Date.now()}`;
  const iteration = state.iteration || 1;
  const now = new Date().toISOString();

  const providerCfg = (config.providers || {})[config.active_provider || 'openrouter'] || {};
  const modelKey = (config.model_mapping || {}).planner
    || (config.model_mapping || {}).free_advanced
    || 'free_advanced';
  const model = (providerCfg.models || {})[modelKey] || (providerCfg.models || {}).free_advanced || 'google/gemma-2-2b-it';

  const rootDir = config.system_root_dir || systemDir;
  const projectSignals = detectProjectSignals(rootDir);
  const existingProject = projectSignals.length > 0;
  let projectContext = '';

  if (existingProject) {
    const fileList = getFileList(rootDir);
    const completed = state.completed_tasks || [];
    projectContext = `PROJECT SIGNALS: ${projectSignals.join(', ')}
CURRENT FILES (${fileList.length}): ${fileList.slice(0, 100).join(', ')}
COMPLETED TASKS: ${completed.map(t => t.title || t.id).join(', ') || 'none'}`;
  }

  const prompt = buildPrompt({ goal, tier, skills, runId, iteration, now, existingProject, projectContext });

  let rawOutput;
  try {
    console.log(`[PLANNER] model_key=${modelKey} model=${model}`);
    rawOutput = await callOpenRouter(prompt, config, modelKey);
  } catch (err) {
    console.error(`[PLANNER] LLM call failed model_key=${modelKey} model=${model}: ${err.message}`);
    return { ok: false, error: `LLM call failed: ${err.message}` };
  }

  if (!rawOutput) {
    console.error('[PLANNER] Empty response from LLM');
    return { ok: false, error: 'LLM returned empty response' };
  }
  console.log(`[PLANNER] raw_response_length=${rawOutput.length}`);
  console.log(`[PLANNER] raw_response_snippet=${JSON.stringify(rawOutput.slice(0, 240))}`);

  const yamlText = extractYaml(rawOutput);
  let tasksDoc;
  try {
    tasksDoc = yaml.load(yamlText);
  } catch (parseErr) {
    console.error(`[PLANNER] YAML parse failed: ${parseErr.message}`);
    return { ok: false, error: `YAML parse failed: ${parseErr.message}`, raw: rawOutput };
  }

  const parsedCount = Array.isArray(tasksDoc?.tasks) ? tasksDoc.tasks.length : 0;
  console.log(`[PLANNER] parsed_task_count=${parsedCount}`);
  if (!tasksDoc || !Array.isArray(tasksDoc.tasks) || tasksDoc.tasks.length === 0) {
    const discardReason = !tasksDoc
      ? 'tasks_doc_missing'
      : !Array.isArray(tasksDoc.tasks)
      ? 'tasks_not_array'
      : 'tasks_empty';
    console.error(`[PLANNER] discard_reason=${discardReason}`);
    return { ok: false, error: 'LLM did not return a valid tasks list', discard_reason: discardReason, raw: rawOutput };
  }

  const validTasks = tasksDoc.tasks.filter((task) => {
    if (!task || typeof task !== 'object') return false;
    return REQUIRED_TASK_FIELDS.every((field) => task[field] !== undefined);
  });
  const discardedInvalid = tasksDoc.tasks.length - validTasks.length;
  if (discardedInvalid > 0) {
    console.warn(`[PLANNER] discarded_invalid_tasks=${discardedInvalid}`);
  }
  if (validTasks.length === 0) {
    console.error('[PLANNER] discard_reason=all_tasks_invalid_schema');
    return { ok: false, error: 'Planner produced tasks but none passed schema validation', discard_reason: 'all_tasks_invalid_schema', raw: rawOutput };
  }

  tasksDoc.tasks = validTasks;
  tasksDoc.metadata = {
    ...(tasksDoc.metadata || {}),
    total_tasks: validTasks.length,
    completed: 0,
    pending: validTasks.length,
    failed: 0,
    blocked: 0
  };

  const tasksFile = path.join(systemDir, 'tasks.yaml');
  fs.writeFileSync(tasksFile, yaml.dump(tasksDoc, { indent: 2 }), 'utf-8');
  console.log(`[PLANNER] persisted_tasks_count=${validTasks.length} file=${tasksFile}`);

  return {
    ok: true,
    tier,
    tasks: validTasks,
    total: validTasks.length
  };
};

module.exports = { generateTasks };
