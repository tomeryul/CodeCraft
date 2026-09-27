/* Counts from a design census (scripts/design-census.js): every variant of
   font size, weight, section title, radius, button, header, colour, box —
   with the pages each appears on. */
const C=JSON.parse(require('fs').readFileSync(process.argv[2]||'census-en.json'));
const pages=Object.keys(C);
const tally=(rows,key)=>{const m={};for(const [p,r] of rows){const k=key(r);(m[k]=m[k]||{n:0,p:new Set(),ex:new Set()});m[k].n++;m[k].p.add(p);if(m[k].ex.size<3)m[k].ex.add(r.t||r.c||'');}return Object.entries(m).sort((a,b)=>b[1].n-a[1].n);};
const rows=f=>pages.flatMap(p=>(C[p][f]||[]).map(r=>[p,r]));
const show=(title,t,lim=40)=>{console.log('\n== '+title+' ('+t.length+' variants)');for(const [k,v] of t.slice(0,lim))console.log(String(v.n).padStart(4)+'  '+k.padEnd(46)+' pages:'+[...v.p].slice(0,7).join(',')+(v.p.size>7?'…':'')+'  e.g. '+[...v.ex].join(' | ').slice(0,70));};
const which=process.argv[3]||'all';
if(which==='all'||which==='fs')show('TEXT font-size',tally(rows('texts'),r=>r.fs));
if(which==='all'||which==='fw')show('TEXT font-weight',tally(rows('texts'),r=>r.fw));
if(which==='all'||which==='ff')show('font family (text+buttons)',tally(rows('texts').concat(rows('buttons')),r=>r.ff));
if(which==='all'||which==='upper')show('UPPERCASE labels: size/weight/spacing/color',tally(rows('texts').filter(([p,r])=>r.tt==='uppercase'),r=>r.fs+' '+r.fw+' ls='+r.ls+' '+r.col),60);
if(which==='all'||which==='rad')show('radius (boxes+buttons+inputs)',tally(rows('boxes').concat(rows('buttons'),rows('inputs')),r=>r.rad),40);
if(which==='all'||which==='btn')show('BUTTON kinds (h / radius / fs / weight / bg)',tally(rows('buttons').filter(([p,r])=>r.h>=24),r=>r.h+'h r'+r.rad+' '+r.fs+'/'+r.fw+' '+r.bg),80);
if(which==='all'||which==='head'){console.log('\n== HEADERS');for(const p of pages){const h=C[p].head;if(h)console.log(p.padEnd(16),'h='+h.h,'title',h.title&&(h.title.fs+'/'+h.title.fw+' "'+h.title.t+'"'),'sub',h.sub&&(h.sub.fs+' "'+h.sub.t.slice(0,40)+'"'),'btns',JSON.stringify(h.btns));}}
if(which==='all'||which==='col')show('TEXT colors',tally(rows('texts'),r=>r.col),30);
if(which==='all'||which==='box')show('BOX kinds (radius / bg / border)',tally(rows('boxes'),r=>'r'+r.rad+' '+r.bg+' '+r.bd),60);
