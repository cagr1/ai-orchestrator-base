#!/usr/bin/env node

console.log('\n🔍 VERIFICACIÓN DE ORCHESTOS v5.1');
console.log('========================================\n');

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

const check = (name, condition) => {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
};

const fileExists = (filepath) => {
  try {
    return fs.existsSync(filepath);
  } catch {
    return false;
  }
};

const directoryExists = (dirpath) => {
  try {
    return fs.statSync(dirpath).isDirectory();
  } catch {
    return false;
  }
};

// 1. Verificar estructura principal
console.log('📁 Estructura del proyecto:');
check('Directorio src/integrations existe', directoryExists('src/integrations'));
check('Directorio src/web existe', directoryExists('src/web'));
check('Directorio src/web/public existe', directoryExists('src/web/public'));
check('Directorio src/web/routes existe', directoryExists('src/web/routes'));
check('Directorio src/web/services existe', directoryExists('src/web/services'));
check('Directorio system existe', directoryExists('system'));

// 2. Verificar archivos clave
console.log('\n📄 Archivos clave:');
check('runner.js existe', fileExists('runner.js'));
check('package.json existe', fileExists('package.json'));
check('system/config.json existe', fileExists('system/config.json'));
check('system/state.json existe', fileExists('system/state.json'));
check('system/tasks.yaml existe', fileExists('system/tasks.yaml'));

// 3. Verificar módulos de integración
console.log('\n🔧 Módulos de integración:');
check('engram-client.js existe', fileExists('src/integrations/engram-client.js'));
check('autoskills-adapter.js existe', fileExists('src/integrations/autoskills-adapter.js'));
check('memory-manager.js existe', fileExists('src/integrations/memory-manager.js'));
check('skill-manager.js existe', fileExists('src/integrations/skill-manager.js'));

// 4. Verificar dashboard
console.log('\n🎯 Dashboard:');
check('server.js existe', fileExists('src/web/server.js'));
check('dashboard-service.js existe', fileExists('src/web/services/dashboard-service.js'));
check('realtime-service.js existe', fileExists('src/web/services/realtime-service.js'));
check('websocket-service.js existe', fileExists('src/web/services/websocket-service.js'));
check('routes/api.js existe', fileExists('src/web/routes/api.js'));
check('routes/views.js existe', fileExists('src/web/routes/views.js'));
check('public/dashboard/index.html existe', fileExists('src/web/public/dashboard/index.html'));

// 5. Verificar configuraciones
console.log('\n⚙️ Configuraciones:');
try {
  const config = JSON.parse(fs.readFileSync('system/config.json', 'utf-8'));
  check('Config tiene versión 3.0', config.version === '3.0');
  check('Config tiene límites definidos', config.limits && config.limits.max_tasks_per_run);
  check('Config tiene settings de evidence', config.evidence && config.evidence.required);
} catch {
  check('Config es JSON válido', false);
}

// 6. Verificar tasks.yaml
console.log('\n📋 Tasks.yaml:');
try {
  const tasksContent = fs.readFileSync('system/tasks.yaml', 'utf-8');
  const hasTasks = tasksContent.includes('tasks:');
  const hasVersion = tasksContent.includes("version: '3.0'");
  check('Tasks.yaml tiene formato válido', hasTasks && hasVersion);
  
  // Contar tareas
  const taskCount = (tasksContent.match(/- id:/g) || []).length;
  console.log(`   📊 Tareas definidas: ${taskCount}`);
} catch {
  check('Tasks.yaml es YAML válido', false);
}

// 7. Verificar dependencias instaladas
console.log('\n📦 Dependencias:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const hasExpress = packageJson.dependencies && packageJson.dependencies.express;
  const hasHTMX = packageJson.dependencies && packageJson.dependencies['htmx.org'];
  const hasJSYAML = packageJson.dependencies && packageJson.dependencies['js-yaml'];
  
  check('Express instalado', hasExpress);
  check('HTMX instalado (o en public)', fileExists('src/web/public/assets/htmx.min.js') || hasHTMX);
  check('js-yaml instalado', hasJSYAML);
} catch {
  check('package.json es JSON válido', false);
}

// 8. Verificar skills
console.log('\n🎯 Skills:');
const skillsDir = 'skills';
if (directoryExists(skillsDir)) {
  const skillFiles = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  check('Skills directory existe', true);
  console.log(`   📚 Skills disponibles: ${skillFiles.length}`);
  
  // Verificar skills específicos
  const frontendSkill = path.join(skillsDir, 'frontend-html-basic.md');
  check('Skill frontend-html-basic.md existe', fileExists(frontendSkill));
} else {
  check('Skills directory existe', false);
}

// 9. Resumen final
console.log('\n========================================');
console.log('📊 RESUMEN FINAL:');
console.log(`✅ Pasados: ${passed}`);
console.log(`❌ Fallados: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);
console.log(`🎯 Porcentaje: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed > 0) {
  console.log('\n⚠️  ¡Atención! Algunas verificaciones fallaron.');
  console.log('   Revisa los archivos marcados con ❌.');
} else {
  console.log('\n🎉 ¡Todo perfecto! OrchestOS está listo para usar.');
}

console.log('\n🚀 Próximos pasos:');
console.log('   1. Ejecutar: node src/web/server.js');
console.log('   2. Abrir: http://localhost:3000/dashboard');
console.log('   3. Probar: Crear tarea, buscar memoria, detectar skills\n');