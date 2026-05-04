# PageWise AI — Demo Script
### HNG Stage 4A Submission | 2–5 Minute Video Guide

---

## 🎬 Before You Record

Make sure you have:
- [ ] Backend running: `cd server && npm run dev` (terminal visible)
- [ ] Extension loaded in Chrome Developer Mode from the `extension/` folder
- [ ] A good article page ready to open (e.g., a BBC, Medium, or dev.to article)
- [ ] A text editor or Notepad open to paste the copied summary into
- [ ] Screen recording tool ready (OBS, QuickTime, Loom, etc.)

---

## 📋 Full Demo Script

---

### Segment 1 — Project Overview (0:00 – 0:40)

**What to show:** Your code editor / file explorer with the project open.

**What to say:**

> "This is PageWise AI — a Manifest V3 Chrome Extension I built for HNG Stage 4A.
> The project has two parts: the `extension/` folder, which is the Chrome extension itself, and the `server/` folder, which is a Node.js backend proxy.
> The extension never talks to OpenAI directly — it always goes through the backend proxy. This means the OpenAI API key is never stored in, or exposed by, the extension."

**Show:**
- The folder structure (`extension/`, `server/`)
- `server/.env.example` — point out it has no real key
- `server/.env` — mention it is in `.gitignore` and not committed

---

### Segment 2 — Start the Backend (0:40 – 1:10)

**What to show:** Your terminal.

**What to say:**

> "I'll start the backend proxy server first. I navigate into the server folder and run `npm run dev`. The server starts on port 3000. This is the only place the OpenAI API key ever lives — in the `.env` file on my machine, read at runtime by the server."

**Commands to run live:**
```bash
cd server
npm run dev
```

**Show:** Terminal confirming `Server running on http://localhost:3000`

---

### Segment 3 — Load the Extension (1:10 – 1:45)

**What to show:** Chrome browser, `chrome://extensions`.

**What to say:**

> "Now I'll load the extension. I go to `chrome://extensions`, enable Developer Mode, click 'Load unpacked', and select the `extension/` folder from the project. PageWise AI now appears in my extensions bar."

**Steps to perform:**
1. Open `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Point out the extension icon appearing in the toolbar

---

### Segment 4 — Summarize a Page (1:45 – 2:45)

**What to show:** A real article page, then the extension popup.

**What to say:**

> "I'll navigate to an article now — let's use this one. I'll click the PageWise AI icon in the toolbar. You can see the popup open. I click 'Summarize Page'. The content script extracts the page text, the background service worker sends it to our backend, the backend calls OpenAI, and the summary is returned here."

**Show:**
- Loading spinner while the request is in-flight
- The completed summary appearing — bullet points and key insights
- Word count and reading time metadata at the bottom

---

### Segment 5 — Cache Behavior (2:45 – 3:15)

**What to show:** The same page — click Summarize again.

**What to say:**

> "Now watch what happens when I click Summarize Page a second time on the same URL. It loads instantly — no spinner, no API call. That's the `chrome.storage.local` cache. The summary is stored per URL and stays valid for 24 hours. You can see the 'Loaded from cache' badge here. This saves API costs and gives a much faster experience on repeat visits."

**Show:**
- The instant load on the second click
- The "Loaded from cache" status badge in the popup

---

### Segment 6 — Copy Button (3:15 – 3:35)

**What to show:** Copy button, then paste into Notepad/TextEdit.

**What to say:**

> "There's also a one-click copy button. I'll click it here — you can see the confirmation. I'll switch to a text editor and paste. The full summary is now in the clipboard."

**Steps:**
1. Click the copy button in the popup
2. Switch to Notepad/TextEdit
3. Paste (Cmd+V / Ctrl+V)
4. Show the pasted text

---

### Segment 7 — Clear Cache (3:35 – 3:55)

**What to show:** Clear cache button.

**What to say:**

> "Users can also clear the cached summary for the current page with the clear cache button. After clearing, the next summarize click will make a fresh API call and generate a new summary."

**Steps:**
1. Click the "Clear cache" button
2. Note the cache badge disappears
3. Optionally click Summarize again to show a fresh API call

---

### Segment 8 — Security Recap (3:55 – 4:30)

**What to show:** `background.js` or `server/api/summarize.js` briefly.

**What to say:**

> "Before I wrap up, here are the key security decisions:
>
> First, the API key is only in `server/.env` — it is never bundled into the extension and never sent to the browser.
>
> Second, the extension uses safe DOM APIs — `textContent` and `createElement` — instead of `innerHTML`, which eliminates XSS risk from AI-generated content.
>
> Third, `background.js` whitelists only five expected payload fields before forwarding to the backend — so a malicious page script can't inject arbitrary data into the API request.
>
> Finally, the backend validates the input, enforces a minimum text length, and hard-caps content at 8,000 characters to control cost and prevent abuse."

**Show (optional):** Briefly scroll through `background.js` payload whitelist or `summarize.js` input validation section.

---

### Closing (4:30 – 5:00)

**What to say:**

> "That's PageWise AI. A complete, secure, cached AI page summarizer Chrome Extension — built with Manifest V3, a Node.js backend proxy, and OpenAI GPT-4o-mini. Thanks for watching."

---

## 🔑 Key Security Talking Points (quick reference)

| Point | What to say |
|---|---|
| API key location | "Only in `server/.env` — never in the extension" |
| Extension ↔ Backend | "Extension calls our proxy, not OpenAI" |
| `.env` in `.gitignore` | "The real key is never committed to Git" |
| `textContent` over `innerHTML` | "No XSS risk from AI output" |
| Payload whitelist | "Background.js drops any unexpected fields" |
| Backend validation | "Server checks length and type before hitting OpenAI" |

---

## ⏱ Suggested Timing

| Segment | Time |
|---|---|
| Project overview | 0:00 – 0:40 |
| Start backend | 0:40 – 1:10 |
| Load extension | 1:10 – 1:45 |
| Summarize a page | 1:45 – 2:45 |
| Cache behavior | 2:45 – 3:15 |
| Copy button | 3:15 – 3:35 |
| Clear cache | 3:35 – 3:55 |
| Security recap | 3:55 – 4:30 |
| Closing | 4:30 – 5:00 |

**Total: ~5 minutes**
