import json, os, html, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from neo4j import GraphDatabase
import psycopg2

WS = os.environ.get('NEO4J_WORKSPACE', 'owai_rebuild_v1')
neo = GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USERNAME'], os.environ['NEO4J_PASSWORD']))
def _clean_dsn(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, 'sslmode=require', ''))
PG = _clean_dsn(os.environ['DATABASE_URL'])
LR = os.environ.get('LIGHTRAG_URL', 'http://lightrag-neo4j-prod:9621')
LRKEY = os.environ.get('LIGHTRAG_API_KEY', '')
GRAPH = os.environ.get('GRAPH_URL', 'http://100.101.240.85:8700')

DS = json.load(open('/data/rag_storage/kv_store_doc_status.json'))
TC = json.load(open('/data/rag_storage/kv_store_text_chunks.json'))
VID2DOC = {v.get('file_path'): k for k, v in DS.items() if v.get('file_path')}
WHY = {}

def pgq(sql, args=()):
    c = psycopg2.connect(PG); cur = c.cursor()
    cur.execute(sql, args); rows = cur.fetchall(); cur.close(); c.close(); return rows

def why_matters(vid, concepts):
    if vid in WHY: return WHY[vid]
    try:
        q = ("In 2 plain sentences, why does this matter specifically for Warwick — who is building ObsidiWikAi, "
             "an agent-native personal knowledge system for Fusion247? Focus on the shift or insight. Concepts: "
             + ", ".join(concepts[:10]))
        req = urllib.request.Request(LR + '/query', data=json.dumps({'query': q, 'mode': 'mix', 'top_k': 8}).encode(),
                                     headers={'X-API-Key': LRKEY, 'Content-Type': 'application/json'})
        r = json.load(urllib.request.urlopen(req, timeout=40))
        WHY[vid] = (r.get('response') or '').strip()[:600]
    except Exception as e:
        WHY[vid] = ''
    return WHY[vid]

