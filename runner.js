#!/usr/bin/env node

/**
 * Agent System Runner v3.0 - Deterministic Parallel Orchestrator
 *
 * Phase 1: Simplified state.json with Run Lock + TTL
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const crypto = require('crypto');
const callOpenRouter = require('./providers/openrouter');
const { createMemoryManager } = require('./src/integrations/memory-manager');
const { runAutoskills, normalizeVendorSkills } = require('./src/integrations/autoskills-adapter');
const { auditSkillsDirectory } = require('./src/integrations/skill-manager');

const ACTIVE_ROOT = (() => {
  const args = process.argv.slice(2);
  const rootFlagIndex = args.indexOf('--root');
  if (rootFlagIndex !== -1 && args[rootFlagIndex + 1]) {
    return path.resolve(args[rootFlagIndex + 1]);
  }
  return path.resolve(__dirname);
})();

const ROOT_DIR = ACTIVE_ROOT;
const SYSTEM_DIR = path.join(ROOT_DIR, 'system');
const GOAL_FILE = path.join(SYSTEM_DIR, 'goal.md');
const PLAN_FILE = path.join(SYSTEM_DIR, 'plan.md');
const TASKS_FILE = path.join(SYSTEM_DIR, 'tasks.yaml');
const MEMORY_FILE = path.join(SYSTEM_DIR, 'memory.md');
const STATE_FILE = path.join(SYSTEM_DIR, 'state.json');
const CONFIG_FILE = path.join(SYSTEM_DIR, 'config.json');
const ORCHESTOS_CONFIG_FILE = path.join(__dirname, 'system', 'config.json');
const CONTEXT_FILE = path.join(SYSTEM_DIR, 'context.md');
const PLAN_REQUEST_FILE = path.join(SYSTEM_DIR, 'plan_request.md');
const EVENTS_FILE = path.join(SYSTEM_DIR, 'events.log');
const STATUS_FILE = path.join(SYSTEM_DIR, 'status.md');
const RUNS_DIR = path.join(SYSTEM_DIR, 'runs');
const COST_FILE = path.join(SYSTEM_DIR, 'cost.json');
const PROVIDER_FILE = path.join(SYSTEM_DIR, 'provider.json');
const AUTO_EXECUTE = true;
const SKILLS_INDEX_FILE = path.join(SYSTEM_DIR, 'skills_index.json');
const SPLITS_DIR = path.join(SYSTEM_DIR, 'splits');
const SKILL_SUGGESTIONS_FILE = path.join(SYSTEM_DIR, 'skill_suggestions.json');
const memoryManager = createMemoryManager({
  memoryFile: MEMORY_FILE,
  configFile: CONFIG_FILE
});

// ============================================================
// FILE OPERATIONS
// ============================================================

const readFile = (filepath) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const writeFile = (filepath, content) => {
  fs.writeFileSync(filepath, content, 'utf-8');
};

const readJSON = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  const sanitized = content.replace(/^\uFEFF/, '');
  return JSON.parse(sanitized);
};

const writeJSON = (filepath, data) => {
  writeFile(filepath, JSON.stringify(data, null, 2));
};

const fileExists = (filepath) => fs.existsSync(filepath);

const readYAML = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  return yaml.load(content);
};

const writeYAML = (filepath, data) => {
  writeFile(filepath, yaml.dump(data, { indent: 2 }));
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const nowIso = () => new Date().toISOString();

const getFileContentHash = (absolutePath) => {
  try {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return null;
    }
    const content = fs.readFileSync(absolutePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (_e) {
    return null;
  }
};

const snapshotOutputFileHashes = (relativePaths = []) => {
  const snapshot = {};
  const uniquePaths = [...new Set((Array.isArray(relativePaths) ? relativePaths : []).filter(Boolean))];
  uniquePaths.forEach((relativePath) => {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    snapshot[relativePath] = getFileContentHash(absolutePath);
  });
  return snapshot;
};

const getChangedOutputPaths = (beforeSnapshot = {}, afterSnapshot = {}) =>
  Object.keys(afterSnapshot).filter((relativePath) => beforeSnapshot[relativePath] !== afterSnapshot[relativePath] && afterSnapshot[relativePath] !== null);

const resolveModelForSkill = (config, skill) => {
  const provider = config?.active_provider;
  const providerConfig = config?.providers?.[provider];
  const modelKey = config?.model_mapping?.[skill] || config?.model_mapping?.default;
  const model = providerConfig?.models?.[modelKey];
  return { modelKey: modelKey || 'unknown', model: model || 'unknown' };
};

const parseFinishReason = (message) => {
  const match = String(message || '').match(/finish_reason=([^) \n]+)/);
  return match ? match[1] : null;
};

const inspectJsonStructure = (text) => {
  const source = String(text || '');
  const trimmed = source.trimStart();
  const startsLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!startsLikeJson) {
    return { startsLikeJson: false, structurallyComplete: false };
  }

  const stack = [];
  let inString = false;
  let escaping = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      if (stack.length === 0) {
        return { startsLikeJson: true, structurallyComplete: false };
      }
      const open = stack.pop();
      if ((open === '{' && ch !== '}') || (open === '[' && ch !== ']')) {
        return { startsLikeJson: true, structurallyComplete: false };
      }
    }
  }

  return {
    startsLikeJson: true,
    structurallyComplete: !inString && !escaping && stack.length === 0
  };
};

const redactText = (text, config) => {
  const enabled = config?.redaction?.enabled !== false;
  if (!enabled || !text) return text || '';

  let out = String(text);
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  out = out.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]');
  out = out.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_TOKEN]');
  out = out.replace(/\b[a-f0-9]{32,}\b/gi, '[REDACTED_HEX]');
  out = out.replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s]+)/gi, '$1=[REDACTED]');
  return out;
};

const appendEvent = (type, data = {}) => {
  const kv = Object.entries(data)
    .map(([k, v]) => `${k}=${redactText(String(v), loadRuntimeConfig()).replace(/\s+/g, '_')}`)
    .join(' ');
  const line = `${nowIso()} | ${type}${kv ? ' | ' + kv : ''}\n`;
  const existing = readFile(EVENTS_FILE) || '';
  writeFile(EVENTS_FILE, existing + line);
};

const applyRetentionPolicies = () => {
  const config = loadRuntimeConfig();
  const retention = config?.retention || {};
  const eventsMaxLines = retention.events_max_lines || 2000;
  const evidenceMaxDays = retention.evidence_max_days || 30;

  if (fileExists(EVENTS_FILE)) {
    const lines = (readFile(EVENTS_FILE) || '').trim().split('\n').filter(Boolean);
    if (lines.length > eventsMaxLines) {
      const trimmed = lines.slice(-eventsMaxLines);
      writeFile(EVENTS_FILE, trimmed.join('\n') + '\n');
    }
  }

  if (fileExists(EVIDENCE_DIR)) {
    const now = Date.now();
    const maxAgeMs = evidenceMaxDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const full = path.join(EVIDENCE_DIR, file);
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(full);
      }
    }
  }
};

// ============================================================
// SKILLS REGISTRY
// ============================================================

const parseFrontmatterName = (content) => {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('---', 3);
  if (end === -1) return null;
  const front = content.slice(3, end);
  const match = front.match(/name:\s*(.+)/i);
  return match ? match[1].trim() : null;
};

const collectSkills = (dir, baseDir, items = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(`${full}.md`)) continue;
      collectSkills(full, baseDir, items);
      continue;
    }
    if (entry.name === 'SKILL.md' && fs.existsSync(`${dir}.md`)) continue;
    if (!entry.name.endsWith('.md')) continue;
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');
    const content = readFile(full) || '';
    const name = parseFrontmatterName(content) || entry.name.replace(/\.md$/, '');
    let category = rel.split('/')[0];
    if (category === 'vendor') {
      const parts = rel.split('/');
      category = parts[1] || 'vendor';
    }
    items.push({ name, path: rel, category });
  }
  return items;
};

const buildSkillsIndex = () => {
  const skillsDir = path.join(ROOT_DIR, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  const items = collectSkills(skillsDir, skillsDir);
  writeJSON(SKILLS_INDEX_FILE, { generated_at: nowIso(), items });
  return items;
};

const loadSkillsIndex = () => {
  const existing = readJSON(SKILLS_INDEX_FILE);
  if (existing?.items?.length) return existing.items;
  return buildSkillsIndex();
};

// ============================================================
// COST + PROVIDER STATE
// ============================================================

const loadCostState = () => {
  const existing = readJSON(COST_FILE);
  if (existing) return existing;
  const cfg = loadRuntimeConfig();
  const budget = cfg?.cost_budget?.max_usd || 0;
  const state = { budget_usd: budget, spent_usd: 0 };
  writeJSON(COST_FILE, state);
  return state;
};

const updateCostState = (updates) => {
  const state = loadCostState();
  const next = { ...state, ...updates };
  writeJSON(COST_FILE, next);
  return next;
};

const loadProviderState = () => {
  const existing = readJSON(PROVIDER_FILE);
  if (existing) return existing;
  const cfg = loadRuntimeConfig();
  const providers = cfg?.providers || {};
  const active = cfg?.active_provider || Object.keys(providers)[0] || null;
  const state = { active_provider: active, providers };
  writeJSON(PROVIDER_FILE, state);
  return state;
};

const updateProviderState = (updates) => {
  const state = loadProviderState();
  const next = { ...state, ...updates };
  writeJSON(PROVIDER_FILE, next);
  return next;
};

const runReviewHooks = () => {
  const config = loadRuntimeConfig();
  const hooks = config?.review_hooks?.commands || [];
  const autoRun = config?.review_hooks?.auto_run === true;

  if (hooks.length === 0) {
    console.log('[REVIEW] No review hooks configured');
    return;
  }

  console.log('[REVIEW] Hooks:');
  hooks.forEach(cmd => console.log(`- ${cmd}`));

  if (!autoRun) {
    console.log('[REVIEW] auto_run is disabled. Enable review_hooks.auto_run to execute.');
    return;
  }

  hooks.forEach(cmd => {
    console.log(`[REVIEW] Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  });
};

// ============================================================
// CONTEXT SNAPSHOT (Cheap Memory Layer)
// ============================================================

const extractGoalSummary = () => {
  const goal = readFile(GOAL_FILE) || '';
  const lines = goal
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => l !== '# Goal');
  return lines.slice(0, 3).join(' ');
};

const getRecentMemoryNotes = (maxEntries = 3) => {
  const content = readFile(MEMORY_FILE);
  if (!content) return [];

  const parts = content.split(/^##\s+/gm).filter(p => p.trim());
  const recent = parts.slice(-maxEntries);
  return recent.map(p => {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || 'Memory';
    const firstDetail = lines.slice(1).find(l => l.startsWith('-')) || '';
    return firstDetail ? `${title} ${firstDetail}` : title;
  });
};

const getTopPendingTasks = (tasksDoc, limit = 5) => {
  const list = tasksDoc?.tasks || [];
  const pending = list.filter(t => t.estado === 'pending');
  const sorted = pending.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.id || '').localeCompare(b.id || '');
  });
  return sorted.slice(0, limit).map(t => {
    const deps = Array.isArray(t.depends_on) && t.depends_on.length > 0
      ? ` deps:${t.depends_on.join(',')}`
      : '';
    return `${t.id}: ${t.title || t.description || '-'}${deps}`;
  });
};

const trimLines = (lines, maxLines) => {
  if (!maxLines || maxLines <= 0) return lines;
  if (lines.length <= maxLines) return lines;
  const trimmed = lines.slice(0, maxLines - 1);
  trimmed.push('... (truncated)');
  return trimmed;
};

const writeContextSnapshot = (state, tasksDoc) => {
  const runtimeConfig = loadRuntimeConfig();
  const maxLines = runtimeConfig?.context?.max_lines || 120;
  const workingSetLimit = runtimeConfig?.context?.working_set_limit || 10;

  const goalSummary = extractGoalSummary();
  const recentNotes = getRecentMemoryNotes();
  const pending = getTopPendingTasks(tasksDoc);
  const workingSet = (tasksDoc?.tasks || [])
    .filter(t => t.estado === 'pending' || t.estado === 'running')
    .flatMap(t => Array.isArray(t.output) ? t.output : [])
    .filter(Boolean)
    .slice(0, workingSetLimit);

  const lines = [
    '# Context Snapshot',
    '',
    `Updated: ${nowIso()}`,
    `Run ID: ${state.run_id || '-'}`,
    `Phase: ${state.phase || '-'}`,
    `Iteration: ${state.iteration}/${state.max_iterations}`,
    `Status: ${state.status || '-'}`,
    '',
    `Goal: ${goalSummary || '(empty)'}`,
    '',
    'Top Pending Tasks:',
    ...(pending.length ? pending.map(p => `- ${p}`) : ['- (none)']),
    '',
    'Working Set:',
    ...(workingSet.length ? workingSet.map(w => `- ${w}`) : ['- (none)']),
    '',
    'Recent Memory:',
    ...(recentNotes.length ? recentNotes.map(n => `- ${n}`) : ['- (none)']),
    ''
  ];

  const finalLines = trimLines(lines, maxLines);
  writeFile(CONTEXT_FILE, finalLines.join('\n'));
};

const summarizeSkills = (config) => {
  const enabled = config?.skills_enabled || {};
  const tiers = Object.keys(enabled);
  if (tiers.length === 0) return [];

  return tiers.map(tier => {
    const list = enabled[tier] || [];
    const preview = list.slice(0, 6).join(', ');
    const suffix = list.length > 6 ? ` (+${list.length - 6} more)` : '';
    return `${tier}: ${preview}${suffix}`;
  });
};

const computeLongestDependencyChain = (tasks) => {
  const graph = {};
  tasks.forEach(t => {
    graph[t.id] = t.depends_on || [];
  });
  const memo = new Map();

  const dfs = (node) => {
    if (memo.has(node)) return memo.get(node);
    const deps = graph[node] || [];
    if (deps.length === 0) {
      memo.set(node, 1);
      return 1;
    }
    const depth = 1 + Math.max(...deps.map(d => dfs(d)));
    memo.set(node, depth);
    return depth;
  };

  return Math.max(0, ...Object.keys(graph).map(dfs));
};

const countSpecCoverage = (tasks) => {
  if (!tasks.length) return { total: 0, withSpec: 0, pct: 0 };
  const withSpec = tasks.filter(t => {
    if (Array.isArray(t.spec_ref) && t.spec_ref.length > 0) return true;
    if (typeof t.spec_ref === 'string' && t.spec_ref.trim()) return true;
    if (Array.isArray(t.spec_refs) && t.spec_refs.length > 0) return true;
    return false;
  }).length;
  const pct = Math.round((withSpec / tasks.length) * 100);
  return { total: tasks.length, withSpec, pct };
};

const collectRiskFlags = (tasks) => {
  const flagged = tasks.filter(t => Array.isArray(t.risk_flags) && t.risk_flags.length > 0);
  return flagged.map(t => `${t.id}: ${t.risk_flags.join(', ')}`);
};

const writeStatusDashboard = (state, tasksDoc) => {
  const tasks = tasksDoc?.tasks || [];
  const meta = tasksDoc?.metadata || {};
  const longest = computeLongestDependencyChain(tasks);
  const spec = countSpecCoverage(tasks);
  const risks = collectRiskFlags(tasks);
  const pending = getTopPendingTasks(tasksDoc, 8);
  const cost = fileExists(COST_FILE) ? readJSON(COST_FILE) : null;
  const provider = fileExists(PROVIDER_FILE) ? readJSON(PROVIDER_FILE) : null;

  const lines = [
    '# Status Dashboard',
    '',
    `Updated: ${nowIso()}`,
    `Run ID: ${state.run_id || '-'}`,
    `Phase: ${state.phase || '-'}`,
    `Iteration: ${state.iteration}/${state.max_iterations}`,
    `Status: ${state.status || '-'}`,
    `Halt Reason: ${state.halt_reason || '-'}`,
    '',
    '## Task Summary',
    `- total: ${meta.total_tasks || 0}`,
    `- completed: ${meta.completed || 0}`,
    `- pending: ${meta.pending || 0}`,
    `- failed: ${meta.failed || 0}`,
    `- blocked: ${meta.blocked || 0}`,
    '',
    '## Dependency Health',
    `- longest_chain: ${longest}`,
    '',
    '## Spec Coverage',
    `- with_spec: ${spec.withSpec}/${spec.total} (${spec.pct}%)`,
    '',
    '## Cost',
    `- budget_usd: ${cost?.budget_usd ?? 0}`,
    `- spent_usd: ${cost?.spent_usd ?? 0}`,
    '',
    '## Provider',
    `- active_provider: ${provider?.active_provider || '-'}`,
    '',
    '## Top Pending Tasks',
    ...(pending.length ? pending.map(p => `- ${p}`) : ['- (none)']),
    '',
    '## Risk Flags',
    ...(risks.length ? risks.map(r => `- ${r}`) : ['- (none)']),
    ''
  ];

  writeFile(STATUS_FILE, lines.join('\n'));
};

const appendRunHistory = (state, tasksDoc, note = '') => {
  ensureDir(RUNS_DIR);
  const runDir = path.join(RUNS_DIR, state.run_id || 'unknown');
  ensureDir(runDir);
  const historyFile = path.join(runDir, 'history.log');

  const meta = tasksDoc?.metadata || {};
  const line = [
    nowIso(),
    `phase=${state.phase || '-'}`,
    `status=${state.status || '-'}`,
    `completed=${meta.completed || 0}`,
    `pending=${meta.pending || 0}`,
    `failed=${meta.failed || 0}`,
    `blocked=${meta.blocked || 0}`,
    `halt=${state.halt_reason || '-'}`,
    note ? `note=${note.replace(/\s+/g, '_')}` : ''
  ].filter(Boolean).join(' | ');

  const existing = readFile(historyFile) || '';
  writeFile(historyFile, existing + line + '\n');
};

const buildPlanRequest = (state, tasksDoc, config, newPrompt) => {
  const goal = readFile(GOAL_FILE) || '';
  const context = readFile(CONTEXT_FILE) || '';
  const memory = readFile(MEMORY_FILE) || '';
  const skillsSummary = summarizeSkills(config);

  const memoryNotes = getRecentMemoryNotes(5);
  const pending = getTopPendingTasks(tasksDoc, 8);

  const lines = [
    '# Planner Request',
    '',
    'You are the Planner. Create or update system/plan.md and system/tasks.yaml.',
    '',
    '## Goal',
    goal.trim() || '(empty)',
    '',
    '## Latest Request',
    newPrompt ? newPrompt : '(none)',
    '',
    '## Context Snapshot',
    context.trim() || '(none)',
    '',
    '## Recent Memory Notes',
    ...(memoryNotes.length ? memoryNotes.map(n => `- ${n}`) : ['- (none)']),
    '',
    '## Top Pending Tasks (if any)',
    ...(pending.length ? pending.map(p => `- ${p}`) : ['- (none)']),
    '',
    '## Skills Enabled (summary)',
    ...(skillsSummary.length ? skillsSummary.map(s => `- ${s}`) : ['- (none)']),
    '',
    '## Output Requirements',
    '- system/plan.md with phases, skills and exit criteria',
    '- system/tasks.yaml with fields: id, title, description, skill, estado, priority, depends_on, attempts, max_attempts, input, output',
    '- Ensure tasks are small (R9) and have explicit input/output',
    '- Use only skills from system/config.json',
    ''
  ];

  return lines.join('\n');
};

const getExistingOutputContext = (outputPath) => {
  const absolutePath = path.join(ROOT_DIR, outputPath);
  if (!fs.existsSync(absolutePath)) return null;
  const content = readFile(absolutePath);
  if (!content) return null;
  const hash = getFileContentHash(absolutePath);
  const maxExcerptLen = 500;
  const excerpt = content.length > maxExcerptLen
    ? content.slice(0, maxExcerptLen) + '...'
    : content;
  return { path: outputPath, hash, excerpt };
};

const buildExecutionPrompt = (task) => {
  const outputs = Array.isArray(task.output) ? task.output.filter(Boolean) : [];
  const existingContexts = [];
  for (const outputPath of outputs) {
    const ctx = getExistingOutputContext(outputPath);
    if (ctx) {
      existingContexts.push(ctx);
    }
  }

  const promptParts = [
    'You are a senior software engineer.',
    'Return ONLY valid JSON. No explanations.',
    ''
  ];

  if (task.truncation_retry) {
    promptParts.push('IMPORTANT: Your previous response was too long and was cut off. This is a retry.');
    promptParts.push('Keep your entire JSON response under 120 lines. Include only the most essential code. No comments, no decorative selectors, no verbose rules.');
    promptParts.push('');
  }

  if (existingContexts.length > 0) {
    promptParts.push('EXISTING FILE CONTEXT (modify rather than recreate):');
    for (const ctx of existingContexts) {
      promptParts.push(`[${ctx.path}] hash=${ctx.hash}`);
      promptParts.push(ctx.excerpt);
      promptParts.push('---');
    }
    promptParts.push('');
  }

  const inputFiles = Array.isArray(task.input) ? task.input.filter(Boolean) : [];
  if (inputFiles.length > 0) {
    promptParts.push('DEPENDENCY FILES (read-only — reference these to ensure your output integrates correctly):');
    for (const inputPath of inputFiles) {
      const absolutePath = path.join(ROOT_DIR, inputPath);
      if (fs.existsSync(absolutePath)) {
        const content = readFile(absolutePath) || '';
        promptParts.push(`\n--- ${inputPath} ---`);
        promptParts.push(content);
        promptParts.push('---');
      }
    }
    promptParts.push('');
  }

  if (task.skill) {
    const skillCandidates = [
      path.join(__dirname, 'skills', `${task.skill}.md`),
      path.join(__dirname, 'skills', 'frontend', `${task.skill}.md`),
      path.join(__dirname, 'skills', 'backend', `${task.skill}.md`),
      path.join(__dirname, 'skills', 'vendor', 'frontend', `${task.skill}.md`),
      path.join(__dirname, 'skills', 'vendor', 'backend', `${task.skill}.md`)
    ];
    const skillPath = skillCandidates.find((candidate) => fs.existsSync(candidate));
    const extractSection = (content, heading) => {
      if (!content) return '';
      const lines = String(content).split(/\r?\n/);
      const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
      if (startIndex === -1) return '';
      let endIndex = lines.length;
      for (let index = startIndex + 1; index < lines.length; index++) {
        if (lines[index].startsWith('## ')) {
          endIndex = index;
          break;
        }
      }
      return lines.slice(startIndex + 1, endIndex).join('\n').trim();
    };

    if (skillPath) {
      const skillContent = readFile(skillPath) || '';
      const constraintsContent = extractSection(skillContent, 'Constraints');
      const outputBoundsContent = extractSection(skillContent, 'Output bounds');
      if (constraintsContent || outputBoundsContent) {
        promptParts.push(`--- SKILL GUIDELINES (${task.skill}) ---`);
        if (constraintsContent) {
          promptParts.push(constraintsContent);
        }
        if (outputBoundsContent) {
          promptParts.push(outputBoundsContent);
        }
        promptParts.push('---', '');
      } else {
        console.warn(`[WARN] Skill "${task.skill}" found but has no Constraints or Output bounds sections`);
      }
    } else {
      console.warn(`[WARN] Skill file not found for "${task.skill}" — checked ${skillCandidates.length} paths`);
    }
  }

  promptParts.push(
    '{',
    '  "files": [',
    '    {',
    '      "path": "relative/path/file.ext",',
    '      "content": "full file content"',
    '    }',
    '  ]',
    '}',
    '',
    'Task Title:',
    task.title || '(no title)',
    '',
    'Task Description:',
    task.description || '(no description)',
    '',
    'You MUST only write files inside:',
    outputs.length ? outputs.join(', ') : '(none)',
    '',
    'Generate at most 2 files per response. If the task logically requires more,',
    'emit only the single most critical file — prefer config/manifest files first.',
    'Do not include any text outside JSON.'
  );

  return promptParts.join('\n');
};

const runLLM = async (prompt, config, skill = null, context = {}) => {
  return await callOpenRouter(prompt, config, skill, context);
};

// ============================================================
// PHASE 1: STATE MANAGEMENT - SIMPLIFIED SCHEMA
// ============================================================

const generateRunId = (goal) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const goalSlug = goal.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${goalSlug}-${timestamp}`;
};

const initializeState = (goal, config) => {
  const runId = generateRunId(goal);
  
  const state = {
    version: "3.0",
    run_id: runId,
    phase: "planning",
    iteration: 0,
    max_iterations: config?.max_iterations || 50,
    status: "running",
    
    execution_control: {
      tasks_completed: 0,
      // Baseline used to measure "tasks completed this session" across multiple `run`s.
      // This allows enforcing `max_tasks_per_run` without requiring an interactive runner.
      session_baseline_completed: 0,
      max_tasks_per_run: 5,
      last_checkpoint: 0,
      checkpoint_interval: 5,
      cooldown_trigger: false,
      consecutive_failures: 0
    },
    
    parallel_batch: {
      max_batch_size: 3
    },
    
    lock: {
      active: false,
      locked_at: null,
      locked_by: null,
      ttl_seconds: 1800
    },
    
    last_updated: new Date().toISOString(),
    halt_reason: null
  };
  
  writeJSON(STATE_FILE, state);
  return state;
};

const loadState = () => {
  return readJSON(STATE_FILE);
};

const saveState = (state) => {
  state.last_updated = new Date().toISOString();
  writeJSON(STATE_FILE, state);
};

// ============================================================
// RUNTIME CONFIG (Optional)
// - Keep initializeState deterministic for tests
// - Allow operators to tune limits without editing code
// ============================================================

const loadRuntimeConfig = () => {
  const runtimeConfig = readJSON(CONFIG_FILE);
  if (runtimeConfig && Object.keys(runtimeConfig).length > 0) {
    return runtimeConfig;
  }
  return readJSON(ORCHESTOS_CONFIG_FILE) || {};
};

const applyRuntimeConfigToState = (state, config) => {
  if (!config || typeof config !== 'object') return;

  // Support both a `limits` block (documented) and legacy flat fields.
  const limits = config.limits || {};
  const maxTasks = limits.max_tasks_per_run ?? config.max_tasks_per_run;
  const maxIters = limits.max_iterations ?? config.max_iterations;
  const maxBatch = limits.max_batch_size ?? config.max_batch_size;
  const cooldown = limits.cooldown_threshold ?? config.cooldown_threshold;
  const checkpointInterval = limits.checkpoint_interval ?? config.checkpoint_interval;

  if (typeof maxIters === 'number') state.max_iterations = maxIters;
  if (typeof maxTasks === 'number') state.execution_control.max_tasks_per_run = maxTasks;
  if (typeof maxBatch === 'number') state.parallel_batch.max_batch_size = maxBatch;
  if (typeof checkpointInterval === 'number') state.execution_control.checkpoint_interval = checkpointInterval;

  // Keep cooldown in state only if the schema has it; otherwise default logic applies.
  if (typeof cooldown === 'number') state.execution_control.cooldown_threshold = cooldown;
};

// ============================================================
// PHASE 1: RUN LOCK WITH TTL
// ============================================================

const validateLock = (state) => {
  if (!state.lock.active) return;
  
  const now = Date.now();
  const lockedAt = new Date(state.lock.locked_at).getTime();
  const ttl = state.lock.ttl_seconds * 1000;
  
  if (now - lockedAt > ttl) {
    console.log("[WARN] STALE LOCK DETECTED - clearing");
    state.lock.active = false;
    state.lock.locked_at = null;
    state.lock.locked_by = null;
  }
};

const acquireLock = (state) => {
  if (state.lock.active) {
    throw new Error(
      `RUN LOCKED since ${state.lock.locked_at} by ${state.lock.locked_by}`
    );
  }
  
  state.lock.active = true;
  state.lock.locked_at = new Date().toISOString();
  state.lock.locked_by = process.pid;
};

const releaseLock = (state) => {
  state.lock.active = false;
  state.lock.locked_at = null;
  state.lock.locked_by = null;
};

// ============================================================
// PHASE 2: TASKS.YAML MANAGEMENT
// ============================================================

const loadTasks = () => {
  return readYAML(TASKS_FILE);
};

const saveTasks = (tasks) => {
  writeYAML(TASKS_FILE, tasks);
};

const computeFileHash = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  return crypto.createHash('sha256').update(content).digest('hex');
};

const saveTasksWithLock = (tasks, expectedHash) => {
  const currentHash = computeFileHash(TASKS_FILE);
  if (expectedHash && currentHash && expectedHash !== currentHash) {
    return { ok: false, reason: 'tasks_yaml_conflict' };
  }
  if (Array.isArray(tasks.tasks)) {
    tasks.tasks = sortTasksDeterministic(tasks.tasks);
  }
  saveTasks(tasks);
  return { ok: true };
};

const applyTasksSaveFailure = (state, saved, context = {}) => {
  const reason = saved?.reason || 'tasks_save_failed';
  state.phase = 'needs_review';
  state.status = 'needs_review';
  state.halt_reason = reason;
  return {
    taskId: context.taskId || 'tasks_yaml',
    failureClass: reason,
    message: context.message || `Could not persist tasks.yaml: ${reason}`,
    haltReason: reason
  };
};

const initializeTasks = (runId) => {
  const tasks = {
    version: "3.0",
    generated_at: nowIso(),
    run_id: runId,
    tasks: [],
    metadata: {
      total_tasks: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      blocked: 0
    }
  };
  saveTasks(tasks);
  return tasks;
};

const updateTaskMetadata = (tasks) => {
  const taskList = tasks.tasks || [];
  tasks.metadata = {
    total_tasks: taskList.length,
    completed: taskList.filter(t => t.estado === "done").length,
    pending: taskList.filter(t => t.estado === "pending").length,
    failed: taskList.filter(t => t.estado === "failed").length,
    blocked: taskList.filter(t => t.estado === "blocked").length,
    split_required: taskList.filter(t => t.estado === "split_required").length
  };
};

const getTaskById = (tasks, taskId) => {
  return tasks.tasks.find(t => t.id === taskId);
};

const updateTask = (tasks, taskId, updates) => {
  const task = getTaskById(tasks, taskId);
  if (!task) return null;
  
  Object.assign(task, updates);
  task.updated_at = nowIso();
  updateTaskMetadata(tasks);
  return task;
};

// ============================================================
// PHASE 3: EXECUTION LIMITS
// ============================================================

const resetExecutionCounters = (state) => {
  state.execution_control.tasks_completed = 0;
  state.execution_control.consecutive_failures = 0;
  state.status = "running";
};

const canExecuteMoreTasks = (state) => {
  const completed = state.execution_control.tasks_completed;
  const max = state.execution_control.max_tasks_per_run;
  
  if (completed >= max) {
    state.phase = "paused";
    state.status = "paused";
    state.halt_reason = "max_tasks_per_run_reached";
    return false;
  }
  return true;
};

const checkIterationLimit = (state) => {
  if (state.iteration >= state.max_iterations) {
    state.phase = "needs_review";
    state.status = "needs_review";
    state.halt_reason = "max_iterations_reached";
    return false;
  }
  return true;
};

// ============================================================
// PHASE 4: PARALLEL BATCH SELECTION (Declarative)
// ============================================================

const getExecutableTasks = (tasks) => {
  const completedIds = new Set(
    tasks.filter(t => t.estado === "done").map(t => t.id)
  );
  
  return tasks.filter(t => {
    if (t.estado !== "pending") return false;
    return t.depends_on.every(depId => completedIds.has(depId));
  });
};

const selectBatchForExecution = (tasks, maxBatchSize) => {
  const executable = getExecutableTasks(tasks);
  
  // Deterministic ordering: priority first, then id
  const sorted = executable.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.id.localeCompare(b.id);
  });
  
  return sorted.slice(0, maxBatchSize);
};

// ============================================================
// PHASE 5: CHECKPOINT SYSTEM
// ============================================================

const shouldCreateCheckpoint = (state) => {
  const completed = state.execution_control.tasks_completed;
  const lastCheckpoint = state.execution_control.last_checkpoint;
  const interval = state.execution_control.checkpoint_interval;
  return (completed - lastCheckpoint) >= interval;
};

const createCheckpoint = (state, tasks) => {
  // Update memory.md with summary
  const summary = generateMemorySummary(tasks);
  // Append with compaction to keep context bounded over long runs.
  appendToMemoryWithCompaction(summary);
  
  // Update checkpoint tracking
  state.execution_control.last_checkpoint = state.execution_control.tasks_completed;
  
  console.log(`[CHECKPOINT] Created at ${state.execution_control.tasks_completed} tasks`);
};

const generateMemorySummary = (tasks) => {
  const completed = tasks.filter(t => t.estado === "done");
  return `## Checkpoint (${new Date().toISOString()})\n- Tasks completed: ${completed.length}\n- Total tasks: ${tasks.length}\n`;
};

const appendToMemory = (content) => {
  memoryManager.append(content);
};

// ============================================================
// PHASE 5B: MEMORY COMPACTION (Mejora 3)
// ============================================================

/**
 * Load config for memory compaction settings
 * @returns {Object} memory configuration
 */
