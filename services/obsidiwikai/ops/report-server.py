import hashlib
import hmac
import html
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from neo4j import GraphDatabase
import psycopg2

WS = os.environ.get('NEO4J_WORKSPACE', 'owai_rebuild_v1')
neo = GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USERNAME'], os.environ['NEO4J_PASSWORD']))


def _clean_dsn(url):
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, 'sslmode=require', ''))


PG = _clean_dsn(os.environ['DATABASE_URL'])
# Decision intents must use the request-only cp_directus role. Fail closed rather
# than silently falling back to the report's broader read connection.
PG_ACTION = _clean_dsn(os.environ['REPORT_ACTION_DATABASE_URL'])
LR = os.environ.get('LIGHTRAG_URL', 'http://lightrag-neo4j-prod:9621')
LRKEY = os.environ.get('LIGHTRAG_API_KEY', '')
GRAPH = os.environ.get('GRAPH_URL', 'http://100.101.240.85:8700')

DS = json.load(open('/data/rag_storage/kv_store_doc_status.json', encoding='utf-8'))
TC = json.load(open('/data/rag_storage/kv_store_text_chunks.json', encoding='utf-8'))
VID2DOC = {value.get('file_path'): key for key, value in DS.items() if value.get('file_path')}
ALIAS = {'MUN1eAlL0lc': 'graph-agents-MUN1e', 'pcR30j-sKxU': 'ai-memory-pcR30j'}
WHY = {}
ACTION_SECRET = os.environ.get('REPORT_ACTION_SECRET', secrets.token_urlsafe(32)).encode()
RATE = {}


def doc_for(video_id):
    return VID2DOC.get(video_id) or VID2DOC.get(ALIAS.get(video_id, ''))


def pgq(sql, args=()):
    connection = psycopg2.connect(PG)
    cursor = connection.cursor()
    cursor.execute(sql, args)
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return rows


def why_matters(video_id, concepts):
    if video_id in WHY:
        return WHY[video_id]
    try:
        query = ("In 2 plain sentences, why does this matter specifically for Warwick — who is building ObsidiWikAi, "
                 "an agent-native personal knowledge system for Fusion247? Focus on the shift or insight. Concepts: "
                 + ", ".join(concepts[:10]))
        request = urllib.request.Request(
            LR + '/query', data=json.dumps({'query': query, 'mode': 'mix', 'top_k': 8}).encode(),
            headers={'X-API-Key': LRKEY, 'Content-Type': 'application/json'},
        )
        response = json.load(urllib.request.urlopen(request, timeout=40))
        WHY[video_id] = (response.get('response') or '').strip()[:600]
    except Exception:
        WHY[video_id] = ''
    return WHY[video_id]


def source_data(video_id):
    document = doc_for(video_id)
    with neo.session() as session:
        rows = session.run(
            f"MATCH (n:{WS}) WHERE n.source_id CONTAINS $d "
            f"RETURN n.entity_id AS id, coalesce(n.description,'') AS desc, "
            f"size(split(coalesce(n.source_id,''),'<SEP>')) AS srcs",
            d=document,
        ).data() if document else []
    new = [row for row in rows if row['srcs'] == 1]
    connected = [row for row in rows if row['srcs'] > 1]
    top = sorted(rows, key=lambda row: -row['srcs'])[:14]
    evidence = None
    for row in top:
        with neo.session() as session:
            record = session.run(
                f"MATCH (n:{WS} {{entity_id:$i}}) RETURN n.source_id AS s", i=row['id'],
            ).single() or {}
            source_id = record.get('s', '')
        chunk = (source_id or '').split('<SEP>')[0].strip()
        candidate = TC.get(chunk, {})
        if candidate.get('content'):
            evidence = {'concept': row['id'], 'passage': candidate['content'].replace('\n', ' ')[:600]}
            break
    return {
        'total': len(rows), 'new': new, 'conn': connected, 'top': top, 'ev': evidence,
        'why': why_matters(video_id, [row['id'] for row in top]),
    }


def action_token(candidate_id, command):
    return hmac.new(ACTION_SECRET, f'{candidate_id}:{command}'.encode(), hashlib.sha256).hexdigest()


