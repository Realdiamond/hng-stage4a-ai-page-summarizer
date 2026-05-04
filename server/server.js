/**
 * server.js — Local dev HTTP wrapper for PageWise AI backend
 * HNG Stage 4A | Frontend Wizards
 *
 * Wraps api/summarize.js in a minimal Node HTTP server so you can
 * run the backend locally without installing the Vercel CLI.
 *
 * Usage:
 *   cp .env.example .env        # add your GEMINI_API_KEY
 *   npm install
 *   npm run dev                 # starts on http://localhost:3000
 */

"use strict";

require("dotenv").config();

const http    = require("http");
const handler = require("./api/summarize");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Parse JSON body manually (Vercel does this automatically in prod)
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      req.body = body ? JSON.parse(body) : {};
    } catch {
      req.body = {};
    }

    // Attach a minimal Vercel-compatible res.status().json() shim
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };

    handler(req, res).catch((err) => {
      console.error("[PageWise] Unhandled error:", err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Internal server error." }));
    });
  });
});

server.listen(PORT, () => {
  console.log(`[PageWise] Backend running → http://localhost:${PORT}/api/summarize`);
});
