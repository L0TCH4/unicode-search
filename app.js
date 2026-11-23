(() => {
'use strict';
// [表示名, ブロック名にマッチする正規表現, 既定でON]  どれにも当てはまらないブロックは「その他」
const GROUPS = [
['ラテン文字',/^(Basic Latin|Latin|IPA Extensions|Phonetic Extensions|Spacing Modifier|Modifier Tone)/,1],
['ギリシャ文字',/^Greek/,1],
['キリル文字',/^Cyrillic/,1],
['ひらがな',/^Hiragana$/,1],
['カタカナ',/^Katakana/,1],
['変体仮名・仮名拡張',/^(Kana Supplement|Kana Extended|Small Kana)/,0],
['漢字',/^(CJK Unified Ideographs$|CJK Compatibility Ideographs$|CJK Radicals|Kangxi|CJK Strokes|Ideographic Description)/,1],
['漢字(拡張・補助)',/^(CJK Unified Ideographs Extension|CJK Compatibility Ideographs Supplement)/,0],
['全角・囲み文字・CJK記号',/^(CJK Symbols|Halfwidth and Fullwidth|Enclosed CJK|CJK Compatibility( Forms)?$|Enclosed Ideographic|Enclosed Alphanumeric|Small Form|Vertical Forms)/,1],
['ハングル',/^Hangul/,0],
['数学・数字記号',/^(Mathematical|Supplemental Mathematical|Miscellaneous Mathematical|Number Forms|Superscripts and Subscripts|Letterlike|Counting Rod|Common Indic Number|Ancient Greek Numbers)/,1],
['矢印',/Arrows/,1],
['句読点・記号・図形',/^(General Punctuation|Supplemental Punctuation|Currency|Miscellaneous Technical|Control Pictures|Optical Character|Box Drawing|Block Elements|Geometric Shapes|Miscellaneous Symbols$|Dingbats|Ornamental Dingbats|Braille|Musical|Alchemical|Mahjong|Domino|Playing Cards|Chess|Legacy Computing|Yijing|Tai Xuan)/,1],
['絵文字',/^(Emoticons|Miscellaneous Symbols and Pictographs|Transport and Map|Supplemental Symbols and Pictographs|Symbols and Pictographs Extended)/,0],
['アラビア文字',/^Arabic/,0],
['ヘブライ文字',/^Hebrew/,0],
['インド系文字',/^(Devanagari|Bengali|Gurmukhi|Gujarati|Oriya|Tamil|Telugu|Kannada|Malayalam|Sinhala|Tibetan|Vedic|Syloti|Saurashtra|Kaithi|Sharada|Brahmi|Grantha|Newa|Modi|Takri|Siddham)/,0],
['東南アジアの文字',/^(Thai|Lao|Myanmar|Khmer|Javanese|Balinese|Sundanese|Cham|Tai |New Tai|Batak|Rejang|Lepcha|Limbu|Buginese)/,0],
];
const GL = GROUPS.map(g=>g[0]).concat(['その他']);
const grpOf = n => { const i=GROUPS.findIndex(g=>g[1].test(n)); return i<0?GROUPS.length:i; };
// [英語ブロック名, 表示名, 開始, 終了, 既定でON]  (data/blocks.js は tools/build_data.py で生成)
const B = window.BLOCKS.map(([n,s,e])=>{ const g=GROUPS[grpOf(n)]; return [n,n,s,e,g&&g[2]?1:0]; });
const gIdx = B.map(b=>grpOf(b[0]));
const CATS = {Lu:'大文字',Ll:'小文字',Lt:'タイトル文字',Lm:'修飾文字',Lo:'その他の文字',Nd:'十進数字',Nl:'数字(文字)',No:'その他の数',
  Pc:'連結句読点',Pd:'ダッシュ',Ps:'開き括弧',Pe:'閉じ括弧',Pi:'開き引用符',Pf:'閉じ引用符',Po:'その他の句読点',
  Sm:'数学記号',Sc:'通貨記号',Sk:'修飾記号',So:'その他の記号'};
const VALID = /^[\p{L}\p{N}\p{P}\p{S}]$/u;
const N = 32, INNER = 28, DIM = 512;
const $ = id => document.getElementById(id);

// ---------- 特徴抽出 ----------
function blur(a){
  const o = new Float32Array(N*N);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    let s=0,c=0;
    for (let j=-1;j<=1;j++) for (let i=-1;i<=1;i++){
      const xx=x+i, yy=y+j;
      if (xx>=0&&xx<N&&yy>=0&&yy<N){ s+=a[yy*N+xx]; c++; }
    }
    o[y*N+x]=s/c;
  }
  return o;
}
// canvas(白地に黒インク) → {vec, ar}。インクが無ければ null
function featurize(cv){
  const w=cv.width, h=cv.height;
  const d=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;
  const W=w+1, I=new Float32Array(W*(h+1));
  for (let y=0;y<h;y++){
    let row=0;
    for (let x=0;x<w;x++){
      const o=(y*w+x)*4, v=1-(d[o]+d[o+1]+d[o+2])/765;
      if (v>0.35){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
      row+=v; I[(y+1)*W+x+1]=I[y*W+x+1]+row;
    }
  }
  if (x1<0) return null;
  const bw=x1-x0+1, bh=y1-y0+1, s=Math.min(INNER/bw, INNER/bh);
  const dx=(N-bw*s)/2, dy=(N-bh*s)/2;
  const cl=(v,m)=>Math.max(0,Math.min(m,v));
  let img=new Float32Array(N*N);
  for (let j=0;j<N;j++){
    const v0=(j-dy)/s, v1=(j+1-dy)/s;
    if (v1<=0||v0>=bh) continue;
    const ya=cl(Math.floor(y0+v0),h), yb=Math.max(ya+1,cl(Math.ceil(y0+v1),h+1));
    for (let i=0;i<N;i++){
      const u0=(i-dx)/s, u1=(i+1-dx)/s;
      if (u1<=0||u0>=bw) continue;
      const xa=cl(Math.floor(x0+u0),w), xb=Math.max(xa+1,cl(Math.ceil(x0+u1),w+1));
      const yb2=Math.min(yb,h), xb2=Math.min(xb,w);
      if (xb2<=xa||yb2<=ya) continue;
      const sum=I[yb2*W+xb2]-I[ya*W+xb2]-I[yb2*W+xa]+I[ya*W+xa];
      img[j*N+i]=sum/((xb2-xa)*(yb2-ya));
    }
  }
  img=blur(blur(img));
  const f=new Float32Array(DIM);
  // 画像部分 16x16 (平均を引いて正規化)
  let m=0;
  for (let y=0;y<16;y++) for (let x=0;x<16;x++){
    const v=(img[2*y*N+2*x]+img[2*y*N+2*x+1]+img[(2*y+1)*N+2*x]+img[(2*y+1)*N+2*x+1])/4;
    f[y*16+x]=v; m+=v;
  }
  m/=256;
  let n1=0;
  for (let k=0;k<256;k++){ f[k]-=m; n1+=f[k]*f[k]; }
  n1=Math.sqrt(n1)||1;
  // 方向部分 8x8x4
  const at=(x,y)=>img[cl(y,N-1)*N+cl(x,N-1)];
  let n2=0;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const gx=at(x+1,y)-at(x-1,y), gy=at(x,y+1)-at(x,y-1);
    const mag=Math.hypot(gx,gy);
    if (mag<1e-4) continue;
    let a=Math.atan2(gy,gx); if (a<0) a+=Math.PI; if (a>=Math.PI) a-=Math.PI;
    const bin=Math.floor(a/(Math.PI/4))%4;
    f[256+((y>>2)*8+(x>>2))*4+bin]+=mag;
  }
  for (let k=256;k<DIM;k++){ f[k]=Math.sqrt(f[k]); n2+=f[k]*f[k]; }
  n2=Math.sqrt(n2)||1;
  const r=Math.SQRT1_2;
  for (let k=0;k<256;k++) f[k]=f[k]/n1*r;
  for (let k=256;k<DIM;k++) f[k]=f[k]/n2*r;
  return {vec:f, ar:Math.log(bw/bh)};
}

// ---------- フォント描画 ----------
const gc=document.createElement('canvas'); gc.width=gc.height=96;
const gx=gc.getContext('2d',{willReadFrequently:true});
let family='sans-serif';
function glyph(ch){
  gx.fillStyle='#fff'; gx.fillRect(0,0,96,96);
  gx.fillStyle='#000'; gx.font='64px '+family;
  gx.textAlign='center'; gx.textBaseline='middle';
  gx.fillText(ch,48,50);
  return featurize(gc);
}
let tofu=[];
function makeTofuRefs(){
  tofu=[0x378,0xFFFF,0x10FFFF,0xE000,0x2FFF].map(c=>glyph(String.fromCodePoint(c))).filter(Boolean);
}
const Q=179;
const dotq=(a,b,o)=>{let s=0;for(let k=0;k<DIM;k++)s+=a[k]*b[o+k];return s/Q;};
const dot=(a,b,o=0)=>{let s=0;for(let k=0;k<DIM;k++)s+=a[k]*b[o+k];return s;};
const isTofu=f=>tofu.some(t=>dot(t.vec,f.vec)>0.9995);

// ---------- インデックス ----------
const cache=new Map();  // "family|ブロック番号" → {cps, vecs, ars}
let gen=0;
const on=B.map(b=>!!b[4]);
async function indexBlock(bi,myGen,progress){
  const key=family+'|'+bi;
  if (cache.has(key)) return cache.get(key);
  const [, , s, e]=B[bi], cps=[], vs=[], ars=[]; let tick=0;
  for (let cp=s;cp<=e;cp++){
    if (cp>=0xD800&&cp<=0xDFFF) continue;
    const ch=String.fromCodePoint(cp);
    if (!VALID.test(ch)) continue;
    if (++tick%200===0){ await new Promise(r=>setTimeout(r)); if (gen!==myGen) return null; progress(cp-s,e-s); }
    const f=glyph(ch);
    if (!f||isTofu(f)) continue;
    cps.push(cp); vs.push(f.vec); ars.push(f.ar);
  }
  const vecs=new Int8Array(cps.length*DIM);
  vs.forEach((v,i)=>{ for (let k=0;k<DIM;k++) vecs[i*DIM+k]=Math.round(v[k]*Q); });
  const res={cps,vecs,ars:Float32Array.from(ars)};
  cache.set(key,res);
  return res;
}
let busy=false, again=false;
async function ensure(){
  if (busy){ again=true; return; }
  busy=true;
  do {
    again=false;
    const myGen=gen;
    makeTofuRefs();
    const todo=B.map((_,i)=>i).filter(i=>on[i]&&!cache.has(family+'|'+i));
    for (let t=0;t<todo.length;t++){
      const bi=todo[t];
      const r=await indexBlock(bi,myGen,(a,b)=>setStatus(`準備中 ${t+1}/${todo.length}: ${B[bi][1]} ${Math.round(a/b*100)}%`));
      if (gen!==myGen){ again=true; break; }
      if (r) recognize();
    }
  } while (again);
  busy=false;
  let n=0; B.forEach((_,i)=>{ if(on[i]){const c=cache.get(family+'|'+i); if(c) n+=c.cps.length;} });
  setStatus(`検索対象 ${n.toLocaleString()}文字`);
}
function setStatus(t){ $('status').textContent=t; }

// ---------- 検索 ----------
function search(q,K=36){
  const top=[];
  for (let bi=0;bi<B.length;bi++){
    if (!on[bi]) continue;
    const c=cache.get(family+'|'+bi);
    if (!c) continue;
    for (let i=0;i<c.cps.length;i++){
      const sc=dotq(q.vec,c.vecs,i*DIM)-0.08*Math.min(2,Math.abs(q.ar-c.ars[i]));
      if (top.length>=K&&sc<=top[K-1].sc) continue;
      let p=top.length; while (p>0&&top[p-1].sc<sc) p--;
      top.splice(p,0,{cp:c.cps[i],sc});
      if (top.length>K) top.pop();
    }
  }
  return top;
}
const hex=cp=>cp.toString(16).toUpperCase().padStart(4,'0');
let selected=null, namesP=null, NM=null;
const RG=[];
function loadNames(){
  if (namesP) return namesP;
  return namesP=new Promise(res=>{
    const sc=document.createElement('script'); sc.src='names.js';
    sc.onload=()=>{
      NM=new Map();
      for (const line of window.UNAMES.split('\n')){
        const i=line.indexOf(';'); if (i<0) continue;
        const k=line.slice(0,i), v=line.slice(i+1);
        if (k.includes('..')){ const [a,b]=k.split('..'); RG.push([parseInt(a,16),parseInt(b,16),v]); }
        else NM.set(parseInt(k,16),v);
      }
      window.UNAMES=''; res();
    };
    sc.onerror=()=>{ NM=new Map(); res(); };
    document.head.appendChild(sc);
  });
}
function nameOf(cp){
  if (!NM) return null;
  const n=NM.get(cp); if (n) return n;
  for (const [a,b,p] of RG) if (cp>=a&&cp<=b) return p+hex(cp);
  return null;
}
const CH=62, GAP=6;
let lastList=[], lastMsg='';
function render(list,msg){ lastList=list; lastMsg=msg; paint(); }
function paint(){
  const box=$('results');
  box.innerHTML='';
  box.scrollTop=0;
  if (!lastList.length){ box.style.display='block'; box.innerHTML='<p class="empty">'+lastMsg+'</p>'; return; }
  box.style.display='grid';
  box.style.gridTemplateColumns='repeat(auto-fill,minmax(60px,1fr))';
  box.style.gridAutoRows=CH+'px';
  box.style.alignContent='start';
  const frag=document.createDocumentFragment();
  for (const cp of lastList){
    const b=document.createElement('button');
    b.type='button'; b.className='card'; b.setAttribute('aria-pressed',String(cp===selected));
    b.innerHTML='<span class="ch"></span><span class="cp">U+'+hex(cp)+'</span>';
    const ch=b.firstChild; ch.textContent=String.fromCodePoint(cp); ch.style.fontFamily=family;
    if (NM) b.title=nameOf(cp)||'';
    b.onclick=()=>choose(cp);
    frag.appendChild(b);
  }
  box.appendChild(frag);
}
function recognize(){
  if (!strokes.length){ if (!$('q').value.trim()) render([],'ここに文字を描くと、似た文字が表示されます。'); return; }
  const q=featurize(pad);
  render(q?search(q,120).map(r=>r.cp):[],'候補がありません。設定で検索対象のブロックを増やしてみてください。');
  loadNames().then(paint);
}
async function nameSearch(text){
  await loadNames();
  const t=text.trim().toUpperCase();
  if (!t){ recognize(); return; }
  const out=[], terms=t.split(/\s+/), ok=n=>terms.every(w=>n.includes(w)), M=120;
  const m=/^(?:U\+)?([0-9A-F]{1,6})$/.exec(t);
  if (m){ const cp=parseInt(m[1],16); if (cp<=0x10FFFF&&!(cp>=0xD800&&cp<=0xDFFF)) out.push(cp); }
  for (const [cp,n] of NM){ if (out.length>=M) break; if (ok(n)&&!out.includes(cp)) out.push(cp); }
  for (const [a,b,p] of RG){ for (let cp=a;cp<=b&&out.length<M;cp++) if (ok(p+hex(cp))&&!out.includes(cp)) out.push(cp); }
  render(out,'該当する文字がありません。英語の文字名(例: ARROW, SNOWMAN)かコード(例: U+2603)で試してください。');
  setStatus(out.length+'件');
}
function choose(cp){
  selected=cp;
  document.querySelectorAll('.card').forEach(b=>b.setAttribute('aria-pressed',String(b.querySelector('.cp').textContent==='U+'+hex(cp))));
  const ch=String.fromCodePoint(cp), H=cp.toString(16).toUpperCase();
  let cat='—';
  for (const k in CATS){ if (new RegExp('^\\p{'+k+'}$','u').test(ch)){ cat=k+' '+CATS[k]; break; } }
  const blk=B.find(b=>cp>=b[2]&&cp<=b[3]);
  const utf8=[...new TextEncoder().encode(ch)].map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' ');
  const d=$('detail');
  d.innerHTML=`<div class="top"><div class="big"></div><p class="nm">読み込み中…</p></div>
    <dl><div><dt>コード</dt><dd>U+${hex(cp)}</dd></div><div><dt>カテゴリ</dt><dd>${cat}</dd></div>
    <div><dt>ブロック</dt><dd>${blk?blk[0]:'—'}</dd></div><div class="opt"><dt>UTF-8</dt><dd>${utf8}</dd></div>
    <div class="opt"><dt>HTML</dt><dd>&amp;#x${H};</dd></div><div class="opt"><dt>JS</dt><dd>\\u{${H}}</dd></div></dl>
    <div class="acts"><button type="button" id="cc" class="primary">コピーする</button><button type="button" id="cu" title="U+コードをコピー">コード</button>
    <button type="button" id="cn" title="文字名をコピー">名前</button><a href="https://codepoints.net/U+${hex(cp)}" target="_blank" rel="noopener">詳細</a></div>`;
  d.querySelector('.big').textContent=ch; d.querySelector('.big').style.fontFamily=family;
  $('cc').onclick=()=>copy(ch); $('cu').onclick=()=>copy('U+'+hex(cp));
  loadNames().then(()=>{
    if (selected!==cp) return;
    const n=nameOf(cp)||'(名前なし)';
    d.querySelector('.nm').textContent=n;
    $('cn').onclick=()=>copy(n);
  });
}
async function copy(t){
  let ok=false;
  try { await navigator.clipboard.writeText(t); ok=true; } catch(_) {}
  toast(ok?`コピーしました: ${t}`:'コピーできませんでした。文字を長押しして選択してください');
}
let toastEl;
function toast(t){
  toastEl&&toastEl.remove();
  toastEl=document.createElement('div'); toastEl.className='toast'; toastEl.textContent=t; toastEl.setAttribute('role','status');
  document.body.appendChild(toastEl);
  setTimeout(()=>toastEl&&toastEl.remove(),1800);
}