def source_data(vid):
    doc = VID2DOC.get(vid)
    with neo.session() as s:
        rows = s.run(f"MATCH (n:{WS}) WHERE n.source_id CONTAINS $d "
                     f"RETURN n.entity_id AS id, coalesce(n.description,'') AS desc, "
                     f"size(split(coalesce(n.source_id,''),'<SEP>')) AS srcs", d=doc).data() if doc else []
        # cross-source: which OTHER videos this shares concepts with
        shares = {}
        for r in rows:
            if r['srcs'] > 1:
                pass
    total = len(rows)
    new = [r for r in rows if r['srcs'] == 1]
    conn = [r for r in rows if r['srcs'] > 1]
    top = sorted(rows, key=lambda r: -r['srcs'])[:14]
    # evidence: a passage for the top new concept
    ev = None
    for r in top:
        with neo.session() as s:
            sid = (s.run(f"MATCH (n:{WS} {{entity_id:$i}}) RETURN n.source_id AS s", i=r['id']).single() or {}).get('s', '')
        chunk = (sid or '').split('<SEP>')[0].strip()
        c = TC.get(chunk, {})
        if c.get('content'):
            ev = {'concept': r['id'], 'passage': c['content'].replace('\n', ' ')[:280]}
            break
    return {'total': total, 'new': new, 'conn': conn, 'top': top, 'ev': ev,
            'why': why_matters(vid, [r['id'] for r in top])}

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
.ev{font-family:ui-monospace,monospace;font-size:12.5px;color:#aeb8c8;background:#12151c;border-radius:9px;padding:10px 12px}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.btns a{background:#222838;border:1px solid #313a4c;border-radius:10px;padding:9px 14px;font-size:14px;font-weight:600;color:#e7ecf4}
.card{display:block;background:#171b23;border:1px solid #262d39;border-radius:13px;padding:13px 15px;margin:9px 0}
@media(prefers-color-scheme:light){.card{background:#fff;border-color:#e2e7f0}.why{background:#eef}.ev{background:#f0f2f7;color:#3a465a}.btns a{background:#eef1f7;border-color:#dce2ee;color:#1a2130}}
.card .t{font-weight:700;font-size:15px}.badge{float:right;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#16281f;color:#6ccf9c}"""

def page(title, body):
    return ("<!doctype html><meta charset=utf8><meta name=viewport content='width=device-width,initial-scale=1'>"
            f"<title>{html.escape(title)}</title><style>{CSS}</style><div class=w>{body}</div>")

def dashboard():
    with neo.session() as s:
        total = s.run(f"MATCH (n:{WS}) RETURN count(n) AS c").single()['c']
        cross = s.run(f"MATCH (n:{WS}) WHERE size(split(coalesce(n.source_id,''),'<SEP>'))>1 RETURN count(n) AS c").single()['c']
    srcs = pgq("select y.video_id, y.title, y.channel, c.state from cockpit.youtube_source y "
               "left join obsidiwikai.compile_job c on c.source_id=y.video_id order by y.captured_at desc")
    sugs = pgq("select proposed_target, recommendation, confidence from cockpit.learning_candidate "
               "where status='pending' order by confidence desc nulls last limit 4")
    b = "<div class=eyebrow>Fusion247 · myPKA</div><h1>Your brain</h1>"
    b += (f"<div class=sec><div class=stat><div><b>{total}</b><span>concepts</span></div>"
          f"<div><b>{cross}</b><span>cross-source links</span></div>"
          f"<div><b>{len([s for s in srcs if s[3]=='done'])}</b><span>sources learned</span></div></div></div>")
    if sugs:
        b += "<div class=sec><h2>💡 Worth your attention</h2>"
        for t, rec, conf in sugs:
            b += f"<div class=sug><span class=k>{html.escape(t or '')}</span> · <span class=c>conf {conf or '—'}</span><p>{html.escape(rec or '')}</p></div>"
        b += "</div>"
    b += "<div class=sec><h2>📥 Sources — tap for the so-what</h2>"
    for vid, ttl, ch, st in srcs:
        badge = "<span class=badge>learned</span>" if st == 'done' else ""
        b += f"<a class=card href='/s/{html.escape(vid)}'><span class=t>{html.escape(ttl or vid)}</span>{badge}<div class=mut>{html.escape(ch or '')}</div></a>"
    b += "</div>"
    b += f"<div class=sec><h2>🕸️ Explore the whole graph</h2><p><a href='{GRAPH}'>Open the interactive map →</a></p></div>"
    return page("Your brain", b)

def source_page(vid):
    row = pgq("select title, channel from cockpit.youtube_source where video_id=%s", (vid,))
    if not row: return page("?", "<h1>Unknown source</h1><a href=/>← back</a>")
    ttl, ch = row[0]
    d = source_data(vid)
    sugs = pgq("select proposed_target, recommendation, why, confidence from cockpit.learning_candidate "
               "where status='pending' order by confidence desc nulls last limit 5")
    b = "<a href=/ class=mut>← your brain</a>"
    b += f"<div class=eyebrow>{html.escape(ch or '')}</div><h1>{html.escape(ttl)}</h1>"
    if d['why']:
        b += f"<div class=sec><h2>🎯 Why this matters to you</h2><div class=why>{html.escape(d['why'])}</div></div>"
    b += (f"<div class=sec><h2>🔄 What changed in your brain</h2><div class=stat>"
          f"<div><b>{d['total']}</b><span>concepts</span></div>"
          f"<div><b>{len(d['new'])}</b><span>new</span></div>"
          f"<div><b>{len(d['conn'])}</b><span>connected</span></div></div></div>")
    if d['new']:
        b += "<div class=sec><h2>✨ What was genuinely new</h2><div>" + "".join(f"<span class='pill new'>{html.escape(r['id'])}</span>" for r in d['new'][:18]) + "</div></div>"
    if d['conn']:
        b += ("<div class=sec><h2>🔗 What it connected to / reinforced</h2><p class=mut>concepts this video shares with the rest of your brain</p><div>"
              + "".join(f"<span class='pill conn'>{html.escape(r['id'])}</span>" for r in d['conn'][:18]) + "</div></div>")
    if sugs:
        b += "<div class=sec><h2>💡 So what? — grounded suggestions</h2>"
        for t, rec, wy, conf in sugs:
            b += f"<div class=sug><span class=k>{html.escape(t or '')}</span> · <span class=c>conf {conf or '—'}</span><p>{html.escape(rec or '')}</p><p class=mut>{html.escape(wy or '')}</p></div>"
        b += "</div>"
    if d['ev']:
        b += f"<div class=sec><h2>📚 Evidence</h2><p class=mut>“{html.escape(d['ev']['concept'])}” — traced to the transcript:</p><div class=ev>{html.escape(d['ev']['passage'])}…</div></div>"
    b += ("<div class=sec><h2>👍 Your call</h2><div class=btns>"
          f"<a href='/decide?vid={vid}&v=useful'>Useful</a><a href='/decide?vid={vid}&v=not'>Not useful</a>"
          f"<a href='{GRAPH}'>Explore in graph</a></div><p class=mut>your call teaches Honcho</p></div>")
    return page(ttl, b)

def decide(vid, v):
    useful = v == 'useful'
    ttl = (pgq("select title from cockpit.youtube_source where video_id=%s", (vid,)) or [['?']])[0][0]
    try:
        summ = f"Warwick found the source \"{ttl}\" {'USEFUL / worth acting on' if useful else 'NOT useful'}."
        c = psycopg2.connect(PG); cur = c.cursor()
        cur.execute("insert into obsidiwikai.context_packet(idempotency_key,type,summary,sensitivity,lifespan,source_pointer,state) "
                    "values(%s,%s,%s,'ordinary','permanent','report-decision','queued') on conflict (idempotency_key) do nothing",
                    ('rep:'+vid+':'+v, 'preference' if useful else 'correction', summ))
        c.commit(); cur.close(); c.close()
    except Exception:
        pass
    return page("thanks", f"<h1>{'👍' if useful else '👎'} Noted</h1><p>Honcho will learn from this.</p><a href='/s/{vid}'>← back to the report</a> · <a href=/>your brain</a>")

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, body):
        self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.end_headers()
        self.wfile.write(body.encode('utf-8'))
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(u.query)
        try:
            if u.path == '/' or u.path == '/index.html': self._send(dashboard())
            elif u.path.startswith('/s/'): self._send(source_page(urllib.parse.unquote(u.path[3:])))
            elif u.path == '/decide': self._send(decide(qs.get('vid', [''])[0], qs.get('v', [''])[0]))
            else: self.send_response(404); self.end_headers()
        except Exception as e:
            self._send(page('error', f"<h1>hmm</h1><pre>{html.escape(str(e))}</pre><a href=/>← back</a>"))

print('report server on :8701 workspace', WS)
ThreadingHTTPServer(('0.0.0.0', 8701), H).serve_forever()
