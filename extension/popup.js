/**
 * popup.js — PageWise AI Chrome Extension
 *
 * Stage 5: UX polish, accessibility, copy summary, spinner,
 *          user-friendly error mapping, duplicate-click guard.
 *
 * Flow:
 *   1. Check cache → hit: render instantly with cache badge
 *   2. Miss → extract page content → AI summarize → render → cache
 *
 * Security: textContent / DOM API only — no innerHTML for any
 *           page or AI-generated content.
 */

"use strict";

// ── Constants ────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "pagewise:summary:";

// ── DOM References ───────────────────────────────────────────
const btnSummarize      = document.getElementById("btn-summarize");
const btnLabel          = document.getElementById("btn-label");
const btnIcon           = document.getElementById("btn-icon");
const btnSpinner        = document.getElementById("btn-spinner");
const btnClear          = document.getElementById("btn-clear");
const btnClearCache     = document.getElementById("btn-clear-cache");
const currentUrlEl      = document.getElementById("current-url");
const outputPlaceholder = document.getElementById("output-placeholder");
const outputLoading     = document.getElementById("output-loading");
const loadingPhaseEl    = document.getElementById("loading-phase");
const outputContent     = document.getElementById("output-content");
const outputError       = document.getElementById("output-error");
const errorMessage      = document.getElementById("error-message");

// ── State ────────────────────────────────────────────────────
let activeTab    = null;
let isProcessing = false;  // duplicate-click guard

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTab = tab;
      currentUrlEl.textContent = tab.url;
      btnSummarize.disabled    = false;
    } else {
      currentUrlEl.textContent = "Could not detect page URL.";
    }
  } catch (err) {
    console.error("[PageWise] Tab query error:", err);
    currentUrlEl.textContent = "Error reading tab.";
  }
});

// ── Cache Helpers ─────────────────────────────────────────────
function cacheKey(url) { return CACHE_PREFIX + url; }

async function readCache(url) {
  try {
    const data  = await chrome.storage.local.get(cacheKey(url));
    const entry = data[cacheKey(url)];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      chrome.storage.local.remove(cacheKey(url));
      return null;
    }
    return entry;
  } catch (err) {
    console.warn("[PageWise] Cache read error:", err);
    return null;
  }
}

async function writeCache(entry) {
  try {
    await chrome.storage.local.set({ [cacheKey(entry.url)]: entry });
  } catch (err) {
    console.warn("[PageWise] Cache write error:", err);
  }
}

async function deleteCache(url) {
  try {
    await chrome.storage.local.remove(cacheKey(url));
  } catch (err) {
    console.warn("[PageWise] Cache delete error:", err);
  }
}

// ── Error Message Mapping ─────────────────────────────────────
function mapError(raw) {
  const msg = (raw || "").toLowerCase();

  // Restricted Chrome pages
  if (
    msg.includes("cannot access") ||
    msg.includes("chrome://") ||
    msg.includes("extension://") ||
    msg.includes("chrome-extension")
  ) return "This page can't be summarized. Navigate to a regular webpage.";

  // Content script not ready
  if (
    msg.includes("receiving end does not exist") ||
    msg.includes("could not establish connection")
  ) return "Couldn't connect to the page. Reload the tab, then try again.";

  // Backend not reachable
  if (
    msg.includes("backend") ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("econnrefused")
  ) return "Couldn't reach the AI service. Make sure the backend is running.";

  // Quota / billing
  if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429"))
    return "AI quota exceeded. Please wait a moment and try again.";

  // Auth
  if (msg.includes("401") || msg.includes("invalid") || msg.includes("key"))
    return "AI authentication failed. Check the backend API key.";

  // Short content
  if (msg.includes("too short") || msg.includes("not enough"))
    return "This page doesn't have enough text to summarize.";

  return "Something went wrong. Please try again.";
}

