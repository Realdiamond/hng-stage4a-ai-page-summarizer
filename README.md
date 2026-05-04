# PageWise AI — AI Page Summarizer Chrome Extension

> **HNG Internship Stage 4A | Frontend Wizards Track**

PageWise AI is a **Manifest V3 Chrome Extension** that extracts readable content from the current webpage, sends it securely to a backend AI proxy, and displays a structured summary — complete with key bullet points, deeper insights, word count, and estimated reading time. Your **OpenAI API key is never stored in or exposed by the extension**.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Manifest V3** | Built on the modern, secure Chrome Extension platform |
| **Popup UI** | Clean, accessible popup with loading states and error messages |
| **Content Extraction** | Content script reads page text using DOM APIs — no `innerHTML` |
| **OpenAI-Powered Summary** | GPT-4o-mini generates structured bullet points and deeper insights |
| **Secure Backend Proxy** | Extension never calls OpenAI directly — all calls go through the server |
| **No Exposed API Key** | `OPENAI_API_KEY` lives only in the server's `.env` file |
| **`chrome.storage.local` Cache** | Summaries are cached per URL to avoid redundant API calls |
| **24-Hour Cache Expiry** | Cached entries automatically expire after 24 hours |
| **Copy Summary** | One-click copy of the full summary to clipboard |
| **Clear Cache** | Per-page cache clearing with a single button |
| **Loading States** | Spinner and status text during extraction and AI fetch |
| **Friendly Error Handling** | User-facing messages for network errors, restricted pages, and API failures |
| **Accessibility** | Keyboard-navigable UI with visible focus states throughout |

---

## 🏗 Architecture

Data flows through five distinct layers:

```
[Chrome Popup]
    │  User clicks "Summarize Page"
    ▼
[Content Script — content.js]
    │  Extracts readable text via DOM textContent APIs
    │  Calculates word count and estimated reading time
    ▼
[Background Service Worker — background.js]
    │  Validates and whitelists payload fields
    │  Forwards safe payload to the backend proxy
    ▼
[Backend Proxy — server/api/summarize.js]
    │  Reads OPENAI_API_KEY from process.env (never from client)
    │  Sanitizes and trims input
    │  Calls OpenAI Chat Completions API
    ▼
[OpenAI API — gpt-4o-mini]
    │  Returns structured JSON { bullets[], insights[] }
    ▼
[Response returned to Popup]
    │  Summary rendered using safe DOM methods
    │  Result stored in chrome.storage.local (keyed by URL)
```

---

## 📁 Folder Structure

```
hng-stage4a-ai-page-summarizer/
├── extension/                  # Chrome Extension (load this folder in Chrome)
│   ├── manifest.json           # Manifest V3 — permissions, entry points
│   ├── popup.html              # Extension popup UI
│   ├── popup.css               # Popup styles
│   ├── popup.js                # Popup logic — cache, copy, render
│   ├── background.js           # Service worker — proxies AI requests
│   ├── content.js              # Content script — extracts page text
│   └── icons/                  # Extension icons (16px, 48px, 128px)
│
├── server/                     # Node.js backend proxy
│   ├── api/
│   │   └── summarize.js        # POST /api/summarize — OpenAI proxy endpoint
│   ├── server.js               # Local dev HTTP server (wraps summarize.js)
│   ├── .env.example            # Environment variable template (safe to commit)
│   ├── package.json
│   └── vercel.json             # Vercel deployment config
│
├── .gitignore                  # Ignores .env, node_modules, .DS_Store, etc.
├── demo-notes.md               # Demo script for the 2–5 minute submission video
└── README.md
```

---

## 🚀 Local Setup

### Prerequisites

- **Node.js ≥ 18**
- A **Google Chrome** browser
- An **OpenAI API key** — get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

### 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/hng-stage4a-ai-page-summarizer.git
cd hng-stage4a-ai-page-summarizer
```

### 2 — Set Up the Backend

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and fill in your key:

```env
OPENAI_API_KEY=sk-...your-key-here...
OPENAI_MODEL=gpt-4o-mini
```

### 3 — Start the Backend

```bash
npm run dev
# Server starts at http://localhost:3000
```

### 4 — Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle — top right)
3. Click **"Load unpacked"**
4. Select the **`extension/`** folder from this project
5. **PageWise AI** will appear in your extensions bar

---

## 🔑 Environment Variables

All variables live in `server/.env` (never committed — listed in `.gitignore`).

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ Yes | Your OpenAI secret key |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini` |
| `PORT` | Optional | Defaults to `3000` for local dev |

The template is provided in `server/.env.example`.

---

## 📖 How to Use

1. **Navigate** to any article, blog post, or content-heavy webpage
2. **Click** the PageWise AI extension icon in the Chrome toolbar
3. **Click** the **"Summarize Page"** button
4. **Wait** a few seconds while the extension:
   - Extracts the page content
   - Sends it to the backend AI proxy
   - Returns a structured summary
