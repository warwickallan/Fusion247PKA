// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/tools.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC1/AC2: the `request_crop` tool
// definition Terra is offered on /v1/responses so it can ask for a closer
// look at a specific region, instead of the application deciding after the
// fact from output it can only partially see (the architecture this
// prototype tests - see Deliverables/2026-08-12-gateway-capability-audit-
// and-agentic-loop-design.md).
//
// SHAPE CONFIRMED BY REAL EXECUTION, not invented: this is the EXACT object
// toolcall2.mjs sent to /v1/responses and that produced a genuine tool call
// (`finish_reason`-equivalent `type:"function_call"`, `name:"request_crop"`,
// `arguments:{"region":"3"}`) - see Deliverables/2026-08-12-capability-probe-
// evidence/toolcall2.mjs and toolcall2-results.json's `responses_api.output`.
//
// PURE data, no I/O, no dependency on anything else in this directory.
// =====================================================================

// This package is ESM (`"type": "module"` in pipeline/package.json) - export/import, not require/module.exports.

/**
 * The Responses-API tool shape is FLAT (`{type, name, description,
 * parameters}`), unlike /v1/chat/completions' nested `{type:'function',
 * function:{name,...}}` - confirmed by toolcall2.mjs sending exactly this
 * flat shape successfully to /v1/responses.
 */
export const REQUEST_CROP_TOOL = Object.freeze({
  type: 'function',
  name: 'request_crop',
  description: 'Request a higher-resolution crop of a named region of the source photograph so it can be re-inspected. Call this whenever you are not confident you have correctly and completely read everything in a region.',
  parameters: {
    type: 'object',
    properties: {
      region: {
        type: 'string',
        description: 'The region number to crop, as one of the numbers listed under AVAILABLE IMAGE REGIONS (e.g. "3").',
      },
    },
    required: ['region'],
  },
});
