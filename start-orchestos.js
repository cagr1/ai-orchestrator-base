#!/usr/bin/env node

console.log('\n🚀 INICIANDO ORCHESTOS v5.1');
console.log('========================================\n');

const { spawn } = require('child_process');
const path = require('path');

// Verificar dependencias
console.log('🔍 Verificando dependencias...');

const requiredDeps = ['express', 'socket.io', 'js-yaml', 'node-fetch'];
const packageJson = require('./package.json');
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

let allDepsInstalled = true;
for (const dep of requiredDeps) {
  if (!deps[dep]) {
    console.log(`❌ Falta: ${dep}`);
    allDepsInstalled = false;
  }
}

if (!allDepsInstalled) {
  console.log('\n📦 Instalando dependencias faltantes...');
  const install = spawn('npm', ['install', ...requiredDeps.filter(d => !deps[d])], {
    stdio: 'inherit',
    shell: true
  });
  
  install.on('close', (code) => {
    if (code === 0) {
      startServer();
    } else {
      console.error('❌ Error instalando dependencias');
    }
  });
} else {
  console.log('✅ Todas las dependencias están instaladas');
  startServer();
}

function startServer() {
  console.log('\n🌐 Iniciando servidor dashboard...');
  console.log('   Servidor: http://localhost:3000');
  console.log('   Dashboard: http://localhost:3000/dashboard');
  console.log('\n📋 Para probar el dashboard, ejecuta:');
  console.log('   node scripts/test-dashboard.js');
  console.log('\n🔄 Presiona Ctrl+C para detener el servidor\n');
  
  const server = spawn('node', [path.join(__dirname, 'src/web/server.js')], {
    stdio: 'inherit',
    shell: true
  });
  
  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo servidor...');
    server.kill('SIGINT');
    process.exit(0);
  });
}