5. **View** the summary — bullet points, key insights, word count, and reading time
6. **Copy** the summary to clipboard with the copy button
7. **On repeat visits**, the cached summary loads instantly (valid for 24 hours)
8. **Clear** the cached summary anytime with the "Clear cache" button

---

## 🔐 Security Decisions

| Decision | Rationale |
|---|---|
| **API key never in the extension** | The extension only communicates with the backend proxy — it has no knowledge of the OpenAI key |
| **Extension calls backend only** | `background.js` posts to `localhost:3000/api/summarize` (or deployed Vercel URL), never to OpenAI directly |
| **`.env` is git-ignored** | `server/.env` is listed in `.gitignore` — only `.env.example` (with no real values) is committed |
| **`textContent` over `innerHTML`** | All dynamic content (summary bullets, errors, page title) is written using safe DOM APIs — no XSS risk |
| **Payload whitelisting in `background.js`** | Before forwarding to the backend, only `title`, `url`, `text`, `wordCount`, and `readingTime` are passed — arbitrary keys from a malicious page are dropped |
| **Backend input validation** | `summarize.js` checks that `text` is a non-empty string, enforces a 50-char minimum, and hard-caps at 8,000 characters |
| **Minimal permissions** | `manifest.json` requests only `activeTab`, `storage`, and `scripting` — no broad host access beyond what is needed |

---

## ⚖️ Trade-offs & Design Decisions

- **8,000-character text cap** — Only the first 8,000 characters of page text are sent to the AI. This controls API cost and latency without meaningfully degrading summary quality for most articles. Full word count and reading time are calculated from the *complete* extracted text *before* trimming, so those stats remain accurate.

- **CORS is open (`*`) for demo purposes** — The backend sets `Access-Control-Allow-Origin: *` to work seamlessly in local development and with Vercel preview URLs. A production deployment should restrict this to the extension's origin or specific allowed domains.

- **Highlight-to-summarize not implemented** — A selection-based highlight feature was considered but deliberately excluded to keep the codebase stable and focused for Stage 4A. It remains a potential enhancement.

- **Cache is per-URL with 24-hour TTL** — Cache entries are keyed by the full page URL and expire after 24 hours, balancing freshness with cost savings. Users can manually clear the cache at any time.

---

## ✅ Testing Checklist

Before submitting or recording your demo, verify the following:

- [ ] Extension loads in Chrome with **no errors** in `chrome://extensions`
- [ ] No errors appear in the extension's background service worker console
- [ ] Summary is generated correctly on a standard article page
- [ ] A **second click on the same page** loads the summary from cache (check for "Loaded from cache" indicator)
- [ ] Taking the backend offline shows a **friendly error message** in the popup
- [ ] Opening the popup on a restricted Chrome page (e.g., `chrome://newtab`) shows a graceful error
- [ ] **Copy button** copies the summary text to clipboard successfully
- [ ] **Clear cache** removes the stored entry and forces a fresh fetch on the next click
- [ ] No API key is visible in any extension file, network request, or browser console log

---

## 🎥 Demo Video Guide

Your demo video should be **2–5 minutes** and cover the following:

1. **Show the project repo** — briefly show the folder structure and point out `server/.env` is not committed
2. **Start the backend** — `cd server && npm run dev` — show the terminal confirming the server is running
3. **Load the extension** — open `chrome://extensions`, load unpacked from `extension/`, show it appears in the toolbar
4. **Summarize a page** — navigate to any article and click "Summarize Page" — show the loading state, then the result
5. **Show the cache** — click "Summarize Page" again on the same page — show it loads instantly and note the "Loaded from cache" badge
6. **Copy the summary** — click the copy button and paste into Notepad/TextEdit to confirm it works
7. **Mention API key security** — briefly explain that the key only lives in `server/.env` and is never sent to the extension

> See `demo-notes.md` for a full word-for-word demo script.

---

## 📦 Submission Note

This extension is submitted as a **locally-loaded Chrome Extension** and has **not** been published to the Chrome Web Store. Load it using Developer Mode as described in the setup instructions above.

The backend can be run locally with `npm run dev` or deployed to **Vercel** using the included `vercel.json` configuration.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Extension** | Plain HTML, CSS, JavaScript (Manifest V3) |
| **Service Worker** | Chrome Extension Background Script (MV3) |
| **Backend** | Node.js, Vercel Serverless Functions |
| **AI Model** | OpenAI GPT-4o-mini (via secure backend proxy) |
| **Cache** | `chrome.storage.local` with 24-hour TTL |

---

## 👤 Author

Built for the **HNG Internship Stage 4A** assessment — Frontend Wizards Track.
