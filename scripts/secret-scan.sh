#!/usr/bin/env bash
#
# secret-scan.sh — zero-dependency secret scanner.
#
# Security finding F-02 (wp0-security-gate.md §6 hard-stop): a secret-scanning
# control must actually run in CI and locally. This script is that control.
#
# Portable: bash + git + grep (+ find, in --surface mode) only. No network, no
# external tools, no deps.
#
# =============================================================================
# TWO MODES
# =============================================================================
#
#   secret-scan.sh
#       DEFAULT MODE. Scans every TRACKED file of whatever git repository the
#       current directory sits in. This is the invocation CI, the pre-commit
#       hook, three `npm run scan` scripts and services/tower-baton's scanner
#       all use, so its DETECTION behaviour is frozen — same patterns, same
#       exclusions, same output for every file it reads. What is NOT frozen is
#       its honesty: see the two corrected false-pass paths at the bottom of
#       this file.
#
#   secret-scan.sh --surface <path> [<path> ...]
#       SURFACE MODE. Scans exactly the named ground, enumerated from the
#       FILESYSTEM — no git, so it works on a surface that is not a repository at
#       all. Use this before handback when your work is not "the tracked files of
#       this repo".
#
# =============================================================================
# WHY SURFACE MODE EXISTS — the defect it closes
# =============================================================================
#
# Default mode builds its file list from `git ls-files` rooted at
# `git rev-parse --show-toplevel`. Its coverage is therefore "tracked files of
# the repo I happen to be standing in" — which is NOT the same thing as "the
# work I am about to hand back".
#
# A Work Order may legitimately declare a file surface outside any repository.
# Running default mode against that work does one of two things, both wrong:
#   - it dies, because there is no repository; or
#   - it is run from some unrelated repo, cheerfully scans a thousand files that
#     are not the deliverable, and exits 0 "clean".
#
# The second is the dangerous one. The worker reports that green honestly, and a
# control that looked nowhere near the work has been recorded as assurance. An
# absent control invites caution; a lying one invites confidence.
#
# Surface mode's contract is therefore the negative one:
#
#   ** IT MUST NOT BE POSSIBLE TO GET A PASS FOR GROUND THAT WAS NOT SCANNED. **
#
# Everything below that looks paranoid — refusing symlinks, refusing an empty
# target, refusing when grep could not read a file — is that contract. When the
# tool cannot honestly say "I read every byte of this", it says NOT SCANNED and
# exits non-zero. It never degrades to a pass, and it never skips silently.
#
# =============================================================================
# EXIT CODES  (both modes use all three)
# =============================================================================
#
#   0  SCANNED and clean   — the ground was read in full, nothing matched.
#   1  FOUND               — a secret-shaped value was found. Hits are printed.
#   2  NOT SCANNED         — the ground could not be read in full, or the
#                            invocation was malformed. This is NOT a pass and it
#                            is NOT a secret finding; it means the control did
#                            not run over what you asked about. Never treat it
#                            as either of the other two.
#
# "scanned and clean" and "not scanned" are deliberately impossible to confuse:
# different exit codes, and different leading words in the output ("SCANNED"
# versus "NOT SCANNED").
#
# =============================================================================
# EXCLUSIONS
# =============================================================================
#
# DEFAULT MODE (deliberate, to avoid self-match / false positives on docs):
#   - .env.example        (names-only template, tracked on purpose)
#   - *.md                (docs reference secret NAMES / pattern shapes)
#   - scripts/secret-scan.sh  (this file — it literally contains the patterns)
#
# SURFACE MODE excludes exactly ONE thing: this script itself, when it happens
# to live inside the surface you named (it carries the patterns, so it would
# always self-match). That exclusion is PRINTED when it fires. Nothing else is
# excluded — not .md, not .env.example, not binaries. On a declared work
# surface a pasted secret in a note is exactly the thing you need caught, so
# surface mode scans every regular file as text (grep -a).
#
# The patterns match VALUES: a token/JWT/key body, not "TELEGRAM_BOT_TOKEN".
#
set -euo pipefail

