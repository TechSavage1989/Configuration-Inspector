// Real hardware on the diagram (owner requests): a modular chassis draws each module in slot order,
// stack members name their own model, described aggregated uplinks land on the far end's uplink
// ports (one link per member pair, not one link to an unnumbered spot), and every port map page
// carries the port role legend. Fictional configurations with documentation addresses only.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
const range=(p,a,z)=>Array.from({length:z-a+1},(_,i)=>p+(a+i)).join(',');
const MDF=['; J9850A Configuration Editor; Created on release #KB.16.10.0025','hostname "EX-CORE"','module A type j9993a','module B type j9987a','module C type j9993a','module E type j9993a','module F type j9993a',
 'trunk A1,C1 trk1 lacp','trunk A5,A6 trk2 lacp','trunk C6,C7 trk3 lacp','trunk E7,E8 trk4 lacp','interface E7','   name "Uplink to EX-IDF-SW05"','   exit','interface E8','   name "Uplink to EX-IDF-SW05"','   exit','interface F8','   name "uplink_to_EX-IDF-SW06"','   exit','interface C6','   name "Uplink to EX-IDF-SW04"','   exit','interface C7','   name "Uplink to EX-IDF-SW04"','   exit','interface A3','   name "uplink_to_EX-IDF-SW03"','   exit','interface A5','   name "Uplink to EX-IDF-SW02"','   exit','interface A6','   name "Uplink to EX-IDF-SW02"','   exit','interface A1','   name "Uplink to EX-IDF-STACK"','   exit','interface A2','   name "uplink_to_EX-IDF-SW01"','   exit','interface C1','   name "Uplink to EX-IDF-STACK"','   exit',
 'vlan 1','   name "DEFAULT_VLAN"','   untagged '+range('B',1,24),'   exit','vlan 10','   name "Data"','   tagged Trk1,A2','   ip address 192.0.2.1 255.255.255.0','   exit'].join('\n')+'\n';
const IDF=['; hpStack_WC Configuration Editor; Created on release #WC.16.10.0025','hostname "EX-IDF-STACK"','vsf','   enable domain 1',
 ...[1,2,3].flatMap(i=>['   member '+i,'      type "'+(i===3?'JL256A':'JL558A')+'" mac-address 020000-00000'+i,'      priority '+(200-i),'      link 1 '+i+'/51','      link 2 '+i+'/52','      exit']),'   exit',
 'trunk 1/50,2/50 trk1 lacp','interface 1/50','   name "uplink_to_core"','   exit','interface 2/50','   name "uplink_to_core"','   exit',
 'vlan 1','   name "DEFAULT_VLAN"','   untagged '+range('1/',1,48)+','+range('2/',1,48)+','+range('3/',1,48),'   exit','vlan 10','   name "Data"','   tagged Trk1','   ip address 192.0.2.12 255.255.255.0','   exit','ip default-gateway 192.0.2.1'].join('\n')+'\n';
