// Tests the HTTP API with the Anthropic call replaced by a fake, so no key or network is needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.ANTHROPIC_API_KEY = 'test-key';
const { app } = require('../server');

const realFetch = globalThis.fetch;
let modelReply = null; // { status, text } answered by the fake Anthropic API
let lastRequest = null;

globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    lastRequest = JSON.parse(init.body);
    const { status = 200, text } = modelReply;
    const body = status === 200 ? JSON.stringify({ content: [{ type: 'text', text }] }) : text;
    return new Response(body, { status });
  }
  return realFetch(url, init);
};

let server;
let base;
before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const drafts = { variants: [{ toneLabel: 'Warm', subject: 'Thanks', body: 'Thank you!' }] };

async function compose(body) {
  const res = await realFetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('an empty description is rejected before any AI call', async () => {
  lastRequest = null;
  assert.equal((await compose({})).status, 400);
  assert.equal((await compose({ context: ' ' })).status, 400);
  assert.equal(lastRequest, null);
});

test('defaults: an email, three variants, the user\'s own language', async () => {
  modelReply = { text: '```json\n' + JSON.stringify(drafts) + '\n```' };
  const r = await compose({ context: '  decline the wedding invitation  ' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ...drafts, messageType: 'email' });
  assert.match(lastRequest.system, /Generate exactly 3 variants/);
  assert.match(lastRequest.system, /Message type: email \(include a short, natural subject line/);
  assert.match(lastRequest.system, /same language the user used/);
  assert.equal(lastRequest.messages[0].content, 'Context / what I want to say:\ndecline the wedding invitation');
});

test('options shape the prompt and the variant count is clamped to 2..3', async () => {
  modelReply = { text: JSON.stringify(drafts) };
  const r = await compose({
    context: 'say thanks',
    originalMessage: '  Can you come Friday?  ',
    options: { messageType: 'chat', formality: 'more casual', numVariants: 9, language: 'Romanian' },
  });
  assert.equal(r.json.messageType, 'chat');
  assert.match(lastRequest.system, /Generate exactly 3 variants/);
  assert.match(lastRequest.system, /Message type: chat \(leave "subject" as an empty string\)/);
  assert.match(lastRequest.system, /Formality preference: more casual\./);
  assert.match(lastRequest.system, /Write all messages in Romanian/);
  assert.match(lastRequest.messages[0].content, /I am replying to this message:\nCan you come Friday\?$/);
  await compose({ context: 'x', options: { numVariants: 1 } });
  assert.match(lastRequest.system, /Generate exactly 2 variants/);
});

test('a reply that is not JSON and an API error both become 502', async () => {
  modelReply = { text: 'Sure! Here you go:' };
  let r = await compose({ context: 'x' });
  assert.equal(r.status, 502);
  assert.equal(r.json.raw, 'Sure! Here you go:');
  modelReply = { status: 401, text: 'bad key' };
  r = await compose({ context: 'x' });
  assert.equal(r.status, 502);
  assert.equal(r.json.details, 'bad key');
});

test('the health check reports whether a key is configured', async () => {
  const res = await realFetch(`${base}/api/health`);
  assert.deepEqual(await res.json(), { ok: true, hasApiKey: true });
});