# --- secret VALUE patterns (POSIX ERE; [[:space:]] for portability) ----------
# The detection classes, as three parallel arrays: NAME, PATTERN, ALLOWLIST.
#
# The FIRST SIX are the canonical set. Default mode uses exactly those six and
# nothing else — see the PATTERNS array built from them below. Their strings,
# their order and their allowlist are frozen.
#
# Classes 7+ are CONTENT-CLASS detection and apply in --surface mode ONLY.
# That split is not stylistic, it is measured: run against this repository's
# 1612 tracked files, the connection-string, sk- and bare-Telegram classes
# produce 11 hits in legitimate committed test fixtures. Putting them in default
# mode would turn CI red on day one, and a control that red-lights the repo on
# day one gets switched off — which is a worse outcome than the gap it closes.
# A declared private surface is a tiny fraction of a repo, so the same patterns
# are affordable there.
declare -a CLASS_NAMES=() CLASS_PATTERNS=() CLASS_ALLOW=()
add_class() { CLASS_NAMES+=("$1"); CLASS_PATTERNS+=("$2"); CLASS_ALLOW+=("${3:-}"); }

# --- 1-6: canonical, used by BOTH modes. FROZEN. ----------------------------
# The allowlist on class 6 drops matches whose quoted VALUE is itself a bare
# SCREAMING_CASE identifier (config maps of env-var NAMES, e.g.
# SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY'). A real secret value
# always carries lowercase / digits / slashes, so it cannot hide one. The five
# strong value patterns are NOT subject to any filter.
add_class 'telegram-bot-token'      '[0-9]{6,}:AA[A-Za-z0-9_-]{30,}'
add_class 'jwt'                     'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.'
add_class 'stripe-live-key'         '(sk|pk)_live_[A-Za-z0-9]{10,}'
add_class 'aws-access-key-id'       'AKIA[0-9A-Z]{16}'
add_class 'pem-private-key-block'   '-----BEGIN [A-Z ]*PRIVATE KEY-----'
add_class 'secret-assigned-to-sensitive-name' \
  "(SERVICE_ROLE_KEY|SECRET|TOKEN|PASSWORD)[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9/+_-]{20,}['\"]" \
  "(SERVICE_ROLE_KEY|SECRET|TOKEN|PASSWORD)[[:space:]]*[:=][[:space:]]*['\"][A-Z_]{20,}['\"]"