// ── Summarize Button ─────────────────────────────────────────
btnSummarize.addEventListener("click", async () => {
  if (!activeTab || isProcessing) return;

  isProcessing = true;
  hideAll();
  let resultShown = false;

  try {
    const currentUrl = activeTab.url;

    // ── Step 0: Cache check ───────────────────────────────
    showLoading("Checking cache…");
    const cached = await readCache(currentUrl);

    if (cached) {
      renderResult({
        title:     cached.title,
        preview:   cached.preview,
        summary:   cached.summary,
        fromCache: true,
        cachedAt:  cached.cachedAt,
      });
      resultShown = true;
      return;
    }

    // ── Step 1: Extract content ───────────────────────────
    showLoading("Extracting page content…");

    let extractResponse;
    try {
      extractResponse = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXTRACT_CONTENT",
      });
    } catch (err) {
      console.error("[PageWise] Content script error:", err);
      showError(mapError(err.message));
      return;
    }

    if (!extractResponse || extractResponse.status === "error") {
      showError(
        mapError(extractResponse?.message || "") ||
        "Could not extract content from this page."
      );
      return;
    }

    const { title, url, text, wordCount, readingTime, preview } = extractResponse.data;

    // ── Step 2: AI Summarize ──────────────────────────────
    showLoading("Generating AI summary…");

    const aiResponse = await chrome.runtime.sendMessage({
      type:    "SUMMARIZE_WITH_AI",
      payload: { title, url, text, wordCount, readingTime },
    });

    if (!aiResponse || !aiResponse.success) {
      const errMsg = aiResponse?.error || "";
      console.error("[PageWise] AI error:", errMsg);
      showError(mapError(errMsg));
      return;
    }

    // ── Step 3: Render ────────────────────────────────────
    renderResult({
      title,
      preview,
      summary:   aiResponse.summary,
      fromCache: false,
    });
    resultShown = true;

    // ── Step 4: Cache write ───────────────────────────────
    await writeCache({
      url,
      title,
      summary:     aiResponse.summary,
      wordCount:   aiResponse.summary.wordCount,
      readingTime: aiResponse.summary.readingTime,
      preview,
      cachedAt:    Date.now(),
    });

  } catch (err) {
    if (!resultShown) {
      console.error("[PageWise] Unexpected error:", err);
      showError(mapError(err.message));
    }
  } finally {
    isProcessing = false;
    stopLoading();
    btnSummarize.disabled = false;
    btnLabel.textContent  = "Summarize Page";
  }
});

// ── Clear UI Button ───────────────────────────────────────────
btnClear.addEventListener("click", () => renderPlaceholder());

// ── Clear Cache Button ────────────────────────────────────────
btnClearCache.addEventListener("click", async () => {
  if (!activeTab) return;
  await deleteCache(activeTab.url);
  btnClearCache.textContent = "✓ Cleared";
  btnClearCache.disabled    = true;
  setTimeout(() => {
    renderPlaceholder();
    btnClearCache.textContent = "Clear cache";
    btnClearCache.disabled    = false;
  }, 1200);
});

// ── UI State Helpers ──────────────────────────────────────────
function hideAll() {
  outputPlaceholder.hidden = true;
  outputLoading.hidden     = true;
  outputContent.hidden     = true;
  outputError.hidden       = true;
  errorMessage.textContent = "";
}

function showLoading(phase) {
  hideAll();
  loadingPhaseEl.textContent = phase;
  outputLoading.hidden       = false;
  btnSummarize.disabled      = true;
  btnIcon.hidden             = true;
  btnSpinner.hidden          = false;
  btnLabel.textContent       = phase;
}

function stopLoading() {
  outputLoading.hidden = true;
  btnIcon.hidden       = false;
  btnSpinner.hidden    = true;
}

function showError(msg) {
  hideAll();
  stopLoading();
  errorMessage.textContent = msg;
  outputError.hidden    = false;
  btnClear.hidden       = false;
  btnClearCache.hidden  = true;
  btnSummarize.disabled = false;
  btnLabel.textContent  = "Summarize Page";
}

function hideError() {
  outputError.hidden       = true;
  errorMessage.textContent = "";
}

function renderPlaceholder() {
  hideAll();
  outputContent.replaceChildren();
  outputPlaceholder.hidden = false;
  btnClear.hidden          = true;
  btnClearCache.hidden     = true;
}

