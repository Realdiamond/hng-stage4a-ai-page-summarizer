/**
 * background.js — PageWise AI Chrome Extension
 *
 * Manifest V3 Service Worker.
 * Proxies AI summarization requests from popup.js to the backend.
 *
 * Security model:
 *   - Only responds to SUMMARIZE_WITH_AI messages (all others ignored).
 *   - Whitelists payload fields before forwarding to backend —
 *     prevents a malicious page from injecting arbitrary data.
 *   - API_ENDPOINT is the single place to update for production deploy.
 */

"use strict";

// ── Backend Endpoint ──────────────────────────────────────────
// No API key is stored here — the key lives only in server/.env
// and is read at runtime by the backend proxy.
//
// LOCAL DEVELOPMENT:
//   const API_ENDPOINT = "http://localhost:3000/api/summarize";
//
// PRODUCTION (deployed Vercel backend — confirmed live):
const API_ENDPOINT = "https://hng-stage4a-ai-page-summarizer.vercel.app/api/summarize";

// ── Service Worker Lifecycle ──────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[PageWise] Extension installed.");
  } else if (reason === "update") {
    console.log("[PageWise] Extension updated.");
  }
});

// ── Message Hub ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SUMMARIZE_WITH_AI") {
    handleSummarize(message.payload)
      .then(sendResponse)
      .catch((err) => {
        console.error("[PageWise] Background error:", err);
        sendResponse({
          success: false,
          error: "Could not reach the AI service. Make sure the backend is running.",
        });
      });

    return true; // keep message channel open for async response
  }

  // Silently ignore all other message types
});

// ── Summarize Handler ─────────────────────────────────────────
async function handleSummarize(payload) {
  // Whitelist only expected fields — never forward arbitrary payload keys.
  // This prevents a malicious page from injecting extra data into the request.
  const safePayload = {
    title: typeof payload?.title === "string" ? payload.title.slice(0, 500) : "",
    url: typeof payload?.url === "string" ? payload.url.slice(0, 500) : "",
    text: typeof payload?.text === "string" ? payload.text.slice(0, 8000) : "",
    wordCount: typeof payload?.wordCount === "number" ? payload.wordCount : null,
    readingTime: typeof payload?.readingTime === "number" ? payload.readingTime : null,
  };

  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      error: data.error || `Backend returned status ${res.status}.`,
    };
  }

  return data; // { success: true, summary: { bullets, insights, wordCount, readingTime } }
}
