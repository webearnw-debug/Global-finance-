// Vercel Serverless Function — tries up to 5 FREE providers in order.
// If one fails (rate limit, quota khatam, network error, anything) it
// automatically moves to the next one — no manual switching needed.
//
// SET UP 5 FREE KEYS (no credit card needed for any of these):
//
// 1) Gemini    -> https://aistudio.google.com          -> "Get API key"
// 2) Groq      -> https://console.groq.com              -> "API Keys" -> Create
// 3) OpenRouter-> https://openrouter.ai/keys             -> Create Key
// 4) Cerebras  -> https://cloud.cerebras.ai              -> API Keys -> Create
// 5) Mistral   -> https://console.mistral.ai             -> API Keys -> Create
//
// In Vercel: Settings -> Environment Variables -> add ALL FIVE:
//      GEMINI_API_KEY     = <your gemini key>
//      GROQ_API_KEY       = <your groq key>
//      OPENROUTER_API_KEY = <your openrouter key>
//      CEREBRAS_API_KEY   = <your cerebras key>
//      MISTRAL_API_KEY    = <your mistral key>
// Save, then push this file so Vercel redeploys and picks up the new vars.
// You don't need all 5 — the code skips any key that's missing.
//
// Front-end doesn't change at all — same {system, messages} in,
// same {content:[{type:"text", text}]} out.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const { system, messages, max_tokens } = req.body || {};
  const chatMessages = [];
  if (system) chatMessages.push({ role: "system", content: system });
  (messages || []).forEach(function (m) {
    chatMessages.push({ role: m.role, content: m.content });
  });

  // Order = priority. First one with a key set is tried first; on failure,
  // falls through to the next configured provider automatically.
  const providers = [
    {
      name: "Gemini",
      key: process.env.GEMINI_API_KEY,
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-3.6-flash"
    },
    {
      name: "Groq",
      key: process.env.GROQ_API_KEY,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: "openai/gpt-oss-120b"
    },
    {
      name: "OpenRouter",
      key: process.env.OPENROUTER_API_KEY,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: "meta-llama/llama-3.3-70b-instruct:free"
    },
    {
      name: "Cerebras",
      key: process.env.CEREBRAS_API_KEY,
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      model: "llama-3.3-70b"
    },
    {
      name: "Mistral",
      key: process.env.MISTRAL_API_KEY,
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest"
    }
  ];

  let lastError = { message: "No AI provider is configured. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY in Vercel." };

  for (const provider of providers) {
    if (!provider.key) continue; // key not set — skip silently

    const result = await callProvider(provider.endpoint, provider.key, provider.model, chatMessages, max_tokens);
    if (result.ok) {
      res.status(200).json({ content: [{ type: "text", text: result.text }] });
      return;
    }
    lastError = result.error || { message: provider.name + " request failed" };
    // loop continues -> tries next provider automatically
  }

  // All configured providers failed
  res.status(500).json({ error: lastError });
};

async function callProvider(endpoint, apiKey, model, messages, max_tokens) {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: max_tokens || 1000
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return { ok: false, error: data.error && data.error.message ? data.error : { message: JSON.stringify(data) } };
    }
    const text = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : "";
    return { ok: true, text: text };
  } catch (err) {
    return { ok: false, error: { message: "Network/upstream error calling " + endpoint + ": " + String(err) } };
  }
}
