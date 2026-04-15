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

const buildPrompt = ({ goal, tier, skills, runId, iteration, now }) => `You are a software project planner. Your job is to break down a goal into concrete tasks.

GOAL: ${goal}

PROJECT TIER: ${tier}
AVAILABLE SKILLS (use ONLY these): ${skills.join(', ')}
RUN ID: ${runId}
ITERATION: ${iteration}
TIMESTAMP: ${now}

INSTRUCTIONS:
- Return ONLY a valid YAML block, no explanation, no markdown prose.
- Wrap it in \`\`\`yaml ... \`\`\`
- Generate 4–8 tasks covering: setup → core features → testing → polish.
- Each task must be specific and actionable.
- Use only skills from the AVAILABLE SKILLS list above.
- "estado" must always be "pending".
- "priority": 1 (highest) to 5 (lowest).
- "depends_on": list IDs of tasks that must finish first.

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

  const prompt = buildPrompt({ goal, tier, skills, runId, iteration, now });

  let rawOutput;
  try {
    rawOutput = await callOpenRouter(prompt, model);
  } catch (err) {
    return { ok: false, error: `LLM call failed: ${err.message}` };
  }

  if (!rawOutput) {
    return { ok: false, error: 'LLM returned empty response' };
  }

  const yamlText = extractYaml(rawOutput);
  let tasksDoc;
  try {
    tasksDoc = yaml.load(yamlText);
  } catch (parseErr) {
    return { ok: false, error: `YAML parse failed: ${parseErr.message}`, raw: rawOutput };
  }

  if (!tasksDoc || !Array.isArray(tasksDoc.tasks) || tasksDoc.tasks.length === 0) {
    return { ok: false, error: 'LLM did not return a valid tasks list', raw: rawOutput };
  }

  const tasksFile = path.join(systemDir, 'tasks.yaml');
  fs.writeFileSync(tasksFile, yaml.dump(tasksDoc, { indent: 2 }), 'utf-8');

  return {
    ok: true,
    tier,
    tasks: tasksDoc.tasks,
    total: tasksDoc.tasks.length
  };
};

module.exports = { generateTasks };
