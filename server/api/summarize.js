/**
 * api/summarize.js — PageWise AI Backend Proxy
 * HNG Stage 4A | Frontend Wizards
 *
 * Stage 3 (revised): OpenAI GPT-4o-mini summarization.
 *
 * Security: OPENAI_API_KEY lives ONLY in process.env.
 * It is never returned to the client or logged.
 *
 * Response shape (unchanged — extension stays compatible):
 * {
 *   success: true,
 *   summary: { bullets[], insights[], wordCount, readingTime }
 * }
 */

"use strict";

// ── Constants ────────────────────────────────────────────────
const OPENAI_API_URL  = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL    = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_TEXT_CHARS  = 8000;
const MIN_TEXT_CHARS  = 50;
const MAX_TOKENS      = 500;

// ── Helper ───────────────────────────────────────────────────
function json(res, status, body) {
  return res.status(status).json(body);
}

// ── Main Handler ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return json(res, 405, { error: "Method Not Allowed. Use POST." });

  // ── API Key Guard ──────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[PageWise] OPENAI_API_KEY is not set.");
    return json(res, 500, { error: "Server misconfiguration: API key missing." });
  }

  // ── Validate Body ──────────────────────────────────────────
  const { title, url, text, wordCount, readingTime } = req.body || {};

  if (!text || typeof text !== "string") {
    return json(res, 400, { error: "Request body must include a 'text' field." });
  }
  if (text.trim().length < MIN_TEXT_CHARS) {
    return json(res, 400, {
      error: "Page content is too short to summarize. Try a page with more text.",
    });
  }

  // ── Sanitize Inputs ────────────────────────────────────────
  const safeText  = text.slice(0, MAX_TEXT_CHARS);
  const safeTitle = (title || "Untitled Page").slice(0, 200);
  const safeUrl   = (url   || "Unknown URL"  ).slice(0, 200);

  // ── Build Prompt ───────────────────────────────────────────
  const systemPrompt =
    "You are a precise AI page summarizer. " +
    "Always respond with valid JSON only — no markdown, no extra text. " +
    "Use this exact schema: " +
    '{ "bullets": [string, ...], "insights": [string, ...] } ' +
    "bullets: 4-6 concise key points (under 120 chars each). " +
    "insights: 2-3 deeper observations or implications (under 120 chars each).";

  const userPrompt =
    `Page Title: ${safeTitle}\n` +
    `Page URL: ${safeUrl}\n` +
    `Word Count: ${wordCount ?? "unknown"}\n` +
    `Reading Time: ${readingTime ?? "unknown"} min\n\n` +
    `Content:\n"""\n${safeText}\n"""`;

  // ── Call OpenAI ────────────────────────────────────────────
  let aiData;
  try {
    const aiRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           OPENAI_MODEL,
        response_format: { type: "json_object" }, // guarantees valid JSON output
        max_tokens:      MAX_TOKENS,
        temperature:     0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error("[PageWise] OpenAI error:", aiRes.status, errBody);

      if (aiRes.status === 429) {
        return json(res, 429, {
          error:
            "OpenAI rate limit or quota exceeded. " +
            "Please wait a moment and try again.",
        });
      }
      if (aiRes.status === 401) {
        return json(res, 401, {
          error: "OpenAI API key is invalid or expired.",
        });
      }
      return json(res, 502, {
        error: `OpenAI returned status ${aiRes.status}. Try again shortly.`,
      });
    }

    aiData = await aiRes.json();
  } catch (fetchErr) {
    console.error("[PageWise] Fetch to OpenAI failed:", fetchErr.message);
    return json(res, 502, {
      error: "Could not reach the OpenAI API. Check your internet connection.",
    });
  }

  // ── Parse Response ─────────────────────────────────────────
  // response_format: json_object guarantees the content is valid JSON,
  // so no need to strip code fences or regex-search for braces.
  let parsed;
  try {
    const content = aiData?.choices?.[0]?.message?.content ?? "";
    parsed = JSON.parse(content);
  } catch (parseErr) {
    console.error("[PageWise] Failed to parse OpenAI JSON:", parseErr.message);
    return json(res, 502, {
      error: "AI returned an unexpected response format. Try again.",
    });
  }

  // ── Validate & Clamp ───────────────────────────────────────
  const bullets  = Array.isArray(parsed.bullets)  ? parsed.bullets.slice(0, 6)  : [];
  const insights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [];

  if (bullets.length === 0) {
    return json(res, 502, {
      error: "AI could not generate a summary for this page. Try another page.",
    });
  }

  // ── Success ────────────────────────────────────────────────
  return json(res, 200, {
    success: true,
    summary: {
      bullets,
      insights,
      wordCount:   wordCount   ?? null,
      readingTime: readingTime ?? null,
    },
  });
};
