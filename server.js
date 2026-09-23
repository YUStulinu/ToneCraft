require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(ANTHROPIC_API_KEY) });
});

// ---- Compose message variants ----
app.post('/api/compose', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Missing ANTHROPIC_API_KEY. Add it to your .env file (see .env.example).'
      });
    }

    const { context, originalMessage, options } = req.body;

    if (!context || !context.trim()) {
      return res.status(400).json({ error: 'Please describe what you want to say.' });
    }

    const opts = options || {};
    const messageType = opts.messageType || 'email'; // email | text | chat | other
    const formality = opts.formality || 'no preference'; // no preference | more formal | more casual
    const numVariants = Math.min(Math.max(Number(opts.numVariants) || 3, 2), 3);
    const language = opts.language || 'auto'; // auto | English | Romanian | Spanish | French | German

    const isEmail = messageType === 'email';

    const systemPrompt = `You are an assistant that drafts short, ready-to-send messages for the user, based on a description of the situation and what they want to communicate.
Respond STRICTLY with valid JSON (no extra text, no backticks, no markdown), matching exactly this structure:

{
  "variants": [
    {
      "toneLabel": "a short, distinctive tone label, e.g. 'Warm & Friendly', 'Professional & Direct', 'Brief & Casual'",
      "subject": "email subject line if messageType is email, otherwise an empty string",
      "body": "the full message text, ready to send"
    }
  ]
}

Generate exactly ${numVariants} variants, each with a genuinely different, clearly distinguishable tone (do not make them all sound the same).
Message type: ${messageType}${isEmail ? ' (include a short, natural subject line for each variant)' : ' (leave "subject" as an empty string)'}.
Formality preference: ${formality}.
Keep the length appropriate for the message type: brief and conversational for a text/chat message, more complete (but not bloated) for an email.
${language === 'auto'
    ? 'Write the messages in the same language the user used in their context/description below.'
    : `Write all messages in ${language}, regardless of the language of the context below.`}
Avoid unnecessary placeholder brackets; if a name or detail is genuinely unknown, use a natural generic placeholder like "[name]" sparingly.
Do not invent specific facts, dates, or commitments that were not implied by the user's context.`;

    let userPrompt = `Context / what I want to say:\n${context.trim()}`;
    if (originalMessage && originalMessage.trim()) {
      userPrompt += `\n\nI am replying to this message:\n${originalMessage.trim()}`;
    }

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(502).json({ error: 'Error calling the Anthropic API.', details: errText });
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    const rawText = textBlock ? textBlock.text : '';
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', rawText);
      return res.status(502).json({ error: 'Could not parse the AI response as JSON.', raw: rawText });
    }

    parsed.messageType = messageType;
    res.json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`ToneCraft is running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
});
