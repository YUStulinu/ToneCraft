# ToneCraft ✉️

Describe what you want to say, and get 2-3 ready-to-send message drafts, each in a different tone — powered by AI (Claude).

## What it does

Type a short description of the situation — e.g. "I want to politely decline a wedding invitation" — pick a message type (email, text, chat) and a formality preference, and ToneCraft returns a few distinct drafts (e.g. warm & friendly, professional & direct, brief & casual) that you can copy, save, or download.

## Project structure

```
tonecraft/
├── server.js           # Express server, calls the Anthropic API
├── package.json
├── .env.example         # template for environment variables
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## Installation

1. You'll need [Node.js](https://nodejs.org/) version 18 or newer.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get a key from [console.anthropic.com](https://console.anthropic.com/) → Settings → API Keys.
5. Start the server:
   ```bash
   npm start
   ```
6. Open [http://localhost:3003](http://localhost:3003) in your browser.

> ⚠️ The `.env` file is ignored by Git (see `.gitignore`) — never push your API key to GitHub.
>
> Note: this app runs on port **3003** by default, so it can run alongside FridgeChef (3000), BriefDesk (3001), and QuizForge (3002) without conflicts. Change `PORT` in `.env` if you'd like a different port.

## Features — MVP

- Describe your situation in plain language
- Optionally paste the message you're replying to, for context
- Choose message type (email / text / chat / other), formality, number of variants (2 or 3), and output language
- Get genuinely different tones per request, each with its own label (and a subject line for emails)

## Features — Extensions (already included, simple version)

- **Saved messages** — bookmark any draft to keep it (stored in `localStorage`)
- **History** — your last 20 requests, with a "View" button that reloads the exact drafts and refills the form
- **Copy** and **Download as .txt** for any draft

## Ideas for next steps (not included yet)

- Regenerate a single variant without regenerating all of them
- Tone sliders (e.g. warmth, directness) instead of preset labels
- Save frequently-used contexts as quick templates
- Browser extension to draft replies directly inside Gmail/Slack

## Pushing to GitHub

```bash
cd tonecraft
git init
git add .
git commit -m "Initial commit: ToneCraft MVP"
git branch -M main
git remote add origin <your_github_repo_url>
git push -u origin main
```

`.env` won't be pushed (it's in `.gitignore`) — that's correct, your key stays local only.
