/**
 * Optional Cloudflare Worker for real AI drafts.
 *
 * Deploy this separately from GitHub Pages and set secret OPENAI_API_KEY in the worker environment.
 * Do NOT put your API key in cms/admin/app.js or any public GitHub Pages file.
 */

const SYSTEM_PROMPT = `
You are the CTX Bombers Meza content assistant.
Write positive, family-friendly, age-appropriate youth fastpitch softball content.
Do not invent private player facts. Do not include full names of minors unless provided and approved.
Prefer concise, polished copy suitable for a public team website.
`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ error: "POST required" }, 405);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured on the Worker." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const { type = "announcement", facts = "", tone = "family-friendly", context = {} } = body;

    const userPrompt = `
Content type: ${type}
Tone: ${tone}
Team context: ${JSON.stringify(context)}
Facts/notes:
${facts}

Return only the draft copy.`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: 500
      })
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return json({ error: data.error?.message || "OpenAI request failed" }, aiResponse.status);
    }

    const text =
      data.output_text ||
      data.output?.flatMap(item => item.content || []).map(part => part.text || "").join("\n").trim() ||
      "";

    return json({ text });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