// ---------- 手書き入力 ----------
const pad=$('pad'), pc=pad.getContext('2d',{willReadFrequently:true});
let strokes=[], cur=null, timer;
function redraw(){
  pc.fillStyle='#fff'; pc.fillRect(0,0,400,400);
  pc.strokeStyle='#000'; pc.lineWidth=10; pc.lineCap=pc.lineJoin='round';
  for (const s of strokes){
    pc.beginPath();
    s.forEach(([x,y],i)=>i?pc.lineTo(x,y):pc.moveTo(x,y));
    if (s.length===1) pc.lineTo(s[0][0]+0.01,s[0][1]);
    pc.stroke();
  }
}
const pos=e=>{const r=pad.getBoundingClientRect();return [(e.clientX-r.left)*400/r.width,(e.clientY-r.top)*400/r.height];};
pad.addEventListener('pointerdown',e=>{
  e.preventDefault(); pad.setPointerCapture(e.pointerId);
  clearTimeout(timer); $('q').value=''; cur=[pos(e)]; strokes.push(cur); redraw();
});
pad.addEventListener('pointermove',e=>{ if(cur){ cur.push(pos(e)); redraw(); } });
const end=()=>{ if(!cur) return; cur=null; clearTimeout(timer); timer=setTimeout(recognize,200); };
pad.addEventListener('pointerup',end); pad.addEventListener('pointercancel',end);
$('undo').onclick=()=>{ strokes.pop(); redraw(); recognize(); };
$('clear').onclick=()=>{ strokes=[]; redraw(); recognize(); };

