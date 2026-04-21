const callOpenRouter = async (prompt, config, skill = null, context = {}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

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

  const taskId = context.taskId || 'unknown';
  const runId = context.runId || 'unknown';
  const promptLen = String(prompt || '').length;
  console.log(`[LLM START] run_id=${runId} task_id=${taskId} skill=${skill || 'none'} model_key=${modelKey} model=${model} prompt_len=${promptLen}`);

  try {
    const response = await fetch(providerConfig.base_url || 'https://openrouter.ai/api/v1/chat/completions', {
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
        max_tokens: providerConfig.max_tokens || 8000
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`OpenRouter API error ${response.status}: ${responseText}`);
      throw new Error(`OpenRouter API error ${response.status}`);
    }

    const data = JSON.parse(responseText);
    const content = data?.choices?.[0]?.message?.content;
    const contentType = Array.isArray(content) ? 'array' : typeof content;
    const contentLen = typeof content === 'string'
      ? content.length
      : Array.isArray(content)
      ? content.length
      : 0;
    console.log(`[LLM END] run_id=${runId} task_id=${taskId} skill=${skill || 'none'} content_type=${contentType} content_len=${contentLen}`);

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const normalized = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part.text === 'string') return part.text;
          return '';
        })
        .join('');
      if (normalized.trim()) {
        return normalized;
      }
    }

    const choice = data?.choices?.[0];
    const finishReason = choice?.finish_reason || 'unknown';
    throw new Error(`OpenRouter returned empty assistant content (run_id=${runId} task_id=${taskId} skill=${skill || 'none'} finish_reason=${finishReason})`);
  } catch (err) {
    console.error(`OpenRouter fetch error [run_id=${runId} task_id=${taskId} skill=${skill || 'none'}]:`, err.message);
    throw err;
  }
};

module.exports = callOpenRouter;
