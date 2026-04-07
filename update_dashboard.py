#!/usr/bin/env python3
import re

# Read the file
with open('src/web/public/dashboard/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add the improvements CSS after the main CSS
content = content.replace(
    '<link rel="stylesheet" href="/assets/dashboard.css" />',
    '<link rel="stylesheet" href="/assets/dashboard.css" />\n    <link rel="stylesheet" href="/assets/dashboard-improvements.css" />'
)

# 2. Add toast container after <body>
content = content.replace(
    '<body>',
    '<body>\n    <!-- Toast Container -->\n    <div class="toast-container" id="toastContainer"></div>'
)

# 3. Add folder picker button to project path
content = content.replace(
    '<input class="textbox" id="projectPath" placeholder="/Users/name/project" />',
    '<div class="input-with-btn">\n                <input class="textbox" id="projectPath" placeholder="/Users/name/project" />\n                <button class="file-picker-btn" id="browseFolderBtn">📁 Browse</button>\n              </div>'
)

# 4. Add Create Project button in Prompt Studio
content = content.replace(
    '<button class="btn" id="savePromptBtn" data-i18n="save">Save</button>',
    '<button class="btn" id="savePromptBtn" data-i18n="save">Save</button>\n            <button class="btn primary" id="createProjectBtn" data-i18n="create_project">Create Project</button>'
)

# 5. Add "loading" state for project init
content = content.replace(
    'projectInitBtn.addEventListener(\'click\', async () => {',
    '''// Toast notification function
      const showToast = (message, type = 'info') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-content">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      };

      // Browse folder
      document.getElementById('browseFolderBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.onchange = (e) => {
          const files = e.target.files;
          if (files.length > 0) {
            const path = files[0].webkitRelativePath.split('/')[0];
            document.getElementById('projectPath').value = path;
            showToast('Folder selected: ' + path, 'success');
          }
        };
        input.click();
      });

      // Create Project button handler
      document.getElementById('createProjectBtn').addEventListener('click', async () => {
        const prompt = document.getElementById('promptInput').value.trim();
        if (!prompt) {
          showToast('Please enter a prompt first', 'error');
          return;
        }
        const btn = document.getElementById('createProjectBtn');
        btn.innerHTML = '<span class="spinner sm"></span> Creating...';
        btn.disabled = true;
        try {
          await fetch('/api/v1/project/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              project_root: document.getElementById('projectPath').value || '.', 
              goal: prompt 
            })
          });
          showToast('Project created successfully!', 'success');
          loadFiles();
        } catch (e) {
          showToast('Error creating project', 'error');
        } finally {
          btn.innerHTML = 'Create Project';
          btn.disabled = false;
        }
      });

      projectInitBtn.addEventListener('click', async () => {'''
)

# 6. Update task rendering to show colored states
content = content.replace(
    '<span class="pill">${task.estado}</span>',
    '<span class="task-state ${task.estado}">${task.estado}</span>'
)

# 7. Add status badge
content = content.replace(
    'statusValue.textContent = state.status || \'unknown\';',
    'statusValue.innerHTML = `<span class="status-badge ${state.status || \'unknown\'}">${state.status || \'unknown\'}</span>`;'
)

# 8. Add loading indicator to buttons
content = content.replace(
    'projectInitBtn.addEventListener(\'click\', async () => {\n        await fetch(\'/api/v1/project/init\', {',
    'projectInitBtn.addEventListener(\'click\', async () => {\n        projectInitBtn.innerHTML = \'<span class="spinner sm"></span>\';\n        await fetch(\'/api/v1/project/init\', { '
)

# Write the modified content
with open('src/web/public/dashboard/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Dashboard updated successfully!")
