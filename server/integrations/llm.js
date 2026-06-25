// Cliente unificado para 4 proveedores de LLM. Recibe creds del request body
// (vienen de localStorage del browser via la UI de Settings) y hace la
// llamada server-side para evitar CORS y para no requerir flags de "browser
// allowed" en cada SDK.
//
// Contrato uniforme:
//   invokeLLM({ provider, apiKey, model, messages, system, max_tokens })
//   → { text, raw, usage? }

const DEFAULT_MAX_TOKENS = 1024;

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  deepseek: 'deepseek-chat',
};

export async function invokeLLM({ provider, apiKey, model, messages, system, max_tokens }) {
  if (!provider) throw new Error('provider requerido');
  if (!apiKey) throw new Error('apiKey requerido (configúralo en Settings → Integraciones)');
  const _model = model || DEFAULT_MODELS[provider];
  const _max = max_tokens || DEFAULT_MAX_TOKENS;
  const msgs = Array.isArray(messages) ? messages : [{ role: 'user', content: String(messages || '') }];

  if (provider === 'anthropic') return callAnthropic({ apiKey, model: _model, messages: msgs, system, max_tokens: _max });
  if (provider === 'openai') return callOpenAI({ apiKey, model: _model, messages: msgs, system, max_tokens: _max });
  if (provider === 'gemini') return callGemini({ apiKey, model: _model, messages: msgs, system, max_tokens: _max });
  if (provider === 'deepseek') return callDeepSeek({ apiKey, model: _model, messages: msgs, system, max_tokens: _max });
  throw new Error(`Proveedor desconocido: ${provider}`);
}

async function callAnthropic({ apiKey, model, messages, system, max_tokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      system: system || undefined,
      messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic ${res.status}`);
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return { text, raw: data, usage: data.usage };
}

async function callOpenAI({ apiKey, model, messages, system, max_tokens }) {
  const fullMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens, messages: fullMessages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI ${res.status}`);
  return { text: data.choices?.[0]?.message?.content || '', raw: data, usage: data.usage };
}

async function callGemini({ apiKey, model, messages, system, max_tokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body = { contents, generationConfig: { maxOutputTokens: max_tokens } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
  return { text, raw: data };
}

async function callDeepSeek({ apiKey, model, messages, system, max_tokens }) {
  const fullMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens, messages: fullMessages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `DeepSeek ${res.status}`);
  return { text: data.choices?.[0]?.message?.content || '', raw: data, usage: data.usage };
}
