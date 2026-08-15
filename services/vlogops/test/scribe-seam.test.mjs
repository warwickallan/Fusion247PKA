// BUILD-006 Phase 3 — AC5, AC6, AC7 (the deterministic half), and the refusal layer of AC3/AC4.
//
// Nothing in this file touches a database or a network. Everything it proves is a property of
// pure functions, which is exactly the point: the contract, the prompt, the identity and the
// citation rules are all decidable without a model and without a store, and confining them to
// modules that CANNOT reach either is how that is held rather than promised.
//
// ⛔ WHAT THIS FILE DOES NOT PROVE, STATED HERE SO NOBODY HAS TO INFER IT ⛔
// Every proof below runs over a deterministic stub or a hand-built proposal. They establish the
// CONTRACT and the PLUMBING. They say nothing whatsoever about whether Scribe writes in
// Warwick's voice — that is a creative judgement, it is Warwick's alone, and it is Phase 5.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCRIBE_DERIVATION_RULE_VERSION, SCRIBE_SIBLINGS, SCRIBE_VERSION } from '../src/config.mjs';
import { sha256Hex } from '../src/identity.mjs';
import {
  CURRENT_CONTRACT_VERSION, availableContractVersions, loadContract, normaliseContractText,
} from '../src/scribe/contract.mjs';
import {
  ENV_GATEWAY_URL, ENV_MODEL, gatewayModelClient, modelConfigured, resolveModelClient,
} from '../src/scribe/model.mjs';
import { buildPrompt, derivationIdentity, promptIdentity } from '../src/scribe/prompt.mjs';
import { parseProposal, validateProposal } from '../src/scribe/proposal.mjs';
import { buildPackageManifest, packageIdentity, renderSibling } from '../src/scribe/package.mjs';
import { composeStubProposal, stubModelClient } from '../src/scribe/stub.mjs';

// A tiny fixed pack. Not a substitute for the real one — the real chain is proven in
// scribe-package.test.mjs against a pack Phase 2 actually compiled. This is here so the PURE
// rules can be exercised on input a reader can hold in their head.
const ENTRIES = [
  {
    ordinal: 0,
    source_ref: 'file:Deliverables/one.md',
    media_type: 'text/markdown',
    byte_length: 11,
    occurred_at: '2026-08-13T00:00:00.000Z',
    occurred_at_basis: 'dated-filename',
    excerpt_text: 'first thing',
  },
  {
    ordinal: 1,
    source_ref: 'git-commit:abc123',
    media_type: 'text/plain',
    byte_length: 12,
    occurred_at: '2026-08-14T09:00:00.000Z',
    occurred_at_basis: 'git-commit-time',
    excerpt_text: 'second thing',
  },
];

const ALLOWED = new Set(ENTRIES.map((e) => e.source_ref));

function goodProposal() {
  return {
    story_question: 'What happened here?',
    question_citations: ['file:Deliverables/one.md'],
    beats: [
      { id: 'beat-1', text: 'The first thing happened.', citations: ['file:Deliverables/one.md'] },
      { id: 'beat-2', text: 'Then the second thing happened.', citations: ['git-commit:abc123'] },
    ],
    claims: [
      { id: 'claim-1', text: 'Both things are recorded.', citations: ['file:Deliverables/one.md', 'git-commit:abc123'] },
    ],
    siblings: {
      script: [{ role: 'scene', claim: 'beat-1', cite: 'file:Deliverables/one.md', text: 'Scene one.' }],
      blog: [{ role: 'paragraph', claim: 'beat-2', cite: 'git-commit:abc123', text: 'Paragraph one.' }],
      titles: [{ role: 'title', claim: 'beat-1', cite: 'file:Deliverables/one.md', text: 'A title.' }],
      'thumbnail-direction': [
        { role: 'direction', claim: 'claim-1', cite: 'git-commit:abc123', text: 'A frame.' },
      ],
    },
  };
}

