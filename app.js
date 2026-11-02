/* Grok Desk app. Plan B: polls /d/{DATA_PATH}/*.json every 15s. All FOMO URLs come from the JSON (links.py). */
(function(){
'use strict';
const POLL=15, DCH=window.DeskChart;
// ---- DATA_PATH: from #d= once, then localStorage; removed from the address bar
(function(){const m=location.hash.match(/[#&]d=([A-Za-z0-9_\-]{32,})/);if(m){localStorage.setItem('desk_d',m[1]);history.replaceState(null,'',location.pathname+location.search)}})();
const DP=localStorage.getItem('desk_d');
const base=DP?`d/${DP}/`:null;
const D={state:null,chart:null,activity:null,account:null,settings:null,agents:{},coin:{},audit:{}};
let lastOk=null,failAt=null,retryIn=0,view={tab:'home'},range='LIVE',firstLoad=true;
const $=s=>document.querySelector(s), esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ct=ts=>new Date(ts*1000).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'})+' CT';
const usd=(v,d=2)=>v==null?'–':'$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const kfmt=v=>v==null?'n/a':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1e3?'$'+(v/1e3).toFixed(1)+'K':'$'+Number(v).toFixed(0);
const price=v=>v==null?'–':'$'+(v>=1?v.toFixed(4):Number(v).toPrecision(4));
const short=m=>m?m.slice(0,4)+'…'+m.slice(-4):'';
const COLORS={scanner:'#64d2ff',auditor:'#0a84ff',analyst:'#ffd60a',executor:'#00d35a',risk:'#ff6b9a'};
const AG=['scanner','auditor','analyst','executor','risk'];

async function get(p){const r=await fetch(base+p+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json()}
async function poll(){
  if(!base){failAt=Date.now();render();return}
  try{
    const [s,c,a,ac,st]=await Promise.all(['state.json','chart.json','activity.json','account.json','settings.json'].map(get));
    Object.assign(D,{state:s,chart:c,activity:a,account:ac,settings:st});
    const ag=await Promise.all(AG.map(n=>get(`agents/${n}.json`).catch(()=>null)));AG.forEach((n,i)=>{if(ag[i])D.agents[n]=ag[i]});
    if(view.mint&&view.tab==='coin')D.coin[view.mint]=await get(`coin/${view.mint}.json`).catch(()=>D.coin[view.mint]);
    if(view.mint&&view.tab==='audit')D.audit[view.mint]=await get(`audit/${view.mint}.json`).catch(()=>D.audit[view.mint]);
    lastOk=Date.now();failAt=null;
  }catch(e){failAt=Date.now();retryIn=POLL}
  render(true);
}
setInterval(()=>{if(failAt){retryIn=Math.max(0,POLL-Math.floor((Date.now()-failAt)/1000));banners()}},1000);

function banners(){
  const e=$('#err'),a=$('#age');
  if(failAt){e.hidden=false;e.textContent=`Desk offline · retrying in ${retryIn||POLL}s · last update ${lastOk?ct(lastOk/1000):'never'}`}else e.hidden=true;
  const pub=((D.settings||{})['desk.publish_min']||6)*60;
  if(D.state&&!failAt&&(Date.now()/1000-D.state.updatedAt)>pub+120){a.hidden=false;a.textContent=`Data from ${ct(D.state.updatedAt)} · this hosting refreshes about every ${Math.round(pub/60)} min`}else a.hidden=true;
}
// ---- odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left
function odo(el,text){
  const prev=el.dataset.v||'';el.dataset.v=text;const red=DCH.reduced();
  if(prev.length!==text.length||red||!el.children.length){
    el.innerHTML=[...text].map(ch=>/\d/.test(ch)?`<span class="d"><span class="col">${[...'0123456789'].map(n=>`<span>${n}</span>`).join('')}</span></span>`:`<span>${esc(ch)}</span>`).join('');
    [...el.querySelectorAll('.col')].forEach((c,i)=>{c.style.transition='none';const d=text.replace(/\D/g,'')[i];c.style.transform=`translateY(-${d*1.05}em)`});
    if(red||!prev)return; }
  const cols=[...el.querySelectorAll('.col')],digs=text.replace(/\D/g,''),pd=prev.replace(/\D/g,'');
  cols.forEach((c,i)=>{if(digs[i]!==pd[i]){c.style.transition='';c.style.transitionDelay=((cols.length-1-i)*30)+'ms';requestAnimationFrame(()=>c.style.transform=`translateY(-${digs[i]*1.05}em)`)}});
}
// ---- router
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>go({tab:b.dataset.tab}));
function go(v){view=v;window.scrollTo(0,0);if(v.mint){(v.tab==='coin'?get(`coin/${v.mint}.json`).then(j=>D.coin[v.mint]=j):get(`audit/${v.mint}.json`).then(j=>D.audit[v.mint]=j)).catch(()=>{}).finally(()=>render())}render()}
window.deskGo=go;
function render(fromPoll){
  banners();const t=view.tab;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t||(t==='coin'||t==='audit')&&b.dataset.tab==='activity'));
  const fx=D.state&&D.state.fixture?`<div class="fixture">FIXTURE · seeded fake PAPER night</div>`:'';
  const html={home,agents,activity,account,coin,audit}[t]();
  const v=$('#view');
  if(fromPoll&&t==='home'&&v.dataset.t==='home'&&D.state&&!v.querySelector('.skel')){updateHome();return}
  v.dataset.t=t;v.innerHTML=fx+html;after[t]&&after[t]();
}
const skel=(h,mt=12)=>`<div class="skel" style="height:${h}px;margin-top:${mt}px"></div>`;
const loading=()=>!D.state;
const paper=()=>D.state&&D.state.mode==='PAPER'?'<span class="pill paper">PAPER</span>':'';

// ---- HOME
function home(){
  if(loading())return `<div class="nav"><div class="avatar">G</div><div class="grow">Grok Bot ›</div></div>${skel(44,4)}${skel(80)}${skel(240)}${skel(44)}${skel(300,24)}`;
  const s=D.state,unread=(D.activity.rows||[]).some(r=>r.ts>(+localStorage.getItem('desk_seen')||0));
  return `<div class="nav"><button class="avatar" onclick="deskGo({tab:'account'})" aria-label="Account">G</button><button class="grow" style="text-align:left" onclick="deskGo({tab:'account'})">Grok Bot ›</button>
  <button class="icon" aria-label="Notifications" onclick="localStorage.setItem('desk_seen',Date.now()/1000);deskGo({tab:'activity'})">🔔${unread?'<span class="dot"></span>':''}</button></div>
  <input class="search" id="q" placeholder="Search name, symbol or mint" autocomplete="off"><div id="qres"></div>
  <div class="bal"><span class="big"><span class="odo" id="bal"></span></span>${paper()}</div>
  <div class="sub" id="today"></div>
  <div class="chartbox"><canvas id="line"></canvas><div class="empty-chart" id="cempty" hidden>Waiting for the first trade</div></div>
  <div class="ranges">${['LIVE','1H','4H','1D','1W','ALL'].map(r=>`<button class="${r===range?'on':''}" data-r="${r}">${r}</button>`).join('')}</div>
  <h2>Agents · <span id="nrun"></span></h2><div class="carousel" id="cards"></div>
  <h2>Activity <button onclick="deskGo({tab:'activity'})">See all</button></h2><div id="act5"></div>`;
}
function updateHome(){
  const s=D.state;odo($('#bal'),usd(s.balance));
  const up=s.todayPct>=0;$('#today').innerHTML=`<span class="${up?'up':'down'}">${up?'+':''}${s.todayPct.toFixed(2)}%</span> today <span class="pill mult" style="margin-left:6px">${s.multiplier.toFixed(2)}×</span>`;
  const run=AG.filter(a=>!(s.agents[a]||{}).paused).length;$('#nrun').textContent=`${run} running`;
  $('#cards').innerHTML=AG.map(a=>`<div class="card">${cardBody(a)}</div>`).join('');
  $('#act5').innerHTML=rows((D.activity.rows||[]).slice(0,5),'Nothing yet tonight');
  drawLine();drawCardCanvases();
}
after_home=()=>{if(!D.state)return;updateHome();
  document.querySelectorAll('.ranges button').forEach(b=>b.onclick=()=>{range=b.dataset.r;document.querySelectorAll('.ranges button').forEach(x=>x.classList.toggle('on',x===b));drawLine()});
  $('#q').oninput=e=>search(e.target.value)};
var after_home;const after={get home(){return after_home},agents:()=>drawCardCanvases(),coin:()=>drawCoin(),audit:()=>beam(),activity:()=>localStorage.setItem('desk_seen',Date.now()/1000)};
function drawLine(){
  const c=D.chart||{points:[],marks:[]},now=Date.now()/1000,span={LIVE:now-(D.state.nightStart||now-86400),'1H':3600,'4H':14400,'1D':86400,'1W':604800,ALL:1e12}[range];
  const pts=(c.points||[]).filter(p=>p[0]>=now-span);const trades=(c.marks||[]).length;
  $('#cempty').hidden=trades>0;
  const marks=(c.marks||[]).map(m=>({ts:m.ts,label:m.kind==='bought'?m.title:m.kind==='sold'?(m.value||'').split(' · ')[0]:`${(m.subtitle||'').replace('Risk · ','').replace(' stop','')} · ${m.value}`,color:m.kind==='bought'?DCH.C.blue:m.kind==='sold'?DCH.C.green:DCH.C.red}));
  const cv=$('#line');if(!trades){DCH.line(cv,pts.length?pts:[[now-3600,c.start||0],[now,c.start||0]],[],c.start);return}
  if(DCH.reduced()){DCH.line(cv,pts,marks,c.start);return}
  const t0=performance.now();(function f(t){const k=Math.min(1,(t-t0)/250);DCH.line(cv,pts,marks.map(m=>({...m,alpha:Math.min(1,(t-t0)/200)})),c.start,k);if(k<1)requestAnimationFrame(f)})(t0);
}
function search(q){q=q.trim().toLowerCase();const out=$('#qres');if(!q){out.innerHTML='';return}
  const seen={};[...(D.activity.rows||[]),...((D.state.agents.scanner||{}).feed||[])].forEach(r=>{if(r.mint&&!seen[r.mint])seen[r.mint]={mint:r.mint,name:r.name||(r.title||'').replace(/^(Bought|Sold|Stopped|Rejected) /,'')}});
  const hits=Object.values(seen).filter(c=>(c.name||'').toLowerCase().includes(q)||c.mint.toLowerCase().startsWith(q)).slice(0,6);
  out.innerHTML=`<div class="rows" style="margin-bottom:10px">${hits.length?hits.map(c=>`<button class="row" onclick="deskGo({tab:'coin',mint:'${esc(c.mint)}'})"><div class="m"><div class="tt">${esc(c.name)}</div><div class="st">${short(c.mint)}</div></div></button>`).join(''):'<div class="row"><div class="st">No coin tonight matches</div></div>'}</div>`}

// ---- AGENT CARDS
function cardBody(a){const s=D.state.agents[a]||{};const hd=(name)=>`<div class="hd"><span class="sw" style="background:${COLORS[a]}"></span>${name}${s.paused?' <span class="st" style="color:var(--t3);font-weight:400">· paused</span>':''}</div>`;
  if(a==='scanner'){const f=s.feed||[];return hd('Scanner')+`<div class="k">${s.pools||0} pools</div><div class="body feed">${f.length?f.slice(0,6).map(r=>r.verdict==='wait'?`<div class="wait" style="color:var(--t2)"><span class="n">${esc(r.name||short(r.mint))}</span><span class="r">${esc(r.reason)}</span></div>`:r.verdict==='kill'?`<div class="kill"><span class="n">${esc(r.name||short(r.mint))}</span><span class="r">${esc(r.reason)}</span></div>`:`<div><span>${esc(r.name||short(r.mint))} · liq ${kfmt(r.liquidity_usd)}</span><span style="color:var(--cyan)">→ auditor</span></div>`).join(''):'<div style="border:0;color:var(--t2)">Listening for graduations</div>'}</div>`}
  if(a==='auditor'){const st=s.strips||[];const done=st.length===8&&st.every(x=>x.pass!=null||x.value_text==='not checked');const red=st.find(x=>x.pass===0);
    return hd('Auditor')+`<div class="k">${s.takenApart||0} taken apart</div><div class="body"><div class="strips">${Array.from({length:8},(_,i)=>{const L=st[i];return `<div class="strip ${L?L.pass===1?'ok':L.pass===0?'bad':'':''}">${L?esc(L.name):''}</div>`}).join('')}</div>
    <div class="s" style="margin-top:6px">${!st.length?'No coin taken apart yet':!done?'taking apart...':red?esc(red.value_text):'8/8 → Executor'}</div><div class="s">${s.rejected||0} rejected</div></div>`}
  if(a==='analyst')return hd('Analyst')+`<div class="k">Scoring</div><div class="body"><canvas class="ring" data-score="${s.lastScore==null?'':s.lastScore}" data-min="${s.minScore||70}"></canvas><div class="s" style="text-align:center">${s.mode==='rules'?'rules mode':'Jev'} · passes from ${s.minScore||70}</div></div>`;
  if(a==='executor'){const l=s.last;return hd('Executor')+`<div class="k">${s.trades||0} trades</div><div class="body"><div class="s">${l&&l.size_usd?`${usd(l.size_usd)} · ${(+l.stack_pct).toFixed(1)}% of stack`:`${s.stackPct}% of stack per ticket`}</div>
    <div class="bar"><i style="width:${l&&l.status==='bought'?100:0}%"></i></div><div class="s">${l?(l.status==='bought'?'✓ Filled':l.status==='sent'?'Executing... 50%':esc(l.status)):'No ticket yet'}</div></div>`}
  return hd('Risk')+`<div class="k">${s.guarding?'Guarding':(s.lastExit||'Idle')}</div><div class="body"><div class="s">${s.guarding?'Open position under watch':s.lastExit?'Last exit':'No open position'}</div><div class="pills"><span class="tp r">stop -${s.stopPct}%</span><span class="tp g">trail ${s.trailPct}%</span></div></div>`;
}
function drawCardCanvases(){document.querySelectorAll('canvas.ring').forEach(c=>DCH.ring(c,c.dataset.score===''?null:+c.dataset.score,+c.dataset.min))}

// ---- AGENTS TAB
function agents(){
  if(loading())return `<div class="nav"><div class="grow">Agents</div></div>${AG.map(()=>skel(320)).join('')}`;
  return `<div class="nav"><div class="grow">Agents</div></div><div class="note">Pause and resume go through Telegram: send "pause scanner" or "resume scanner" to your desk bot.</div>`+AG.map(a=>{const d=D.agents[a]||{decisions:[]},s=D.state.agents[a]||{};const locked=a==='risk'&&s.guarding;
    const today=(d.decisions||[]).length;
    return `<div style="background:var(--c1);border-radius:20px;padding:16px;margin-top:14px">
    <div style="display:flex;align-items:center;gap:10px"><span class="sw" style="width:10px;height:10px;border-radius:50%;background:${s.paused?'var(--t3)':'var(--green)'}"></span>
    <div style="flex:1"><div style="font-weight:600;font-size:17px;color:${COLORS[a]}">${a[0].toUpperCase()+a.slice(1)}</div><div class="st" style="color:var(--t2);font-size:13px">${s.paused?'paused':'running'} · ${today} today${locked?' · locked while a position is open':''}</div></div>
    <div class="toggle ro ${s.paused?'':'on'}" title="read-only on this hosting"></div></div>
    <div style="margin-top:10px">${(d.decisions||[]).length?d.decisions.slice(0,20).map(r=>`<a class="lrow" href="${esc(r.coin_url)}" target="_blank" rel="noopener"><span style="color:var(--t2);width:72px">${ct(r.ts)}</span><span style="flex:1">${esc(short(r.mint))}</span><span class="lv">${esc(decText(a,r))}</span></a>`).join(''):'<div class="emptytxt" style="padding:16px 0">Nothing yet tonight</div>'}</div>
    <button class="lrow" style="width:100%;color:var(--green)" onclick="deskGo({tab:'account',sec:'${a}'})">Settings ›</button></div>`}).join('');
}
function decText(a,r){if(a==='scanner')return r.verdict==='pass'?'pass':r.reason;if(a==='auditor')return r.pass?'8/8':r.reason;if(a==='analyst')return r.pass?`pass · ${r.score}`:r.reason;if(a==='executor')return r.reason?`${r.verdict} · ${r.reason}`:r.verdict;return `${r.verdict} · ${r.pnl_usd>=0?'+':'-'}${usd(Math.abs(r.pnl_usd))}`}

// ---- ACTIVITY
function rows(rs,emptyText){if(!rs.length)return `<div class="emptytxt">${emptyText}</div>`;
  return `<div class="rows">${rs.map(r=>{const tr=r.kind!=='rejected';const ic={bought:'↗',sold:'✓',stopped:'↘',rejected:'✕'}[r.kind]||'·';
  const col=r.kind==='sold'?'up':r.kind==='stopped'?'down':'';
  return `<button class="row" onclick="deskGo({tab:'${tr?'coin':'audit'}',mint:'${esc(r.mint)}'})"><div class="ic">${ic}</div><div class="m"><div class="tt">${esc(r.title)}</div><div class="st">${esc(r.subtitle)}</div></div><div class="v ${col}">${esc(r.value)}</div></button>`}).join('')}</div>`}
function activity(){if(loading())return `<div class="nav"><div class="grow">Activity</div></div>${skel(60)}${skel(60,1)}${skel(60,1)}${skel(60,1)}`;
  return `<div class="nav"><div class="grow">Activity</div>${paper()}</div>`+rows(D.activity.rows||[],'Nothing yet tonight')}

// ---- AUDITOR SCREEN
function audit(){const a=view.mint&&D.audit[view.mint];const back=`<div class="nav"><button class="back" onclick="deskGo({tab:'activity'})">‹</button><div class="grow">Auditor</div></div>`;
  if(view.mint&&!a&&!failAt)return back+`<div class="disc-wrap">${Array.from({length:8},()=>'<div class="disc skel"></div>').join('')}</div>${skel(400)}`;
  if(!a||!(a.layers||[]).length)return back+`<div class="emptytxt">No coin taken apart yet</div>`;
  const red=a.layers.find(l=>l.pass===0),name=coinName(view.mint);
  const sig=(D.agents.executor||{decisions:[]}).decisions.find(r=>r.mint===view.mint);
  return back+`<div style="font-size:22px;font-weight:600">${esc(name)}</div>
  <div class="disc-wrap" id="discs">${a.layers.map(()=>'<div class="disc"></div>').join('')}</div>
  <div id="lrows">${a.layers.map(l=>`<div class="lrow" data-p="${l.pass==null?'n':l.pass}"><span>${l.layer} ${esc(l.name)}</span><span><span class="lv">…</span> <span class="mk"></span></span></div>`).join('')}</div>
  <div id="vd" style="visibility:hidden">${red?`<div class="verdict down">Rejected · ${esc(red.value_text)}</div><div class="sub">Grok Bot won't buy ${esc(name)}</div>`:`<div class="verdict up">Cleared · 8/8 parts</div><div class="sub">${sig&&sig.size_usd?`Sent to Executor · ${usd(sig.size_usd)}`:'Sent to Analyst'}</div>`}</div>
  <div class="lrow" style="margin-top:12px"><span>Take apart before buying</span><span class="toggle ro ${(D.settings||{})['auditor.enabled']!==false?'on':''}"></span></div>
  <div class="note">Read-only here: change it with a Telegram command ("set enabled to off" asks twice in the app spec; on this hosting send it to the desk bot).</div>
  <a class="full btn-green" href="${esc(a.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>`}
function beam(){const a=D.audit[view.mint];if(!a||!$('#discs'))return;const discs=[...document.querySelectorAll('#discs .disc')],rs=[...document.querySelectorAll('#lrows .lrow')];
  const fin=(i)=>{const l=a.layers[i];discs[i].className='disc '+(l.pass===1?'ok':l.pass===0?'bad':'');rs[i].querySelector('.lv').textContent=l.value_text;rs[i].querySelector('.mk').innerHTML=l.pass===1?'<span class="up">✓</span>':l.pass===0?'<span class="down">✕</span>':'<span style="color:var(--t3)">–</span>'};
  if(DCH.reduced()){a.layers.forEach((_,i)=>fin(i));$('#vd').style.visibility='visible';return}
  let i=0;(function step(){if(i>=a.layers.length){$('#vd').style.visibility='visible';return}discs[i].className='disc scan';const k=i;setTimeout(()=>{fin(k);i++;setTimeout(step,150)},350)})();}
function coinName(m){const c=D.coin[m];if(c&&c.name)return c.name;const r=(D.activity&&D.activity.rows||[]).find(r=>r.mint===m);return r?r.title.replace(/^(Bought|Sold|Stopped|Rejected) /,''):short(m)}

// ---- COIN SCREEN
function coin(){const c=view.mint&&D.coin[view.mint];const back=`<div class="nav"><button class="back" onclick="deskGo({tab:'activity'})">‹</button><div class="grow"></div>${paper()}</div>`;
  if(!c)return back+(failAt?`<div class="emptytxt">No data for this coin yet</div>`:`${skel(40)}${skel(70)}${skel(260)}${skel(140)}`);
  const p=c.position,open=p&&p.status!=='closed'&&!p.exit_reason,age=c.migratedAt?Math.floor((Date.now()/1000-c.migratedAt)/3600):null;
  const pass=(c.audit.layers||[]).filter(l=>l.pass===1).length;const chg=p&&c.price?100*(c.price/p.entry_price-1):null;const st=c.stats||{};
  return back+`<div style="display:flex;align-items:center;gap:8px"><div style="font-size:22px;font-weight:600">${esc(c.name||short(c.mint))}</div>${(c.audit.layers||[]).length?`<span class="chip">🛡 ${pass}/8</span>`:''}</div>
  <div class="sub">${esc(c.symbol||'')} · Solana${age!=null?` · ${age}h old`:''}</div>
  <div class="big" style="font-size:48px;margin-top:8px">${price(c.price)}</div>
  ${chg!=null?`<div class="sub ${chg>=0?'up':'down'}">${chg>=0?'▲':'▼'} ${Math.abs(chg).toFixed(1)}% since entry</div>`:''}
  <div class="chartbox candles">${c.candles.length?'<canvas id="cdl"></canvas>':'<div class="emptytxt">No candles yet</div>'}</div>
  <div class="stats"><div class="stat"><div class="l">Market cap</div><div class="x">${kfmt(st.marketCap)}</div></div><div class="stat"><div class="l">Liquidity</div><div class="x">${kfmt(st.liquidityUsd)}</div></div>
  <div class="stat"><div class="l">24h volume</div><div class="x">${kfmt(st.volumeH24)}</div></div><div class="stat"><div class="l">Holders</div><div class="x">${c.holders==null?'n/a':c.holders.toLocaleString('en-US')}</div></div></div>
  ${p?`<div style="background:var(--c1);border-radius:14px;padding:14px;margin-top:14px"><div style="font-weight:600">Your position · ${usd(p.size_usd)} in · Executor</div>
  ${open&&p.exitLines?`<div class="lrow"><span>Stop line</span><span class="lv">${price(p.exitLines.stop)} · -${p.stop_pct}%</span></div><div class="lrow"><span>Trail line</span><span class="lv">${p.exitLines.trail?price(p.exitLines.trail):'starts at +'+((D.settings||{})['risk.trail_start_pct']||20)+'%'}</span></div><div class="lrow" style="border:0"><span>Time left to timeout</span><span class="lv">${tleft(p.timeoutAt)}</span></div>`:`<div class="sub">Closed · ${esc(p.exit_reason||'')} · ${p.pnl_usd>=0?'+':'-'}${usd(Math.abs(p.pnl_usd||0))}</div>`}</div>`:''}
  <a class="full ${open?'btn-red':'btn-green'}" href="${esc(c.coin_url)}" target="_blank" rel="noopener">${open?'Sell on FOMO':'Buy on FOMO'}</a>`}
function tleft(t){const s=t-Date.now()/1000;if(s<=0)return 'due';return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`}
function drawCoin(){const c=D.coin[view.mint];const cv=$('#cdl');if(!c||!cv)return;const p=c.position,open=p&&!p.exit_reason;
  DCH.candles(cv,c.candles,open&&p.exitLines?(p.exitLines.trail||p.exitLines.stop):null)}

// ---- ACCOUNT
function account(){if(loading())return `<div class="nav"><div class="grow">Account</div></div>${skel(44)}${skel(120)}${skel(400)}`;
  const a=D.account,s=D.settings||{};const groups={};Object.keys(s).filter(k=>!k.startsWith('agent.')).forEach(k=>{const g=k.split('.')[0];(groups[g]=groups[g]||[]).push(k)});
  const RANGES={pct:[0,100]};
  return `<div class="nav"><div class="grow">Account</div></div>
  <div class="seg"><span class="${a.mode==='PAPER'?'on':''}">PAPER</span><span class="${a.mode==='LIVE'?'on':''}">LIVE</span></div>
  <div class="note">Mode is read-only here. Send "live" to the desk bot on Telegram and type LIVE to confirm (needs 1 full PAPER night).</div>
  <div class="rows"><div class="row"><div class="m"><div class="tt">Stack</div><div class="st">${a.mode==='PAPER'?'Simulated PAPER balance':'Set with "stack 1240" on Telegram'}</div></div><div class="v">${usd(a.stack)}</div></div>
  <a class="row" href="${esc(a.profile_url)}" target="_blank" rel="noopener"><div class="m"><div class="tt">Your FOMO profile</div><div class="st">@${esc(s['desk.fomo_handle']||'')}</div></div><div class="v" style="color:var(--t3)">›</div></a>
  <button class="row" id="invite"><div class="m"><div class="tt">Invite a friend</div><div class="st">Share your FOMO link</div></div><div class="v" style="color:var(--t3)">›</div></button>
  <div class="row"><div class="m"><div class="tt">Telegram</div><div class="st">Pushes and commands</div></div><div class="v ${a.telegram==='connected'?'up':'down'}">${a.telegram==='connected'?'Connected':'Not connected'}</div></div>
  <div class="row"><div class="m"><div class="tt">Notifications</div><div class="st">Notifications go to Telegram on this hosting</div></div></div></div>
  <h2>Settings</h2><div class="note">Read-only. Change any setting with a Telegram command, e.g. "set stop to -8%".</div>
  ${Object.entries(groups).map(([g,ks])=>`<div id="sec-${g}" style="font-weight:600;margin:16px 0 8px;text-transform:capitalize">${g}</div><div class="rows">${ks.map(k=>setRow(k,s[k])).join('')}</div>`).join('')}`}
function setRow(k,v){const label=k.split('.').slice(1).join(' ').replace(/_/g,' ');
  if(typeof v==='number'){const max=v<=1&&!Number.isInteger(v)?1:Math.max(v*3,1);return `<div class="set"><span>${esc(label)}</span><input type="range" disabled min="0" max="${max}" step="any" value="${v}"><span class="sv">${v}</span></div>`}
  return `<div class="set"><span>${esc(label)}</span><span class="sv">${esc(String(v))}</span></div>`}
after.account=()=>{const b=$('#invite');if(b)b.onclick=async()=>{const u=D.account.signup_url;try{if(navigator.share){await navigator.share({url:u});return}}catch(e){return}
  try{await navigator.clipboard.writeText(u)}catch(e){}const t=document.createElement('div');t.className='toast';t.textContent='Link copied';document.body.appendChild(t);setTimeout(()=>t.remove(),1600)};
  if(view.sec){const el=$('#sec-'+view.sec);el&&el.scrollIntoView()}};

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
window.__deskReady=()=>D.state!=null||failAt!=null;
if(!DP){window.__deskReady=()=>true;$('#view').innerHTML=`<div class="paste"><h2>Paste your desk link</h2><p class="dim">Home-screen apps keep their own storage. Paste the desk link from Telegram (full link or just the path).</p><input id="pl" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/#d=…"><button id="ps" class="btn">Save</button><div id="pm" class="dim"></div></div>`;
  const nav=document.querySelector('nav');if(nav)nav.hidden=true;
  $('#ps').onclick=async()=>{const v=$('#pl').value.trim();const m=v.match(/(?:[#&]d=|\/d\/)?([A-Za-z0-9_\-]{32,})\/?(?:[^A-Za-z0-9_\-].*)?$/);const pm=$('#pm');
    if(!m){pm.textContent='That does not look like a desk link.';return}pm.textContent='Checking…';
    try{const r=await fetch(`d/${m[1]}/state.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw 0;await r.json();localStorage.setItem('desk_d',m[1]);location.reload()}
    catch(e){pm.textContent='Could not reach that desk. Check the link and try again.'}};
  return}
render();poll();setInterval(poll,POLL*1000);
})();