const getMemoryConfig = () => {
  return memoryManager.getConfig();
};

/**
 * Count entries in memory.md (entries start with ##)
 * @returns {number} number of entries
 */
const countMemoryEntries = () => {
  return memoryManager.countEntries();
};

/**
 * Check if memory compaction is needed
 * @returns {boolean} true if compaction should run
 */
const shouldCompactMemory = () => {
  return memoryManager.shouldCompact();
};

/**
 * Perform memory compaction - keep last N entries + compact summary
 */
const performMemoryCompaction = () => {
  memoryManager.compact();
};

/**
 * Append to memory with automatic compaction
 * @param {string} content - content to append
 */
const appendToMemoryWithCompaction = (content) => {
  memoryManager.appendWithCompaction(content);
};

// ============================================================
// PHASE 6: COOLDOWN (LLM Fatigue Protection)
// ============================================================

const checkCooldownTrigger = (state) => {
  const consecutive = state.execution_control.consecutive_failures;
  const threshold = 3; // config.limits.cooldown_threshold
  
  if (consecutive >= threshold) {
    state.execution_control.cooldown_trigger = true;
    state.phase = "needs_review";
    state.status = "needs_review";
    state.halt_reason = "cooldown_triggered_due_to_consecutive_failures";
    return true;
  }
  return false;
};

