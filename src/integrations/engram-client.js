const { setTimeout } = require('timers/promises');

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch (_e) {
    return null;
  }
};

const createEngramClient = ({ baseUrl, timeoutMs = 5000 }) => {
  const base = (baseUrl || '').replace(/\/+$/, '');

  const request = async (path, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(timeoutMs).then(() => controller.abort());
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      const json = await safeJson(res);
      return { ok: res.ok, status: res.status, json };
    } finally {
      timeout.cancel?.();
    }
  };

  // HTTP API (per docs). All endpoints return JSON.
  const health = () => request('/health', { method: 'GET' });

  const createSession = ({ id, project, directory }) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ id, project, directory })
    });

  const endSession = ({ id, summary }) =>
    request(`/sessions/${encodeURIComponent(id)}/end`, {
      method: 'POST',
      body: JSON.stringify({ summary })
    });

  const addObservation = (payload) =>
    request('/observations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

  const search = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/search${qs ? `?${qs}` : ''}`, { method: 'GET' });
  };

  const stats = () => request('/stats', { method: 'GET' });

  return {
    health,
    createSession,
    endSession,
    addObservation,
    search,
    stats
  };
};

module.exports = { createEngramClient };
