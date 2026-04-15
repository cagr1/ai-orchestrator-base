require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');

const { registerApiRoutes } = require('./routes/api');
const { registerViewRoutes } = require('./routes/views');
const { createRealtimeHub } = require('./services/realtime-service');
const { createDashboardService } = require('./services/dashboard-service');
const { createWebsocketHub } = require('./services/websocket-service');

const PORT = process.env.DASHBOARD_PORT || 3000;
const ROOT = process.cwd();

const app = express();
const server = http.createServer(app);

const realtime = createRealtimeHub();
const websocket = createWebsocketHub(server);
const dashboard = createDashboardService({ rootDir: ROOT, realtime, websocket });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));

registerApiRoutes(app, { dashboard, realtime, websocket });
registerViewRoutes(app, { dashboard });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dashboard' });
});

server.listen(PORT, () => {
  console.log(`[DASHBOARD] Listening on http://localhost:${PORT}`);
});

realtime.attach(app);