CANONICAL_CLASS_COUNT=${#CLASS_NAMES[@]}

# --- 7+: CONTENT CLASSES — --surface mode only ------------------------------
# GL-012 §2's forbidden list is half filename-shaped and half CONTENT-shaped
# ("connection strings containing credentials", "credential stores, keychain
# entries, and exported sessions"). Filenames are handled by filename_denied()
# below; everything here is the content half, for which this scanner is the sole
# mechanical control rather than defence-in-depth.

# Connection string carrying an embedded credential: scheme://user:secret@host.
# The allowlist removes obvious non-secrets — template interpolations and the
# standard throwaway values. MEASURED: 17 hits across this repo before the
# allowlist, 5 after; the 12 removed were `postgres:postgres@localhost` CI
# services and `${VAR}` interpolations. The trade is stated in the coverage
# output: a real password whose literal value is one of these words is missed.
add_class 'connection-string-with-credentials' \
  '(postgres|postgresql|mysql|mariadb|mongodb|mongodb\+srv|redis|rediss|amqp|amqps|ftp|ftps|sftp|ssh|smtp|smtps|mssql|clickhouse|nats|ldap|ldaps|https?)://[A-Za-z0-9._%+-]+:[^[:space:]/@"'"'"'<>]{6,}@' \
  ':(\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^>]*>|\{\{[^}]*\}\}|%[sd]|[Pp]ostgres|[Pp]assword|[Pp]asswd|[Pp]laceholder|[Cc]hangeme|change_me|[Ss]ecret|[Ee]xample|hunter2|[Rr]edacted|REDACTED|[Xx]+|\*+|your_password|yourpassword|[Dd]ummy|[Ff]ake|notreal|[Ss]ample|[Tt]est|testpass)@'

add_class 'jdbc-password'           'jdbc:[a-z]+://[^[:space:]]*[?&](password|pwd)=[^&[:space:]"'"'"']{4,}'

# Credential stores and exported sessions.
add_class 'aws-credentials-file-entry' \
  'aws_(secret_access_key|session_token)[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{40,}'
add_class 'credential-store-json-value' \
  '"(access_token|refresh_token|id_token|session_token|client_secret|api_key|apikey|secret_key|auth_token|private_key)"[[:space:]]*:[[:space:]]*"[^"]{20,}"' \
  '"[^"]*"[[:space:]]*:[[:space:]]*"(\$\{[^}]*\}|<[^>]*>|\{\{[^}]*\}\}|[A-Z_]{20,})"'
add_class 'netrc-credentials' \
  'machine[[:space:]]+[^[:space:]]+[[:space:]]+login[[:space:]]+[^[:space:]]+[[:space:]]+password[[:space:]]+[^[:space:]]+'
add_class 'htpasswd-hash'           '^[A-Za-z0-9_.-]+:\$(apr1|2[aby]|1|5|6)\$[^:[:space:]]{10,}$'
# The [[:space:]]* after the colon is load-bearing: a real Set-Cookie header has
# a space there, and without it this class silently matched nothing.
add_class 'session-cookie-value'    '[Ss]et-[Cc]ookie:[[:space:]]*[^[:space:]]*(session|sid|auth|token)[^;[:space:]]{20,}'

# Bearer / access tokens appearing as VALUES rather than as named variables.
add_class 'bearer-token-value'      '[Bb]earer[[:space:]]+[A-Za-z0-9._~+/=-]{30,}'
add_class 'basic-auth-header-value' '[Aa]uthorization[[:space:]]*[:=][[:space:]]*["'"'"']?[Bb]asic[[:space:]]+[A-Za-z0-9+/=]{16,}'

# Vendor token shapes. `openai-style-key`, `stripe-key-body` and
# `telegram-token-bare` are RECONCILED FROM services/tower-baton/scripts/secret-scan.sh,
# which carried stronger shape detection than the canonical set. They are taken
# verbatim rather than "improved": a first draft that added `-` to the sk- body
# matched ordinary hyphenated English ("Risk-Issue-Change-Decision-Register")
# and produced 234 false positives against this repo. tower-baton's form
# produces 3, all of them deliberate secret-shaped test fixtures.
add_class 'openai-style-key'        'sk-[A-Za-z0-9]{20,}'
add_class 'openai-project-key'      'sk-proj-[A-Za-z0-9_-]{20,}'
add_class 'stripe-key-body'         '(pk|sk)_[A-Za-z0-9]{20,}'
add_class 'telegram-token-bare'     '[0-9]{8,}:[A-Za-z0-9_-]{30,}'
add_class 'github-token'            'gh[pousr]_[A-Za-z0-9]{36}'
add_class 'github-fine-grained-pat' 'github_pat_[A-Za-z0-9_]{22,}'
add_class 'slack-token'             'xox[baprs]-[A-Za-z0-9-]{10,}'
add_class 'google-api-key'          'AIza[0-9A-Za-z_-]{35}'
add_class 'npm-token'               'npm_[A-Za-z0-9]{36}'
add_class 'gitlab-token'            'glpat-[A-Za-z0-9_-]{20,}'
add_class 'sendgrid-key'            'SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}'

# --- default mode's pattern set: the canonical six, unchanged ---------------
declare -a PATTERNS=("${CLASS_PATTERNS[@]:0:6}")
ALLOWLIST_RE="${CLASS_ALLOW[5]}"

# =============================================================================
# WHAT THIS CONTROL DOES NOT DETECT
# =============================================================================
# Printed on every --surface run, clean or not. A limitation that lives only in
# a document is a limitation that quietly disappears; this one travels attached
# to the green it qualifies.
declare -a NOT_DETECTED=(
  'a credential with NO recognisable shape held in an ordinarily-named variable (db_thing = "correct-horse-battery")'
  'a secret whose literal value is a common placeholder word — the direct, accepted cost of the connection-string allowlist'
  'secrets inside encrypted, compressed or encoded archives (.zip, .7z, .gz) — their content is opaque to a text scan'
  'a secret SPLIT or ASSEMBLED at runtime from fragments — the technique used by the test fixtures of this very scanner, so it is known to defeat it'
  'anything READ but never written — the structural gap in GL-012 section 6, which no scanner closes because a read leaves no artefact'
)

# =============================================================================
# CREDENTIAL-SHAPED FILENAMES — refused UNREAD
# =============================================================================
# GL-012 §3 requires this to be mechanical: membership of a fixed set, never an
# opinion about whether a file "looks sensitive". A denied file is reported by
# PATH ONLY and is never opened, never grepped, never quoted.
#
# Sets $DENY_RULE and returns 0 to deny; returns 1 to allow.
DENY_RULE=''
filename_denied() {
  local p="$1" base ext seg comp dirpart oldifs
  base="${p##*/}"

  # Template files are keys-only by construction and this repo tracks four of
  # them behind an explicit .gitignore negation. They are exempt from filename
  # REFUSAL but are still CONTENT-SCANNED, so a real value pasted into one is
  # still caught. This narrows GL-012 §2's literal `.env.*`; it is Larry's
  # recorded ruling of 2026-07-29, made so a keys-only template does not produce
  # a false refusal, and Warwick can overturn it by deleting this case block.
  case "$base" in
    .env.example|.env.sample|.env.template|env.example|env.sample|env.template) return 1 ;;
  esac

  # FD1 — any DIRECTORY component beginning ".env". Catches a whole secrets
  # folder (".env keys/") whatever the leaf files inside it are called, and
  # catches direnv's .envrc.
  dirpart="${p%/*}"
  [ "$dirpart" = "$p" ] && dirpart=''
  oldifs="$IFS"; IFS='/'
  # shellcheck disable=SC2206
  local comps=($dirpart)
  IFS="$oldifs"
  for comp in ${comps+"${comps[@]}"}; do
    case "$comp" in
      .env*) DENY_RULE="path component '$comp' begins with '.env'"; return 0 ;;
    esac
  done

  # FD2 — exact credential-store basenames.
  case "$base" in
    id_rsa|id_dsa|id_ecdsa|id_ed25519|.pgpass|.netrc|_netrc|.npmrc|.pypirc|.git-credentials|.htpasswd|.dockercfg|credentials)
      DENY_RULE="credential-store filename '$base'"; return 0 ;;
  esac

  # FD3 — keystore / bundled-key extensions. NOTE: .pem/.key/.crt are
  # deliberately NOT here. GL-012 §2 forbids "certificates containing a private
  # key", which is a CONTENT condition; this repo tracks a public CA certificate
  # with no private key in it, and a filename rule would refuse a file that
  # carries no secret. The pem-private-key-block class is the correct control.
  ext="${base##*.}"
  case "$ext" in
    p12|pfx|jks|keystore|ppk|kdbx)
      DENY_RULE="key/keystore extension '.$ext'"; return 0 ;;
  esac

  # FD4 — an environment file REGARDLESS OF EXTENSION. Any dot-delimited segment
  # equal to "env" denies: `.env`, `.env.local`, `prod.env`, and critically
  # `shopper.env.txt` — a .txt file that is functionally an env file, which no
  # extension-based rule catches and which previously needed a judgement clause
  # to describe. Source-code extensions are excluded so a config-loader module
  # named env.js is not refused; a literal secret inside it is still caught by
  # the content classes.
  case "$ext" in
    js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|cs|php|sh|bash|c|h|cpp|hpp) ;;
    *)
      oldifs="$IFS"; IFS='.'
      # shellcheck disable=SC2206
      local segs=($base)
      IFS="$oldifs"
      for seg in ${segs+"${segs[@]}"}; do
        if [ "$seg" = "env" ]; then
          DENY_RULE="filename carries an 'env' segment ('$base') — an environment file regardless of extension"
          return 0
        fi
      done
      ;;
  esac

  return 1
}

