// Vercel Serverless Function — uses Google Gemini's FREE tier (no credit card needed).
// This replaces the previous Anthropic-based version of this same file.
//
// WHERE THIS FILE GOES: api/chat.js in the root of your repo (same as before —
// just replace the old file's content with this).
//
// HOW TO GET A FREE KEY (no card):
//   1. Go to https://aistudio.google.com and sign in with any Google account.
//   2. Click "Get API key" in the left sidebar -> "Create API key".
//   3. Copy the key (starts with "AIza...").
//
// HOW TO SET IT: Vercel dashboard -> your project -> Settings -> Environment
// Variables -> Add New -> Name: GEMINI_API_KEY, Value: <the key you copied>
// -> Save. Then push any small change (or re-save this file) so Vercel builds
// a fresh deployment that picks up the variable.
//
// The front-end (your big HTML file) does NOT need to change — it still sends
// {model, system, messages} and expects {content:[{type:"text", text}]} back.
// This file receives that, calls Gemini, and reshapes Gemini's reply into that
// same format, so nothing else in your site needs to be touched.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: "GEMINI_API_KEY is not set in Vercel environment variables" } });
    return;
  }

  try {
    const { system, messages, max_tokens } = req.body || {};

    const chatMessages = [];
    if (system) chatMessages.push({ role: "system", content: system });
    (messages || []).forEach(function (m) {
      chatMessages.push({ role: m.role, content: m.content });
    });

    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash", // free-tier model. If Google renames/retires it, change only this line.
        messages: chatMessages,
        max_tokens: max_tokens || 1000
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data.error || data });
      return;
    }

    const text = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : "";

    // Reshape Gemini's reply into the same shape the front-end already expects.
    res.status(200).json({ content: [{ type: "text", text: text }] });
  } catch (err) {
    res.status(500).json({ error: { message: "Upstream request failed: " + String(err) } });
  }
};