// ---------- 設定UI ----------
const bx=$('blocks'), gBoxes=[], bBoxes=[];
let realNames=false;
function syncAll(){
  gBoxes.forEach((o,g)=>{
    if (!o) return;
    const n=o.idx.filter(i=>on[i]).length;
    o.c.checked=n===o.idx.length; o.c.indeterminate=n>0&&n<o.idx.length;
    o.cnt.textContent=n+'/'+o.idx.length;
  });
  bBoxes.forEach((c,i)=>{ if (c) c.checked=on[i]; });
}
function changed(){ syncAll(); ensure(); recognize(); }
function buildBlocks(){
  bx.innerHTML=''; bx.classList.toggle('real',realNames);
  gBoxes.length=0; bBoxes.length=0;
  GL.forEach((name,g)=>{
    const idx=B.map((_,i)=>i).filter(i=>gIdx[i]===g);
    if (!idx.length) return;
    const wrap=document.createElement('div'); wrap.className='grp';
    const head=document.createElement('label'), c=document.createElement('input'), cnt=document.createElement('span');
    c.type='checkbox'; cnt.className='n';
    c.onchange=()=>{ idx.forEach(i=>{ on[i]=c.checked; }); changed(); };
    head.append(c,document.createTextNode(name),cnt); wrap.appendChild(head);
    gBoxes[g]={c,cnt,idx};
    if (realNames){
      const sub=document.createElement('div'); sub.className='sub';
      idx.forEach(i=>{
        const l=document.createElement('label'), k=document.createElement('input');
        k.type='checkbox'; k.onchange=()=>{ on[i]=k.checked; changed(); };
        l.title='U+'+hex(B[i][2])+'–U+'+hex(B[i][3]);
        l.append(k,document.createTextNode(B[i][0])); sub.appendChild(l); bBoxes[i]=k;
      });
      wrap.appendChild(sub);
    }
    bx.appendChild(wrap);
  });
  syncAll();
}
function preset(fn){ B.forEach((_,i)=>{ on[i]=fn(i); }); changed(); }
$('real').onchange=()=>{ realNames=$('real').checked; buildBlocks(); };
$('p-def').onclick=()=>preset(i=>!!B[i][4]);
$('p-all').onclick=()=>{ if (confirm('すべてのブロック(約15万字)を索引化します。数分かかり、メモリも使います。続けますか？')) preset(()=>true); };
$('p-none').onclick=()=>preset(()=>false);
buildBlocks();
let qt; $('q').oninput=()=>{ clearTimeout(qt); qt=setTimeout(()=>nameSearch($('q').value),250); };
function setFont(){
  const v=$('font').value, cf=$('customFont');
  cf.hidden=v!=='custom';
  const next=v==='custom'?(cf.value.trim()?`"${cf.value.trim().replace(/"/g,'')}",sans-serif`:'sans-serif'):v;
  if (next===family) return;
  family=next; gen++; cache.clear(); ensure(); recognize();
}
$('font').onchange=setFont; $('customFont').onchange=setFont;

const dlg=$('settings');
$('open-set').onclick=()=>dlg.showModal();
$('close-set').onclick=()=>dlg.close();
dlg.addEventListener('click',e=>{ if (e.target===dlg) dlg.close(); });
redraw(); recognize(); ensure();
})();