usage() {
  cat <<'USAGE'
Usage:
  secret-scan.sh                            Scan every TRACKED file of the git
                                            repository containing the cwd.
  secret-scan.sh --surface <path> [<path>...]
                                            Scan exactly the named files and/or
                                            directories, enumerated from the
                                            filesystem. Works outside git.
  secret-scan.sh --help                     This text.

Exit codes:
  0  SCANNED and clean
  1  FOUND a secret-shaped value
  2  NOT SCANNED (unscannable target, or malformed invocation) — never a pass

Bare paths are NOT accepted; a surface must be named with --surface so that a
mistyped flag can never be silently interpreted as "scan this instead".
USAGE
}

# not_scanned <reason...> — the single exit point for "the control did not run
# over what you asked about". Always exit 2, always say why, always on stderr as
# well as stdout so it survives being piped.
not_scanned() {
  echo "secret-scan: NOT SCANNED — $*" >&2
  exit 2
}

# ---------------------------------------------------------------------------
# SURFACE MODE
# ---------------------------------------------------------------------------
run_surface_mode() {
  [ "$#" -gt 0 ] || not_scanned "--surface requires at least one path."

  local -a TARGETS=("$@")
  local t
  for t in "${TARGETS[@]}"; do
    # A symlinked TARGET is refused rather than resolved: the surface you named
    # and the ground actually read would differ, which is the whole failure
    # class this mode exists to prevent.
    [ ! -L "$t" ] || not_scanned "target is a symlink, refusing to scan ground other than the one named: $t"
    [ -e "$t" ]   || not_scanned "target does not exist: $t"
    [ -r "$t" ]   || not_scanned "target is not readable: $t"
  done

  # Resolve this script's own identity so it can be excluded by inode (`-ef`),
  # not by how its path happens to be spelled.
  local self_dir self
  self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  self="$self_dir/$(basename "${BASH_SOURCE[0]}")"

  local errfile
  errfile="$(mktemp)"
  # Every path out of this function calls exit, so clean up on EXIT (not RETURN).
  # shellcheck disable=SC2064
  trap "rm -f '$errfile'" EXIT

  # --- enumerate regular files -----------------------------------------------
  local -a FILES=()
  local f self_excluded=0
  while IFS= read -r -d '' f; do
    if [ -e "$self" ] && [ "$f" -ef "$self" ]; then
      self_excluded=1
      continue
    fi
    FILES+=("$f")
  done < <(find "${TARGETS[@]}" -type f -print0 2>"$errfile")

  # A traversal error (permission denied on a subdirectory, vanished path) means
  # part of the surface was never visited. That is NOT SCANNED, not a pass.
  if [ -s "$errfile" ]; then
    echo "secret-scan: find reported errors while enumerating the surface:" >&2
    cat "$errfile" >&2
    not_scanned "the surface could not be enumerated in full."
  fi

  # --- enumerate everything that is NOT a regular file and NOT a directory ----
  # Symlinks, fifos, sockets, devices. find does not descend into symlinked
  # directories, so their contents would be silently absent from the scan.
  local -a UNREADABLE_KINDS=()
  while IFS= read -r -d '' f; do
    UNREADABLE_KINDS+=("$f")
  done < <(find "${TARGETS[@]}" ! -type f ! -type d -print0 2>"$errfile")

  if [ -s "$errfile" ]; then
    echo "secret-scan: find reported errors while enumerating the surface:" >&2
    cat "$errfile" >&2
    not_scanned "the surface could not be enumerated in full."
  fi

  if [ "${#UNREADABLE_KINDS[@]}" -gt 0 ]; then
    echo "secret-scan: these entries are not regular files and were NOT read:" >&2
    printf '  %s\n' "${UNREADABLE_KINDS[@]}" >&2
    not_scanned "${#UNREADABLE_KINDS[@]} non-regular entr(ies) in the surface (symlink/fifo/socket/device). Their contents are unknown to this scan."
  fi

  # --- credential-shaped FILENAMES: partitioned out and never opened ----------
  # These are refused on sight. They are removed from the scan list BEFORE any
  # grep runs, so the scanner never reads a file whose name already says it
  # carries credentials — and therefore can never echo one.
  local -a DENIED=() DENIED_RULES=() SCANLIST=()
  for f in ${FILES+"${FILES[@]}"}; do
    if filename_denied "$f"; then
      DENIED+=("$f")
      DENIED_RULES+=("$DENY_RULE")
    else
      SCANLIST+=("$f")
    fi
  done

  if [ "${#SCANLIST[@]}" -eq 0 ] && [ "${#DENIED[@]}" -eq 0 ]; then
    if [ "$self_excluded" -eq 1 ]; then
      not_scanned "the surface contains no scannable file (only this scanner itself, which is excluded)."
    fi
    not_scanned "the surface contains no regular files: ${TARGETS[*]}"
  fi

  # --- scan, one class at a time ----------------------------------------------
  # Per class rather than one combined grep, because the class NAME is what gets
  # reported. The matched TEXT is never printed: this output is read by a worker
  # and pasted into a return message, and GL-012 §6 makes the return the one
  # channel no scanner examines. A control pointed at a private surface must not
  # itself become the thing that copies the secret out of it.
  local -a HITS=()
  local i cname cpat callow hitfile lineno worst=0

  # PASS 1 — one combined grep over the whole scan list, listing only the FILES
  # that match anything. This is the only full traversal: a naive per-class loop
  # means one full pass per class, which on a large surface (node_modules and
  # all) does not finish in a useful time. A file matching any class must appear
  # here, so narrowing to these candidates before the per-class work below is
  # exact, not an approximation.
  local -a ALL_ARGS=()
  for ((i = 0; i < ${#CLASS_NAMES[@]}; i++)); do ALL_ARGS+=(-e "${CLASS_PATTERNS[$i]}"); done

  local candidates
  set +e
  # -a (not -I): every regular file is read as text, so a key embedded in a file
  # grep would classify as binary is not an invisible gap.
  candidates="$(grep -a -l -E "${ALL_ARGS[@]}" -- "${SCANLIST[@]}" 2>>"$errfile" | tr -d '\000')"
  worst=$?
  set -e

  # PASS 2 — attribute each candidate to the class(es) it matched, on the small
  # candidate set only. The class NAME is what gets reported; the matched TEXT
  # never is.
  if [ -n "$candidates" ]; then
    local -a CANDS=()
    while IFS= read -r hitfile; do
      [ -n "$hitfile" ] && CANDS+=("$hitfile")
    done <<< "$candidates"

    # ONE process per candidate FILE. Attribution to a class is then done
    # in-shell against the matching lines. The obvious shapes here — a pipeline
    # per pair, or a grep per (class, file) — cost 26x this, which on Windows
    # MSYS measured 26 seconds for an 81-file surface in pure process spawn. A
    # control that is slow enough to be irritating is a control that gets
    # skipped.
    local raw st ln lncontent recognised attributed
    for hitfile in "${CANDS[@]}"; do
      set +e
      raw="$(grep -a -n -E "${ALL_ARGS[@]}" -- "$hitfile" 2>>"$errfile" | tr -d '\000')"
      st=$?
      set -e
      [ "$st" -ge 2 ] && worst=$st
      [ -n "$raw" ] || continue

      while IFS= read -r ln; do
        [ -n "$ln" ] || continue
        # grep -n on a SINGLE file emits "N:content". Take the number; the
        # content is inspected in memory to name the class and is never stored,
        # never printed, never returned.
        #
        # The content MUST be separated from the "N:" prefix before matching.
        # Testing the prefixed string breaks every anchored pattern — ^ no
        # longer sits at the start of the line — which silently misattributes
        # the htpasswd class. The fail-safe below caught exactly that during
        # development; the separation here is the actual fix.
        lineno="${ln%%:*}"
        lncontent="${ln#*:}"
        recognised=0; attributed=0
        for ((i = 0; i < ${#CLASS_NAMES[@]}; i++)); do
          cname="${CLASS_NAMES[$i]}"; cpat="${CLASS_PATTERNS[$i]}"; callow="${CLASS_ALLOW[$i]}"
          [[ "$lncontent" =~ $cpat ]] || continue
          recognised=1
          [ -n "$callow" ] && [[ "$lncontent" =~ $callow ]] && continue
          HITS+=("$hitfile:$lineno — [REDACTED] matched class: $cname")
          attributed=1
        done
        # FAIL-SAFE. grep has already decided this line matches something. If
        # bash's regex engine disagrees and attributes it to no class, the line
        # is still REPORTED, as unattributed — a dialect difference between the
        # two engines must never turn a grep hit into silence.
        if [ "$recognised" -eq 0 ]; then
          HITS+=("$hitfile:$lineno — [REDACTED] matched class: unattributed-match (grep matched, class attribution did not — treat as a hit)")
          attributed=1
        fi
        : "$attributed"
      done <<< "$raw"
      raw=''
    done
  fi

  # grep: 0 = matched, 1 = no match, >=2 = ERROR (a file could not be read).
  # An error means coverage is unknown. A real finding still outranks it — both
  # are non-zero, so neither can be mistaken for a pass.
  if [ "$worst" -ge 2 ]; then
    echo "secret-scan: grep reported errors while reading the surface:" >&2
    cat "$errfile" >&2
    if [ "${#HITS[@]}" -gt 0 ] || [ "${#DENIED[@]}" -gt 0 ]; then
      echo "secret-scan: FOUND credential material BEFORE the read failed — and the scan was also incomplete. Failing." >&2
      surface_coverage_report
      exit 1
    fi
    not_scanned "grep could not read part of the surface; coverage is unknown."
  fi

  if [ "${#DENIED[@]}" -gt 0 ] || [ "${#HITS[@]}" -gt 0 ]; then
    echo "secret-scan: FOUND credential material on the named surface:"
    echo "-----------------------------------------------------------------"
    for ((i = 0; i < ${#DENIED[@]}; i++)); do
      echo "${DENIED[$i]} — REFUSED UNREAD: ${DENIED_RULES[$i]}"
    done
    for ((i = 0; i < ${#HITS[@]}; i++)); do
      echo "${HITS[$i]}"
    done
    echo "-----------------------------------------------------------------"
    echo "secret-scan: ${#DENIED[@]} file(s) refused by name (never opened), ${#HITS[@]} content hit(s)."
    echo "secret-scan: values are REDACTED by design — this output is read into handback messages."
    surface_coverage_report
    echo "secret-scan: FOUND. Failing."
    exit 1
  fi

  if [ "$self_excluded" -eq 1 ]; then
    echo "secret-scan: excluded 1 file from the surface: this scanner itself ($self) — it carries the patterns."
  fi
  echo "secret-scan: surface = ${TARGETS[*]}"
  surface_coverage_report
  echo "secret-scan: SCANNED ${#SCANLIST[@]} file(s) of the named surface, 0 secret value(s) found."
  exit 0
}

# What was actually looked for, and what was not. Printed on EVERY --surface run,
# clean or not. GL-012 §5a will cite this control; the honest thing is for the
# control to carry its own account of its coverage rather than leave a reader to
# infer it from a green.
surface_coverage_report() {
  echo "secret-scan: CHECKED ${#CLASS_NAMES[@]} detection class(es) — ${CLASS_NAMES[*]}"
  echo "secret-scan: plus a credential-shaped FILENAME deny-list (refused unread); .env.example/.sample/.template are exempt from refusal but ARE content-scanned."
  echo "secret-scan: NOT DETECTED BY THIS CONTROL —"
  printf '  - %s\n' "${NOT_DETECTED[@]}"
}

# ---------------------------------------------------------------------------
# MODE DISPATCH
# ---------------------------------------------------------------------------
if [ "$#" -gt 0 ]; then
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --surface)
      shift
      run_surface_mode "$@"
      ;;
    *)
      echo "secret-scan: unrecognised argument: $1" >&2
      usage >&2
      not_scanned "malformed invocation; nothing was scanned."
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# DEFAULT MODE — repo-wide over tracked files.
#
# DETECTION is frozen: same patterns, same exclusions, same allowlist, same
# output for every file it reads. CI, the pre-commit hook and every
# `npm run scan` depend on that and it has not moved.
#
# What DID change (Larry's ruling, 2026-07-29: "correctness wins"): two paths
# that used to report a PASS over ground this mode never read now exit 2. They
# were the same defect the --surface mode above exists to kill, sitting inside
# the mode everyone actually runs.
#
#   1. An empty file list printed "no tracked files to scan — clean" and exited
#      0. Nothing scanned is not clean.
#   2. `grep ... || true` swallowed grep's exit status 2, so a file grep could
#      not open — or an exec that failed outright — was indistinguishable from
#      a file with no secrets in it.
# ---------------------------------------------------------------------------

# Always operate from the repository root so paths are stable regardless of cwd.
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# --- build the scan file list (tracked files, minus exclusions) --------------
# git ls-files writes to a temp file rather than a process substitution because
# a process substitution's exit status is UNOBSERVABLE: in
# `while read ... < <(git ls-files -z)` a git that dies part-way leaves a SHORT
# list and the scan then reports "clean" over files it never enumerated. Reading
# from a file lets the status be checked, and lets the count below carry a
# truthful reason for why nothing was scanned.
LSFILES="$(mktemp)"
GREPERR="$(mktemp)"
# shellcheck disable=SC2064
trap "rm -f '$LSFILES' '$GREPERR'" EXIT

if ! git ls-files -z > "$LSFILES"; then
  not_scanned "git ls-files failed; the tracked-file list could not be built."
fi

TRACKED=0
FILES=()
while IFS= read -r -d '' f; do
  TRACKED=$((TRACKED + 1))
  case "$f" in
    *.md) continue ;;
    .env.example|*/.env.example) continue ;;
    scripts/secret-scan.sh) continue ;;
  esac
  # Skip anything not present on disk (e.g. a staged deletion).
  [ -f "$f" ] || continue
  FILES+=("$f")
done < "$LSFILES"

if [ "${#FILES[@]}" -eq 0 ]; then
  if [ "$TRACKED" -eq 0 ]; then
    not_scanned "this repository has no tracked files; there was nothing to scan."
  fi
  not_scanned "all ${TRACKED} tracked file(s) were excluded or absent from disk; nothing was scanned."
fi

# --- run grep once with every pattern (-I skips binary files) ----------------
GREP_ARGS=()
for pat in "${PATTERNS[@]}"; do
  GREP_ARGS+=(-e "$pat")
done

# grep: 0 = matched, 1 = no match, >=2 = ERROR (a file could not be read, or the
# invocation itself failed). Capture the status instead of discarding it.
set +e
MATCHES="$(grep -I -n -H -E "${GREP_ARGS[@]}" -- "${FILES[@]}" 2>"$GREPERR")"
GREPSTATUS=$?
set -e

# Apply the SCREAMING_CASE allowlist (see ALLOWLIST_RE above).
if [ -n "$MATCHES" ]; then
  MATCHES="$(printf '%s\n' "$MATCHES" | grep -vE "$ALLOWLIST_RE" || true)"
fi

# A read error means coverage is unknown. A real finding still outranks it —
# both are non-zero, so neither can be mistaken for a pass.
if [ "$GREPSTATUS" -ge 2 ]; then
  echo "secret-scan: grep reported errors while reading tracked files:" >&2
  cat "$GREPERR" >&2
  if [ -n "$MATCHES" ]; then
    echo "secret-scan: FOUND potential secret value(s) BEFORE the read failed:" >&2
    echo "$MATCHES" >&2
    echo "secret-scan: FOUND — and the scan was also incomplete. Failing." >&2
    exit 1
  fi
  not_scanned "grep could not read part of the tracked file set; coverage is unknown."
fi

if [ -n "$MATCHES" ]; then
  echo "secret-scan: FOUND potential secret value(s):"
  echo "-----------------------------------------------------------------"
  echo "$MATCHES"
  echo "-----------------------------------------------------------------"
  COUNT="$(printf '%s\n' "$MATCHES" | grep -c '' || true)"
  echo "secret-scan: FOUND ${COUNT} hit(s) across ${#FILES[@]} scanned file(s). Failing."
  exit 1
fi

echo "secret-scan: clean — scanned ${#FILES[@]} tracked file(s), 0 secret value(s) found."
exit 0
