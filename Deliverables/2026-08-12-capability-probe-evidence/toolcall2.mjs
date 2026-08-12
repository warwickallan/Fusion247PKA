import fs from 'node:fs';

const GATEWAY = process.env.FUSION_GATEWAY_URL;
const KEY = process.env.FUSION_GATEWAY_KEY;
const ANSWER_MODEL = process.env.FUSION_MODEL_ANSWER || 'gpt-5.6-terra';
const base = GATEWAY.replace(/\/$/, '');
const hdrs = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY };

async function post(pathSuffix, body) {
  const res = await fetch(base + pathSuffix, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, ok: res.ok, json: json, text: text.slice(0, 1200) };
}

const toolDef = {
  type: 'function',
  name: 'request_crop',
  description: 'Request a higher-resolution crop of a named region of the source photograph so it can be re-inspected.',
  parameters: {
    type: 'object',
    properties: { region: { type: 'string', description: 'The region number or label to crop.' } },
    required: ['region'],
  },
};

const results = {};

// Route A: /v1/chat/completions with tools shaped for that API + reasoning_effort:'none'
try {
  const r = await post('/chat/completions', {
    model: ANSWER_MODEL,
    reasoning_effort: 'none',
    messages: [{ role: 'user', content: 'You are reading a photographed shopping list. Region 3 is blurry and you cannot read it confidently. You MUST call the request_crop tool for region 3 instead of guessing.' }],
    tools: [{ type: 'function', function: { name: toolDef.name, description: toolDef.description, parameters: toolDef.parameters } }],
    tool_choice: 'auto',
    stream: false,
  });
  const msg = (r.json && r.json.choices) ? r.json.choices[0].message : null;
  results.chat_completions_reasoning_none = {
    status: r.status,
    finish_reason: (r.json && r.json.choices) ? r.json.choices[0].finish_reason : null,
    tool_calls: msg ? msg.tool_calls : null,
    content: msg ? msg.content : null,
    raw_error: r.ok ? null : (r.json || r.text),
  };
} catch (e) { results.chat_completions_reasoning_none = { error: String(e) }; }

// Route B: /v1/responses with tools (Responses-API tool shape is flatter: {type:'function', name, description, parameters})
try {
  const r = await post('/responses', {
    model: ANSWER_MODEL,
    input: 'You are reading a photographed shopping list. Region 3 is blurry and you cannot read it confidently. You MUST call the request_crop tool for region 3 instead of guessing.',
    tools: [toolDef],
    tool_choice: 'auto',
  });
  results.responses_api = {
    status: r.status,
    output: r.json ? r.json.output : null,
    raw_error: r.ok ? null : (r.json || r.text),
  };
} catch (e) { results.responses_api = { error: String(e) }; }

fs.writeFileSync('toolcall2-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