const onTaskSuccess = (state) => {
  state.execution_control.consecutive_failures = 0;
};

const onTaskFailure = (state) => {
  state.execution_control.consecutive_failures++;
};

// ============================================================
// PHASE 7: EVIDENCE FORMAT (Simplified)
// ============================================================

const EVIDENCE_DIR = path.join(SYSTEM_DIR, 'evidence');

const saveEvidence = (taskId, evidence) => {
  ensureDir(EVIDENCE_DIR);
  const evidenceFile = path.join(EVIDENCE_DIR, `${taskId}.json`);
  const config = loadRuntimeConfig();
  const data = {
    task_id: taskId,
    executed_at: nowIso(),
    files_changed: evidence.files_changed || [],
    summary: redactText(evidence.summary || '', config)
  };
  writeJSON(evidenceFile, data);
};

const loadEvidence = (taskId) => {
  const evidenceFile = path.join(EVIDENCE_DIR, `${taskId}.json`);
  return readJSON(evidenceFile);
};

const getEvidenceConfig = (config) => {
  const evidence = config?.evidence || {};
  return {
    required: evidence.required !== false,
    min_files_changed: typeof evidence.min_files_changed === 'number' ? evidence.min_files_changed : 1,
    excluded_paths: Array.isArray(evidence.excluded_paths)
      ? evidence.excluded_paths
      : ['system/', '.agents/', 'node_modules/', '.git/', 'dist/', 'build/', '.next/']
  };
};

const filterExcludedPaths = (files, excludedPrefixes) => {
  return files.filter(file => !excludedPrefixes.some(prefix => file.startsWith(prefix)));
};

