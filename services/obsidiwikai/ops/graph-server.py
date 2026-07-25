import json, os, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from neo4j import GraphDatabase

WS = os.environ.get('NEO4J_WORKSPACE', 'owai_rebuild_v1')
drv = GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USERNAME'], os.environ['NEO4J_PASSWORD']))

def fetch(focus=None, limit=120):
    with drv.session() as s:
        if focus:
            rows = s.run(f"MATCH (c:{WS}) WHERE toLower(c.entity_id)=toLower($q) "
                         f"OPTIONAL MATCH (c)-[]-(m:{WS}) WITH c, collect(DISTINCT m)[0..70] AS ms "
                         f"UNWIND ([c]+ms) AS n OPTIONAL MATCH (n)-[r]-() "
                         f"RETURN n.entity_id AS id, count(r) AS deg, coalesce(n.entity_type,'concept') AS type", q=focus).data()
        else:
            rows = s.run(f"MATCH (n:{WS}) OPTIONAL MATCH (n)-[r]-() "
                         f"WITH n,count(r) AS deg ORDER BY deg DESC LIMIT {limit} "
                         f"RETURN n.entity_id AS id, deg, coalesce(n.entity_type,'concept') AS type").data()
        ids = list({r['id'] for r in rows})
        edges = s.run(f"MATCH (a:{WS})-[r]->(b:{WS}) WHERE a.entity_id IN $ids AND b.entity_id IN $ids "
                      f"RETURN a.entity_id AS a, b.entity_id AS b", ids=ids).data()
    seen = {}
    for r in rows:
        seen[r['id']] = {'id': r['id'], 'deg': r['deg'], 'type': r['type']}
    return {'nodes': list(seen.values()), 'edges': [[e['a'], e['b']] for e in edges], 'focus': focus or ''}

def total():
    with drv.session() as s:
        return s.run(f"MATCH (n:{WS}) RETURN count(n) AS c").single()['c']

