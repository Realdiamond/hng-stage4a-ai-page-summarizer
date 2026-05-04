/**
 * content.js — PageWise AI Chrome Extension
 * HNG Stage 4A | Frontend Wizards
 *
 * Content Script — injected into every page at document_idle.
 *
 * NOTE: extractPageContent() is fully synchronous.
 * We do NOT return true from the message listener — doing so
 * falsely signals an async response and causes Chrome (MV3) to
 * emit a "message channel closed" warning that races with the
 * popup's catch block, producing the double-render bug.
 *
 * Stage 2: Real content extraction.
 *   - Responds to EXTRACT_CONTENT messages from popup.js
 *   - Prefers <article> → <main> → <body> as content source
 *   - Strips noisy elements before extracting text
 *   - Returns title, url, wordCount, readingTime, preview
 */

"use strict";

// ── Noisy elements to remove before text extraction ──────────
const NOISE_SELECTORS = [
  "script", "style", "noscript", "iframe",
  "nav", "header", "footer", "aside",
  "svg", "figure", "form", "button",
  "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  "[aria-hidden='true']",
].join(", ");

const PREVIEW_MAX_CHARS = 500;
const MAX_TEXT_CHARS    = 8000;  // matches server cap — no point sending more

// ── Core extraction function ─────────────────────────────────
function extractPageContent() {
  // 1. Pick the best content root
  const root =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;

  // 2. Clone so we don't mutate the live DOM
  const clone = root.cloneNode(true);

  // 3. Remove noisy elements from the clone
  clone.querySelectorAll(NOISE_SELECTORS).forEach((el) => el.remove());

  // 4. Get clean plain text
  const rawText = (clone.innerText || clone.textContent || "")
    .replace(/\s+/g, " ")   // collapse whitespace
    .trim();

  // 5. Metrics
  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingTimeMins = Math.max(1, Math.ceil(wordCount / 200)); // ~200 wpm

  // 6. Preview (first PREVIEW_MAX_CHARS chars, cut at word boundary)
  let preview = rawText.slice(0, PREVIEW_MAX_CHARS);
  if (rawText.length > PREVIEW_MAX_CHARS) {
    const lastSpace = preview.lastIndexOf(" ");
    preview = (lastSpace > 0 ? preview.slice(0, lastSpace) : preview) + "…";
  }

  // 7. Cap text sent to backend (metrics above use full rawText so they stay
  //    accurate; only the AI payload is trimmed at a word boundary)
  let text = rawText.slice(0, MAX_TEXT_CHARS);
  if (rawText.length > MAX_TEXT_CHARS) {
    const lastSpace = text.lastIndexOf(" ");
    text = (lastSpace > 0 ? text.slice(0, lastSpace) : text) + "…";
  }

  return {
    title: document.title || "Untitled Page",
    url: window.location.href,
    text,               // capped at MAX_TEXT_CHARS — sent to backend for AI
    wordCount,          // from full rawText — accurate page metric
    readingTime: readingTimeMins,
    preview,            // 500-char truncation — shown in popup UI
  };
}

// ── Message Listener ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Validate message type — reject anything unexpected
  if (message.type !== "EXTRACT_CONTENT") return false;

  try {
    const data = extractPageContent();
    sendResponse({ status: "ok", data });
  } catch (err) {
    console.error("[PageWise] Extraction error:", err);
    sendResponse({ status: "error", message: err.message || "Extraction failed." });
  }

  // Do NOT return true — response is synchronous.
  // Returning true would signal an async response and trigger
  // a spurious "channel closed" error in the popup's catch block.
});

console.log("[PageWise] Content script loaded on:", window.location.href);
