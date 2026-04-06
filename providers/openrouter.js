const callOpenRouter = async (prompt, model = 'google/gemma-2-2b-it') => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
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