function validateThrows(mutate) {
  const proposal = goodProposal();
  mutate(proposal);
  try {
    validateProposal({ proposal, allowedRefs: ALLOWED });
  } catch (err) {
    return err;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC6 — THE MODEL SEAM REFUSES LOUDLY WHEN UNCONFIGURED, and never substitutes a fallback.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC6 — with no gateway configured, the seam refuses instead of falling back', async () => {
  const client = gatewayModelClient({});                       // an empty environment
  await assert.rejects(
    () => client.draft('anything'),
    (err) => {
      assert.equal(err.code, 'EVLOGOPSNOMODEL', 'the refusal does not carry the documented code');
      assert.match(err.message, new RegExp(ENV_GATEWAY_URL), 'the refusal does not name the variable to set');
      assert.match(err.message, /REFUSES to substitute/, 'the refusal does not say it refuses to substitute');
      return true;
    },
  );
});

test('AC6 — a gateway with NO MODEL NAMED is also a refusal, and the seam has no default', async () => {
  // The recorded incident this proof exists for: obsidiwikai's `vision` role defaulted to an
  // alias the gateway did not register and failed live with a 400. The ruling was that a default
  // model name the gateway does not provide must never survive preflight again. So the absence
  // of a default is a FEATURE, and this proof is what stops someone adding one back "for
  // convenience".
  const client = gatewayModelClient({ [ENV_GATEWAY_URL]: 'http://127.0.0.1:9/v1' });
  await assert.rejects(
    () => client.draft('anything'),
    (err) => {
      assert.equal(err.code, 'EVLOGOPSNOMODEL');
      assert.match(err.message, new RegExp(ENV_MODEL), 'the refusal does not name the model variable');
      return true;
    },
  );
});

