const path = require('path');

const registerViewRoutes = (app, { dashboard }) => {
  app.get('/', (_req, res) => {
    res.redirect('/dashboard/index.html');
  });

  app.get('/dashboard/data', (_req, res) => {
    res.json({
      status: dashboard.getStatus(),
      tasks: dashboard.getTasks(),
      project: dashboard.getDashboardConfig()
    });
  });

  app.get('/dashboard', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard', 'index.html'));
  });
};

module.exports = { registerViewRoutes };
