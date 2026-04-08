const express = require('express');

const registerApiRoutes = (app, { dashboard, realtime }) => {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    res.json(dashboard.getStatus());
  });

  router.get('/tasks', (_req, res) => {
    res.json(dashboard.getTasks());
  });

  router.post('/tasks', (req, res) => {
    const result = dashboard.createTask(req.body || {});
    realtime.broadcast('tasks:updated', result);
    res.json(result);
  });

  router.put('/tasks/:id', (req, res) => {
    const result = dashboard.updateTask(req.params.id, req.body || {});
    realtime.broadcast('tasks:updated', result);
    res.json(result);
  });

  router.post('/execute', (_req, res) => {
    const result = dashboard.triggerRun();
    realtime.broadcast('run:triggered', result);
    res.json(result);
  });

  router.post('/control', (req, res) => {
    const result = dashboard.applyControl(req.body || {});
    realtime.broadcast('control:updated', result);
    res.json(result);
  });

  router.get('/project', (_req, res) => {
    res.json(dashboard.getDashboardConfig());
  });

  router.post('/project', (req, res) => {
    const result = dashboard.updateDashboardConfig({ project_root: req.body?.project_root });
    res.json(result);
  });

  router.post('/project/init', (req, res) => {
    const { goal, project_root } = req.body || {};
    res.json(dashboard.initProject(goal, project_root));
  });

  router.post('/prompt', (req, res) => {
    const result = dashboard.updateDashboardConfig({ prompt: req.body?.prompt || '' });
    res.json(result);
  });

  router.get('/skills', (_req, res) => {
    res.json(dashboard.listSkills());
  });

  router.get('/skills/files', (_req, res) => {
    res.json(dashboard.listSkillFiles());
  });

  router.get('/skills/read', (req, res) => {
    const rel = String(req.query.path || '');
    res.json(dashboard.readSkillFile(rel));
  });

  router.post('/skills/write', (req, res) => {
    const { path: rel, content } = req.body || {};
    res.json(dashboard.writeSkillFile(rel, content));
  });

  router.post('/skills/refresh', (_req, res) => {
    res.json(dashboard.refreshSkills());
  });

  router.post('/skills/detect', (req, res) => {
    const apply = Boolean(req.body?.apply);
    res.json(dashboard.detectSkills(apply));
  });

  router.get('/memory/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) return res.json([]);
    const results = await dashboard.searchMemory(query);
    res.json(results || []);
  });

  router.get('/files', (_req, res) => {
    res.json(dashboard.listProjectFiles());
  });

router.get('/files/read', (req, res) => {
    const rel = String(req.query.path || '');
    res.json(dashboard.readProjectFile(rel));
  });

  router.post('/files/write', (req, res) => {
    const { path: rel, content } = req.body || {};
    res.json(dashboard.writeProjectFile(rel, content));
  });

  // Engram endpoints
  router.get('/engram/health', async (req, res) => {
    try {
      const { memoryFile, configFile } = dashboard.getPaths?.() || {};
      const { createMemoryManager } = require('../../integrations/memory-manager');
      const memoryManager = createMemoryManager({ memoryFile, configFile });
      const config = memoryManager.getConfig?.();
      
      if (config?.provider === 'engram') {
        const client = memoryManager.getEngramClient?.();
        if (client) {
          const health = await client.health();
          res.json({ ok: health.ok, status: health.status });
        } else {
          res.json({ ok: false, error: 'Engram client not available' });
        }
      } else {
        res.json({ ok: false, error: 'Engram not configured as memory provider' });
      }
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  router.post('/engram/install', (req, res) => {
    // This would install Engram based on OS
    // For now, just return instructions
    const os = process.platform;
    let instructions = '';
    
    if (os === 'darwin') {
      instructions = 'brew install gentleman-programming/tap/engram';
    } else if (os === 'linux') {
      instructions = 'Download binary from GitHub: https://github.com/gentleman-programming/engram/releases';
    } else if (os === 'win32') {
      instructions = 'Download .exe from GitHub: https://github.com/gentleman-programming/engram/releases';
    }
    
    res.json({ 
      ok: true, 
      message: 'Engram installation instructions',
      os,
      instructions 
    });
  });

  router.get('/engram/test', async (req, res) => {
    try {
      const response = await fetch('http://127.0.0.1:7437/health', { timeout: 3000 });
      const ok = response.ok;
      res.json({ ok, status: response.status });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  app.use('/api/v1', router);
};

module.exports = { registerApiRoutes };