test('AC6 — the seam CODE contains no fallback path to any other model', () => {
  // A behavioural proof can only exercise the paths that exist. This one asserts about the
  // source, because the failure being prevented is a FUTURE edit that adds a fallback back in.
  //
  // COMMENTS ARE STRIPPED FIRST, and that is not a convenience. This file's header explains at
  // length where the pattern came from and names `obsidiwikai` and `lightrag` while doing it —
  // a control that fired on those would be reporting a breach where there is a promise, which
  // is the same mistake `test/helpers/sql-identifiers.mjs` was written to avoid. Scan the code.
  const raw = fs.readFileSync(new URL('../src/scribe/model.mjs', import.meta.url), 'utf8');
  const code = raw.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');

  // The strip must actually have stripped something, or this control is scanning the whole file
  // and calling it code.
  assert.ok(code.length < raw.length * 0.75, 'the comment stripper removed almost nothing');

  assert.ok(!/obsidiwikai/.test(code), 'the seam reaches across a service boundary');
  assert.ok(!/lightrag/i.test(code), 'the seam has acquired a fallback provider');
  assert.ok(!/\|\|\s*['"`](gpt|fusion\.)/.test(code), 'the seam has acquired a default model name');
  // And the mutation check: the patterns above must be capable of firing at all.
  assert.ok(/obsidiwikai/.test(`${code}\nimport x from '../../obsidiwikai/y.mjs';`),
    'the service-boundary pattern cannot fire even when the breach is present');
});

test('AC6 — `modelConfigured` requires BOTH the gateway and the model name', () => {
  assert.equal(modelConfigured({}), false);
  assert.equal(modelConfigured({ [ENV_GATEWAY_URL]: 'http://x/v1' }), false, 'a URL alone reported as configured');
  assert.equal(modelConfigured({ [ENV_MODEL]: 'some-model' }), false, 'a model alone reported as configured');
  assert.equal(modelConfigured({ [ENV_GATEWAY_URL]: 'http://x/v1', [ENV_MODEL]: 'm' }), true);
  assert.equal(modelConfigured({ [ENV_GATEWAY_URL]: '   ', [ENV_MODEL]: 'm' }), false, 'whitespace read as a value');
});

test('AC6 — the default client is the one that refuses; the stub must be asked for by name', () => {
  const dflt = resolveModelClient(undefined, {}, stubModelClient);
  assert.equal(dflt.describe().provider, 'fusion-gateway', 'the default client is not the gateway');
  const stub = resolveModelClient('stub', {}, stubModelClient);
  assert.equal(stub.describe().provider, 'stub');
  assert.equal(stub.describe().configured, false, 'the stub reports itself as a configured model');
  assert.match(stub.describe().warning, /Not Warwick's voice/, 'the stub does not disclose what it is');
  assert.throws(() => resolveModelClient('stub', {}, null), (e) => e.code === 'EVLOGOPSNOSTUB');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC5 — THE CONTRACT IS VERSIONED, and its version is its BYTES.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC5 — a contract loads with an identity that is the sha256 of the text it actually uses', () => {
  const contract = loadContract();
  assert.equal(contract.version, CURRENT_CONTRACT_VERSION);
  assert.match(contract.id, /^[0-9a-f]{64}$/);
  // Hash what you USE. `contract.text` is what reaches the model, and it is what was hashed —
  // the two can never disagree because they are the same string.
  assert.equal(contract.id, sha256Hex(contract.text),
    'the contract id is not the hash of the text the model is sent');
  assert.equal(contract.text, normaliseContractText(fs.readFileSync(contract.path, 'utf8')));
  assert.ok(availableContractVersions().includes(CURRENT_CONTRACT_VERSION));
});

test('AC5 — THE CONTRACT IDENTITY SURVIVES A CRLF CHECKOUT', () => {
  // The defect this proves closed, caught by git itself while staging: this repository has
  // `core.autocrlf=true` and no root `.gitattributes`, so the very same committed contract is
  // CRLF on a Windows checkout and LF on Linux CI. Hashing raw bytes would have given one
  // contract two identities decided by the operating system, and every package_id and
  // derivation_id would have inherited it.
  const contract = loadContract();

  const asCheckedOutOnWindows = contract.text.replace(/\n/g, '\r\n');
  assert.notEqual(asCheckedOutOnWindows, contract.text, 'the CRLF fixture is not actually CRLF');
  assert.notEqual(sha256Hex(asCheckedOutOnWindows), sha256Hex(contract.text),
    'the raw bytes are identical, so this proof would pass without the normalisation');

  // The normalisation is what closes it, and it closes it in both directions.
  assert.equal(sha256Hex(normaliseContractText(asCheckedOutOnWindows)), contract.id,
    'a CRLF checkout of this contract produces a DIFFERENT identity');
  assert.equal(normaliseContractText(asCheckedOutOnWindows), contract.text);

  // And it is the ONLY normalisation: a real edit still changes the identity.
  assert.notEqual(sha256Hex(normaliseContractText(`${contract.text} `)), contract.id,
    'the normalisation is swallowing real differences');
  assert.notEqual(sha256Hex(normaliseContractText(contract.text.toUpperCase())), contract.id);
});

test('AC5 — asking for a contract that does not exist is refused, never invented', () => {
  assert.throws(() => loadContract('scribe-v99'), (err) => {
    assert.equal(err.code, 'EVLOGOPSSCRIBENOCONTRACT');
    assert.match(err.message, /there is no path that invents one/);
    return true;
  });
  assert.throws(() => loadContract('../../etc/passwd'), (err) => err.code === 'EVLOGOPSSCRIBEBADVERSION');
});

test('AC5 — CHANGING THE CONTRACT CHANGES THE PACKAGE IDENTITY, by one byte', () => {
  const contract = loadContract();
  const validated = validateProposal({ proposal: goodProposal(), allowedRefs: ALLOWED });

  const base = buildPackageManifest({
    packId: 'a'.repeat(64), seedId: 'b'.repeat(64), contract, promptSha256: 'c'.repeat(64),
    storyQuestion: validated.storyQuestion, claims: validated.claims, segments: validated.segments,
  });

  // The same contract NAME with different BYTES. This is the failure a version label alone
  // cannot catch: a released contract edited in place would keep its name and silently start
  // producing packages that claim to be under the old one.
  const edited = { version: contract.version, id: sha256Hex(`${contract.text} `), text: `${contract.text} ` };
  const after = buildPackageManifest({
    packId: 'a'.repeat(64), seedId: 'b'.repeat(64), contract: edited, promptSha256: 'c'.repeat(64),
    storyQuestion: validated.storyQuestion, claims: validated.claims, segments: validated.segments,
  });

  assert.notEqual(contract.id, edited.id, 'a one-byte edit did not change the contract id');
  assert.notEqual(packageIdentity(base), packageIdentity(after),
    'editing the contract left the package identity unchanged — versioning would be cosmetic');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC7 — DETERMINISM WHERE DETERMINISM IS HONEST.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC7 — the same pack and contract produce byte-identical prompt and derivation identity', () => {
  const contract = loadContract();
  const args = { contract, packId: 'a'.repeat(64), seedId: 'b'.repeat(64), angle: 'why', entries: ENTRIES };

  const p1 = buildPrompt(args);
  const p2 = buildPrompt({ ...args, entries: [...ENTRIES] });
  assert.equal(p1, p2, 'two assemblies of the same inputs produced different prompt bytes');

  const d = (prompt) => derivationIdentity({
    packId: 'a'.repeat(64), contractId: contract.id, promptSha256: promptIdentity(prompt),
    derivationRuleVersion: SCRIBE_DERIVATION_RULE_VERSION, scribeVersion: SCRIBE_VERSION,
  });
  assert.equal(d(p1), d(p2));
  assert.match(d(p1), /^[0-9a-f]{64}$/);
});

test('AC7 — the prompt carries no clock, and a different contract changes the derivation', () => {
  const contract = loadContract();
  const prompt = buildPrompt({ contract, packId: 'a'.repeat(64), seedId: 'b'.repeat(64), entries: ENTRIES });

  // Today's date must not appear anywhere in the prompt. A prompt that quietly carried the
  // current date would make derivation_id change daily while claiming the question was the same.
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(!prompt.includes(today), 'the prompt contains today\'s date');

  const same = derivationIdentity({
    packId: 'a'.repeat(64), contractId: contract.id, promptSha256: promptIdentity(prompt),
    derivationRuleVersion: SCRIBE_DERIVATION_RULE_VERSION, scribeVersion: SCRIBE_VERSION,
  });
  const other = derivationIdentity({
    packId: 'a'.repeat(64), contractId: sha256Hex('a different contract'),
    promptSha256: promptIdentity(prompt),
    derivationRuleVersion: SCRIBE_DERIVATION_RULE_VERSION, scribeVersion: SCRIBE_VERSION,
  });
  assert.notEqual(same, other, 'the derivation identity ignores which contract asked the question');
});

test('AC7 — the prompt lists every citable ref, and the stub consumes it through the seam', async () => {
  const contract = loadContract();
  const prompt = buildPrompt({ contract, packId: 'a'.repeat(64), seedId: 'b'.repeat(64), entries: ENTRIES });
  for (const e of ENTRIES) assert.ok(prompt.includes(e.source_ref), `${e.source_ref} is not citable`);

  // The stub reads the ref list out of the prompt rather than being handed the rows. If
  // buildPrompt ever stopped listing them, this fails — which is the whole reason it parses.
  const stub = stubModelClient();
  const parsed = parseProposal(await stub.draft(prompt));
  const validated = validateProposal({ proposal: parsed, allowedRefs: ALLOWED });
  assert.ok(validated.claims.length >= 2);
  assert.deepEqual(
    [...new Set(validated.segments.map((s) => s.sibling))].sort(),
    [...SCRIBE_SIBLINGS].sort(),
    'the stub did not produce all four siblings',
  );

  // Deterministic: the same prompt gives the same bytes.
  assert.equal(JSON.stringify(composeStubProposal(prompt)), JSON.stringify(composeStubProposal(prompt)));
});

test('AC7 — a prompt with no citable-ref block is a defect the stub REFUSES rather than works around', () => {
  assert.throws(() => composeStubProposal('a prompt with no ref block'),
    (err) => err.code === 'EVLOGOPSSCRIBESTUBPROMPT');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC3 / AC4 — THE REFUSAL LAYER. The database refuses these too; this layer refuses them
// FIRST, by name, before a transaction is opened.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC3 — a good proposal validates, and every segment resolves to its master and the pack', () => {
  const v = validateProposal({ proposal: goodProposal(), allowedRefs: ALLOWED });
  const byId = new Map(v.claims.map((c) => [c.claim_id, c]));
  assert.ok(byId.has('story-question'), 'the story question is not stored as a citable master claim');
  for (const s of v.segments) {
    assert.ok(byId.has(s.claim_id), `${s.sibling}[${s.ordinal}] adapts an unknown claim`);
    assert.ok(ALLOWED.has(s.source_ref), `${s.sibling}[${s.ordinal}] cites outside the pack`);
    assert.ok(byId.get(s.claim_id).citations.includes(s.source_ref),
      `${s.sibling}[${s.ordinal}] cites evidence its master does not hold`);
  }
});

test('AC3 — a sibling segment that cites NOTHING is refused', () => {
  const err = validateThrows((p) => { delete p.siblings.blog[0].cite; });
  assert.equal(err.code, 'EVLOGOPSSCRIBEUNCITED');
  assert.match(err.message, /nothing written/);
});

test('AC3 — a citation to an entry NOT IN THE PACK is refused as fabricated', () => {
  const err = validateThrows((p) => { p.siblings.blog[0].cite = 'file:Deliverables/invented.md'; });
  assert.equal(err.code, 'EVLOGOPSSCRIBEUNKNOWNCITATION');
  assert.match(err.message, /invented\.md/, 'the refusal does not name the offending reference');
});

test('AC3 — a MASTER claim that cites nothing is refused, and it takes its siblings with it', () => {
  const err = validateThrows((p) => { p.beats[0].citations = []; });

  // Two codes fire, and the cascade is the correct behaviour rather than noise: beat-1 now
  // rests on nothing (UNCITED), and every sibling segment that was adapting beat-1 is now
  // citing evidence its master does not hold (DRIFT). The thrown error takes the most severe
  // code and carries them all, which is why the assertion is on `codes` rather than on `code`.
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEUNCITED'), `expected an UNCITED problem, got ${err.codes}`);
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEDRIFT'), 'orphaning a master left its siblings standing');
  assert.match(err.message, /beat-1/);
});

test('AC4 — a sibling adapting a claim THE MASTER DOES NOT MAKE is refused as drift', () => {
  const err = validateThrows((p) => { p.siblings.script[0].claim = 'beat-99'; });
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT');
  assert.match(err.message, /not a claim the master makes/);
});

test('AC4 — a sibling bringing its OWN evidence, real but unused by its master, is refused', () => {
  // The subtle one, and the one a naive citation check passes: `git-commit:abc123` IS a real
  // entry of this pack, and the citation resolves. It is still drift, because beat-1 does not
  // rest on it — this is how a blog quietly acquires a claim the video never made.
  const err = validateThrows((p) => { p.siblings.script[0].cite = 'git-commit:abc123'; });
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT');
  assert.match(err.message, /may not bring its own evidence/);
});

test('AC4 — a sibling with NO master at all is refused', () => {
  const err = validateThrows((p) => { delete p.siblings.titles[0].claim; });
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT');
  assert.match(err.message, /adaptation OF something/);
});

test('AC2 — a package missing any of the four siblings is refused', () => {
  for (const sibling of SCRIBE_SIBLINGS) {
    const err = validateThrows((p) => { delete p.siblings[sibling]; });
    assert.equal(err.code, 'EVLOGOPSSCRIBEINCOMPLETE', `a package without "${sibling}" was accepted`);
    assert.match(err.message, new RegExp(sibling));
  }
});

test('AC2 — a proposal with no master spine at all is refused, and every sibling falls with it', () => {
  const err = validateThrows((p) => { p.beats = []; });
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEINCOMPLETE'), `expected INCOMPLETE, got ${err.codes}`);
  assert.match(err.message, /no spine is not a master/);
  // Deleting the master does not leave three siblings quietly standing on their own.
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEDRIFT'), 'siblings survived the deletion of the entire master');
});

test('every problem is reported together, not one round trip at a time', () => {
  const err = validateThrows((p) => {
    p.siblings.blog[0].cite = 'file:Deliverables/invented.md';
    p.siblings.script[0].claim = 'beat-99';
    p.beats[1].citations = [];
  });
  assert.ok(err.problems.length >= 3, `expected several problems, got ${err.problems.length}`);
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT', 'the most severe code did not win');
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEUNKNOWNCITATION'));
  assert.ok(err.codes.includes('EVLOGOPSSCRIBEUNCITED'));
});

test('a model that DECLINES is a correct outcome, not a crash', () => {
  assert.throws(() => parseProposal('{"refusal":"the pack does not support a story"}'), (err) => {
    assert.equal(err.code, 'EVLOGOPSSCRIBEREFUSED');
    assert.match(err.refusal, /does not support a story/);
    return true;
  });
});

test('unparseable model output is refused rather than repaired', () => {
  assert.throws(() => parseProposal('here is your story, mate'), (e) => e.code === 'EVLOGOPSSCRIBEUNPARSEABLE');
  assert.throws(() => parseProposal(''), (e) => e.code === 'EVLOGOPSSCRIBEUNPARSEABLE');
  assert.throws(() => parseProposal('[1,2,3]'), (e) => e.code === 'EVLOGOPSSCRIBEUNPARSEABLE');
  // A fenced object is tolerated — models do this even when told not to.
  assert.equal(parseProposal('```json\n{"a":1}\n```').a, 1);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The projection — a sibling IS its rows, and the render is deterministic.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC2 — a sibling renders as a pure projection of its cited rows', () => {
  const v = validateProposal({ proposal: goodProposal(), allowedRefs: ALLOWED });
  const ordinalByRef = new Map(ENTRIES.map((e) => [e.source_ref, e.ordinal]));

  const once = renderSibling({ sibling: 'blog', segments: v.segments, ordinalByRef });
  const twice = renderSibling({ sibling: 'blog', segments: [...v.segments].reverse(), ordinalByRef });
  assert.equal(once, twice, 'the projection depends on the order rows arrived in');
  assert.match(once, /Paragraph one\./);
  assert.match(once, /evidence: \[E1 · git-commit:abc123\]/, 'the projection lost its citation');
  assert.match(once, /derived from `beat-2`/, 'the projection lost its master');
});

test('AC2 — A SIBLING CANNOT SURVIVE ITS MASTER: remove the beat, the sibling is refused', () => {
  // This is what "changing the master changes the siblings" means in a store where nothing is
  // edited in place. A sibling is not a document that happens to agree with the master; it is
  // bound to it, and a master that no longer makes the claim takes the sibling with it.
  //
  // Two independent bindings, each proven by breaking it:

  // 1. Remove the master claim entirely. The blog paragraph that adapted it cannot be stored.
  const gone = goodProposal();
  gone.beats = gone.beats.filter((b) => b.id !== 'beat-2');
  let err = null;
  try { validateProposal({ proposal: gone, allowedRefs: ALLOWED }); } catch (e) { err = e; }
  assert.ok(err, 'a sibling outlived the master claim it adapts');
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT');
  assert.match(err.message, /beat-2/);

  // 2. Keep the master, but change WHAT IT RESTS ON. The sibling's evidence is no longer its
  // master's evidence, and it cannot be stored either — even though that evidence is real and
  // in the pack.
  const moved = goodProposal();
  moved.beats[1].citations = ['file:Deliverables/one.md'];
  err = null;
  try { validateProposal({ proposal: moved, allowedRefs: ALLOWED }); } catch (e) { err = e; }
  assert.ok(err, 'a sibling kept evidence its master had stopped resting on');
  assert.equal(err.code, 'EVLOGOPSSCRIBEDRIFT');

  // 3. And a master whose words change produces a different package, so the two are never
  // confusable in the store.
  const contract = loadContract();
  const manifestOf = (v) => buildPackageManifest({
    packId: 'a'.repeat(64), seedId: 'b'.repeat(64), contract, promptSha256: 'c'.repeat(64),
    storyQuestion: v.storyQuestion, claims: v.claims, segments: v.segments,
  });
  const before = validateProposal({ proposal: goodProposal(), allowedRefs: ALLOWED });
  const reworded = goodProposal();
  reworded.beats[1].text = 'Then something entirely different happened.';
  const after = validateProposal({ proposal: reworded, allowedRefs: ALLOWED });
  assert.notEqual(packageIdentity(manifestOf(before)), packageIdentity(manifestOf(after)),
    'a changed master left the package identity unchanged');
});

test('the committed sample, if present, is labelled as stub output rather than as voice', () => {
  // A committed sample is the one artefact a human reads without running anything, so the
  // labelling is load-bearing. This proof is what stops a future sample being committed
  // without that disclosure.
  const serviceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const dir = path.join(serviceRoot, 'samples');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length > 0, 'a samples directory exists with no readable sample in it');
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(text, /stub/i, `${f} does not disclose that it is stub-model output`);
    assert.ok(!/Warwick's voice(?!\?)/.test(text) || /NOT .*Warwick's voice/i.test(text),
      `${f} claims to be Warwick's voice`);
  }
});