const getGitDiffFiles = () => {
  try {
    const output = execSync('git diff --name-only', { encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (_e) {
    return [];
  }
};

const createEvidenceForTask = (taskId, filesChanged, summary, config) => {
  const evidenceConfig = getEvidenceConfig(config);
  const cleaned = filterExcludedPaths(filesChanged, evidenceConfig.excluded_paths);
  saveEvidence(taskId, {
    files_changed: cleaned,
    summary: summary || 'Auto-generated evidence'
  });
  return cleaned;
};

// ============================================================
// PHASE 11: R9 TASK SIZE VALIDATION
// ============================================================

const validateTaskSize = (task) => {
  const errors = [];
  
  // Validate output files count
  const outputFiles = task.output?.length ?? 0;
  if (outputFiles > 10) {
    errors.push(`output files (${outputFiles}) > 10`);
  }
  
  // Validate input files count
  const inputFiles = task.input?.length ?? 0;
  if (inputFiles > 10) {
    errors.push(`input files (${inputFiles}) > 10`);
  }
  
  // Validate description length (proxy for complexity)
  const descLength = task.description?.length ?? 0;
  if (descLength > 500) {
    errors.push(`description too long (${descLength} chars)`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const validateAllTasks = (tasks) => {
  const violations = [];
  
  tasks.forEach(task => {
    const validation = validateTaskSize(task);
    if (!validation.valid) {
      violations.push({
        task_id: task.id,
        errors: validation.errors
      });
    }
  });
  
  if (violations.length > 0) {
    console.error("[ERROR] R9 Task Size violations detected:");
    violations.forEach(v => {
      console.error(`  Task ${v.task_id}: ${v.errors.join(", ")}`);
    });
    console.error("[ERROR] Planner must split these tasks before proceeding.");
    throw new Error("R9_VALIDATION_FAILED");
  }
};

// ============================================================
// PHASE 12: COMPLETION DETECTION
// ============================================================

const checkProjectCompletion = (tasks, state) => {
  const remaining = tasks.filter(t => t.estado !== "done");
  
  if (remaining.length === 0) {
    state.phase = "completed";
    state.status = "completed";
    state.halt_reason = "all_tasks_completed";
    return true;
  }
  
  return false;
};

// ============================================================
// TASKS.YAML VALIDATION + SESSION ACCOUNTING
// ============================================================

const normalizeTasksDoc = (tasksDoc) => {
  if (!tasksDoc || typeof tasksDoc !== "object") {
    throw new Error("TASKS_YAML_MISSING_OR_INVALID");
  }
  if (!Array.isArray(tasksDoc.tasks)) {
    throw new Error('TASKS_YAML_SCHEMA_INVALID: "tasks" must be an array');
  }
  if (!tasksDoc.metadata || typeof tasksDoc.metadata !== "object") {
    tasksDoc.metadata = {};
  }
  updateTaskMetadata(tasksDoc);
  return tasksDoc;
};

const getCompletedCount = (tasksDoc) => {
  if (tasksDoc?.metadata && typeof tasksDoc.metadata.completed === "number") {
    return tasksDoc.metadata.completed;
  }
  const list = tasksDoc?.tasks || [];
  return list.filter(t => t.estado === "done").length;
};

const ensureSessionBaseline = (state, tasksDoc, command) => {
  const completedNow = getCompletedCount(tasksDoc);

  if (!state.execution_control) state.execution_control = {};
  if (typeof state.execution_control.session_baseline_completed !== "number") {
    state.execution_control.session_baseline_completed = completedNow;
  }

  // `resume` starts a new "execution session" window.
  if (command === "resume") {
    state.execution_control.session_baseline_completed = completedNow;
    state.execution_control.tasks_completed = 0;
    state.execution_control.consecutive_failures = 0;
    state.execution_control.cooldown_trigger = false;
    state.status = "running";
    if (state.phase === "paused") state.phase = "execution";
    return;
  }

  // Derive "tasks completed this session" from tasks.yaml, not from ephemeral memory.
  const baseline = state.execution_control.session_baseline_completed;
  state.execution_control.tasks_completed = Math.max(0, completedNow - baseline);
};

// ============================================================
// PLANNING VALIDATION
// ============================================================

const normalizeSkillName = (skill) => {
  if (!skill) return '';
  return skill.replace(/\//g, '-').replace(/\.md$/, '');
};

const getEnabledSkills = (config) => {
  const enabled = config?.skills_enabled || {};
  const sets = Object.values(enabled).flat();
  return new Set(sets.map(s => normalizeSkillName(s)));
};

const validateTaskSchema = (task) => {
  const requiredFields = ['id', 'title', 'description', 'skill', 'estado', 'priority', 'depends_on', 'input', 'output'];
  const missing = requiredFields.filter(field => task[field] === undefined);
  if (missing.length) {
    throw new Error(`Task ${task.id || '(unknown)'} missing fields: ${missing.join(', ')}`);
  }
  if (!Array.isArray(task.depends_on)) {
    throw new Error(`Task ${task.id} depends_on must be an array`);
  }
  if (!Array.isArray(task.input) || !Array.isArray(task.output)) {
    throw new Error(`Task ${task.id} input/output must be arrays`);
  }
};

const compareTaskIds = (a, b) => {
  const re = /^T(\d+)/;
  const ma = re.exec(a || '');
  const mb = re.exec(b || '');
  if (ma && mb) {
    const na = parseInt(ma[1], 10);
    const nb = parseInt(mb[1], 10);
    if (na !== nb) return na - nb;
  }
  return (a || '').localeCompare(b || '');
};

const sortTasksDeterministic = (tasks) => {
  return tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return compareTaskIds(a.id, b.id);
  });
};

const validateUniqueTaskIds = (tasks) => {
  const seen = new Set();
  tasks.forEach(task => {
    if (seen.has(task.id)) {
      throw new Error(`Duplicate task id: ${task.id}`);
    }
    seen.add(task.id);
  });
};

const validateTaskIdPattern = (tasks, config) => {
  const pattern = config?.tasks?.id_pattern;
  if (!pattern) return;
  const re = new RegExp(pattern);
  tasks.forEach(task => {
    if (!re.test(task.id)) {
      throw new Error(`Task id does not match pattern (${pattern}): ${task.id}`);
    }
  });
};

const validateTaskSkills = (tasks, config) => {
  const allowed = getEnabledSkills(config);
  tasks.forEach(task => {
    const skill = normalizeSkillName(task.skill);
    if (!allowed.has(skill)) {
      throw new Error(`Task ${task.id} uses skill not enabled in config: ${task.skill}`);
    }
  });
};

const validatePlannedTasks = (tasksDoc, config) => {
  const tasks = tasksDoc.tasks || [];
  tasks.forEach(task => validateTaskSchema(task));
  validateUniqueTaskIds(tasks);
  validateTaskIdPattern(tasks, config);
  validateTaskSkills(tasks, config);
  validateDependencies(tasks);
  detectCycles(tasks);
  validateAllTasks(tasks);
};

// ============================================================
// PHASE 13: DEPENDENCY VALIDATION
// ============================================================

const validateDependencies = (tasks) => {
  const ids = new Set(tasks.map(t => t.id));
  
  tasks.forEach(task => {
    task.depends_on.forEach(dep => {
      if (!ids.has(dep)) {
        throw new Error(
          `Invalid dependency ${dep} in task ${task.id}`
        );
      }
    });
  });
};

const detectCycles = (tasks) => {
  const graph = {};
  tasks.forEach(t => {
    graph[t.id] = t.depends_on;
  });
  
  const visited = new Set();
  const stack = new Set();
  
  const visit = (node) => {
    if (stack.has(node)) {
      throw new Error(`Dependency cycle detected at ${node}`);
    }
    if (visited.has(node)) return;
    
    stack.add(node);
    graph[node].forEach(visit);
    stack.delete(node);
    visited.add(node);
  };
  
  Object.keys(graph).forEach(visit);
};

// ============================================================
// PHASE 14: R10 NO IMPLICIT TASKS (Anti-Hallucination)
// ============================================================

const validateEvidenceAgainstTask = (task, evidence) => {
  if (!task.output || task.output.length === 0) return;

  const allowed = new Set(task.output);

  evidence.files_changed.forEach(file => {
    let allowedMatch = false;
    
    allowed.forEach(path => {
      if (file.startsWith(path)) {
        allowedMatch = true;
      }
    });
    
    if (!allowedMatch) {
      throw new Error(
        `Unauthorized file change: ${file}. ` +
        `Only allowed: ${Array.from(allowed).join(", ")}`
      );
    }
  });
};

const validateAcceptanceCriteria = (task, config) => {
  const requireAcceptance = config?.review_criteria?.require_acceptance_criteria === true;
  if (!requireAcceptance) return;
  const criteria = task.acceptance_criteria;
  if (!criteria || (Array.isArray(criteria) && criteria.length === 0)) {
    throw new Error(`Missing acceptance_criteria in task ${task.id}`);
  }
};

// ============================================================
// PHASE 17: R11 PLANNER GUARDRAIL (Anti-Destruction)
// ============================================================

const validatePlannerAllowed = (state, tasksExists) => {
  if (tasksExists && state.phase !== "planning") {
    throw new Error(
      "Planner not allowed after planning phase. " +
      "Manual reset required to regenerate tasks."
    );
  }
};

// ============================================================
// PHASE 18: ATTEMPTS/MAX_ATTEMPTS (Mejora 2)
// ============================================================

/**
 * Increment attempts counter for a task when it fails
 * @param {Object} tasks - tasks object
 * @param {string} taskId - task id to increment attempts
 * @returns {Object|null} updated task or null if not found
 */
const incrementTaskAttempts = (tasks, taskId) => {
  const task = getTaskById(tasks, taskId);
  if (!task) return null;
  
  // Initialize attempts if not present
  if (task.attempts === undefined) {
    task.attempts = 0;
  }
  // Initialize max_attempts if not present (default to 3)
  if (task.max_attempts === undefined) {
    task.max_attempts = 3;
  }
  
  task.attempts += 1;
  task.updated_at = nowIso();
  updateTaskMetadata(tasks);
  
  return task;
};

/**
 * Check if a task has exhausted all attempts
 * @param {Object} task - task object
 * @returns {boolean} true if attempts >= max_attempts
 */
const isTaskExhausted = (task) => {
  if (!task) return false;
  
  const attempts = task.attempts || 0;
  const maxAttempts = task.max_attempts || 3;
  
  return attempts >= maxAttempts;
};

/**
 * Mark a task as permanently failed when attempts are exhausted
 * @param {Object} tasks - tasks object
 * @param {string} taskId - task id to mark as failed_permanent
 * @returns {Object|null} updated task or null if not found
 */
const markTaskFailedPermanent = (tasks, taskId) => {
  const task = getTaskById(tasks, taskId);
  if (!task) return null;
  
  task.estado = "failed_permanent";
  task.updated_at = nowIso();
  updateTaskMetadata(tasks);
  
  return task;
};

/**
 * Handle dependent tasks when a task fails permanently
 * Blocks all tasks that depend on the failed task
 * @param {Object} tasks - tasks object
 * @param {string} failedTaskId - id of the permanently failed task
 * @returns {Array} list of dependent tasks that were blocked
 */
const handleDependentTasksOnFailure = (tasks, failedTaskId) => {
  const blockedTasks = [];
  
  tasks.tasks.forEach(task => {
    // Skip if already done or failed_permanent
    if (task.estado === "done" || task.estado === "failed_permanent") {
      return;
    }
    
    // Check if this task depends on the failed task
    if (task.depends_on && task.depends_on.includes(failedTaskId)) {
      task.estado = "blocked";
      task.updated_at = nowIso();
      blockedTasks.push(task.id);
    }
  });
  
  updateTaskMetadata(tasks);
  return blockedTasks;
};

/**
 * Process a task failure - increments attempts and handles exhaustion
 * @param {Object} tasks - tasks object
 * @param {string} taskId - task id that failed
 * @param {Object} state - state object
 * @returns {Object} result with action taken
 */
const processTaskFailure = (tasks, taskId, state) => {
  const task = getTaskById(tasks, taskId);
  if (!task) {
    return { action: "error", message: "Task not found" };
  }
  
  // Increment attempts
  incrementTaskAttempts(tasks, taskId);
  
  // Check if exhausted
  if (isTaskExhausted(task)) {
    // Mark as permanently failed
    markTaskFailedPermanent(tasks, taskId);
    
    // Handle dependents
    const blocked = handleDependentTasksOnFailure(tasks, taskId);
    
    // Update state
    state.execution_control.consecutive_failures++;
    
    return {
      action: "failed_permanent",
      message: `Task ${taskId} failed after ${task.attempts} attempts`,
      blocked_dependents: blocked
    };
  } else {
    // Still has attempts left - can retry
    state.execution_control.consecutive_failures++;
    
    return {
      action: "retry_allowed",
      message: `Task ${taskId} failed, ${task.max_attempts - task.attempts} attempts remaining`,
      attempts: task.attempts,
      max_attempts: task.max_attempts
    };
  }
};

// ============================================================
// PHASE 19: CORRECTIVE TASKS (Mejora 1)
// ============================================================

/**
 * Generate a corrective task ID from a failed task
 * @param {string} taskId - original task ID
 * @returns {string} corrective task ID (e.g., T5 -> T5_fix)
 */
const generateCorrectiveTaskId = (taskId) => {
  return `${taskId}_fix`;
};

/**
 * Check if a task ID is a corrective task
 * @param {string} taskId - task ID to check
 * @returns {boolean} true if task is a corrective task
 */
const isCorrectiveTask = (taskId) => {
  return taskId.endsWith('_fix');
};

/**
 * Get the original task ID from a corrective task
 * @param {string} correctiveTaskId - corrective task ID (e.g., T5_fix)
 * @returns {string|null} original task ID or null if not valid
 */
const getOriginalTaskId = (correctiveTaskId) => {
  if (!isCorrectiveTask(correctiveTaskId)) {
    return null;
  }
  return correctiveTaskId.replace('_fix', '');
};

/**
 * Create a corrective task based on a failed task
 * The original task remains unchanged (immutable)
 * @param {Object} tasks - tasks object
 * @param {string} failedTaskId - ID of the failed task
 * @param {string} fixDescription - Description of the fix needed
 * @returns {Object|null} created corrective task or null if failed task not found
 */
const createCorrectiveTask = (tasks, failedTaskId, fixDescription) => {
  const originalTask = getTaskById(tasks, failedTaskId);
  if (!originalTask) {
    return null;
  }
  
  const correctiveId = generateCorrectiveTaskId(failedTaskId);
  
  // Check if corrective task already exists
  const existing = getTaskById(tasks, correctiveId);
  if (existing) {
    return existing;
  }
  
  // Create corrective task based on original
  const correctiveTask = {
    id: correctiveId,
    description: fixDescription || `Corrective task for ${failedTaskId}: Fix issues from failed execution`,
    estado: "pending",
    priority: originalTask.priority,
    depends_on: [...originalTask.depends_on], // Keep same dependencies
    attempts: 0,
    max_attempts: 1, // Usually only 1 attempt for corrective tasks
    input: [...(originalTask.input || [])],
    output: [...(originalTask.output || [])],
    skill: originalTask.skill,
    original_task: failedTaskId, // Reference to original task
    created_at: nowIso(),
    updated_at: nowIso()
  };
  
  tasks.tasks.push(correctiveTask);
  updateTaskMetadata(tasks);
  
  return correctiveTask;
};

/**
 * Link dependent tasks to use the corrective task instead of the failed one
 * @param {Object} tasks - tasks object
 * @param {string} failedTaskId - ID of the failed task
 * @param {string} correctiveTaskId - ID of the corrective task
 * @returns {Array} list of dependent tasks that were updated
 */
const linkDependentToCorrective = (tasks, failedTaskId, correctiveTaskId) => {
  const updatedDependents = [];
  
  tasks.tasks.forEach(task => {
    // Skip if already done
    if (task.estado === "done") {
      return;
    }
    
    // Check if this task depends on the failed task
    if (task.depends_on && task.depends_on.includes(failedTaskId)) {
      // Add corrective task to dependencies, keep original as reference
      if (!task.depends_on.includes(correctiveTaskId)) {
        task.depends_on.push(correctiveTaskId);
        task.corrective_link = failedTaskId; // Track the original dependency
        task.updated_at = nowIso();
        updatedDependents.push(task.id);
      }
    }
  });
  
  updateTaskMetadata(tasks);
  return updatedDependents;
};

/**
 * Create a corrective task and optionally link dependents
 * @param {Object} tasks - tasks object
 * @param {string} failedTaskId - ID of the failed task
 * @param {Object} options - options object
 * @param {string} options.fixDescription - Description of the fix
 * @param {boolean} options.linkDependents - Whether to link dependents to corrective task
 * @returns {Object} result with created task and linked dependents
 */
const createAndLinkCorrectiveTask = (tasks, failedTaskId, options = {}) => {
  const { fixDescription, linkDependents = true } = options;
  
  // Create the corrective task
  const correctiveTask = createCorrectiveTask(tasks, failedTaskId, fixDescription);
  
  if (!correctiveTask) {
    return { action: "error", message: "Failed task not found" };
  }
  
  // Link dependents if requested
  let linkedDependents = [];
  if (linkDependents) {
    linkedDependents = linkDependentToCorrective(tasks, failedTaskId, correctiveTask.id);
  }
  
  return {
    action: "corrective_created",
    message: `Corrective task ${correctiveTask.id} created for ${failedTaskId}`,
    corrective_task: correctiveTask,
    linked_dependents: linkedDependents
  };
};

// ============================================================
// PHASE 10: RECALCULATION RULE
// ============================================================

const recalculateTaskStates = (tasks) => {
  const completedIds = new Set(
    tasks.filter(t => t.estado === "done").map(t => t.id)
  );
  
  tasks.forEach(task => {
    // Never change done, failed, or split_required
    if (task.estado === "done" || task.estado === "failed" || task.estado === "split_required") {
      return;
    }
    
    // Check dependencies
    const depsDone = task.depends_on.every(depId => completedIds.has(depId));
    
    if (!depsDone) {
      task.estado = "blocked";
    } else if (task.estado === "blocked") {
      task.estado = "pending";
    }
  });
  
  return tasks;
};

// ============================================================
// TASK MUTATION HELPERS (CLI)
// ============================================================

const markTaskDone = (tasksDoc, taskId) => {
  const task = getTaskById(tasksDoc, taskId);
  if (!task) return null;
  task.estado = "done";
  task.updated_at = nowIso();
  updateTaskMetadata(tasksDoc);
  return task;
};

const markTaskFailed = (tasksDoc, taskId, reason) => {
  const task = getTaskById(tasksDoc, taskId);
  if (!task) return null;
  task.estado = "failed";
  if (reason) {
    task.failure_reason = reason;
  }
  task.updated_at = nowIso();
  updateTaskMetadata(tasksDoc);
  return task;
};

const markTaskPending = (tasksDoc, taskId) => {
  const task = getTaskById(tasksDoc, taskId);
  if (!task) return null;
  if (task.estado === "failed_permanent") {
    return { error: "failed_permanent" };
  }
  task.estado = "pending";
  task.updated_at = nowIso();
  updateTaskMetadata(tasksDoc);
  return task;
};

const suggestTaskSplit = (tasksDoc, taskId) => {
  const task = getTaskById(tasksDoc, taskId);
  if (!task) return null;

  const validation = validateTaskSize(task);
  if (validation.valid) {
    return { ok: false, reason: 'task_is_within_limits' };
  }

  const existingIds = tasksDoc.tasks.map(t => t.id);
  const maxId = existingIds.reduce((max, id) => {
    const match = /^T(\d+)/.exec(id || '');
    const num = match ? parseInt(match[1], 10) : 0;
    return Math.max(max, num);
  }, 0);

  const outputs = Array.isArray(task.output) ? task.output : [];
  const midpoint = Math.ceil(outputs.length / 2) || 1;
  const outputsA = outputs.slice(0, midpoint);
  const outputsB = outputs.slice(midpoint);

  const t1 = {
    id: `T${maxId + 1}`,
    title: `${task.title} (part 1)`,
    description: task.description,
    skill: task.skill,
    estado: 'pending',
    priority: task.priority,
    depends_on: Array.isArray(task.depends_on) ? [...task.depends_on] : [],
    attempts: 0,
    max_attempts: task.max_attempts || 2,
    input: Array.isArray(task.input) ? [...task.input] : [],
    output: outputsA
  };

  const t2 = {
    id: `T${maxId + 2}`,
    title: `${task.title} (part 2)`,
    description: task.description,
    skill: task.skill,
    estado: 'pending',
    priority: task.priority,
    depends_on: [t1.id],
    attempts: 0,
    max_attempts: task.max_attempts || 2,
    input: Array.isArray(task.input) ? [...task.input] : [],
    output: outputsB.length ? outputsB : outputsA
  };

  return { ok: true, tasks: [t1, t2], violations: validation.errors };
};

// ============================================================
// CLI COMMANDS
// ============================================================

const printStatus = () => {
  const state = loadState();
  if (!state) {
    console.log('[ERROR] No state found. Run: node runner.js init "Your goal"');
    return;
  }

  const runtimeConfig = loadRuntimeConfig();
  applyRuntimeConfigToState(state, runtimeConfig);

  console.log('[STATUS] Current run state');
  console.log(`- run_id: ${state.run_id || '-'}`);
  console.log(`- version: ${state.version}`);
  console.log(`- phase: ${state.phase}`);
  console.log(`- iteration: ${state.iteration}/${state.max_iterations}`);
  console.log(`- status: ${state.status}`);
  console.log(`- halt_reason: ${state.halt_reason || '-'}`);
  console.log(`- lock: ${state.lock.active ? 'ACTIVE' : 'inactive'}`);
  console.log(`- tasks_completed: ${state.execution_control.tasks_completed}/${state.execution_control.max_tasks_per_run}`);
  console.log(`- consecutive_failures: ${state.execution_control.consecutive_failures}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();

  console.log('\n[RUNNER] Agent System Runner v3.0');
  console.log('====================================\n');

  if (command === 'init') {
    const rootFlagIndex = args.indexOf('--root');
    const initArgs = args.filter((_, i) =>
      i !== rootFlagIndex && (rootFlagIndex === -1 || i !== rootFlagIndex + 1)
    );
    const goal = initArgs.slice(1).join(' ').trim() || 'Define project goal here';
    const config = readJSON(CONFIG_FILE) || {};

    ensureDir(SYSTEM_DIR);
    writeFile(GOAL_FILE, `# Goal\n\n${goal}\n`);

    const state = initializeState(goal, config);
    memoryManager.setSessionContext({
      sessionId: state.run_id,
      project: path.basename(ROOT_DIR),
      directory: ROOT_DIR
    });
    initializeTasks(state.run_id);
    writeContextSnapshot(state, loadTasks());
    writeStatusDashboard(state, loadTasks());
    appendEvent('init', { run_id: state.run_id });
    applyRetentionPolicies();

    console.log(`[INIT] New run initialized: ${state.run_id}`);
    console.log('[INIT] Phase: planning');
    console.log('[INIT] Tasks template created');
    console.log('\n[END] Run: node runner.js run\n');
    return;
  }

  if (command === 'status') {
    printStatus();
    console.log('\n[END] Runner finished\n');
    return;
  }
  
  if (command === 'run' || command === 'resume') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }

    memoryManager.setSessionContext({
      sessionId: state.run_id,
      project: path.basename(ROOT_DIR),
      directory: ROOT_DIR
    });

    const runtimeConfig = loadRuntimeConfig();
    applyRuntimeConfigToState(state, runtimeConfig);
    
    // Phase 1: Validate and acquire lock
    validateLock(state);
    acquireLock(state);
    
    try {
      console.log(`[${command.toUpperCase()}] Starting execution...`);
      console.log(`[STATE] Phase: ${state.phase}`);
      console.log(`[STATE] Iteration: ${state.iteration}/${state.max_iterations}`);
      console.log(`[RUNNER START] pid=${process.pid} run_id=${state.run_id || 'unknown'} command=${command} root=${ROOT_DIR}`);
      appendEvent('run_start', { run_id: state.run_id, phase: state.phase, iteration: state.iteration });
      applyRetentionPolicies();

      if (command === 'run' && state.status === 'paused') {
        console.error(`[HALT] State is paused. Run: node runner.js resume --root "${ROOT_DIR}"`);
        state.halt_reason = 'paused_requires_resume';
        return;
      }

      if (!checkIterationLimit(state)) {
        console.error(`[HALT] ${state.halt_reason}`);
        return;
      }

      const tasksDoc = normalizeTasksDoc(loadTasks());
      let tasksHash = computeFileHash(TASKS_FILE);

      // Planning gate: `run` needs tasks planned first.
      if (state.phase === 'planning' && tasksDoc.tasks.length === 0) {
        console.log('[ACTION] Planner required: populate system/tasks.yaml with tasks (input/output/depends_on).');
        state.halt_reason = 'no_tasks_planned';
        return;
      }

      // Transition to execution once tasks exist.
      if (state.phase === 'planning') {
        state.phase = 'execution';
      }

      // Deterministic recalculation + metadata normalization.
      tasksDoc.tasks = recalculateTaskStates(tasksDoc.tasks);
      updateTaskMetadata(tasksDoc);

      // Validations: dependency integrity, cycles, and R9.
      validatePlannedTasks(tasksDoc, runtimeConfig);

      // Evidence enforcement (R10) for tasks already marked done.
      const evidenceCfg = getEvidenceConfig(runtimeConfig);
      const requireEvidence = evidenceCfg.required;
      const minFilesChanged = evidenceCfg.min_files_changed;
      const excludedPaths = evidenceCfg.excluded_paths;

      const isExcluded = (filePath) => excludedPaths.some(prefix => filePath.startsWith(prefix));

      if (requireEvidence) {
        for (const task of tasksDoc.tasks) {
          if (task.estado !== 'done') continue;

          const evidence = loadEvidence(task.id);
          if (!evidence) {
            console.error(`[HALT] Missing evidence for done task: ${task.id} (expected system/evidence/${task.id}.json)`);
            state.phase = 'needs_review';
            state.status = 'needs_review';
            state.halt_reason = 'missing_evidence_for_done_task';
            return;
          }

          const changed = Array.isArray(evidence.files_changed) ? evidence.files_changed : [];
          if (changed.length < minFilesChanged) {
            console.error(`[HALT] Evidence for ${task.id} has files_changed=${changed.length} (min ${minFilesChanged})`);
            state.phase = 'needs_review';
            state.status = 'needs_review';
            state.halt_reason = 'insufficient_evidence_files_changed';
            return;
          }

          for (const file of changed) {
            if (isExcluded(file)) {
              console.error(`[HALT] Evidence for ${task.id} includes excluded path: ${file}`);
              state.phase = 'needs_review';
              state.status = 'needs_review';
              state.halt_reason = 'evidence_includes_excluded_paths';
              return;
            }
          }

          // Ensure evidence stays within declared task.output (anti-implicit work).
          validateEvidenceAgainstTask(task, evidence);
          validateAcceptanceCriteria(task, runtimeConfig);
        }
      }

      // Session counters + max_tasks_per_run enforcement across multiple `run`s.
      ensureSessionBaseline(state, tasksDoc, command);

      // Checkpointing: append bounded summaries to memory.md every N completed tasks.
      if (shouldCreateCheckpoint(state)) {
        createCheckpoint(state, tasksDoc.tasks);
      }

      // Refresh context snapshot each run (cheap, small).
      writeContextSnapshot(state, tasksDoc);
      writeStatusDashboard(state, tasksDoc);

      if (!canExecuteMoreTasks(state)) {
        console.log(`[HALT] ${state.halt_reason}`);
        return;
      }

      // Completion detection is cheap: do it before proposing new work.
      if (checkProjectCompletion(tasksDoc.tasks, state)) {
        console.log('[DONE] All tasks are completed.');
        const saved = saveTasksWithLock(tasksDoc, tasksHash);
        if (!saved.ok) {
          state.phase = 'needs_review';
          state.status = 'needs_review';
          state.halt_reason = saved.reason;
        }
        return;
      }

      // Determine next parallel batch.
      const maxBatch = state.parallel_batch.max_batch_size || 3;
      const remainingQuota = Math.max(
        0,
        (state.execution_control.max_tasks_per_run || 5) - (state.execution_control.tasks_completed || 0)
      );
      const batchSize = Math.min(maxBatch, remainingQuota);

      const batch = selectBatchForExecution(tasksDoc.tasks, batchSize);

      if (batch.length === 0) {
        console.log('[HALT] No executable tasks available (all pending tasks are blocked or none exist).');
        state.phase = 'needs_review';
        state.status = 'needs_review';
        state.halt_reason = 'no_executable_tasks';
        const saved = saveTasksWithLock(tasksDoc, tasksHash);
        if (!saved.ok) {
          state.phase = 'needs_review';
          state.status = 'needs_review';
          state.halt_reason = saved.reason;
        }
        return;
      }

      console.log('\n🟢 BATCH PARALELO - Puedes ejecutar estas tareas en cualquier orden:\n');
      batch.forEach(task => {
        console.log(`  - ${task.id}: ${task.title || '(no title)'}`);
        console.log(`    Skill: ${task.skill || '-'}`);
        console.log(`    Input: ${(task.input || []).join(', ') || '-'}`);
        console.log(`    Output: ${(task.output || []).join(', ') || '-'}`);
        if (Array.isArray(task.depends_on) && task.depends_on.length > 0) {
          console.log(`    Depends on: ${task.depends_on.join(', ')}`);
        }
        console.log('');
      });

      let anyTaskUpdated = false;
      let hardFailure = null;
      if (AUTO_EXECUTE) {
        
        for (const task of batch) {
          const execCtx = `pid=${process.pid} run_id=${state.run_id || 'unknown'} task_id=${task.id}`;

          // DEPENDENCY GUARD: re-verify at execution time (deps may have changed within the batch run).
          if (task.depends_on && task.depends_on.length > 0) {
            const liveCompletedIds = new Set(tasksDoc.tasks.filter(t => t.estado === 'done').map(t => t.id));
            const liveFailedIds = new Set(tasksDoc.tasks.filter(t => t.estado === 'failed' || t.estado === 'split_required').map(t => t.id));
            const depFailed = task.depends_on.find(depId => liveFailedIds.has(depId));
            const depNotDone = task.depends_on.find(depId => !liveCompletedIds.has(depId));
            if (depFailed) {
              console.warn(`[DEPS GUARD] Blocking ${task.id} — dependency ${depFailed} is failed`);
              updateTask(tasksDoc, task.id, { estado: 'blocked', block_reason: `dependency_failed:${depFailed}` });
              anyTaskUpdated = true;
              continue;
            }
            if (depNotDone) {
              console.warn(`[DEPS GUARD] Blocking ${task.id} — dependency ${depNotDone} is not done`);
              updateTask(tasksDoc, task.id, { estado: 'blocked', block_reason: `dependency_not_done:${depNotDone}` });
              anyTaskUpdated = true;
              continue;
            }
          }

          // SIZING GATE: tasks annotated sizing_risk=must_split never reach the provider.
          // This is a planning-level block, not an execution failure.
          if (task.sizing_risk === 'must_split') {
            const evidenceDir = path.join(SYSTEM_DIR, 'evidence');
            ensureDir(evidenceDir);
            fs.writeFileSync(
              path.join(evidenceDir, `${task.id}.failure.json`),
              JSON.stringify({
                task_id: task.id,
                run_id: state.run_id || 'unknown',
                stage: 'sizing_gate',
                error_class: 'sizing_gate_blocked',
                error_message: `Task ${task.id} has sizing_risk=must_split — blocked before provider call`,
                sizing_risk: task.sizing_risk,
                timestamp: new Date().toISOString()
              }, null, 2),
              'utf-8'
            );
            console.error(`[SIZING GATE] Task ${task.id} blocked — sizing_risk=must_split, no provider call made`);
            updateTask(tasksDoc, task.id, { estado: 'split_required', block_reason: 'sizing_risk:must_split' });
            anyTaskUpdated = true;
            hardFailure = {
              taskId: task.id,
              failureClass: 'sizing_gate_blocked',
              message: `Task ${task.id} has sizing_risk=must_split and must be split before execution`,
              haltReason: `batch_stopped_on_sizing_gate:${task.id}`
            };
            break;
          }

          let stage = 'provider_call';
          let promptLen = 0;
          let rawType = 'undefined';
          let rawLen = 0;
          let rawPreview = '';
          let parseStarted = false;
          try {
            console.log(`[EXEC] Running task ${task.id} (${execCtx})`);
            const prompt = buildExecutionPrompt(task);
            promptLen = prompt.length;
            console.log(`[LLM DISPATCH] ${execCtx} skill=${task.skill || 'none'} prompt_len=${prompt.length}`);
            const llmOutput = await runLLM(prompt, runtimeConfig, task.skill, {
              taskId: task.id,
              runId: state.run_id || 'unknown'
            });
            console.log(`[LLM RESULT] ${execCtx} raw_type=${typeof llmOutput} raw_len=${typeof llmOutput === 'string' ? llmOutput.length : 0}`);
            const rawOutput = llmOutput || '';
            stage = 'pre_parse';
            rawType = typeof llmOutput;
            rawLen = typeof llmOutput === 'string' ? llmOutput.length : 0;
            rawPreview = typeof llmOutput === 'string' ? llmOutput.slice(0, 300) : '';
            if (!rawOutput.trim()) {
              const evidenceDir = path.join(SYSTEM_DIR, 'evidence');
              ensureDir(evidenceDir);
              const errorMsg = `Empty model response for task ${task.id} (${execCtx})`;
              const errData = {
                task_id: task.id,
                error: errorMsg,
                truncated: false,
                raw_len: rawOutput.length,
                pid: process.pid,
                run_id: state.run_id || 'unknown'
              };
              fs.writeFileSync(
                path.join(evidenceDir, `${task.id}.parse-error.json`),
                JSON.stringify(errData, null, 2),
                'utf-8'
              );
              console.error(`[EXEC PARSE FAIL] ${task.id}: ${errorMsg}`);
              throw new Error(errorMsg);
            }

            // 1. Persist raw output unconditionally before any parsing attempt.
            const evidenceDir = path.join(SYSTEM_DIR, 'evidence');
            ensureDir(evidenceDir);
            fs.writeFileSync(
              path.join(evidenceDir, `${task.id}.raw.txt`),
              rawOutput,
              'utf-8'
            );
            fs.writeFileSync(
              path.join(evidenceDir, `${task.id}.raw.pid-${process.pid}.txt`),
              rawOutput,
              'utf-8'
            );

            // 2. Clean: strip markdown fences, isolate the JSON object by
            //    taking the substring from first '{' to last '}'.
            const fenceStripped = rawOutput
              .replace(/```(?:json|JSON)?\s*/g, '')
              .replace(/```/g, '');
            const firstBrace = fenceStripped.indexOf('{');
            const lastBrace  = fenceStripped.lastIndexOf('}');

            // DEBUG: log parse context to diagnose failures
            console.log(`[DEBUG PARSE] ${execCtx} rawLen=${rawOutput.length} fenceLen=${fenceStripped.length}`);
            console.log(`[DEBUG PARSE] rawFirst100=${JSON.stringify(rawOutput.slice(0, 100))}`);
            console.log(`[DEBUG PARSE] rawLast100=${JSON.stringify(rawOutput.slice(-100))}`);
            console.log(`[DEBUG PARSE] firstBrace=${firstBrace} lastBrace=${lastBrace}`);

            if (firstBrace === -1) {
              const errData = {
                task_id: task.id,
                error: 'No JSON object start found in LLM output',
                truncated: false,
                raw_snippet: rawOutput.slice(0, 300),
                debug: { rawLen: rawOutput.length, fenceLen: fenceStripped.length, firstBrace, lastBrace }
              };
              fs.writeFileSync(
                path.join(evidenceDir, `${task.id}.parse-error.json`),
                JSON.stringify(errData, null, 2),
                'utf-8'
              );
              console.error(`[EXEC PARSE FAIL] ${task.id}: ${errData.error}`);
              throw new Error(errData.error);
            }
            const candidate = (lastBrace !== -1 && lastBrace >= firstBrace)
              ? fenceStripped.slice(firstBrace, lastBrace + 1).trim()
              : fenceStripped.slice(firstBrace).trim();
            const candidateStructure = inspectJsonStructure(candidate);

            // 3. Parse - with one minimal recovery pass for trailing commas.
            parseStarted = true;
            let parsed;
            try {
              parsed = JSON.parse(candidate);
            } catch (e1) {
              // Remove trailing commas before ] or } (common LLM mistake).
              const recovered = candidate.replace(/,\s*([}\]])/g, '$1');
              try {
                parsed = JSON.parse(recovered);
              } catch (e2) {
                const isTruncated = candidateStructure.startsLikeJson &&
                                    !candidateStructure.structurallyComplete;
                const errorMsg = isTruncated
                  ? `LLM output truncated or incomplete for task ${task.id}`
                  : `JSON parse failed for task ${task.id}: ${e2.message}`;
                const errData = {
                  task_id: task.id,
                  error: errorMsg,
                  truncated: isTruncated,
                  parse_error: e2.message,
                  raw_snippet: rawOutput.slice(0, 500),
                  candidate_snippet: candidate.slice(0, 500)
                };
                fs.writeFileSync(
                  path.join(evidenceDir, `${task.id}.parse-error.json`),
                  JSON.stringify(errData, null, 2),
                  'utf-8'
                );
                console.error(`[EXEC PARSE FAIL] ${task.id}: ${errorMsg}`);
                throw new Error(errorMsg);
              }
            }

            // 4. Validate structure.
            if (!parsed.files || !Array.isArray(parsed.files)) {
              throw new Error('Output missing files array');
            }

            const declaredOutputPaths = Array.isArray(task.output) ? task.output.filter(Boolean) : [];
            if (declaredOutputPaths.length === 0) {
              // No declared outputs — task is a side-effect-free step (verification, review, etc.)
              // Auto-complete: write a completion marker so evidence validation passes.
              const markerPath = `docs/${task.id}-complete.md`;
              const markerFile = path.join(ROOT_DIR, markerPath);
              fs.mkdirSync(path.dirname(markerFile), { recursive: true });
              fs.writeFileSync(markerFile, `# ${task.title || task.id}\n\nCompleted: ${new Date().toISOString()}\n`, 'utf-8');
              updateTask(tasksDoc, task.id, { estado: 'done' });
              anyTaskUpdated = true;
              const evidenceDir = path.join(SYSTEM_DIR, 'evidence');
              ensureDir(evidenceDir);
              fs.writeFileSync(
                path.join(evidenceDir, `${task.id}.json`),
                JSON.stringify({ task_id: task.id, files_changed: [markerPath], summary: 'Auto-completed: no declared output files', llm_model: task.skill, timestamp: new Date().toISOString() }, null, 2),
                'utf-8'
              );
              console.log(`[EXEC AUTO] ${task.id}: no declared outputs — auto-completed, marker written to ${markerPath}`);
              continue;
            }
            const validWritableFiles = parsed.files.filter((file) => (
              file &&
              typeof file.path === 'string' &&
              file.path.trim().length > 0 &&
              typeof file.content === 'string' &&
              file.content.trim().length > 0
            ));
            if (validWritableFiles.length === 0) {
              throw new Error(`Output insufficiency for task ${task.id}: parsed.files contains no valid writable path/content pairs`);
            }
            const invalidDeclaredOutputs = parsed.files.filter((file) => (
              file &&
              declaredOutputPaths.includes(file.path) &&
              !(typeof file.content === 'string' && file.content.trim().length > 0)
            ));
            if (invalidDeclaredOutputs.length > 0) {
              throw new Error(`Output insufficiency for task ${task.id}: declared output has unusable content`);
            }
            const beforeOutputSnapshot = snapshotOutputFileHashes(declaredOutputPaths);

            // 5. Write files — only reached when parse succeeded.
            for (const file of parsed.files) {
              if (!file.path || !file.content) {
                console.warn(`[EXEC WARN] ${task.id}: Skipping invalid file entry`);
                continue;
              }
              if (!declaredOutputPaths.includes(file.path)) {
                console.warn(`[EXEC WARN] ${task.id}: File ${file.path} not in allowed outputs ${declaredOutputPaths.join(', ')}`);
              }
              const filePath = path.join(ROOT_DIR, file.path);
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, file.content, 'utf-8');
              console.log(`[EXEC WRITE] ${task.id}: Created ${file.path}`);
            }

            const afterOutputSnapshot = snapshotOutputFileHashes(declaredOutputPaths);
            const changedOutputPaths = getChangedOutputPaths(beforeOutputSnapshot, afterOutputSnapshot);
            if (changedOutputPaths.length === 0) {
              throw new Error(`No declared output files were modified for task ${task.id}`);
            }
            console.log(`[EXEC VERIFY] ${task.id}: Modified declared outputs -> ${changedOutputPaths.join(', ')}`);
            console.log(`[EXEC] Completed task ${task.id}`);

            updateTask(tasksDoc, task.id, { estado: 'done' });
            anyTaskUpdated = true;

            const evidence = {
              task_id: task.id,
              files_changed: changedOutputPaths,
              summary: `Generated/updated ${changedOutputPaths.length} declared output file(s)`,
              llm_model: task.skill,
              timestamp: new Date().toISOString()
            };
            fs.writeFileSync(
              path.join(evidenceDir, `${task.id}.json`),
              JSON.stringify(evidence, null, 2),
              'utf-8'
            );

          } catch (err) {
            const message = String(err?.message || err || 'unknown_error');
            const { modelKey, model } = resolveModelForSkill(runtimeConfig, task.skill);
            if (!parseStarted) {
              const stageClass =
                stage === 'provider_call'
                  ? 'provider_call_failure'
                  : 'pre_parse_failure';
              const preParseEvidence = {
                task_id: task.id,
                run_id: state.run_id || 'unknown',
                skill: task.skill || 'unknown',
                model,
                model_key: modelKey,
                stage,
                error_class:
                  message.includes('OpenRouter returned empty assistant content')
                    ? 'empty_assistant_content'
                    : message.includes('OpenRouter API error')
                    ? 'provider_http_error'
                    : message.includes('Empty model response')
                    ? 'empty_model_response'
                    : stageClass,
                error_message: message,
                finish_reason: parseFinishReason(message),
                prompt_len: promptLen,
                raw_type: rawType,
                raw_len: rawLen,
                timestamp: new Date().toISOString(),
                raw_preview: rawPreview || null
              };
              const evidenceDir = path.join(SYSTEM_DIR, 'evidence');
              ensureDir(evidenceDir);
              fs.writeFileSync(
                path.join(evidenceDir, `${task.id}.failure.json`),
                JSON.stringify(preParseEvidence, null, 2),
                'utf-8'
              );
            }
            const isTruncation = message.includes('truncated or incomplete');
            const failureClass =
              isTruncation ||
              message.includes('JSON parse failed') ||
              message.includes('No JSON object start found') ||
              message.includes('Empty model response')
                ? 'parse_or_truncation_failure'
                : message.includes('Output missing files array') ||
                  message.includes('Output insufficiency') ||
                  message.includes('has no declared output files to verify') ||
                  message.includes('No declared output files were modified')
                ? 'output_sufficiency_failure'
                : 'task_execution_failure';
            console.error(`[EXEC ERROR] ${task.id} (${execCtx}) class=${failureClass}: ${message}`);

            if (isTruncation) {
              const currentAttempts = (task.attempts || 0) + 1;
              const maxAttempts = task.max_attempts || 3;
              if (currentAttempts >= maxAttempts) {
                console.warn(`[TRUNCATION] ${task.id}: exhausted ${maxAttempts} attempts — marking split_required`);
                updateTask(tasksDoc, task.id, { estado: 'split_required', attempts: currentAttempts, block_reason: 'output_too_large' });
                anyTaskUpdated = true;
                hardFailure = {
                  taskId: task.id,
                  failureClass: 'sizing_gate_blocked',
                  message: `Task ${task.id} output too large after ${maxAttempts} attempts — needs manual splitting`,
                  haltReason: `batch_stopped_on_sizing_gate:${task.id}`
                };
                break;
              } else {
                console.warn(`[TRUNCATION] ${task.id}: attempt ${currentAttempts}/${maxAttempts} — retrying with compact mode`);
                updateTask(tasksDoc, task.id, { estado: 'pending', attempts: currentAttempts, truncation_retry: true });
                anyTaskUpdated = true;
                // Stop the batch: subsequent tasks may depend on this task's output.
                // The retry will be picked up at the start of the next run.
                break;
              }
            } else {
              updateTask(tasksDoc, task.id, { estado: 'failed' });
              anyTaskUpdated = true;
              hardFailure = {
                taskId: task.id,
                failureClass,
                message,
                haltReason: `batch_stopped_on_${failureClass}:${task.id}`
              };
              break;
            }
          }
        }
        
        // Save tasks if any were updated
        if (anyTaskUpdated) {
          // Recalculate dependency-driven states (blocked <-> pending) after task completions.
          tasksDoc.tasks = recalculateTaskStates(tasksDoc.tasks);
          updateTaskMetadata(tasksDoc);
          const saved = saveTasksWithLock(tasksDoc, tasksHash);
          if (!saved.ok) {
            hardFailure = applyTasksSaveFailure(state, saved);
            console.error(`[HALT] Could not save tasks (reason=${hardFailure.failureClass}). State moved to needs_review.`);
          } else {
            tasksHash = computeFileHash(TASKS_FILE);
          }
        }

        if (hardFailure) {
          state.phase = 'needs_review';
          state.status = 'needs_review';
          state.halt_reason = hardFailure.haltReason;
          appendRunHistory(state, tasksDoc, `hard_stop_${hardFailure.taskId}`);
          appendEvent('batch_hard_stop', {
            run_id: state.run_id,
            task_id: hardFailure.taskId,
            class: hardFailure.failureClass
          });
          console.error(`[HALT] Stopped batch on first failure: task=${hardFailure.taskId} class=${hardFailure.failureClass}`);
          return;
        }
      }

      console.log('[NEXT] Ejecuta las tareas del batch, luego:');
      console.log('  1) Marca cada tarea como `done` (o `failed`) en system/tasks.yaml');
      if (requireEvidence) {
        console.log('  2) Crea system/evidence/{task_id}.json con files_changed y summary');
      }
      console.log('  3) Vuelve a correr: node runner.js run');

      state.iteration += 1;
      state.halt_reason = 'batch_ready';

      appendRunHistory(state, tasksDoc, 'batch_executed');
      appendEvent('batch_ready', { run_id: state.run_id, batch_size: batch.length });
      
    } finally {
      // Always release lock
      releaseLock(state);
      saveState(state);
      appendEvent('run_end', { run_id: state.run_id, status: state.status });
    }
    
    console.log('\n[END] Runner finished\n');
    return;
  }
  
  if (command === 'review') {
    console.log('[REVIEW] Review mode');
    console.log('[REVIEW] Use this when status = needs_review');
    runReviewHooks();
    appendEvent('review', { run_id: loadState()?.run_id || '-' });
    return;
  }

  if (command === 'plan') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }

    const runtimeConfig = loadRuntimeConfig();
    applyRuntimeConfigToState(state, runtimeConfig);

    const prompt = args.slice(1).join(' ').trim();
    if (prompt) {
      const existingGoal = readFile(GOAL_FILE) || '# Goal\n\n';
      const normalized = existingGoal.includes('# Goal') ? existingGoal : `# Goal\n\n${existingGoal}\n`;
      const updated = `${normalized.trim()}\n\n## Latest Request\n\n${prompt}\n`;
      writeFile(GOAL_FILE, updated);
    }

    let tasksDoc = loadTasks();
    if (!tasksDoc) {
      tasksDoc = initializeTasks(state.run_id);
    }
    tasksDoc = normalizeTasksDoc(tasksDoc);

    state.phase = 'planning';
    state.status = 'running';
    state.halt_reason = null;

    writeContextSnapshot(state, tasksDoc);
    writeStatusDashboard(state, tasksDoc);
    const planRequest = buildPlanRequest(state, tasksDoc, runtimeConfig, prompt);
    writeFile(PLAN_REQUEST_FILE, planRequest);

    saveState(state);
    appendEvent('plan_request', { run_id: state.run_id });

    console.log('[PLAN] Planner request created: system/plan_request.md');
    console.log('[PLAN] Use your LLM/Planner to produce system/plan.md and system/tasks.yaml');
    return;
  }

  if (command === 'validate') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const runtimeConfig = loadRuntimeConfig();
    const tasksDoc = normalizeTasksDoc(loadTasks());
    try {
      validatePlannedTasks(tasksDoc, runtimeConfig);
    } catch (e) {
      console.error(`[VALIDATE] Failed: ${e.message}`);
      process.exit(1);
    }
    console.log('[VALIDATE] Planning checks passed');
    appendEvent('validate', { run_id: state.run_id });
    return;
  }

  if (command === 'skills') {
    const sub = args[1] || '';
    if (sub === 'validate') {
      const skillsDir = path.join(ROOT_DIR, 'skills');
      const audits = auditSkillsDirectory(skillsDir);
      if (!audits.length) {
        console.log('[SKILLS] No skill files found');
        return;
      }
      audits.forEach((item) => {
        const prefix = item.status === 'valid' ? '✓' : item.status === 'warn' ? '⚠' : '✗';
        console.log(`${prefix} ${item.filePath} - ${item.message}`);
      });
      const summary = audits.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});
      console.log(
        `[SKILLS] Validation complete: ${summary.valid || 0} valid, ${summary.warn || 0} warnings, ${summary.error || 0} errors`
      );
      return;
    }
    if (sub === 'detect') {
      const apply = args.includes('--apply');
      const verbose = args.includes('--verbose') || args.includes('-v');
      const agentFlagIndex = args.findIndex(a => a === '--agent' || a === '-a');
      const agent = agentFlagIndex !== -1 ? args[agentFlagIndex + 1] : null;
      const result = runAutoskills({
        cwd: ROOT_DIR,
        dryRun: !apply,
        yes: apply,
        agent: agent || undefined,
        verbose
      });
      const outFile = path.join(SYSTEM_DIR, 'autoskills.last.txt');
      writeFile(outFile, result.output || '');
      writeJSON(SKILL_SUGGESTIONS_FILE, {
        generated_at: nowIso(),
        suggestions: result.suggestions || []
      });
      if (!result.ok) {
        console.error('[AUTOSKILLS] Detect failed. Output saved to system/autoskills.last.txt');
        process.exit(1);
      }
      console.log('[AUTOSKILLS] Detect completed. Output saved to system/autoskills.last.txt');
      if (apply) {
        try {
          execSync('node scripts/organize-autoskills.js', { stdio: 'inherit' });
        } catch (_e) {
          console.error('[AUTOSKILLS] Organization step failed. Run: node scripts/organize-autoskills.js');
        }
        normalizeVendorSkills(ROOT_DIR);
        const items = buildSkillsIndex();
        console.log(`[SKILLS] Index rebuilt (${items.length} items)`);
      }
      return;
    }
    if (sub === 'install') {
      const verbose = args.includes('--verbose') || args.includes('-v');
      const agentFlagIndex = args.findIndex(a => a === '--agent' || a === '-a');
      const agent = agentFlagIndex !== -1 ? args[agentFlagIndex + 1] : null;
      const result = runAutoskills({
        cwd: ROOT_DIR,
        dryRun: false,
        yes: true,
        agent: agent || undefined,
        verbose
      });
      const outFile = path.join(SYSTEM_DIR, 'autoskills.last.txt');
      writeFile(outFile, result.output || '');
      writeJSON(SKILL_SUGGESTIONS_FILE, {
        generated_at: nowIso(),
        suggestions: result.suggestions || []
      });
      if (!result.ok) {
        console.error('[AUTOSKILLS] Install failed. Output saved to system/autoskills.last.txt');
        process.exit(1);
      }
      console.log('[AUTOSKILLS] Install completed. Output saved to system/autoskills.last.txt');
      try {
        execSync('node scripts/organize-autoskills.js', { stdio: 'inherit' });
      } catch (_e) {
        console.error('[AUTOSKILLS] Organization step failed. Run: node scripts/organize-autoskills.js');
      }
      normalizeVendorSkills(ROOT_DIR);
      const items = buildSkillsIndex();
      console.log(`[SKILLS] Index rebuilt (${items.length} items)`);
      return;
    }
    if (sub === 'suggest') {
      const data = readJSON(SKILL_SUGGESTIONS_FILE);
      const items = data?.suggestions || [];
      if (!items.length) {
        console.log('[AUTOSKILLS] No suggestions found. Run: node runner.js skills detect');
        return;
      }
      items.forEach(s => console.log(`- ${s.source} › ${s.skill}${s.hint ? ` (${s.hint})` : ''}`));
      console.log(`[AUTOSKILLS] ${items.length} suggestion(s)`);
      return;
    }
    if (sub === 'rebuild' || sub === '--rebuild') {
      try {
        execSync('node scripts/organize-autoskills.js', { stdio: 'inherit' });
      } catch (_e) {
        console.error('[AUTOSKILLS] Organization step failed. Run: node scripts/organize-autoskills.js');
      }
      normalizeVendorSkills(ROOT_DIR);
      const items = buildSkillsIndex();
      console.log(`[SKILLS] Index rebuilt (${items.length} items)`);
      return;
    }
    const items = loadSkillsIndex();
    if (sub === 'search') {
      const term = (args.slice(2).join(' ') || '').toLowerCase();
      const results = items.filter(i =>
        i.name.toLowerCase().includes(term) || i.path.toLowerCase().includes(term)
      );
      results.forEach(r => console.log(`- ${r.name} (${r.path})`));
      console.log(`[SKILLS] ${results.length} match(es)`);
      return;
    }
    const counts = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    Object.keys(counts).sort().forEach(cat => {
      console.log(`- ${cat}: ${counts[cat]}`);
    });
    console.log(`[SKILLS] Total: ${items.length}`);
    return;
  }

  if (command === 'split') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const taskId = args[1];
    if (!taskId) {
      console.error('[ERROR] Missing task id. Usage: node runner.js split T1');
      process.exit(1);
    }
    const tasksDoc = normalizeTasksDoc(loadTasks());
    const suggestion = suggestTaskSplit(tasksDoc, taskId);
    if (!suggestion) {
      console.error(`[ERROR] Task not found: ${taskId}`);
      process.exit(1);
    }
    if (!suggestion.ok) {
      console.log(`[SPLIT] No split needed: ${suggestion.reason}`);
      return;
    }
    ensureDir(SPLITS_DIR);
    const outFile = path.join(SPLITS_DIR, `${taskId}.yaml`);
    const payload = {
      original_task: taskId,
      violations: suggestion.violations,
      suggested_tasks: suggestion.tasks
    };
    writeYAML(outFile, payload);
    console.log(`[SPLIT] Suggestion written to ${outFile}`);
    appendEvent('split', { task: taskId });
    return;
  }

  if (command === 'memory') {
    const sub = args[1] || '';
    if (sub === 'search') {
      const query = args.slice(2).join(' ').trim();
      if (!query) {
        console.error('[ERROR] Missing query. Usage: node runner.js memory search "text"');
        process.exit(1);
      }
      const state = loadState();
      const project = state?.run_id ? path.basename(ROOT_DIR) : path.basename(ROOT_DIR);
      memoryManager.search({ query, project, limit: 5 }).then((results) => {
        if (!results || results.length === 0) {
          console.log('[MEMORY] No results found');
          return;
        }
        results.forEach((r) => {
          const line = r.title ? `${r.title} - ${r.content || ''}` : (r.content || JSON.stringify(r));
          console.log(`- ${line}`.trim());
        });
      }).catch(() => {
        console.error('[MEMORY] Search failed');
      });
      return;
    }
  }

  if (command === 'provider') {
    const state = loadProviderState();
    const sub = args[1] || '';
    if (sub === 'list') {
      const providers = state.providers || {};
      Object.keys(providers).forEach(name => {
        const active = name === state.active_provider ? ' (active)' : '';
        console.log(`- ${name}${active}`);
      });
      return;
    }
    if (sub === 'use') {
      const name = args[2];
      if (!name) {
        console.error('[ERROR] Missing provider name. Usage: node runner.js provider use <name>');
        process.exit(1);
      }
      if (!state.providers || !state.providers[name]) {
        console.error(`[ERROR] Unknown provider: ${name}`);
        process.exit(1);
      }
      updateProviderState({ active_provider: name });
      console.log(`[PROVIDER] Active provider set to ${name}`);
      appendEvent('provider', { active: name });
      return;
    }
    console.log('[PROVIDER] Usage: node runner.js provider list | use <name>');
    return;
  }

  if (command === 'cost') {
    const sub = args[1] || '';
    if (sub === 'set') {
      const value = parseFloat(args[2]);
      if (Number.isNaN(value)) {
        console.error('[ERROR] Missing/invalid amount. Usage: node runner.js cost set 50');
        process.exit(1);
      }
      updateCostState({ budget_usd: value });
      console.log(`[COST] Budget set to ${value} USD`);
      appendEvent('cost_budget', { budget: value });
      return;
    }
    if (sub === 'add') {
      const value = parseFloat(args[2]);
      if (Number.isNaN(value)) {
        console.error('[ERROR] Missing/invalid amount. Usage: node runner.js cost add 1.25');
        process.exit(1);
      }
      const state = loadCostState();
      const next = (state.spent_usd || 0) + value;
      updateCostState({ spent_usd: next });
      console.log(`[COST] Spent updated to ${next} USD`);
      appendEvent('cost_spent', { spent: next });
      return;
    }
    const state = loadCostState();
    console.log(`[COST] budget_usd=${state.budget_usd} spent_usd=${state.spent_usd}`);
    return;
  }

  if (command === 'evidence') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const runtimeConfig = loadRuntimeConfig();
    const taskId = args[1];
    if (!taskId) {
      console.error('[ERROR] Missing task id. Usage: node runner.js evidence T1 [files...]');
      process.exit(1);
    }
    const files = args.slice(2);
    const filesChanged = files.length ? files : getGitDiffFiles();
    const cleaned = createEvidenceForTask(taskId, filesChanged, 'Auto-generated evidence', runtimeConfig);
    console.log(`[EVIDENCE] Saved system/evidence/${taskId}.json with ${cleaned.length} files`);
    appendEvent('evidence', { task: taskId, files: cleaned.length });
    return;
  }

  if (command === 'verify') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const runtimeConfig = loadRuntimeConfig();
    const tasksDoc = normalizeTasksDoc(loadTasks());
    const evidenceCfg = getEvidenceConfig(runtimeConfig);

    const errors = [];
    for (const task of tasksDoc.tasks) {
      if (task.estado !== 'done') continue;

      if (evidenceCfg.required) {
        const evidence = loadEvidence(task.id);
        if (!evidence) {
          errors.push(`Missing evidence for ${task.id}`);
          continue;
        }
        const changed = Array.isArray(evidence.files_changed) ? evidence.files_changed : [];
        const cleaned = filterExcludedPaths(changed, evidenceCfg.excluded_paths);
        if (cleaned.length < evidenceCfg.min_files_changed) {
          errors.push(`Evidence for ${task.id} has files_changed=${cleaned.length} (min ${evidenceCfg.min_files_changed})`);
          continue;
        }
        try {
          validateEvidenceAgainstTask(task, evidence);
        } catch (e) {
          errors.push(e.message);
          continue;
        }
      }

      try {
        validateAcceptanceCriteria(task, runtimeConfig);
      } catch (e) {
        errors.push(e.message);
      }
    }

    if (errors.length > 0) {
      console.error('[VERIFY] Failed:');
      errors.forEach(err => console.error(`- ${err}`));
      process.exit(1);
    }

    console.log('[VERIFY] All done tasks validated');
    appendEvent('verify', { run_id: state.run_id });
    return;
  }

  if (command === 'done') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const runtimeConfig = loadRuntimeConfig();
    const taskId = args[1];
    if (!taskId) {
      console.error('[ERROR] Missing task id. Usage: node runner.js done T1 [files...]');
      process.exit(1);
    }
    const tasksDoc = normalizeTasksDoc(loadTasks());
    const tasksHash = computeFileHash(TASKS_FILE);
    const task = markTaskDone(tasksDoc, taskId);
    if (!task) {
      console.error(`[ERROR] Task not found: ${taskId}`);
      process.exit(1);
    }
    onTaskSuccess(state);
    const saved = saveTasksWithLock(tasksDoc, tasksHash);
    if (!saved.ok) {
      console.error('[ERROR] tasks.yaml changed by another actor. Retry.');
      process.exit(1);
    }
    saveState(state);
    writeStatusDashboard(state, tasksDoc);
    appendRunHistory(state, tasksDoc, 'done');

    if (getEvidenceConfig(runtimeConfig).required) {
      const files = args.slice(2);
      const filesChanged = files.length ? files : getGitDiffFiles();
      createEvidenceForTask(taskId, filesChanged, 'Auto-generated evidence', runtimeConfig);
      console.log(`[DONE] Task ${taskId} marked done + evidence saved`);
      appendEvent('done', { task: taskId, evidence: 'auto' });
      return;
    }

    console.log(`[DONE] Task ${taskId} marked done`);
    appendEvent('done', { task: taskId });
    return;
  }

  if (command === 'fail') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const tasksDoc = normalizeTasksDoc(loadTasks());
    const tasksHash = computeFileHash(TASKS_FILE);
    const taskId = args[1];
    if (!taskId) {
      console.error('[ERROR] Missing task id. Usage: node runner.js fail T1 "reason"');
      process.exit(1);
    }
    const reason = args.slice(2).join(' ').trim();
    const task = markTaskFailed(tasksDoc, taskId, reason);
    if (!task) {
      console.error(`[ERROR] Task not found: ${taskId}`);
      process.exit(1);
    }
    const result = processTaskFailure(tasksDoc, taskId, state);
    const saved = saveTasksWithLock(tasksDoc, tasksHash);
    if (!saved.ok) {
      console.error('[ERROR] tasks.yaml changed by another actor. Retry.');
      process.exit(1);
    }
    saveState(state);
    writeStatusDashboard(state, tasksDoc);
    appendRunHistory(state, tasksDoc, 'fail');
    console.log(`[FAIL] ${result.message}`);
    if (result.blocked_dependents && result.blocked_dependents.length) {
      console.log(`[FAIL] Blocked dependents: ${result.blocked_dependents.join(', ')}`);
    }
    appendEvent('fail', { task: taskId, action: result.action });
    return;
  }

  if (command === 'retry') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const tasksDoc = normalizeTasksDoc(loadTasks());
    const tasksHash = computeFileHash(TASKS_FILE);
    const taskId = args[1];
    if (!taskId) {
      console.error('[ERROR] Missing task id. Usage: node runner.js retry T1');
      process.exit(1);
    }
    const task = markTaskPending(tasksDoc, taskId);
    if (!task) {
      console.error(`[ERROR] Task not found: ${taskId}`);
      process.exit(1);
    }
    if (task.error === 'failed_permanent') {
      console.error(`[ERROR] Task ${taskId} is failed_permanent and cannot be retried`);
      process.exit(1);
    }
    const saved = saveTasksWithLock(tasksDoc, tasksHash);
    if (!saved.ok) {
      console.error('[ERROR] tasks.yaml changed by another actor. Retry.');
      process.exit(1);
    }
    saveState(state);
    writeStatusDashboard(state, tasksDoc);
    appendRunHistory(state, tasksDoc, 'retry');
    console.log(`[RETRY] Task ${taskId} moved back to pending`);
    appendEvent('retry', { task: taskId });
    return;
  }

  if (command === 'context') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    const tasksDoc = normalizeTasksDoc(loadTasks());
    writeContextSnapshot(state, tasksDoc);
    writeStatusDashboard(state, tasksDoc);
    console.log('[CONTEXT] Snapshot updated in system/context.md');
    appendEvent('context', { run_id: state.run_id });
    return;
  }
  
  // Default: show help
  console.log('Usage: node runner.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  init "goal"    Initialize new run');
  console.log('  run            Execute one round (up to 5 tasks)');
  console.log('  resume         Resume from paused state');
  console.log('  status         Show current state');
  console.log('  review         Manual review mode');
  console.log('  plan "prompt"  Create planner request (context + goal)');
  console.log('  validate       Validate tasks.yaml against config');
  console.log('  skills [detect|install|suggest|search <term>|rebuild]  Skills registry');
  console.log('  memory search "query"  Search memory (Engram/file)');
  console.log('  split T1        Suggest task split (writes system/splits/T1.yaml)');
  console.log('  provider list|use <name>  Provider selection');
  console.log('  cost [set|add] <amount>  Track budget/spend');
  console.log('  done T1 [files...]   Mark task done (+ auto evidence)');
  console.log('  fail T1 "reason"     Mark task failed');
  console.log('  retry T1             Move task back to pending');
  console.log('  evidence T1 [files...]  Write evidence for task');
  console.log('  verify               Validate evidence for done tasks');
  console.log('  context        Refresh context snapshot');
  console.log('  status.md / events.log auto-updated during runs');
  console.log('');
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[ERROR]', err.message);
    process.exit(1);
  });
}

