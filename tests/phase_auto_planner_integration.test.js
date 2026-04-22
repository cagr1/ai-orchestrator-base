const assert = require('assert');
const { enforceFrontendIntegrationInputs } = require('../src/integrations/auto-planner');

console.log('Testing Phase Auto Planner Integration Inputs...');

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
    description: 'Write wireframe',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 2,
    depends_on: ['T1'],
    input: [],
    output: ['docs/wireframe.md']
  },
  {
    id: 'T3',
    title: 'Create CSS',
    description: 'Create styles',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 3,
    depends_on: [],
    input: [],
    output: ['styles.css']
  },
  {
    id: 'T4',
    title: 'Create JS',
    description: 'Create interactions',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 3,
    depends_on: [],
    input: [],
    output: ['script.js']
  }
];

enforceFrontendIntegrationInputs(tasks);

const cssTask = tasks.find(task => task.id === 'T3');
assert(cssTask.depends_on.includes('T1'), 'CSS task should depend on T1');
assert(cssTask.input.includes('index.html'), 'CSS task should read index.html');

const jsTask = tasks.find(task => task.id === 'T4');
assert(jsTask.depends_on.includes('T1'), 'JS task should depend on T1');
assert(jsTask.input.includes('index.html'), 'JS task should read index.html');

const integrationTask = tasks.find(task => task.id === 'T5');
assert(integrationTask, 'Final integration task should be created');
assert.deepStrictEqual(integrationTask.output, ['index.html'], 'Integration task should only output index.html');
assert(integrationTask.depends_on.includes('T3'), 'Integration task should depend on CSS task');
assert(integrationTask.depends_on.includes('T4'), 'Integration task should depend on JS task');
assert(integrationTask.input.includes('index.html'), 'Integration task should read existing index.html');
assert(integrationTask.input.includes('styles.css'), 'Integration task should read styles.css');
assert(integrationTask.input.includes('script.js'), 'Integration task should read script.js');

const tasksWithExistingIntegration = [
  {
    id: 'T1',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 1,
    depends_on: [],
    input: [],
    output: ['index.html']
  },
  {
    id: 'T2',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 2,
    depends_on: ['T1'],
    input: [],
    output: ['styles.css']
  },
  {
    id: 'T3',
    skill: 'frontend-html-basic',
    estado: 'pending',
    priority: 3,
    depends_on: [],
    input: [],
    output: ['index.html']
  }
];

enforceFrontendIntegrationInputs(tasksWithExistingIntegration);
assert.strictEqual(tasksWithExistingIntegration.length, 3, 'Existing integration task should be reused');
assert(tasksWithExistingIntegration[2].depends_on.includes('T2'), 'Existing integration task should depend on asset task');
assert(tasksWithExistingIntegration[2].input.includes('styles.css'), 'Existing integration task should read asset output');

console.log('✓ Auto planner frontend integration inputs work');