PAGE = r"""<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Fusion247 Brain — graph</title><style>
:root{--bg:#0e1016;--ink:#e7ecf4;--mut:#93a0b4;--ac:#7c7bf0;--sf:#171b23;--bd:#2a313d}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}
#bar{position:fixed;top:0;left:0;right:0;z-index:6;display:flex;gap:8px;align-items:center;padding:10px 12px}
#bar b{font-size:15px;font-weight:800;white-space:nowrap}#bar .c{color:var(--mut);font-size:12px;white-space:nowrap}
#q{flex:1;min-width:60px;background:var(--sf);border:1px solid var(--bd);color:var(--ink);border-radius:9px;padding:8px 11px;font-size:15px}
#q::placeholder{color:var(--mut)}
#tip{position:fixed;z-index:7;background:rgba(0,0,0,.85);color:#fff;padding:8px 11px;border-radius:9px;font-size:13px;max-width:250px;pointer-events:none;opacity:0;line-height:1.35}
#tip .s{color:#9fb0ff;font-size:11px;display:block;margin-top:3px}
#hint{position:fixed;bottom:10px;left:0;right:0;text-align:center;color:var(--mut);font-size:12px;z-index:5;pointer-events:none}
canvas{display:block;touch-action:none}a{color:var(--ac)}
</style></head><body>
<div id=bar><b>🧠 Brain</b><input id=q placeholder="search a concept… (e.g. Honcho)" ><span class=c id=cnt></span></div>
<div id=tip></div><div id=hint>drag to pan · pinch/scroll to zoom · tap a concept to focus its links</div>
<canvas id=c></canvas>
<script>
const G=__DATA__,TOTAL=__TOTAL__;
const q=document.getElementById('q');q.value=G.focus||'';
q.addEventListener('keydown',e=>{if(e.key==='Enter')location.href='/?q='+encodeURIComponent(q.value.trim());});
const cv=document.getElementById('c'),ctx=cv.getContext('2d'),tip=document.getElementById('tip');
let DPR=Math.min(2,devicePixelRatio||1),W,H;function size(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';}size();addEventListener('resize',size);
const maxd=Math.max(1,...G.nodes.map(n=>n.deg));
function col(d){const t=Math.sqrt(d/maxd);const a=[80,120,200],b=[124,123,240],c2=[224,137,74];let x=t<.5?a.map((v,i)=>v+(b[i]-v)*(t*2)):b.map((v,i)=>v+(c2[i]-v)*((t-.5)*2));return'rgb('+x.map(Math.round).join(',')+')';}
const idx=new Map(G.nodes.map((n,i)=>[n.id,i]));
const N=G.nodes.map(n=>({...n,x:(Math.random()-.5)*600,y:(Math.random()-.5)*600,vx:0,vy:0,r:4+Math.sqrt(n.deg)*2.3}));
const E=G.edges.map(([a,b])=>[idx.get(a),idx.get(b)]).filter(([a,b])=>a!=null&&b!=null);
function step(rep){for(const n of N){n.vx*=.86;n.vy*=.86;}for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const a=N[i],b=N[j];let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+.01,d=Math.sqrt(d2),f=rep/d2,fx=dx/d*f,fy=dy/d*f;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;}for(const[i,j]of E){const a=N[i],b=N[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)+.01,f=(d-70)*.006,fx=dx/d*f,fy=dy/d*f;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;}for(const n of N){n.vx-=n.x*.0016;n.vy-=n.y*.0016;n.x+=n.vx;n.y+=n.vy;}}
for(let k=0;k<320;k++)step(2600);
let tx=W/2,ty=H/2,sc=G.focus?1.1:1,sel=-1;
function draw(){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(tx,ty);ctx.scale(sc,sc);ctx.lineWidth=.6/sc;
for(const[i,j]of E){const a=N[i],b=N[j],hot=sel>=0&&(i===sel||j===sel);ctx.strokeStyle=hot?'rgba(124,123,240,.9)':'rgba(150,160,190,.14)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
const nb=new Set();if(sel>=0)for(const[i,j]of E){if(i===sel)nb.add(j);if(j===sel)nb.add(i);}
for(let i=0;i<N.length;i++){const n=N[i],on=sel<0||i===sel||nb.has(i);ctx.globalAlpha=on?1:.2;ctx.fillStyle=col(n.deg);ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,7);ctx.fill();if(i===sel){ctx.lineWidth=2/sc;ctx.strokeStyle='#fff';ctx.stroke();}if((n.deg>=14||i===sel||(G.focus&&on))&&on){ctx.globalAlpha=1;ctx.fillStyle='#e7ecf4';ctx.font=(i===sel?700:600)+' '+(11/sc)+'px -apple-system,sans-serif';ctx.textAlign='center';ctx.fillText(n.id,n.x,n.y-n.r-3/sc);}}
ctx.globalAlpha=1;ctx.restore();}
function loop(){step(2600);draw();requestAnimationFrame(loop);}loop();
document.getElementById('cnt').textContent=(G.focus?G.nodes.length+' around "'+G.focus+'"':G.nodes.length+' hubs')+' · '+TOTAL+' total';
let drag=false,px,py,moved,dragN=-1;
const tw=(x,y)=>[(x-tx)/sc,(y-ty)/sc];
function pick(x,y){const[wx,wy]=tw(x,y);let best=-1,bd=1e9;for(let i=0;i<N.length;i++){const dx=N[i].x-wx,dy=N[i].y-wy,d=dx*dx+dy*dy;if(d<Math.max(160,(N[i].r+8)**2)&&d<bd){bd=d;best=i;}}return best;}
function dn(x,y){px=x;py=y;moved=false;dragN=pick(x,y);drag=true;}
function mv(x,y){if(!drag){const p=pick(x,y);if(p>=0){const n=N[p];tip.style.opacity=1;tip.style.left=Math.min(x+12,W-260)+'px';tip.style.top=(y+12)+'px';tip.innerHTML=n.id+'<span class=s>'+n.deg+' links · double-tap to explore</span>';}else tip.style.opacity=0;return;}const dx=x-px,dy=y-py;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;if(dragN>=0){const[wx,wy]=tw(x,y);N[dragN].x=wx;N[dragN].y=wy;N[dragN].vx=0;N[dragN].vy=0;}else{tx+=dx;ty+=dy;}px=x;py=y;}
function upp(x,y){if(!moved){const p=pick(x,y);sel=(p===sel)?-1:p;}drag=false;dragN=-1;}
cv.addEventListener('mousedown',e=>dn(e.clientX,e.clientY));addEventListener('mousemove',e=>mv(e.clientX,e.clientY));addEventListener('mouseup',e=>upp(e.clientX,e.clientY));
cv.addEventListener('dblclick',e=>{const p=pick(e.clientX,e.clientY);if(p>=0)location.href='/?q='+encodeURIComponent(N[p].id);});
cv.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.12:.89;const[wx,wy]=tw(e.clientX,e.clientY);sc*=f;tx=e.clientX-wx*sc;ty=e.clientY-wy*sc;},{passive:false});
let pinch=0,lastTap=0;
cv.addEventListener('touchstart',e=>{if(e.touches.length===1){const t=e.touches[0];const now=Date.now();if(now-lastTap<300){const p=pick(t.clientX,t.clientY);if(p>=0){location.href='/?q='+encodeURIComponent(N[p].id);return;}}lastTap=now;dn(t.clientX,t.clientY);}else if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();if(e.touches.length===1)mv(e.touches[0].clientX,e.touches[0].clientY);else if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinch){const f=d/pinch,mx=(e.touches[0].clientX+e.touches[1].clientX)/2,my=(e.touches[0].clientY+e.touches[1].clientY)/2,[wx,wy]=tw(mx,my);sc*=f;tx=mx-wx*sc;ty=my-wy*sc;}pinch=d;}},{passive:false});
cv.addEventListener('touchend',e=>{if(e.touches.length===0){if(!moved&&e.changedTouches[0]){const p=pick(e.changedTouches[0].clientX,e.changedTouches[0].clientY);sel=(p===sel)?-1:p;}drag=false;dragN=-1;pinch=0;}},{passive:false});
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path not in ('/', '/index.html'):
            self.send_response(404); self.end_headers(); return
        qs = urllib.parse.parse_qs(u.query)
        focus = (qs.get('q', [''])[0] or '').strip() or None
        try:
            data = fetch(focus)
            if focus and not data['nodes']:
                data = fetch(None)  # nothing found → fall back to hubs
            body = PAGE.replace('__DATA__', json.dumps(data)).replace('__TOTAL__', str(total()))
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(body.encode('utf-8'))
        except Exception as e:
            self.send_response(500); self.end_headers(); self.wfile.write(str(e).encode())

print('graph server on :8700 workspace', WS, 'total', total())
ThreadingHTTPServer(('0.0.0.0', 8700), H).serve_forever()
