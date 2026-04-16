const path = require('path');

const registerViewRoutes = (app, { dashboard }) => {
  app.get('/', (_req, res) => {
    res.redirect('/dashboard/index.html');
  });

  app.get('/dashboard/data', (_req, res) => {
    const snapshot = dashboard.getSnapshot();
    const project = dashboard.getDashboardConfig();
    const runHistory = dashboard.getRunHistory();
    res.json({
      snapshot,
      project,
      runHistory
    });
  });

  app.get('/dashboard', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard', 'index.html'));
  });
};

module.exports = { registerViewRoutes };
