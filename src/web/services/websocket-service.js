const { WebSocketServer } = require('ws');

const createWebsocketHub = (server) => {
  const wss = new WebSocketServer({ server, path: '/api/v1/ws' });

  const broadcast = (event, payload) => {
    const message = JSON.stringify({ event, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  };

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ event: 'connected', payload: { ok: true } }));
  });

  return { broadcast };
};

module.exports = { createWebsocketHub };
