// Capability probe against the REAL deployed Fusion gateway (LiteLLM) for the
// gpt-5.6-terra vision/answer model. Read-only introspection + minimal live
// calls. Never prints FUSION_GATEWAY_URL / FUSION_GATEWAY_KEY values.
import fs from 'node:fs';
import path from 'node:path';

const GATEWAY = process.env.FUSION_GATEWAY_URL || null;
const KEY = process.env.FUSION_GATEWAY_KEY || null;
const VISION_MODEL = process.env.FUSION_MODEL_VISION || 'fusion.vision';
const ANSWER_MODEL = process.env.FUSION_MODEL_ANSWER || 'gpt-5.6-terra';

if (!GATEWAY) { console.error('NO GATEWAY CONFIGURED - aborting'); process.exit(1); }

const base = GATEWAY.replace(/\/$/, '');
const root = base.replace(/\/v1$/, '');
const hdrs = { 'Content-Type': 'application/json', ...(KEY ? { Authorization: 'Bearer ' + KEY } : {}) };

const results = {};
const SCRATCH = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/65635422-06ce-4e12-8614-a5e21fb76876/scratchpad';

function toDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return 'data:image/' + mime + ';base64,' + buf.toString('base64');
}

async function rawPost(pathSuffix, body) {
  const url = base + pathSuffix;
  const res = await fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e2) { /* not json */ }
  return { status: res.status, ok: res.ok, json: json, text: text.slice(0, 1500) };
}

async function rawGet(url) {
  const res = await fetch(url, { headers: hdrs });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e2) { /* not json */ }
  return { status: res.status, ok: res.ok, json: json, text: text.slice(0, 3000) };
}

