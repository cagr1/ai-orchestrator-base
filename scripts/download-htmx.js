#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

console.log('📥 Descargando HTMX para el dashboard...');

const assetsDir = path.join(__dirname, '..', 'src/web/public/assets');

// Crear directorio si no existe
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// URL de HTMX 1.9.10 (versión estable)
const htmxUrl = 'https://unpkg.com/htmx.org@1.9.10/dist/htmx.min.js';
const htmxPath = path.join(assetsDir, 'htmx.min.js');

// Descargar HTMX
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

// También necesitamos hyperscript para interacciones avanzadas
const hyperscriptUrl = 'https://unpkg.com/hyperscript.org@0.9.12/dist/_hyperscript.min.js';
const hyperscriptPath = path.join(assetsDir, '_hyperscript.min.js');

async function main() {
  try {
    console.log('📦 Descargando HTMX...');
    await downloadFile(htmxUrl, htmxPath);
    console.log('✅ HTMX descargado correctamente');
    
    console.log('📦 Descargando Hyperscript...');
    await downloadFile(hyperscriptUrl, hyperscriptPath);
    console.log('✅ Hyperscript descargado correctamente');
    
    // Verificar que los archivos existen
    if (fs.existsSync(htmxPath) && fs.existsSync(hyperscriptPath)) {
      const htmxSize = fs.statSync(htmxPath).size;
      const hyperscriptSize = fs.statSync(hyperscriptPath).size;
      
      console.log('\n📊 Resumen:');
      console.log(`   - htmx.min.js: ${(htmxSize / 1024).toFixed(1)} KB`);
      console.log(`   - _hyperscript.min.js: ${(hyperscriptSize / 1024).toFixed(1)} KB`);
      console.log(`   - Total: ${((htmxSize + hyperscriptSize) / 1024).toFixed(1)} KB`);
      
      console.log('\n🎉 Assets listos para el dashboard!');
      console.log('   Los archivos están en: src/web/public/assets/');
    } else {
      console.log('❌ Error: No se pudieron descargar todos los archivos');
    }
  } catch (error) {
    console.error('❌ Error descargando assets:', error.message);
    
    // Fallback: crear archivos mínimos
    console.log('🔄 Creando fallback local...');
    
    // HTMX mínimo (solo funciones básicas)
    const htmxFallback = `
// HTMX Fallback - funciones básicas
window.htmx = {
  onLoad: (cb) => document.addEventListener('DOMContentLoaded', cb),
  process: (el) => console.log('HTMX process', el),
  ajax: (verb, path, config) => {
    console.log('HTMX ajax', verb, path, config);
    return fetch(path, { method: verb, ...config });
  }
};
console.log('HTMX fallback cargado');
`;
    
    // Hyperscript fallback
    const hyperscriptFallback = `
// Hyperscript Fallback
window._hyperscript = {
  addProcessor: () => {},
  evaluate: (code, el) => {
    console.log('Hyperscript evaluate', code, el);
    try {
      return eval(code);
    } catch (e) {
      console.error('Hyperscript error:', e);
    }
  }
};
console.log('Hyperscript fallback cargado');
`;
    
    fs.writeFileSync(htmxPath, htmxFallback);
    fs.writeFileSync(hyperscriptPath, hyperscriptFallback);
    
    console.log('✅ Fallback creado (funcionalidad básica)');
  }
}

main();