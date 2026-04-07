const createRealtimeHub = () => {
  const clients = new Set();

  const attach = (app) => {
    app.get('/api/v1/realtime', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const client = { id: Date.now() + Math.random(), res };
      clients.add(client);

      res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      req.on('close', () => {
        clients.delete(client);
      });
    });
  };

  const broadcast = (event, payload) => {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      client.res.write(data);
    }
  };

  return { attach, broadcast };
};

module.exports = { createRealtimeHub };
