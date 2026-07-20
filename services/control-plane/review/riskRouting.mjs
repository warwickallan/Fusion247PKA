// BUILD-014 PR-2b — risk-routing = checkpoint_assurance computation (v3 Part B, correction #4).
//
// The WP is the BASELINE (003 ops.wp.baseline_*). The CHECKPOINT/diff computes the FINAL required
// reviewer ROLES: product_qa ALWAYS; adversarial when a risk trigger is touched; security where a
// security surface is touched; warwick_approval_required + auto_merge_eligible EXPLICIT (never
// inferred from green gates — that silent escalation is exactly what v3 forbids). A WP that began a
// harmless formatter and later gained an autonomous command / permission / credential / public
// endpoint / live-data write / persistent worker MUST be re-tiered from the ACTUAL diff surface —
// a low-risk WP classification can never be reused after the implementation touches a higher-risk
// surface.
//
// PURE + INJECTABLE: deriveDiffSurfaces + computeAssurance are pure so tests drive synthetic diffs;
// persistAssurance is the only DB writer. The routing is MODEL-AGNOSTIC — it computes required
// ROLES, never reviewer/model names (registryDispatch maps roles -> authorised reviewers).

export const RISK_POLICY_VERSION = 'risk-routing-v1';

// The risk-trigger vocabulary. Each maps a touched SURFACE to the roles it raises. A trigger is
// detected from the diff (changed file paths + added lines) OR supplied as a Warwick stress flag.
export const RISK_TRIGGERS = Object.freeze([
  'autonomous_command', // spawns/executes commands, gate-disabling flags, self-driving actions
  'permission',         // permission/allowlist/gate/policy/auth-scope changes
  'credential',         // secrets, tokens, api keys, .env, credential handling
  'public_endpoint',    // HTTP routes, listeners, webhooks, servers exposed to the outside
  'live_data',          // writes to live/hosted data, migrations applied, DATABASE_URL writes
  'persistent_worker',  // daemons, timers/cron, long-lived background workers
]);

// Surfaces that raise the ADVERSARIAL role (any of them). (All triggers, by design — any elevated
// surface deserves a cold-final adversarial pass.)
const ADVERSARIAL_SURFACES = new Set(RISK_TRIGGERS);
// Surfaces that raise the SECURITY role.
const SECURITY_SURFACES = new Set(['credential', 'public_endpoint', 'permission']);
// Surfaces that raise a mandatory WARWICK human gate (the high-consequence set).
const WARWICK_SURFACES = new Set(['autonomous_command', 'credential', 'live_data', 'persistent_worker']);