def valid_action_token(candidate_id, command, token):
    return hmac.compare_digest(action_token(candidate_id, command), str(token or ''))


def candidate_lifecycle(candidate_status, task_status=None, command=None, command_status=None):
    if candidate_status == 'declined':
        return 'dismissed'
    if candidate_status == 'deferred':
        return 'deferred'
    if candidate_status == 'accepted':
        if task_status == 'done':
            return 'completed'
        if task_status in ('open', 'in_progress'):
            return 'with Larry'
        return 'accepted'
    if command_status in ('requested', 'claimed'):
        return 'Accept queued' if command == 'accept' else 'Dismiss queued'
    return 'proposed'


def file_candidate_decision(candidate_id, command, token, requested_by='report:warwick'):
    if command not in ('accept', 'decline'):
        raise ValueError('unsupported candidate decision')
    try:
        candidate_id = str(uuid.UUID(str(candidate_id)))
    except ValueError as error:
        raise ValueError('invalid candidate id') from error
    if not valid_action_token(candidate_id, command, token):
        raise PermissionError('invalid action token')

    connection = psycopg2.connect(PG_ACTION)
    cursor = connection.cursor()
    try:
        cursor.execute(
            "select lc.source_video_id, lc.status, lc.updated_at, f.status "
            "from cockpit.learning_candidate lc "
            "left join cockpit.follow_on_task f on f.source_candidate_id=lc.id and f.origin='learning_accept' "
            "where lc.id=%s and lc.candidate_scope='system_improvement'",
            (candidate_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise LookupError('system-improvement candidate not found')
        video_id, _status, updated_at, task_status = row
        if task_status == 'done':
            raise ValueError('completed candidates are immutable from the report')
        key = f"report:{candidate_id}:{command}:{int(updated_at.timestamp())}"
        cursor.execute(
            "insert into cockpit.learning_command "
            "(requested_by, command, candidate_id, note, idempotency_key) "
            "values (%s,%s,%s,%s,%s) on conflict (idempotency_key) do nothing returning id",
            (requested_by, command, candidate_id,
             'Warwick decision from the source-level Make the Brain Better report', key),
        )
        command_id = cursor.fetchone()
        connection.commit()
        return {'video_id': video_id, 'command_id': command_id[0] if command_id else None, 'idempotent': command_id is None}
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def allow_request(address, limit=12, window=60):
    now = time.time()
    recent = [stamp for stamp in RATE.get(address, []) if now - stamp < window]
    if len(recent) >= limit:
        RATE[address] = recent
        return False
    recent.append(now)
    RATE[address] = recent
    return True


def origin_allowed(headers):
    origin = headers.get('Origin')
    if not origin:
        return True
    host = headers.get('Host', '')
    return urllib.parse.urlsplit(origin).netloc == host


CSS = """*{box-sizing:border-box}body{margin:0;background:#0e1016;color:#e7ecf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55}
@media(prefers-color-scheme:light){body{background:#f5f7fb;color:#1a2130}}
.w{max-width:760px;margin:0 auto;padding:20px 18px 80px}a{color:#8f8dff;text-decoration:none}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f8dff;font-weight:700}
h1{font-size:26px;margin:.2em 0 .5em;letter-spacing:-.02em;font-weight:800;text-wrap:balance}
.sec{background:#171b23;border:1px solid #262d39;border-radius:14px;padding:15px 17px;margin:12px 0}
@media(prefers-color-scheme:light){.sec{background:#fff;border-color:#e2e7f0}}
.sec h2{font-size:15px;margin:0 0 8px;display:flex;gap:8px;align-items:center}
.sec p{margin:.4em 0;font-size:15px}.mut{color:#93a0b4;font-size:13px}
.pill{display:inline-block;background:#222838;border:1px solid #313a4c;border-radius:999px;padding:3px 10px;margin:3px 4px 0 0;font-size:13px}
@media(prefers-color-scheme:light){.pill{background:#eef1f7;border-color:#dce2ee}}
.pill.new{border-color:#3fa06a;color:#7fd3a3}.pill.conn{border-color:#c78a3f;color:#e0b070}
.stat{display:flex;gap:16px;flex-wrap:wrap;margin:6px 0}.stat div{text-align:center}.stat b{display:block;font-size:24px;font-weight:800}.stat span{font-size:11px;color:#93a0b4;text-transform:uppercase;letter-spacing:.05em}
.why{background:#1c2030;border-left:3px solid #8f8dff;border-radius:0 10px 10px 0;padding:12px 14px;font-size:15.5px}
.sug{border-top:1px solid #262d39;padding:10px 0}.sug:first-child{border-top:none}.sug .k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#8f8dff}.sug .c{color:#93a0b4;font-size:12px}
.ev{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12.5px;color:#aeb8c8;background:#12151c;border-radius:9px;padding:10px 12px}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btns form{margin:0}.btns a,.btns button{display:inline-block;background:#222838;border:1px solid #313a4c;border-radius:10px;padding:10px 14px;min-height:44px;font:600 14px/1.4 inherit;color:#e7ecf4;cursor:pointer}.btns button:focus-visible,.btns a:focus-visible{outline:3px solid #8f8dff;outline-offset:2px}
.brain-card{border-top:1px solid #313a4c;padding:14px 0}.brain-card:first-of-type{border-top:none}.brain-card h3{font-size:16px;margin:4px 0}.brain-card dl{margin:8px 0}.brain-card dt{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#93a0b4;font-weight:700}.brain-card dd{margin:1px 0 8px}.life{font-size:12px;font-weight:700;color:#7fd3a3}.ref{font-family:ui-monospace,monospace;font-size:12px;color:#93a0b4}
.card{display:block;background:#171b23;border:1px solid #262d39;border-radius:13px;padding:13px 15px;margin:9px 0}
@media(prefers-color-scheme:light){.card{background:#fff;border-color:#e2e7f0}.why{background:#eef}.ev{background:#f0f2f7;color:#3a465a}.btns a,.btns button{background:#eef1f7;border-color:#dce2ee;color:#1a2130}}
.card .t{font-weight:700;font-size:15px}.badge{float:right;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#16281f;color:#6ccf9c}"""


def page(title, body):
    return ("<!doctype html><html lang='en'><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            f"<title>{html.escape(title)}</title><style>{CSS}</style><body><main class=w>{body}</main></body></html>")


def dashboard():
    with neo.session() as session:
        total = session.run(f"MATCH (n:{WS}) RETURN count(n) AS c").single()['c']
        cross = session.run(f"MATCH (n:{WS}) WHERE size(split(coalesce(n.source_id,''),'<SEP>'))>1 RETURN count(n) AS c").single()['c']
    sources = pgq("select y.video_id, y.title, y.channel, c.state from cockpit.youtube_source y "
                  "left join obsidiwikai.compile_job c on c.source_id=y.video_id order by y.captured_at desc")
    suggestions = pgq("select proposed_target, recommendation, confidence from cockpit.learning_candidate "
                      "where status='pending' and candidate_scope='warwick_opportunity' "
                      "order by confidence desc nulls last limit 4")
    body = "<div class=eyebrow>Fusion247 · myPKA</div><h1>Your brain</h1>"
    body += (f"<div class=sec><div class=stat><div><b>{total}</b><span>concepts</span></div>"
             f"<div><b>{cross}</b><span>cross-source links</span></div>"
             f"<div><b>{len([source for source in sources if source[3] == 'done'])}</b><span>sources learned</span></div></div></div>")
    if suggestions:
        body += "<div class=sec><h2>💡 Worth your attention</h2>"
        for target, recommendation, confidence in suggestions:
            body += f"<div class=sug><span class=k>{html.escape(target or '')}</span> · <span class=c>conf {confidence or '—'}</span><p>{html.escape(recommendation or '')}</p></div>"
        body += "</div>"
    body += "<div class=sec><h2>📥 Sources — tap for the so-what</h2>"
    for video_id, title, channel, state in sources:
        badge = "<span class=badge>learned</span>" if state == 'done' else ""
        body += f"<a class=card href='/s/{urllib.parse.quote(video_id)}'><span class=t>{html.escape(title or video_id)}</span>{badge}<div class=mut>{html.escape(channel or '')}</div></a>"
    body += "</div>"
    body += f"<div class=sec><h2>🕸️ Explore the whole graph</h2><p><a href='{html.escape(GRAPH)}'>Open the interactive map →</a></p></div>"
    return page("Your brain", body)


def source_candidates(video_id):
    return pgq(
        "select lc.id::text, lc.candidate_ref, lc.recommendation, lc.why, lc.evidence, "
        "lc.proposed_target, lc.expected_effect, lc.confidence, lc.risk, lc.candidate_kind, "
        "lc.next_step, lc.status, f.id::text, f.status, cmd.command, cmd.status "
        "from cockpit.learning_candidate lc "
        "left join lateral (select id,status from cockpit.follow_on_task where source_candidate_id=lc.id "
        "  and origin='learning_accept' order by created_at desc limit 1) f on true "
        "left join lateral (select command,status from cockpit.learning_command where candidate_id=lc.id "
        "  order by requested_at desc limit 1) cmd on true "
        "where lc.source_video_id=%s and lc.candidate_scope='system_improvement' order by lc.sort,lc.created_at",
        (video_id,),
    )


def render_brain_candidates(video_id):
    candidates = source_candidates(video_id)
    if not candidates:
        return ''
    body = "<div class=sec id=brain-better><h2>🛠 Make the Brain Better</h2><p class=mut>Source-grounded improvements to Larry, MyPKA and Fusion247. Accept creates governed work for Larry; it never silently edits canonical MyPKA.</p>"
    for row in candidates:
        (candidate_id, candidate_ref, recommendation, why, evidence, target, expected_effect,
         confidence, risk, kind, next_step, status, task_id, task_status, command, command_status) = row
        lifecycle = candidate_lifecycle(status, task_status, command, command_status)
        action = (candidate_ref or '').rsplit(':', 1)[-1]
        body += f"<article class=brain-card id='{html.escape(candidate_ref or candidate_id)}'>"
        body += f"<div><span class=life>{html.escape(lifecycle)}</span> · <span class=ref>Action {html.escape(action)} · {html.escape(candidate_ref or candidate_id)}</span></div>"
        body += f"<h3>{html.escape(recommendation or '')}</h3><dl>"
        for label, value in [
            ('Target / category', f"{target or '—'} / {kind or '—'}"), ('Why', why),
            ('Source / graph evidence', evidence), ('Expected effect', expected_effect),
            ('Confidence', confidence), ('Risk / what would invalidate it', risk),
            ('Concrete next step', next_step),
        ]:
            body += f"<dt>{html.escape(label)}</dt><dd>{html.escape(str(value or '—'))}</dd>"
        body += "</dl>"
        if lifecycle not in ('completed', 'Dismiss queued'):
            body += "<div class=btns>"
            if status != 'accepted' and lifecycle != 'Accept queued':
                token = action_token(candidate_id, 'accept')
                body += ("<form method=post action=/candidate-decision>"
                         f"<input type=hidden name=candidate_id value='{html.escape(candidate_id)}'>"
                         "<input type=hidden name=command value=accept>"
                         f"<input type=hidden name=token value='{token}'>"
                         "<button type=submit>Accept</button></form>")
            if status != 'declined':
                token = action_token(candidate_id, 'decline')
                body += ("<form method=post action=/candidate-decision>"
                         f"<input type=hidden name=candidate_id value='{html.escape(candidate_id)}'>"
                         "<input type=hidden name=command value=decline>"
                         f"<input type=hidden name=token value='{token}'>"
                         "<button type=submit>Dismiss</button></form>")
            body += "</div>"
        if task_id:
            body += f"<p class=mut>Governed follow-on: {html.escape(task_id)} · {html.escape(task_status or '')}</p>"
        body += "</article>"
    return body + "</div>"


def source_page(video_id):
    row = pgq("select title, channel from cockpit.youtube_source where video_id=%s", (video_id,))
    if not row:
        return page("Unknown source", "<h1>Unknown source</h1><a href=/>← back</a>")
    title, channel = row[0]
    data = source_data(video_id)
    suggestions = pgq(
        "select proposed_target, recommendation, why, confidence from cockpit.learning_candidate "
        "where status='pending' and candidate_scope='warwick_opportunity' "
        "order by confidence desc nulls last limit 5",
    )
    body = "<a href=/ class=mut>← your brain</a>"
    body += f"<div class=eyebrow>{html.escape(channel or '')}</div><h1>{html.escape(title)}</h1>"
    interpretation = pgq(
        "select delta from obsidiwikai.source_interpretation where source_id=%s and is_current=true "
        "and delta is not null order by created_at desc limit 1", (video_id,),
    )
    if interpretation and interpretation[0][0]:
        body += f"<div class=sec style='border-color:#8f8dff'><h2>🔄 Since you first learned this…</h2><div class=why>{html.escape(interpretation[0][0])}</div></div>"
    if data['why']:
        body += f"<div class=sec><h2>🎯 Why this matters to you</h2><div class=why>{html.escape(data['why'])}</div></div>"
    body += (f"<div class=sec><h2>🔄 What changed in your brain</h2><div class=stat>"
             f"<div><b>{data['total']}</b><span>concepts</span></div>"
             f"<div><b>{len(data['new'])}</b><span>new</span></div>"
             f"<div><b>{len(data['conn'])}</b><span>connected</span></div></div></div>")
    if data['new']:
        body += "<div class=sec><h2>✨ What was genuinely new</h2><div>" + ''.join(
            f"<span class='pill new'>{html.escape(row['id'])}</span>" for row in data['new'][:18]) + "</div></div>"
    if data['conn']:
        body += ("<div class=sec><h2>🔗 What it connected to / reinforced</h2><p class=mut>concepts this video shares with the rest of your brain</p><div>"
                 + ''.join(f"<span class='pill conn'>{html.escape(row['id'])}</span>" for row in data['conn'][:18]) + "</div></div>")
    if suggestions:
        body += "<div class=sec><h2>💡 So what? — grounded suggestions</h2>"
        for target, recommendation, why, confidence in suggestions:
            body += f"<div class=sug><span class=k>{html.escape(target or '')}</span> · <span class=c>conf {confidence or '—'}</span><p>{html.escape(recommendation or '')}</p><p class=mut>{html.escape(why or '')}</p></div>"
        body += "</div>"
    body += render_brain_candidates(video_id)
    if data['ev']:
        body += f"<div class=sec><h2>📚 Evidence</h2><p class=mut>“{html.escape(data['ev']['concept'])}” — traced to the transcript:</p><div class=ev>{html.escape(data['ev']['passage'])}…</div></div>"
    body += ("<div class=sec><h2>👍 Your call</h2><div class=btns>"
             "<form method=post action=/decide>"
             f"<input type=hidden name=vid value='{html.escape(video_id)}'>"
             "<input type=hidden name=v value=useful>"
             f"<input type=hidden name=token value='{action_token(video_id, 'useful')}'>"
             "<button type=submit>Useful</button></form>"
             "<form method=post action=/decide>"
             f"<input type=hidden name=vid value='{html.escape(video_id)}'>"
             "<input type=hidden name=v value=not>"
             f"<input type=hidden name=token value='{action_token(video_id, 'not')}'>"
             "<button type=submit>Not useful</button></form>"
             f"<a href='{html.escape(GRAPH)}'>Explore in graph</a></div><p class=mut>your call teaches Honcho</p></div>")
    return page(title, body)


def decide(video_id, value):
    # Files a Warwick preference/correction into the Context Outbox. Deliberate action only — the
    # caller (do_POST) has already verified a POST + valid HMAC token + allowed origin, so a
    # link-preview/prefetch or accidental GET can no longer fire this (Fable-1). Any DB failure
    # PROPAGATES so the outcome is reported honestly, never a silent "Noted".
    if value not in ('useful', 'not'):
        raise ValueError('invalid decision value')
    useful = value == 'useful'
    title = (pgq("select title from cockpit.youtube_source where video_id=%s", (video_id,)) or [['?']])[0][0]
    summary = f"Warwick found the source \"{title}\" {'USEFUL / worth acting on' if useful else 'NOT useful'}."
    connection = psycopg2.connect(PG)
    try:
        cursor = connection.cursor()
        cursor.execute(
            "insert into obsidiwikai.context_packet(idempotency_key,type,summary,sensitivity,lifespan,source_pointer,state) "
            "values(%s,%s,%s,'ordinary','permanent','report-decision','queued') on conflict (idempotency_key) do nothing",
            ('rep:' + video_id + ':' + value, 'preference' if useful else 'correction', summary),
        )
        connection.commit()
    finally:
        connection.close()
    return {'video_id': video_id, 'useful': useful}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def _headers(self, content_type='text/html; charset=utf-8'):
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")

    def _send(self, body, status=200, content_type='text/html; charset=utf-8'):
        self.send_response(status)
        self._headers(content_type)
        self.end_headers()
        self.wfile.write(body.encode('utf-8'))

    def _redirect(self, location):
        self.send_response(303)
        self._headers()
        self.send_header('Location', location)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path in ('/', '/index.html'):
                self._send(dashboard())
            elif parsed.path.startswith('/api/source/'):
                video_id = urllib.parse.unquote(parsed.path[len('/api/source/'):])
                data = source_data(video_id)
                row = pgq("select title from cockpit.youtube_source where video_id=%s", (video_id,))
                response = json.dumps({
                    'source_id': video_id, 'title': row[0][0] if row else video_id, 'total': data['total'],
                    'new': [item['id'] for item in data['new']],
                    'connected': [item['id'] for item in data['conn']], 'why': data['why'],
                    'evidence': data['ev'],
                })
                self._send(response, content_type='application/json; charset=utf-8')
            elif parsed.path.startswith('/s/'):
                self._send(source_page(urllib.parse.unquote(parsed.path[3:])))
            else:
                self._send(page('Not found', '<h1>Not found</h1><a href=/>← back</a>'), status=404)
        except Exception:
            self._send(page('Error', '<h1>Something went wrong</h1><p>The error was recorded. No decision was applied.</p><a href=/>← back</a>'), status=500)

    def do_POST(self):
        if self.path not in ('/candidate-decision', '/decide'):
            self._send(page('Not found', '<h1>Not found</h1>'), status=404)
            return
        if not origin_allowed(self.headers):
            self._send(page('Forbidden', '<h1>Forbidden</h1>'), status=403)
            return
        address = self.client_address[0]
        if not allow_request(address):
            self._send(page('Slow down', '<h1>Too many requests</h1>'), status=429)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 4096:
                raise ValueError('invalid request length')
            form = urllib.parse.parse_qs(self.rfile.read(length).decode('utf-8'), strict_parsing=True)
            if self.path == '/decide':
                # Deliberate preference/correction — verify the per-(source,value) HMAC token before
                # touching Honcho's lens, exactly like the candidate path (Fable-1).
                vid = form.get('vid', [''])[0]
                value = form.get('v', [''])[0]
                if not valid_action_token(vid, value, form.get('token', [''])[0]):
                    raise PermissionError('invalid decision token')
                decide(vid, value)
                self._redirect('/s/' + urllib.parse.quote(vid))
                return
            result = file_candidate_decision(
                form.get('candidate_id', [''])[0], form.get('command', [''])[0], form.get('token', [''])[0],
            )
            self._redirect('/s/' + urllib.parse.quote(result['video_id']) + '#brain-better')
        except PermissionError:
            self._send(page('Forbidden', '<h1>Forbidden</h1><p>The decision token was invalid.</p>'), status=403)
        except (ValueError, LookupError):
            self._send(page('Invalid decision', '<h1>Decision not filed</h1><p>Reload the source report and try again.</p>'), status=400)
        except Exception:
            self._send(page('Error', '<h1>Decision not filed</h1><p>No state was changed. Try again later.</p>'), status=500)


if __name__ == '__main__':
    print('report server on :8701 workspace', WS)
    ThreadingHTTPServer(('0.0.0.0', 8701), Handler).serve_forever()
