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
- "input": list output file paths from dependency tasks that this task must read before writing its own output. If a task depends on another task, include the relevant dependency output paths here.
- Each task "output" must list at most 2 specific file paths (no directory wildcards like /src or /public). Split large project scaffolds across multiple tasks so each task writes 1–2 files.
- If any task uses skill "frontend-html-basic", make T1 a minimal bootstrap task that outputs ONLY "index.html". Move CSS/JS files to later tasks (T2+).
- For that same frontend-html-basic flow, make T2 output ONLY "docs/wireframe.md" and keep it concise (short wireframe summary, not a full design system spec).
- CSS/JS tasks must be bounded: max 100 lines per output file. Never create one broad "full styles" task. Split CSS into layout, components, typography, and responsive section tasks when needed.
- For frontend-html-basic projects with separate CSS or JS outputs, create a final integration task that outputs "index.html", depends on the CSS/JS tasks, and lists "index.html" plus those CSS/JS files in "input". This final task must link the generated assets from the HTML.

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

const enforceFrontendBootstrap = (tasks = []) => {
  const t1 = tasks.find(task => task && task.id === 'T1');
  if (!t1) return;
  if (t1.skill !== 'frontend-html-basic') return;
  t1.output = ['index.html'];
};

const enforceFrontendT2Sizing = (tasks = []) => {
  const t1 = tasks.find(task => task && task.id === 'T1');
  if (!t1 || t1.skill !== 'frontend-html-basic') return;

  const t2 = tasks.find(task => task && task.id === 'T2');
  if (!t2) return;

  t2.output = ['docs/wireframe.md'];
  t2.description = 'Write a concise landing-page wireframe summary in Markdown (max 120 lines): sections, content hierarchy, and brief component notes. Do not include full style guide, exhaustive copy, or long design-system documentation.';
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const ensureListIncludes = (task, field, values) => {
  task[field] = unique([...(Array.isArray(task[field]) ? task[field] : []), ...values]);
};

const replaceDependency = (task, oldId, newIds) => {
  const deps = Array.isArray(task.depends_on) ? task.depends_on : [];
  task.depends_on = unique(deps.flatMap(dep => dep === oldId ? newIds : [dep]));
};

const isFrontendAssetPath = (filePath = '') => /\.(css|js)$/i.test(filePath);

const isCssPath = (filePath = '') => /\.css$/i.test(filePath);

const taskOutputs = (task) => Array.isArray(task?.output) ? task.output.filter(Boolean) : [];

const CSS_SECTION_ORDER = ['layout', 'components', 'typography', 'responsive'];

const CSS_SECTION_OUTPUTS = {
  layout: 'styles/layout.css',
  components: 'styles/components.css',
  typography: 'styles/typography.css',
  responsive: 'styles/responsive.css'
};

const CSS_SECTION_DESCRIPTIONS = {
  layout: 'Generate only the layout CSS section for page structure, containers, grids, spacing, and major regions. Keep output under 100 lines and do not include component, typography, or responsive rules.',
  components: 'Generate only the component CSS section for buttons, cards, navigation, forms, and repeated UI elements. Keep output under 100 lines and do not include layout, typography, or responsive rules.',
  typography: 'Generate only the typography CSS section for font stacks, headings, body text, links, and content rhythm. Keep output under 100 lines and do not include layout, component, or responsive rules.',
  responsive: 'Generate only the responsive CSS section for breakpoints and mobile/desktop adjustments. Keep output under 100 lines and do not include base layout, component, or typography rules.'
};

const CSS_SCOPE_KEYWORDS = ['layout', 'components', 'component', 'typography', 'responsive', 'variables', 'tokens'];
const JS_SCOPE_KEYWORDS = ['interaction', 'interactions', 'navigation', 'form', 'forms', 'animation', 'state'];
const TASK_SIZE_RISK_WORDS = ['full', 'complete', 'entire', 'whole', 'comprehensive', 'all'];

const hasScopeKeyword = (task, keywords) => {
  const text = `${task.title || ''} ${task.description || ''} ${taskOutputs(task).join(' ')}`.toLowerCase();
  return keywords.some(keyword => text.includes(keyword));
};

const hasTaskSizeRiskWord = (task) => {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  return TASK_SIZE_RISK_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(text));
};

const isGenericCssTask = (task) => {
  const outputs = taskOutputs(task);
  const cssOutputs = outputs.filter(isCssPath);
  if (cssOutputs.length === 0) return false;
  if (cssOutputs.some(output => Object.values(CSS_SECTION_OUTPUTS).includes(output))) return false;
  return hasTaskSizeRiskWord(task) || !hasScopeKeyword(task, CSS_SCOPE_KEYWORDS);
};

const isGenericJsTask = (task) => {
  const outputs = taskOutputs(task).filter(output => /\.js$/i.test(output));
  return outputs.length > 0 && !hasScopeKeyword(task, JS_SCOPE_KEYWORDS);
};

