export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/explain") {
      return json({ error: "Not found" }, 404, corsHeaders);
    }

    if (!isOriginAllowed(request, env)) {
      return json({ error: "Forbidden" }, 403, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, corsHeaders);
    }

    const term = typeof body.term === "string" ? body.term.trim() : "";
    if (!term || term.length > 200) {
      return json({ error: "Invalid term" }, 400, corsHeaders);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "Server not configured" }, 500, corsHeaders);
    }

    const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      'Briefly explain what "' +
      term +
      '" means in 2–3 clear sentences for a general audience. Be concise, accurate, and interesting. Do not use bullet points or headings.';

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(env.GEMINI_API_KEY);

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 220,
        },
      }),
    });

    if (!geminiResponse.ok) {
      console.error("Gemini error", geminiResponse.status, await geminiResponse.text());
      return json({ error: "Upstream API error" }, 502, corsHeaders);
    }

    const data = await geminiResponse.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return json({ error: "Empty response" }, 502, corsHeaders);
    }

    return json({ text }, 200, corsHeaders);
  },
};

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return true;
  }

  const allowed = getAllowedOrigins(env);
  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(origin);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = getAllowedOrigins(env);
  let allowOrigin = "*";

  if (origin && allowed.length > 0) {
    allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
