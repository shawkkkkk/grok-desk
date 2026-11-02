/* Hand-drawn canvas charts, devicePixelRatio aware. No chart library. */
(function(){
const C={green:'#00d35a',red:'#ff453a',blue:'#0a84ff',orange:'#ff9f0a',t2:'rgba(235,235,245,0.6)',t3:'rgba(235,235,245,0.3)',sep:'rgba(84,84,88,0.55)',c2:'#2c2c2e'};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function setup(cv){const dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);return{x,w,h}}
function font(x,s,w){x.font=`${w||600} ${s}px -apple-system,"SF Pro Text",system-ui,sans-serif`}

function line(cv,pts,marks,start,anim){
  const {x,w,h}=setup(cv);const top=34,bot=h-10,pad=16;
  if(!pts.length)return;
  const vs=pts.map(p=>p[1]).concat(start!=null?[start]:[]);let lo=Math.min(...vs),hi=Math.max(...vs);if(hi-lo<1e-9){hi+=1;lo-=1}
  const t0=pts[0][0],t1=pts[pts.length-1][0]||t0+1;
  const X=t=>pad+(w-2*pad)*((t-t0)/Math.max(1,t1-t0)),Y=v=>bot-(bot-top)*((v-lo)/(hi-lo));
  const k=anim==null?1:anim;
  if(start!=null){x.setLineDash([4,4]);x.strokeStyle=C.t3;x.lineWidth=1;x.beginPath();x.moveTo(0,Y(start));x.lineTo(w,Y(start));x.stroke();x.setLineDash([])}
  const n=pts.length;const xy=pts.map(p=>[X(p[0]),Y(p[1])]);
  if(n>1&&k<1){const a=xy[n-2],b=xy[n-1];xy[n-1]=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]}
  const g=x.createLinearGradient(0,top,0,bot);g.addColorStop(0,'rgba(0,211,90,0.28)');g.addColorStop(1,'rgba(0,211,90,0)');
  x.beginPath();xy.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.lineTo(xy[n-1][0],bot);x.lineTo(xy[0][0],bot);x.closePath();x.fillStyle=g;x.fill();
  x.beginPath();xy.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.strokeStyle=C.green;x.lineWidth=2;x.lineJoin='round';x.stroke();
  x.beginPath();x.arc(xy[n-1][0],xy[n-1][1],4,0,7);x.fillStyle=C.green;x.fill();
  // marks above the line; a later mark that would overlap moves up a row
  font(x,11);const placed=[];
  (marks||[]).filter(m=>m.ts>=t0&&m.ts<=t1).forEach(m=>{
    const v=interp(pts,m.ts),px=X(m.ts),py=Y(v);const tw=x.measureText(m.label).width+12;
    let row=0;const cx0=Math.min(w-tw/2-2,Math.max(tw/2+2,px));while(placed.some(p=>p.row===row&&Math.abs(p.x-cx0)<(p.w+tw)/2+4))row++;
    const cx=Math.min(w-tw/2-2,Math.max(tw/2+2,px));placed.push({x:cx,w:tw,row});const ly=Math.max(12,py-16-row*22);
    x.globalAlpha=m.alpha==null?1:m.alpha;
    x.fillStyle=m.color;roundRect(x,cx-tw/2,ly-9,tw,18,9);x.fill();x.fillStyle=m.color===C.green?'#000':'#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(m.label,cx,ly);
    x.strokeStyle=m.color;x.globalAlpha*=.5;x.beginPath();x.moveTo(px,ly+9);x.lineTo(px,py);x.stroke();x.globalAlpha=1});
}
function interp(pts,t){for(let i=1;i<pts.length;i++)if(pts[i][0]>=t){const a=pts[i-1],b=pts[i];return a[1]+(b[1]-a[1])*((t-a[0])/Math.max(1e-9,b[0]-a[0]))}return pts[pts.length-1][1]}
function roundRect(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}

function candles(cv,cs,exitLine,entry){
  const {x,w,h}=setup(cv);if(!cs.length)return;const volH=46,top=10,bot=h-volH-14,pad=12;
  let lo=Math.min(...cs.map(c=>c.l)),hi=Math.max(...cs.map(c=>c.h));if(exitLine){lo=Math.min(lo,exitLine);hi=Math.max(hi,exitLine)}
  if(hi-lo<1e-15){hi*=1.01;lo*=.99}
  const Y=v=>bot-(bot-top)*((v-lo)/(hi-lo));const n=cs.length,step=(w-2*pad)/n,bw=Math.max(2,step*.62);
  const vmax=Math.max(1e-9,...cs.map(c=>c.v||0));
  cs.forEach((c,i)=>{const cx=pad+step*i+step/2,col=c.c>=c.o?C.green:C.red;x.strokeStyle=col;x.fillStyle=col;x.lineWidth=1;
    x.beginPath();x.moveTo(cx,Y(c.h));x.lineTo(cx,Y(c.l));x.stroke();const a=Y(Math.max(c.o,c.c)),b=Y(Math.min(c.o,c.c));x.fillRect(cx-bw/2,a,bw,Math.max(1,b-a));
    const vh=(volH-4)*((c.v||0)/vmax);x.globalAlpha=.45;x.fillRect(cx-bw/2,h-4-vh,bw,vh);x.globalAlpha=1});
  if(exitLine){const y=Y(exitLine);x.setLineDash([6,4]);x.strokeStyle=C.orange;x.lineWidth=1.5;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();x.setLineDash([]);
    font(x,11);x.fillStyle=C.orange;x.textAlign='left';x.textBaseline='bottom';x.fillText('Risk trailing stop',pad,y-3)}
}

function ring(cv,score,min){
  const {x,w,h}=setup(cv);const r=Math.min(w,h)/2-8,cx=w/2,cy=h/2;
  x.lineWidth=12;x.lineCap='round';x.strokeStyle=C.c2;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();
  if(score!=null){x.strokeStyle=score>=min?C.green:'#ffd60a';x.beginPath();x.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+2*Math.PI*score/100);x.stroke()}
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='600 40px -apple-system,"SF Pro Display",system-ui';x.fillText(score==null?'–':String(score),cx,cy);
}
window.DeskChart={line,candles,ring,reduced,C};
})();