// ── Result Renderer ───────────────────────────────────────────
function renderResult({ title, preview, summary, fromCache, cachedAt }) {
  hideError();
  outputContent.replaceChildren();

  // Cache badge
  if (fromCache && cachedAt) {
    const badge = document.createElement("div");
    badge.className = "cache-badge";
    badge.setAttribute("role", "status");
    badge.textContent = `⚡ Loaded from cache · ${formatTimeAgo(cachedAt)}`;
    outputContent.appendChild(badge);
  }

  // Page title card
  outputContent.appendChild(makeCard("📄 Page", title, "card-title"));

  // Stats row
  if (summary.wordCount || summary.readingTime) {
    const row = document.createElement("div");
    row.className = "stats-row";
    if (summary.wordCount)
      row.appendChild(makeStat("Words", summary.wordCount.toLocaleString()));
    if (summary.readingTime)
      row.appendChild(makeStat("Read time", `~${summary.readingTime} min`));
    outputContent.appendChild(row);
  }

  // Bullet summary
  if (summary.bullets?.length) {
    const section = makeSection("✦ Summary");
    const ul = document.createElement("ul");
    ul.className = "bullet-list";
    summary.bullets.forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    outputContent.appendChild(section);
  }

  // Key insights
  if (summary.insights?.length) {
    const section = makeSection("💡 Key Insights");
    summary.insights.forEach((insight, i) => {
      const chip = document.createElement("div");
      chip.className = "insight-chip";
      const num = document.createElement("span");
      num.className   = "insight-num";
      num.textContent = String(i + 1);
      const txt = document.createElement("span");
      txt.className   = "insight-text";
      txt.textContent = insight;
      chip.appendChild(num);
      chip.appendChild(txt);
      section.appendChild(chip);
    });
    outputContent.appendChild(section);
  }

  // Copy summary button
  const copyBtn = document.createElement("button");
  copyBtn.className   = "btn-copy";
  copyBtn.textContent = "Copy summary";
  copyBtn.setAttribute("aria-label", "Copy summary to clipboard");
  copyBtn.addEventListener("click", () =>
    copySummary({ title, summary, copyBtn })
  );
  outputContent.appendChild(copyBtn);

  // Collapsible raw preview
  if (preview) {
    const details = document.createElement("details");
    details.className = "preview-details";
    const summaryEl = document.createElement("summary");
    summaryEl.className   = "preview-summary-label";
    summaryEl.textContent = "🔍 Show raw preview";
    const pre = document.createElement("p");
    pre.className   = "preview-text";
    pre.textContent = preview;
    details.appendChild(summaryEl);
    details.appendChild(pre);
    outputContent.appendChild(details);
  }

  outputContent.hidden  = false;
  btnClear.hidden       = false;
  btnClearCache.hidden  = false;
}

// ── Copy Summary ──────────────────────────────────────────────
async function copySummary({ title, summary, copyBtn }) {
  const lines = [];
  lines.push(`📄 ${title}`);
  lines.push("");

  if (summary.wordCount || summary.readingTime) {
    const parts = [];
    if (summary.wordCount)   parts.push(`${summary.wordCount.toLocaleString()} words`);
    if (summary.readingTime) parts.push(`~${summary.readingTime} min read`);
    lines.push(parts.join("  ·  "));
    lines.push("");
  }

  if (summary.bullets?.length) {
    lines.push("Summary:");
    summary.bullets.forEach((b) => lines.push(`• ${b}`));
    lines.push("");
  }

  if (summary.insights?.length) {
    lines.push("Key Insights:");
    summary.insights.forEach((ins, i) => lines.push(`${i + 1}. ${ins}`));
  }

  const text = lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "✓ Copied!";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy summary";
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch (err) {
    console.error("[PageWise] Clipboard error:", err);
    copyBtn.textContent = "Copy failed";
    setTimeout(() => { copyBtn.textContent = "Copy summary"; }, 2000);
  }
}

// ── Time Formatting ───────────────────────────────────────────
function formatTimeAgo(ts) {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// ── DOM Builder Helpers ───────────────────────────────────────
function makeSection(label) {
  const wrap = document.createElement("div");
  wrap.className = "result-section";
  const lbl = document.createElement("span");
  lbl.className   = "section-label";
  lbl.textContent = label;
  wrap.appendChild(lbl);
  return wrap;
}

function makeCard(label, value, extraClass = "") {
  const card = document.createElement("div");
  card.className = ["result-card", extraClass].filter(Boolean).join(" ");
  const lbl = document.createElement("span");
  lbl.className   = "card-label";
  lbl.textContent = label;
  const val = document.createElement("p");
  val.className   = "card-value";
  val.textContent = value;
  card.appendChild(lbl);
  card.appendChild(val);
  return card;
}

function makeStat(label, value) {
  const stat = document.createElement("div");
  stat.className = "stat-chip";
  const lbl = document.createElement("span");
  lbl.className   = "stat-label";
  lbl.textContent = label;
  const val = document.createElement("span");
  val.className   = "stat-value";
  val.textContent = value;
  stat.appendChild(lbl);
  stat.appendChild(val);
  return stat;
}
