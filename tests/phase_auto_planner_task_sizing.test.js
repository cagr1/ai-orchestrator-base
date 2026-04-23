const assert = require('assert');
const {
  enforceCSSTaskSizing,
  enforceFrontendIntegrationInputs
} = require('../src/integrations/auto-planner');

console.log('Testing Phase Auto Planner Task Sizing...');

const tasks = [
  {
    id: 'T1',
    title: 'Bootstrap HTML',
    description: 'Create base HTML',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 1,
    depends_on: [],
    input: [],
    output: ['index.html']
  },
  {
    id: 'T2',
    title: 'Wireframe',
    description: 'Write concise wireframe',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 2,
    depends_on: ['T1'],
    input: ['index.html'],
    output: ['docs/wireframe.md']
  },
  {
    id: 'T3',
    title: 'Implement full responsive styles',
    description: 'Create complete CSS for the whole hospital website',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 3,
    depends_on: ['T2'],
    input: ['index.html', 'docs/wireframe.md'],
    output: ['styles.css']
  }
];

enforceCSSTaskSizing(tasks);

const sectionOutputs = tasks.flatMap(task => task.output || []);
assert(sectionOutputs.includes('styles/layout.css'), 'Layout section CSS should be created');
assert(sectionOutputs.includes('styles/components.css'), 'Components section CSS should be created');
assert(sectionOutputs.includes('styles/typography.css'), 'Typography section CSS should be created');
assert(sectionOutputs.includes('styles/responsive.css'), 'Responsive section CSS should be created');
assert(!sectionOutputs.includes('styles.css'), 'Generic styles.css task should be split before integration');

const cssSectionTasks = tasks.filter(task => (task.output || []).some(output => output.startsWith('styles/')));
assert.strictEqual(cssSectionTasks.length, 4, 'Exactly four bounded CSS section tasks should exist');
for (const task of cssSectionTasks) {
  assert(task.depends_on.includes('T1'), `${task.id} should depend on T1`);
  assert(task.input.includes('index.html'), `${task.id} should read index.html`);
  assert(task.input.includes('docs/wireframe.md'), `${task.id} should read docs/wireframe.md`);
  assert(task.description.includes('under 100 lines'), `${task.id} should include line budget`);
}

enforceFrontendIntegrationInputs(tasks);

const integrationTask = tasks.find(task => (task.output || []).includes('index.html') && task.id !== 'T1');
assert(integrationTask, 'Integration task should be created');
assert(integrationTask.output.includes('styles.css'), 'Integration task should output final styles.css');
assert(integrationTask.description.includes('layout, components, typography, responsive'), 'Integration task should describe merge order');
for (const cssTask of cssSectionTasks) {
  assert(integrationTask.depends_on.includes(cssTask.id), `Integration task should depend on ${cssTask.id}`);
  assert(integrationTask.input.includes(cssTask.output[0]), `Integration task should read ${cssTask.output[0]}`);
}

const scopedTasks = [
  {
    id: 'T1',
    title: 'Bootstrap HTML',
    description: 'Create base HTML',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 1,
    depends_on: [],
    input: [],
    output: ['index.html']
  },
  {
    id: 'T2',
    title: 'Create layout CSS section',
    description: 'Generate only the layout CSS section under 100 lines',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 2,
    depends_on: ['T1'],
    input: ['index.html'],
    output: ['styles/layout.css']
  }
];

enforceCSSTaskSizing(scopedTasks);
assert.strictEqual(scopedTasks.length, 2, 'Already scoped CSS task should not be split again');

console.log('✓ Auto planner task sizing bounds CSS output');