async function main() {
  // 0. GET /models
  try {
    const r = await rawGet(base + '/models');
    results.models_endpoint = { status: r.status, ids: r.json && r.json.data ? r.json.data.map(function(m){return m.id;}) : null };
  } catch (e) { results.models_endpoint = { error: String(e) }; }

  // 0b. LiteLLM-specific /model/info
  const candidates = [root + '/model/info', base + '/model/info', root + '/v1/model/info'];
  results.model_info_probe = [];
  for (const candidate of candidates) {
    try {
      const r = await rawGet(candidate);
      let relevant;
      if (r.json && Array.isArray(r.json.data)) {
        relevant = r.json.data
          .filter(function(m){ return [VISION_MODEL, ANSWER_MODEL, 'gpt-5.6-terra'].indexOf(m.model_name) !== -1; })
          .map(function(m){ return { model_name: m.model_name, model_info: m.model_info }; });
      } else {
        relevant = r.json || r.text;
      }
      results.model_info_probe.push({ url: candidate, status: r.status, relevant: relevant });
    } catch (e) {
      results.model_info_probe.push({ url: candidate, error: String(e) });
    }
  }

  // 1. Multi-image re-confirm
  try {
    const img1 = toDataUrl(SCRATCH + '/crossout2.jpg');
    const img2 = toDataUrl(SCRATCH + '/sultana.jpg');
    const r = await rawPost('/chat/completions', {
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'I am sending exactly two images. For EACH image, in one short sentence, describe what you see. Label your answer IMAGE 1: and IMAGE 2:.' },
          { type: 'image_url', image_url: { url: img1 } },
          { type: 'image_url', image_url: { url: img2 } },
        ],
      }],
      stream: false,
    });
    results.multi_image = { status: r.status, content: (r.json && r.json.choices) ? r.json.choices[0].message.content : r.text, usage: r.json ? r.json.usage : null };
  } catch (e) { results.multi_image = { error: String(e) }; }

  // 2. Multi-turn continuation
  try {
    const r = await rawPost('/chat/completions', {
      model: ANSWER_MODEL,
      messages: [
        { role: 'user', content: 'Remember this codeword: ZEBRA-471. Reply with only the word OK.' },
        { role: 'assistant', content: 'OK' },
        { role: 'user', content: 'What was the codeword I told you, exactly?' },
      ],
      stream: false,
    });
    results.multiturn_client_history = { status: r.status, content: (r.json && r.json.choices) ? r.json.choices[0].message.content : r.text, response_id: r.json ? r.json.id : null, usage: r.json ? r.json.usage : null };
  } catch (e) { results.multiturn_client_history = { error: String(e) }; }

  let firstId = null;
  try {
    const r = await rawPost('/chat/completions', {
      model: ANSWER_MODEL,
      messages: [{ role: 'user', content: 'Remember this second codeword: FALCON-902. Reply with only the word OK.' }],
      stream: false,
    });
    firstId = r.json ? r.json.id : null;
    results.multiturn_first_call = { status: r.status, id: firstId, content: (r.json && r.json.choices) ? r.json.choices[0].message.content : r.text };
  } catch (e) { results.multiturn_first_call = { error: String(e) }; }

  try {
    const r = await rawPost('/chat/completions', {
      model: ANSWER_MODEL,
      previous_response_id: firstId,
      messages: [{ role: 'user', content: 'What was the second codeword I just told you?' }],
      stream: false,
    });
    const content2c = (r.json && r.json.choices) ? r.json.choices[0].message.content : r.text;
    results.multiturn_previous_response_id_on_chat_completions = {
      status: r.status, content: content2c,
      knew_the_codeword: /FALCON-902/i.test(content2c || ''),
    };
  } catch (e) { results.multiturn_previous_response_id_on_chat_completions = { error: String(e) }; }

  const respPaths = ['/responses', '/v1/responses'];
  for (const respPath of respPaths) {
    const skip = base.endsWith('/v1') && respPath === '/v1/responses';
    if (skip) continue;
    const key = 'responses_api_' + respPath.replace(/\//g, '_');
    try {
      const r1 = await rawPost(respPath, { model: ANSWER_MODEL, input: 'Remember codeword OTTER-3. Reply OK only.', store: true });
      results[key] = { first_call_status: r1.status, first_call_body: r1.json || r1.text };
      if (r1.ok && r1.json && r1.json.id) {
        const r2 = await rawPost(respPath, { model: ANSWER_MODEL, input: 'What was the codeword?', previous_response_id: r1.json.id });
        results[key].second_call_status = r2.status;
        results[key].second_call_body = r2.json || r2.text;
      }
    } catch (e) {
      results[key] = { error: String(e) };
    }
  }

  // 3. Tool / function calling
  try {
    const r = await rawPost('/chat/completions', {
      model: ANSWER_MODEL,
      messages: [{
        role: 'user',
        content: 'You are reading a photographed shopping list. Region 3 is blurry and you cannot read it confidently. You MUST call the request_crop tool for region 3 instead of guessing.',
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'request_crop',
          description: 'Request a higher-resolution crop of a named region of the source photograph so it can be re-inspected.',
          parameters: {
            type: 'object',
            properties: { region: { type: 'string', description: 'The region number or label to crop.' } },
            required: ['region'],
          },
        },
      }],
      tool_choice: 'auto',
      stream: false,
    });
    const msg = (r.json && r.json.choices) ? r.json.choices[0].message : null;
    results.tool_calling = {
      status: r.status,
      finish_reason: (r.json && r.json.choices) ? r.json.choices[0].finish_reason : null,
      tool_calls: msg ? msg.tool_calls : null,
      content: msg ? msg.content : null,
      raw_error: r.ok ? null : (r.json || r.text),
    };
  } catch (e) { results.tool_calling = { error: String(e) }; }

  // 4. Image detail / resolution control
  try {
    const img = toDataUrl(SCRATCH + '/sultana.jpg');
    const low = await rawPost('/chat/completions', {
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Read any text visible in this image, verbatim.' },
        { type: 'image_url', image_url: { url: img, detail: 'low' } },
      ] }],
      stream: false,
    });
    const high = await rawPost('/chat/completions', {
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Read any text visible in this image, verbatim.' },
        { type: 'image_url', image_url: { url: img, detail: 'high' } },
      ] }],
      stream: false,
    });
    results.image_detail = {
      low: { status: low.status, usage: low.json ? low.json.usage : null, content: (low.json && low.json.choices) ? low.json.choices[0].message.content : low.text },
      high: { status: high.status, usage: high.json ? high.json.usage : null, content: (high.json && high.json.choices) ? high.json.choices[0].message.content : high.text },
    };
  } catch (e) { results.image_detail = { error: String(e) }; }

  // 5. Prompt caching
  try {
    const filler = 'HOUSEHOLD CATALOGUE CONTEXT LINE. '.repeat(400);
    const call = function() {
      return rawPost('/chat/completions', {
        model: ANSWER_MODEL,
        messages: [{ role: 'user', content: filler + '\n\nGiven the above, reply with just the number 42.' }],
        stream: false,
      });
    };
    const c1 = await call();
    const c2 = await call();
    results.prompt_caching = {
      call1_usage: c1.json ? c1.json.usage : null,
      call2_usage: c2.json ? c2.json.usage : null,
    };
  } catch (e) { results.prompt_caching = { error: String(e) }; }

  // 6. Usage/cost telemetry summary
  const summary = {};
  for (const k of Object.keys(results)) {
    const v = results[k];
    if (v && typeof v === 'object' && 'usage' in v) summary[k] = v.usage;
  }
  results.usage_summary = summary;

  const outPath = SCRATCH + '/capability-probe/results.json';
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('WROTE', outPath);
  console.log(JSON.stringify(results, null, 2));
}

main();