// Export for tests
module.exports = {
  initializeState,
  loadState,
  saveState,
  acquireLock,
  releaseLock,
  validateLock,
  generateRunId,
  loadTasks,
  saveTasks,
  saveTasksWithLock,
  applyTasksSaveFailure,
  computeFileHash,
  initializeTasks,
  getTaskById,
  updateTask,
  updateTaskMetadata,
  // Phase 3
  resetExecutionCounters,
  canExecuteMoreTasks,
  checkIterationLimit,
  // Phase 4
  getExecutableTasks,
  selectBatchForExecution,
  // Phase 5
  shouldCreateCheckpoint,
  createCheckpoint,
  // Phase 6
  checkCooldownTrigger,
  onTaskSuccess,
  onTaskFailure,
  // Phase 7
  saveEvidence,
  loadEvidence,
  // Phase 10
  recalculateTaskStates,
  // Phase 11
  validateTaskSize,
  validateAllTasks,
  // Phase 12
  checkProjectCompletion,
  // Phase 13
  validateDependencies,
  detectCycles,
  // Phase 14
  validateEvidenceAgainstTask,
  validatePlannedTasks,
  buildExecutionPrompt,
  // Phase 17
  validatePlannerAllowed,
  // Phase 18 - Attempts/Max Attempts (Mejora 2)
  incrementTaskAttempts,
  isTaskExhausted,
  markTaskFailedPermanent,
  handleDependentTasksOnFailure,
  processTaskFailure,
  // Phase 5B - Memory Compaction (Mejora 3)
  getMemoryConfig,
  countMemoryEntries,
  shouldCompactMemory,
  performMemoryCompaction,
  appendToMemoryWithCompaction,
  // Phase 19 - Corrective Tasks (Mejora 1)
  generateCorrectiveTaskId,
  isCorrectiveTask,
  getOriginalTaskId,
  createCorrectiveTask,
  linkDependentToCorrective,
  createAndLinkCorrectiveTask
};
