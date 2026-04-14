const fs = require('fs');
const { createEngramClient } = require('./engram-client');

const readFile = (filepath) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const writeFile = (filepath, content) => {
  fs.writeFileSync(filepath, content, 'utf-8');
};

const readJSON = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  const sanitized = content.replace(/^\uFEFF/, '');
  return JSON.parse(sanitized);
};

const createMemoryManager = ({ memoryFile, configFile }) => {
  const getConfig = () => {
    const config = readJSON(configFile);
    return config?.memory || { max_entries: 20, enable_compaction: true };
  };

  const getEngramConfig = () => {
    const config = readJSON(configFile);
    return config?.engram || {};
  };

  const getEngramClient = () => {
    const engram = getEngramConfig();
    if (!engram?.enabled) return null;
    return createEngramClient({
      baseUrl: engram.base_url,
      timeoutMs: engram.timeout_ms || 5000
    });
  };

  const sessionContext = {
    sessionId: null,
    project: null,
    directory: null
  };

  const setSessionContext = ({ sessionId, project, directory }) => {
    if (sessionId) sessionContext.sessionId = sessionId;
    if (project) sessionContext.project = project;
    if (directory) sessionContext.directory = directory;
  };

  let sessionCreated = false;
  const ensureSession = async (client) => {
    if (sessionCreated) return true;
    if (!sessionContext.sessionId) return false;

    const res = await client.createSession({
      id: sessionContext.sessionId,
      project: sessionContext.project,
      directory: sessionContext.directory
    });
    if (res.ok) {
      sessionCreated = true;
      return true;
    }
    return false;
  };

  const deriveObservation = (content) => {
    const title = String(content || '').split('\n')[0].replace(/^##\s*/, '').trim() || 'Checkpoint';
    return {
      session_id: sessionContext.sessionId || 'default',
      type: 'learning',
      title,
      content,
      project: sessionContext.project,
      scope: 'project'
    };
  };

  const append = (content) => {
    const existing = readFile(memoryFile) || "# Memory Log\n\n";
    writeFile(memoryFile, existing + content + "\n");
  };

  const countEntries = () => {
    const content = readFile(memoryFile);
    if (!content) return 0;
    const matches = content.match(/^##/gm);
    return matches ? matches.length : 0;
  };

  const shouldCompact = () => {
    const config = getConfig();
    if (!config.enable_compaction) return false;
    const entryCount = countEntries();
    return entryCount >= config.max_entries;
  };

  const generateCompactSummary = (content) => {
    const summaryLines = [
      "## Historical Summary (Compacted)",
      `- Compacted at: ${new Date().toISOString()}`,
      "- Previous entries have been summarized for context preservation"
    ];

    const taskMatches = content.match(/- Tasks completed: \d+/g);
    if (taskMatches) {
      const lastMatch = taskMatches[taskMatches.length - 1];
      summaryLines.push(`- Last known: ${lastMatch}`);
    }

    const entryCount = (content.match(/^##/gm) || []).length;
    summaryLines.push(`- Total historical entries: ${entryCount}`);

    return summaryLines.join('\n');
  };

  const compact = () => {
    const config = getConfig();
    const content = readFile(memoryFile);

    if (!content) {
      console.log("[COMPACTION] No memory content to compact");
      return;
    }

    const entries = content.split(/^##/gm).filter(e => e.trim());

    if (entries.length <= config.max_entries) {
      console.log(`[COMPACTION] Entry count (${entries.length}) below threshold (${config.max_entries}), skipping`);
      return;
    }

    const header = entries[0];
    const keepCount = config.max_entries - 1;
    const lastEntries = entries.slice(-keepCount);

    const historicalContent = entries.slice(1, -keepCount).join('\n##');
    const summary = generateCompactSummary("##" + historicalContent);

    const compacted = header + '\n##' + lastEntries.join('\n##');
    const newContent = compacted + '\n\n' + summary + '\n';

    writeFile(memoryFile, newContent);
    console.log(`[COMPACTION] Compacted ${entries.length - config.max_entries} entries, kept ${config.max_entries}`);
  };

  const appendWithCompaction = (content) => {
    const memory = getConfig();
    const engram = getEngramConfig();
    const provider = memory?.provider || 'file';

    // Always write to file synchronously first (primary storage)
    append(content);
    if (shouldCompact()) {
      compact();
    }

    // If engram is configured, also mirror async (best-effort, non-blocking)
    if (provider === 'engram') {
      const client = getEngramClient();
      if (client) {
        client.health().then(() => {
          return ensureSession(client);
        }).then((ready) => {
          if (!ready) throw new Error('session_not_ready');
          return client.addObservation(deriveObservation(content));
        }).then((res) => {
          if (!res.ok) {
            console.log(`[ENGRAM] Mirror failed (${res.status})`);
          }
        }).catch(() => {
          // Engram mirror failed silently — file already written above
        });
      }
    }
  };

  const search = async ({ query, project, limit = 5 }) => {
    const memory = getConfig();
    const engram = getEngramConfig();
    const provider = memory?.provider || 'file';

    if (provider === 'engram') {
      const client = getEngramClient();
      if (client) {
        try {
          const res = await client.search({ q: query, project, limit });
          if (res.ok) return res.json;
        } catch (_e) {
          // fall through to file search
        }
      }
    }

    const content = readFile(memoryFile) || '';
    const lines = content.split('\n').filter(l => l.toLowerCase().includes(String(query).toLowerCase()));
    return lines.slice(0, limit).map(l => ({ content: l }));
  };

  return {
    append,
    getConfig,
    countEntries,
    shouldCompact,
    compact,
    appendWithCompaction,
    setSessionContext,
    search
  };
};

module.exports = { createMemoryManager };
