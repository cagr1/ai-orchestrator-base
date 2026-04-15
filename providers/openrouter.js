const fs = require('fs');
const path = require('path');

const readJSON = (filepath) => {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const sanitized = content.replace(/^\uFEFF/, '');
    return JSON.parse(sanitized);
  } catch (_e) {
    return null;
  }
};

const CONFIG_FILE = path.join(__dirname, '..', 'system', 'config.json');

const callOpenRouter = async (prompt, skill = null) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const config = readJSON(CONFIG_FILE);
  const providerConfig = config?.providers?.[config.active_provider];

  if (!providerConfig) {
    throw new Error(`Provider ${config.active_provider} not configured`);
  }

  const modelMapping = config.model_mapping || {};
  const modelKey = modelMapping[skill] || modelMapping.default || 'free_default';
  const model = providerConfig.models?.[modelKey];

  if (!model) {
    throw new Error(`Model ${modelKey} not configured for provider ${config.active_provider}`);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'AI Orchestrator'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`OpenRouter API error ${response.status}: ${responseText}`);
      throw new Error(`OpenRouter API error ${response.status}`);
    }

    const data = JSON.parse(responseText);
    return data?.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('OpenRouter fetch error:', err.message);
    throw err;
  }
};

module.exports = callOpenRouter;
