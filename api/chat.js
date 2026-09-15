// Vercel Serverless Function — keeps the real Anthropic API key on the server.
//
// WHERE THIS FILE GOES: put it at  api/chat.js  in the root of your repo
// (same level as your HTML file, in a folder literally named "api"). Vercel
// auto-detects anything under /api as a serverless function — no extra config
// needed, even for a plain static site.
//
// HOW TO SET THE KEY: do NOT type your real key into any file you commit.
// Instead — Vercel dashboard → your project → Settings → Environment Variables
// → Add New → Name: ANTHROPIC_API_KEY, Value: <your real key> → Save → Redeploy.
// The key then lives only on Vercel's servers and is injected at runtime via
// process.env, so git and GitHub's secret scanning never see it.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel environment variables" });
    return;
  }

  try {
    const { model, system, messages, max_tokens } = req.body || {};

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: max_tokens || 1000,
        system: system || undefined,
        messages: messages || []
      })
    });

    const data = await anthropicRes.json();
    // Forward Anthropic's response (and status) straight through to the browser.
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Upstream request failed", detail: String(err) });
  }
};
