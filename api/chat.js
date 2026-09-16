// Vercel Serverless Function — tries Google Gemini FIRST, and if that fails for
// any reason (including "daily limit khatam" / rate limit), automatically falls
// back to Groq — both are genuinely free, no credit card needed. This roughly
// doubles your usable daily capacity, and Groq also replies noticeably faster.
//
// SET UP TWO FREE KEYS:
//
// 1) Gemini (you likely already have this one):
//      https://aistudio.google.com -> "Get API key" -> "Create API key"
//
// 2) Groq (new — add this one too):
//      https://console.groq.com -> sign up (email/Google/GitHub, no card)
//      -> left sidebar "API Keys" -> "Create API Key" -> copy it
//
// Then in Vercel: Settings -> Environment Variables -> add BOTH:
//      GEMINI_API_KEY = <your gemini key>
//      GROQ_API_KEY   = <your groq key>
// Save, then push this file (any small change to the repo) so Vercel builds a
// fresh deployment that picks up both variables.
//
// The front-end does NOT need to change — it still sends {system, messages}
// and gets back {content:[{type:"text", text}]}, exactly as before.

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

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  let lastError = { message: "No AI provider is configured. Set GEMINI_API_KEY and/or GROQ_API_KEY in Vercel." };

  // 1) Try Gemini first (primary)
  if (geminiKey) {
    const result = await callProvider(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      geminiKey,
      "gemini-3.6-flash",
      chatMessages,
      max_tokens
    );
    if (result.ok) {
      res.status(200).json({ content: [{ type: "text", text: result.text }] });
      return;
    }
    lastError = result.error || { message: "Gemini request failed" };
  }

  // 2) Fall back to Groq (also free, no card) if Gemini failed or wasn't configured
  if (groqKey) {
    const result = await callProvider(
      "https://api.groq.com/openai/v1/chat/completions",
      groqKey,
      "openai/gpt-oss-120b",
      chatMessages,
      max_tokens
    );
    if (result.ok) {
      res.status(200).json({ content: [{ type: "text", text: result.text }] });
      return;
    }
    lastError = result.error || { message: "Groq request failed" };
  }

  // Both providers failed (or neither key is set) — report the most recent real error
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
