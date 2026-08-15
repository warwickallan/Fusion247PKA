// BUILD-006 Phase 3 — the DETERMINISTIC STUB. Not a model, and it never pretends to be one.
//
// ⛔ READ THIS BEFORE READING ANYTHING THIS PRODUCES ⛔
//
// This composes a structurally valid draft by mechanical rule. It has no language model behind
// it, it makes no creative judgement, and its prose is deliberately flat and repetitive so that
// nobody — reviewer, reader, or a future session skimming a sample file — can mistake its output
// for writing. It exists to exercise the CONTRACT, the SCHEMA, the DERIVATION and the CITATION
// ENFORCEMENT end to end without a gateway credential.
//
// A green suite over this stub proves the contract and the plumbing. IT PROVES NOTHING ABOUT
// WHETHER SCRIBE WRITES IN WARWICK'S VOICE. That is a creative judgement, it is Warwick's alone,
// and it happens at Phase 5.
//
// ── WHY IT PARSES THE PROMPT INSTEAD OF BEING HANDED THE ENTRIES ────────────────────────────
// It could have been constructed with the pack rows directly, and that would have been less
// code. It reads the prompt instead, through the same `draft(prompt) -> string` interface the
// gateway client implements, because that is the only way the stub exercises the thing that
// actually ships: if buildPrompt ever stopped listing the citable source_refs, a stub handed the
// rows out of band would carry on passing while the real seam went blind. This one fails.
//
// It is therefore a genuine consumer of the prompt contract, and its parser is deliberately
// strict — no repair, no fallback, no "well, there is probably a ref in here somewhere".

const REF_BLOCK_HEADER = 'The ONLY citable source_ref values are these, exactly as written:';

/** Pull the citable source_refs out of a prompt, in the order buildPrompt listed them. */
export function citableRefsFromPrompt(prompt) {
  const start = prompt.indexOf(REF_BLOCK_HEADER);
  if (start === -1) {
    const err = new Error(
      'vlogops scribe stub: the prompt carries no citable-source_ref block, so there is nothing '
      + 'a model could legally cite. This is a defect in the prompt, not in the stub.',
    );
    err.code = 'EVLOGOPSSCRIBESTUBPROMPT';
    throw err;
  }

  const refs = [];
  const lines = prompt.slice(start + REF_BLOCK_HEADER.length).split('\n');
  for (const line of lines) {
    if (line.startsWith('  ') && line.trim() !== '') {
      refs.push(line.trim());
      continue;
    }
    if (refs.length > 0) break;      // the block has ended
  }

  if (refs.length === 0) {
    const err = new Error('vlogops scribe stub: the prompt listed no citable source_refs');
    err.code = 'EVLOGOPSSCRIBESTUBPROMPT';
    throw err;
  }
  return refs;
}

/** A readable short label for a ref, for the stub's mechanical sentences. */
function label(ref) {
  const withoutScheme = ref.includes(':') ? ref.slice(ref.indexOf(':') + 1) : ref;
  const base = withoutScheme.split('/').pop() || withoutScheme;
  return base.length > 72 ? `${base.slice(0, 69)}...` : base;
}

/**
 * Compose a structurally valid proposal from the refs the prompt offered.
 *
 * Pure and total: same prompt in, same JSON out, in any process on any day. That is what makes
 * the whole Phase 3 chain reproducible end to end under the stub, which is the only honest way
 * to demonstrate AC7 — a real model's words are not reproducible and this code never implies
 * otherwise.
 */
export function composeStubProposal(prompt) {
  const refs = citableRefsFromPrompt(prompt);

  const beatRefs = refs.slice(0, Math.min(5, refs.length));
  const beats = beatRefs.map((ref, i) => ({
    id: `beat-${i + 1}`,
    text: `STUB BEAT ${i + 1}: the record at ${label(ref)} is one of the things that happened in this window.`,
    citations: [ref],
  }));

  const claims = [
    {
      id: 'claim-1',
      text: `STUB CLAIM: this window is carried by ${refs.length} pieces of frozen evidence, and every one of them is citable.`,
      citations: [refs[0]],
    },
    {
      id: 'claim-2',
      text: `STUB CLAIM: the last thing in the window is ${label(refs[refs.length - 1])}.`,
      citations: [refs[refs.length - 1]],
    },
  ];

  const seg = (role, claim, cite, text) => ({ role, claim, cite, text });

  return {
    story_question:
      `STUB QUESTION: what did these ${refs.length} pieces of evidence, from ${label(refs[0])} to `
      + `${label(refs[refs.length - 1])}, actually show?`,
    question_citations: [refs[0]],
    beats,
    claims,
    siblings: {
      script: beats.map((b, i) => seg(
        'scene', b.id, b.citations[0],
        `STUB SCENE ${i + 1} (spoken). ${b.text} This is mechanical placeholder narration produced `
        + 'without a language model, and it is not written in anybody\'s voice.',
      )),
      blog: beats.map((b, i) => seg(
        'paragraph', b.id, b.citations[0],
        `STUB PARAGRAPH ${i + 1} (written). ${b.text} The blog is a separate projection of the same `
        + 'master claim as the scene above it, which is the property this sample exists to show.',
      )),
      titles: beats.slice(0, Math.min(3, beats.length)).map((b, i) => seg(
        'title', b.id, b.citations[0],
        `STUB TITLE ${i + 1} — ${label(b.citations[0])}`,
      )),
      'thumbnail-direction': [
        seg(
          'direction', claims[0].id, claims[0].citations[0],
          'STUB THUMBNAIL DIRECTION: a frame showing the evidence count, with no face and no text overlay. '
          + 'Mechanical placeholder direction, not a creative decision.',
        ),
      ],
    },
  };
}

/**
 * A model client that satisfies the seam's interface exactly, and says what it is.
 *
 * `describe()` is stored on the package row, permanently, so a stub-drafted package announces
 * itself to every future reader without anybody having to remember which run was which.
 */
export function stubModelClient() {
  return {
    describe() {
      return {
        provider: 'stub',
        client: 'deterministic-stub-v1',
        model: null,
        configured: false,
        deterministic: true,
        warning: 'MECHANICAL PLACEHOLDER TEXT — no language model was called. Not Warwick\'s voice.',
      };
    },
    async draft(prompt) {
      return JSON.stringify(composeStubProposal(prompt));
    },
  };
}