// Detection patterns over ADDED diff lines / changed file paths. First-party, conservative:
// intended to CATCH elevation (fail toward more review), not to be exhaustively adversarial.
const PATTERNS = Object.freeze({
  autonomous_command: [
    /child_process/i, /\bspawn(?:Sync)?\b/, /\bexec(?:Sync|File)?\b/, /taskkill/i,
    /dangerously-skip-permissions/i, /--yes\b/, /auto[-_]?merge/i, /\bshell\s*:\s*true\b/i,
  ],
  permission: [
    /allowedTools/i, /disallowedTools/i, /permission/i, /\bRLS\b/, /grant\s+(all|select|insert|update|delete)/i,
    /policyGate/i, /\bscopes?\b/i, /sandbox/i,
  ],
  credential: [
    /\.env\b/, /API_KEY/i, /SECRET/i, /TOKEN/i, /CREDENTIAL/i, /password/i, /HMAC/i, /private[_-]?key/i,
  ],
  public_endpoint: [
    /app\.(get|post|put|delete|use)\b/i, /express\(/i, /\.listen\(/, /createServer/i, /webhook/i,
    /fastify/i, /http\.Server/i, /router\.(get|post)/i,
  ],
  live_data: [
    /apply_migration/i, /DATABASE_URL/i, /supabase/i, /production/i, /\blive\b/i, /INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM/i,
  ],
  persistent_worker: [
    /setInterval/i, /setTimeout\([^,]+,\s*\d{5,}/, /\bcron\b/i, /daemon/i, /pm2/i, /systemd/i, /launchd/i, /while\s*\(\s*true\s*\)/,
  ],
});

/**
 * Derive the set of touched risk SURFACES from a diff. Pure. `changedFiles` is an array of paths;
 * `diffText` is the unified diff (only ADDED lines — starting '+', excluding '+++' headers — are
 * scanned, so pre-existing/removed code does not raise a trigger). Returns a sorted string[].
 */
export function deriveDiffSurfaces({ changedFiles = [], diffText = '' } = {}) {
  const surfaces = new Set();
  const addedLines = String(diffText ?? '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .join('\n');
  const pathBlob = (Array.isArray(changedFiles) ? changedFiles : []).join('\n');
  const hay = `${pathBlob}\n${addedLines}`;
  for (const trigger of RISK_TRIGGERS) {
    if (PATTERNS[trigger].some((re) => re.test(hay))) surfaces.add(trigger);
  }
  // Path-shaped signals the line patterns might miss.
  if (/\.env(\b|$)/im.test(pathBlob)) surfaces.add('credential');
  if (/migrations?\//i.test(pathBlob)) surfaces.add('live_data');
  return [...surfaces].sort();
}

/**
 * Compute the checkpoint assurance profile. Pure. Inputs:
 *   · wpBaseline — the 003 ops.wp baseline flags (baseline_* ...), nullable.
 *   · diffSurfaces — string[] of touched risk surfaces (from deriveDiffSurfaces).
 *   · warwickStressFlags — string[] of extra triggers Warwick attached to the checkpoint.
 *   · policyVersion — the risk policy version stamp.
 *
 * Output is the checkpoint_assurance row shape:
 *   { product_qa_required, adversarial_review_required, security_review_required,
 *     warwick_approval_required, auto_merge_eligible, triggers[], policy_version }
 *
 * Rules (fail toward MORE review):
 *   · product_qa ALWAYS required (the floor).
 *   · adversarial required if any adversarial surface OR wp baseline demands it.
 *   · security required if any security surface OR wp baseline demands it.
 *   · warwick required if any warwick surface OR wp baseline demands it.
 *   · auto_merge_eligible ALWAYS false here — EXPLICIT + conservative. It is NEVER inferred from a
 *     clean surface or green gates; policy/Warwick sets it true deliberately (and the DB CHECK
 *     forbids it alongside warwick_approval_required).
 */
export function computeAssurance({
  wpBaseline = null, diffSurfaces = [], warwickStressFlags = [], policyVersion = RISK_POLICY_VERSION,
} = {}) {
  const triggers = [...new Set([...(diffSurfaces ?? []), ...(warwickStressFlags ?? [])])]
    .filter((t) => typeof t === 'string' && t.length)
    .sort();

  const touched = new Set(triggers);
  const anyIn = (set) => [...touched].some((t) => set.has(t));

  const baseAdversarial = Boolean(wpBaseline?.baseline_adversarial_required);
  const baseSecurity = Boolean(wpBaseline?.baseline_security_review_required);
  const baseWarwick = Boolean(wpBaseline?.baseline_warwick_approval_required);

  return {
    product_qa_required: true,
    adversarial_review_required: baseAdversarial || anyIn(ADVERSARIAL_SURFACES),
    security_review_required: baseSecurity || anyIn(SECURITY_SURFACES),
    warwick_approval_required: baseWarwick || anyIn(WARWICK_SURFACES),
    auto_merge_eligible: false, // EXPLICIT — never inferred from green gates / a clean surface.
    triggers,
    policy_version: policyVersion,
  };
}

/**
 * Persist (or recompute in place) the checkpoint_assurance row. The PR-2a guard allows UPDATE of
 * every field except identity, so a re-run recomputes the profile for the same checkpoint.
 * Runs on a Pool or a pinned client. Returns the persisted profile.
 */
export async function persistAssurance(client, { checkpointId, buildId, profile }) {
  await client.query(
    `insert into ops.checkpoint_assurance
       (checkpoint_id, build_id, product_qa_required, adversarial_review_required,
        security_review_required, warwick_approval_required, auto_merge_eligible,
        triggers, policy_version, calculated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     on conflict (checkpoint_id) do update set
       product_qa_required = excluded.product_qa_required,
       adversarial_review_required = excluded.adversarial_review_required,
       security_review_required = excluded.security_review_required,
       warwick_approval_required = excluded.warwick_approval_required,
       auto_merge_eligible = excluded.auto_merge_eligible,
       triggers = excluded.triggers,
       policy_version = excluded.policy_version,
       calculated_at = now()`,
    [
      checkpointId, buildId,
      profile.product_qa_required, profile.adversarial_review_required,
      profile.security_review_required, profile.warwick_approval_required,
      profile.auto_merge_eligible, profile.triggers, profile.policy_version,
    ]);
  return profile;
}

/** The set of required ROLES from a computed profile (product_qa first). */
export function requiredRolesFromProfile(profile) {
  const roles = [];
  if (profile.product_qa_required) roles.push('product_qa');
  if (profile.adversarial_review_required) roles.push('adversarial_assurance');
  if (profile.security_review_required) roles.push('security_assurance');
  return roles;
}