// Two more closets on adjacent ports of module A (owner's case: leaders from A3, A5 and A6 side by side).
const SW=(name,ports,ip)=>['; JL253A Configuration Editor; Created on release #WC.16.10.0025','hostname "'+name+'"',...(ports.length>1?['trunk '+ports.join(',')+' trk1 lacp']:[]),...ports.flatMap(p=>['interface '+p,'   name "uplink_to_core"','   exit']),
 'vlan 1','   name "DEFAULT_VLAN"','   untagged '+range('',1,24),'   exit','vlan 10','   name "Data"','   tagged '+(ports.length>1?'Trk1':ports[0]),'   ip address '+ip+' 255.255.255.0','   exit','ip default-gateway 192.0.2.1'].join('\n')+'\n';
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles([file('ex-core.conf',MDF),file('ex-idf-stack.conf',IDF),file('ex-idf-sw02.conf',SW('EX-IDF-SW02',['25','26'],'192.0.2.13')),file('ex-idf-sw03.conf',SW('EX-IDF-SW03',['25'],'192.0.2.14')),file('ex-idf-sw04.conf',SW('EX-IDF-SW04',['25','26'],'192.0.2.15')),file('ex-idf-sw05.conf',SW('EX-IDF-SW05',['25','26'],'192.0.2.16')),file('ex-idf-sw06.conf',SW('EX-IDF-SW06',['25'],'192.0.2.17'))]);await page.waitForTimeout(1500);
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();await page.locator('.diagram-scroll > svg').first().waitFor({timeout:20000});
  await page.locator('#diagram-focus').selectOption({label:'EX-CORE'});await page.waitForTimeout(1500);
  const texts=async()=>page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll svg text')].map(t=>t.textContent.trim()).filter(Boolean));
  let t=await texts();
  ok(t.some(x=>/J9850A 5406R zl2/.test(x))&&t.some(x=>/^B\s+·\s+J9987A$/.test(x))&&t.some(x=>/^A\s+·\s+J9993A$/.test(x))&&t.some(x=>/^D\s+·\s+empty$/.test(x)),'the chassis names its model and each module card its slot and module: '+t.filter(x=>/J9|empty/.test(x)).join(' / '));
  // The 5406R zl2 grid (owner request: modules where they really are): MM1 | MM2, then A | B, C | D, E | F.
  const at=async()=>page.evaluate(()=>{const o={};for(const el of document.querySelectorAll('.diagram-scroll svg text')){const m=el.textContent.trim().match(/^(MM1|MM2|[A-F])\s+·/);if(m&&!o[m[1]]){const b=el.getBBox();o[m[1]]={x:Math.round(b.x),y:Math.round(b.y)};}}return o;});
  const g=await at(),row=(a,b)=>g[a]&&g[b]&&Math.abs(g[a].y-g[b].y)<2&&g[b].x>g[a].x+40,col=(a,b)=>g[a]&&g[b]&&Math.abs(g[a].x-g[b].x)<2&&g[b].y>g[a].y+40;
  ok(row('MM1','MM2')&&row('A','B')&&row('C','D')&&row('E','F')&&col('MM1','A')&&col('A','C')&&col('C','E')&&col('B','D'),'the chassis is drawn as its slot grid, empty slots included: '+JSON.stringify(g));
  // Edge to edge (owner request: real-world spacing): one module row (72 px) and a 9 px gap apart, at the drawing's scale.
  ok(g.A&&g.C&&g.E&&Math.abs(g.C.y-g.A.y-81)<1.5&&Math.abs(g.E.y-g.C.y-81)<1.5,'module rows sit edge to edge: one module (72 px) and a 9 px gap apart: '+(g.C.y-g.A.y)+', '+(g.E.y-g.C.y));
  ok(t.includes('A1')&&t.includes('C1')&&t.includes('1/50')&&t.includes('2/50'),'both aggregated uplinks are drawn, each to a numbered uplink port on the stack');
  ok(['A3','A5','A6'].every(p=>t.includes(p)),'links from neighbouring ports of one module are all drawn: '+t.filter(x=>/^A\d$/.test(x)).join(','));
  ok(!t.includes('A2'),'a port naming another switch (…-IDF-SW01) is not taken for the stack uplink');
  ok(t.some(x=>x==='JL256A'),'a stack member of another model names its own model');
  // Owner request: parallel lines never lie exactly on one another (chassis leaders, stack gaps and lanes included).
  const overlaps=await page.evaluate(()=>{const ls=[...document.querySelectorAll('.diagram-scroll svg [data-line][data-route]')].map(el=>({k:el.getAttribute('data-line'),p:el.getAttribute('data-route').split(' ').filter(Boolean).map(q=>q.split(',').map(Number))}));const out=[];
   const segs=ls.flatMap((l,i)=>l.p.slice(1).map((b,j)=>({i,a:l.p[j],b})));for(let x=0;x<segs.length;x++)for(let y=x+1;y<segs.length;y++){const s=segs[x],u=segs[y];if(s.i===u.i)continue;
    const V=g=>Math.abs(g.a[0]-g.b[0])<0.5,Hz=g=>Math.abs(g.a[1]-g.b[1])<0.5,ov=(p,q,r,w)=>Math.min(Math.max(p,q),Math.max(r,w))-Math.max(Math.min(p,q),Math.min(r,w));
    if(V(s)&&V(u)&&Math.abs(s.a[0]-u.a[0])<0.5&&ov(s.a[1],s.b[1],u.a[1],u.b[1])>1||Hz(s)&&Hz(u)&&Math.abs(s.a[1]-u.a[1])<0.5&&ov(s.a[0],s.b[0],u.a[0],u.b[0])>1)out.push(ls[s.i].k+' / '+ls[u.i].k+' at '+s.a.join(','));}return out;});
  ok(overlaps.length===0,'no two lines run on top of each other: '+overlaps.slice(0,4).join('; '));
  // Owner request: links leaving a chassis are clearly apart: inside the chassis no link crosses another.
  const inside=await page.evaluate(()=>{const g=[...document.querySelectorAll('.diagram-scroll svg [data-diagram-node]')].find(el=>/excore/.test(el.getAttribute('data-diagram-node')));if(!g)return ['no chassis'];const b=g.getBBox();
   const ls=[...document.querySelectorAll('.diagram-scroll svg [data-line][data-route]')].map(el=>({k:el.getAttribute('data-line'),p:el.getAttribute('data-route').split(' ').filter(Boolean).map(q=>q.split(',').map(Number))}));const out=[];
   const segs=ls.flatMap((l,i)=>l.p.slice(1).map((q,j)=>({i,a:l.p[j],b:q})));const inB=(x,y)=>x>b.x&&x<b.x+b.width&&y>b.y&&y<b.y+b.height;
   for(const h of segs){if(Math.abs(h.a[1]-h.b[1])>0.5)continue;for(const v of segs){if(v.i===h.i||Math.abs(v.a[0]-v.b[0])>0.5)continue;const x=v.a[0],y=h.a[1];
    if(x>Math.min(h.a[0],h.b[0])+0.5&&x<Math.max(h.a[0],h.b[0])-0.5&&y>Math.min(v.a[1],v.b[1])+0.5&&y<Math.max(v.a[1],v.b[1])-0.5&&inB(x,y))out.push(ls[h.i].k.split('~')[0]+' x '+ls[v.i].k.split('~')[0]);}}return out;});
  ok(inside.length===0,'no link crosses another inside the chassis: '+inside.slice(0,4).join('; '));
  // Owner request: stack members evenly spaced, as far apart as the lines between them need, and no line across a member.
  const mg=await page.evaluate(()=>{const ys=[...document.querySelectorAll('.diagram-scroll svg text')].filter(t=>/^Member \d+$/.test(t.textContent.trim())).map(t=>Math.round(t.getBBox().y*10)/10).sort((a,b)=>a-b);return ys.slice(1).map((y,i)=>Math.round((y-ys[i])*10)/10);});
  ok(mg.length===2&&Math.abs(mg[0]-mg[1])<0.6,'stack members are evenly spaced: '+mg.join(', '));
  // Port map pages: the legend heads every page, and each member and module names its model.
  const tabs=await page.locator('[data-diagram-tab]').allInnerTexts(),maps=tabs.map((x,i)=>[x,i]).filter(([x])=>/^Port map/.test(x));ok(maps.length>=2,'the port map runs over several pages: '+maps.length);
  const heads=[];for(const [,i] of maps){await page.locator('[data-diagram-tab="'+i+'"]').click();await page.waitForTimeout(300);const pt=await texts();ok(pt.includes('PORT ROLES'),'port map page '+(i)+' has the port role legend');heads.push(...pt.filter(x=>/·\s+(member|slot)\s|^Member \d/.test(x)||/^JL\d{3}A|^J9\d{3}A/.test(x)));}
  ok(heads.includes('J9850A 5406R zl2')||heads.some(x=>/J9850A 5406R zl2/.test(x)),'the port map heads the chassis with its model beside the name');
  ok(heads.some(x=>/Member 3\s+\|\s+JL256A\s+\|\s+48 RJ-45 \+ 4 SFP\+/.test(x)),'port map headings name each module slot and stack member with its own model: '+heads.slice(0,8).join(' / '));
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' diagram hardware browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
