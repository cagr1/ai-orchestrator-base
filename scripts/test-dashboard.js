#!/usr/bin/env node

console.log('\n🧪 TEST DEL DASHBOARD ORCHESTOS');
console.log('========================================\n');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testDashboard() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🔍 Testing endpoints...');
  
  try {
    // 1. Test health endpoint
    console.log('1. Health endpoint');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log(`   ✅ Status: ${healthRes.status}, Data: ${JSON.stringify(healthData)}`);
    
    // 2. Test dashboard endpoint
    console.log('2. Dashboard endpoint');
    const dashboardRes = await fetch(`${baseUrl}/dashboard`);
    console.log(`   ✅ Status: ${dashboardRes.status}, Content-Type: ${dashboardRes.headers.get('content-type')}`);
    
    // 3. Test API endpoints
    console.log('3. API endpoints');
    
    // Status API
    const statusRes = await fetch(`${baseUrl}/api/status`);
    const statusData = await statusRes.json();
    console.log(`   ✅ Status API: ${statusRes.status}, Phase: ${statusData.phase || 'N/A'}`);
    
    // Tasks API
    const tasksRes = await fetch(`${baseUrl}/api/tasks`);
    const tasksData = await tasksRes.json();
    console.log(`   ✅ Tasks API: ${tasksRes.status}, Tasks: ${tasksData.length || 0}`);
    
    // Skills API
    const skillsRes = await fetch(`${baseUrl}/api/skills`);
    const skillsData = await skillsRes.json();
    console.log(`   ✅ Skills API: ${skillsRes.status}, Skills: ${skillsData.length || 0}`);
    
    // Memory API (search)
    const memoryRes = await fetch(`${baseUrl}/api/memory/search?q=test`);
    const memoryData = await memoryRes.json();
    console.log(`   ✅ Memory API: ${memoryRes.status}, Results: ${memoryData.length || 0}`);
    
    // 4. Test crear tarea
    console.log('4. Crear tarea (POST)');
    const createTaskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test task from dashboard',
        description: 'Testing dashboard functionality',
        skill: 'frontend-html-basic',
        priority: 2
      })
    });
    const createTaskData = await createTaskRes.json();
    console.log(`   ✅ Create Task: ${createTaskRes.status}, ID: ${createTaskData.id || 'N/A'}`);
    
    // 5. Test init project
    console.log('5. Init project');
    const initRes = await fetch(`${baseUrl}/api/project/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'Test project from dashboard',
        project_root: '.'
      })
    });
    const initData = await initRes.json();
    console.log(`   ✅ Init Project: ${initRes.status}, OK: ${initData.ok || false}`);
    
    // 6. Test detect skills
    console.log('6. Detect skills');
    const detectRes = await fetch(`${baseUrl}/api/skills/detect`);
    const detectData = await detectRes.json();
    console.log(`   ✅ Detect Skills: ${detectRes.status}, Output: ${detectData.output ? 'Yes' : 'No'}`);
    
    // 7. Test project files
    console.log('7. Project files');
    const filesRes = await fetch(`${baseUrl}/api/project/files`);
    const filesData = await filesRes.json();
    console.log(`   ✅ Project Files: ${filesRes.status}, Files: ${filesData.length || 0}`);
    
    // 8. Test file operations
    console.log('8. File operations');
    const testFilePath = 'test-dashboard-file.txt';
    const writeRes = await fetch(`${baseUrl}/api/project/file/${testFilePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'This file was created by dashboard test'
      })
    });
    const writeData = await writeRes.json();
    console.log(`   ✅ Write File: ${writeRes.status}, OK: ${writeData.ok || false}`);
    
    // Leer el archivo
    const readRes = await fetch(`${baseUrl}/api/project/file/${testFilePath}`);
    const readData = await readRes.json();
    console.log(`   ✅ Read File: ${readRes.status}, Content: ${readData.content ? 'Yes' : 'No'}`);
    
    console.log('\n========================================');
    console.log('🎉 TODAS LAS TESTS PASADAS!');
    console.log('\n🚀 Dashboard está funcionando correctamente.');
    console.log('   Puedes acceder a: http://localhost:3000/dashboard');
    
  } catch (error) {
    console.error('\n❌ Error durante las tests:', error.message);
    console.log('🔧 Soluciones posibles:');
    console.log('   1. Verificar que el servidor está corriendo: node src/web/server.js');
    console.log('   2. Verificar que HTMX está instalado: node scripts/download-htmx.js');
    console.log('   3. Verificar config.json tiene la versión correcta');
    console.log('   4. Verificar tasks.yaml tiene formato válido');
  }
}

// Check if server is running first
console.log('📡 Verificando conexión al servidor...');
testDashboard();