const nextTaskIdFactory = (tasks = []) => {
  let next = tasks.reduce((max, task) => {
    const match = String(task?.id || '').match(/^T(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return () => `T${next++}`;
};

const enforceCSSTaskSizing = (tasks = []) => {
  const t1 = tasks.find(task => task && task.id === 'T1');
  if (!t1 || t1.skill !== 'frontend-html-basic') return;

  const getNextTaskId = nextTaskIdFactory(tasks);
  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    if (!task || task.skill !== 'frontend-html-basic') continue;

    if (isGenericJsTask(task)) {
      task.description = `${task.description || 'Generate JavaScript interactions.'} Scope this task to one interaction area only and keep the JS output under 100 lines.`;
      ensureListIncludes(task, 'depends_on', ['T1']);
      ensureListIncludes(task, 'input', ['index.html']);
    }

    if (!isGenericCssTask(task)) continue;

    const originalId = task.id;
    const originalDepends = Array.isArray(task.depends_on) ? task.depends_on : [];
    const originalInput = Array.isArray(task.input) ? task.input : [];
    const sectionTasks = CSS_SECTION_ORDER.map((section, sectionIndex) => ({
      ...task,
      id: sectionIndex === 0 ? originalId : getNextTaskId(),
      title: `Create ${section} CSS section`,
      description: CSS_SECTION_DESCRIPTIONS[section],
      depends_on: unique([...originalDepends, 'T1']),
      input: unique([...originalInput, 'index.html', 'docs/wireframe.md']),
      output: [CSS_SECTION_OUTPUTS[section]]
    }));

    tasks.splice(index, 1, ...sectionTasks);
    const sectionIds = sectionTasks.map(sectionTask => sectionTask.id);
    for (const candidate of tasks) {
      if (!sectionIds.includes(candidate.id)) {
        replaceDependency(candidate, originalId, sectionIds);
      }
    }
    index += sectionTasks.length - 1;
  }
};

const enforceFrontendIntegrationInputs = (tasks = []) => {
  const t1 = tasks.find(task => task && task.id === 'T1');
  if (!t1 || t1.skill !== 'frontend-html-basic') return;

  const htmlPath = 'index.html';
  const assetTasks = tasks.filter(task => {
    const outputs = taskOutputs(task);
    return !outputs.includes(htmlPath) && outputs.some(isFrontendAssetPath);
  });
  if (assetTasks.length === 0) return;

  for (const task of assetTasks) {
    if (task.id !== 'T1') {
      ensureListIncludes(task, 'depends_on', ['T1']);
    }
    ensureListIncludes(task, 'input', [htmlPath]);
  }

  const assetTaskIds = assetTasks.map(task => task.id).filter(Boolean);
  const assetOutputs = unique(assetTasks.flatMap(taskOutputs).filter(isFrontendAssetPath));
  const sectionCssOutputs = assetOutputs.filter(output => Object.values(CSS_SECTION_OUTPUTS).includes(output));
  let integrationTask = tasks.find(task => task.id !== 'T1' && taskOutputs(task).includes(htmlPath));

  if (!integrationTask) {
    const maxNumericId = tasks.reduce((max, task) => {
      const match = String(task?.id || '').match(/^T(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    integrationTask = {
      id: `T${maxNumericId + 1}`,
      title: 'Integrate generated frontend assets',
      description: 'Update index.html to link the generated CSS and JavaScript files. Preserve the existing HTML structure and only add the required stylesheet and script references.',
      skill: 'frontend-html-basic',
      estado: 'pending',
      priority: Math.min(5, Math.max(1, ...assetTasks.map(task => Number(task.priority) || 1)) + 1),
      depends_on: [],
      input: [],
      output: [htmlPath]
    };
    tasks.push(integrationTask);
  }

  ensureListIncludes(integrationTask, 'depends_on', assetTaskIds);
  ensureListIncludes(integrationTask, 'input', [htmlPath, ...assetOutputs]);
  integrationTask.output = sectionCssOutputs.length > 0 ? [htmlPath, 'styles.css'] : [htmlPath];
  if (sectionCssOutputs.length > 0) {
    integrationTask.description = 'Merge CSS section files in this order: layout, components, typography, responsive. Write the merged result to styles.css, then update index.html to link styles.css and any generated JavaScript files. Preserve existing HTML content.';
  }
};

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

  enforceFrontendBootstrap(validTasks);
  enforceFrontendT2Sizing(validTasks);
  enforceCSSTaskSizing(validTasks);
  enforceFrontendIntegrationInputs(validTasks);
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
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(tasksFile, yaml.dump(tasksDoc, { indent: 2 }), 'utf-8');
  console.log(`[PLANNER] persisted_tasks_count=${validTasks.length} file=${tasksFile}`);

  return {
    ok: true,
    tier,
    tasks: validTasks,
    total: validTasks.length
  };
};

module.exports = { generateTasks, enforceCSSTaskSizing, enforceFrontendIntegrationInputs };
