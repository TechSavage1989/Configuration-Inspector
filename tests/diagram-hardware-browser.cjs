// Real hardware on the diagram (owner requests): a modular chassis draws each module in slot order,
// stack members name their own model, described aggregated uplinks land on the far end's uplink
// ports (one link per member pair, not one link to an unnumbered spot), and every port map page
// carries the port role legend. Fictional configurations with documentation addresses only.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
const range=(p,a,z)=>Array.from({length:z-a+1},(_,i)=>p+(a+i)).join(',');
const MDF=['; J9850A Configuration Editor; Created on release #KB.16.10.0025','hostname "EX-CORE"','module A type j9993a','module B type j9987a','module C type j9993a',
 'trunk A1,C1 trk1 lacp','interface A1','   name "Uplink to EX-IDF-STACK"','   exit','interface A2','   name "uplink_to_EX-IDF-SW01"','   exit','interface C1','   name "Uplink to EX-IDF-STACK"','   exit',
 'vlan 1','   name "DEFAULT_VLAN"','   untagged '+range('B',1,24),'   exit','vlan 10','   name "Data"','   tagged Trk1,A2','   ip address 192.0.2.1 255.255.255.0','   exit'].join('\n')+'\n';
const IDF=['; hpStack_WC Configuration Editor; Created on release #WC.16.10.0025','hostname "EX-IDF-STACK"','vsf','   enable domain 1',
 ...[1,2,3].flatMap(i=>['   member '+i,'      type "'+(i===3?'JL256A':'JL558A')+'" mac-address 020000-00000'+i,'      priority '+(200-i),'      link 1 '+i+'/51','      link 2 '+i+'/52','      exit']),'   exit',
 'trunk 1/50,2/50 trk1 lacp','interface 1/50','   name "uplink_to_core"','   exit','interface 2/50','   name "uplink_to_core"','   exit',
 'vlan 1','   name "DEFAULT_VLAN"','   untagged '+range('1/',1,48)+','+range('2/',1,48)+','+range('3/',1,48),'   exit','vlan 10','   name "Data"','   tagged Trk1','   ip address 192.0.2.12 255.255.255.0','   exit','ip default-gateway 192.0.2.1'].join('\n')+'\n';
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles([file('ex-core.conf',MDF),file('ex-idf-stack.conf',IDF)]);await page.waitForTimeout(1500);
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();await page.locator('.diagram-scroll > svg').first().waitFor({timeout:20000});
  await page.locator('#diagram-focus').selectOption({label:'EX-CORE'});await page.waitForTimeout(1500);
  const texts=async()=>page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll svg text')].map(t=>t.textContent.trim()).filter(Boolean));
  let t=await texts();
  ok(t.some(x=>/J9850A\s+·\s+J9993A/.test(x))&&t.includes('J9987A')&&t.filter(x=>x==='J9993A').length>=1,'the chassis draws its modules in slot order, each named by its model: '+t.filter(x=>/J99/.test(x)).join(' / '));
  ok(['A','B','C'].every(s=>t.includes(s)),'each module card carries its slot letter');
  ok(t.includes('A1')&&t.includes('C1')&&t.includes('1/50')&&t.includes('2/50'),'both aggregated uplinks are drawn, each to a numbered uplink port on the stack');
  ok(!t.includes('A2'),'a port naming another switch (…-IDF-SW01) is not taken for the stack uplink');
  ok(t.some(x=>x==='JL256A'),'a stack member of another model names its own model');
  // Port map pages: the legend heads every page, and each member and module names its model.
  const tabs=await page.locator('[data-diagram-tab]').allInnerTexts(),maps=tabs.map((x,i)=>[x,i]).filter(([x])=>/^Port map/.test(x));ok(maps.length>=2,'the port map runs over several pages: '+maps.length);
  const heads=[];for(const [,i] of maps){await page.locator('[data-diagram-tab="'+i+'"]').click();await page.waitForTimeout(300);const pt=await texts();ok(pt.includes('PORT ROLES'),'port map page '+(i)+' has the port role legend');heads.push(...pt.filter(x=>/·\s+(member|slot)\s/.test(x)||/^JL\d{3}A$|^J99\d\dA$/.test(x)));}
  ok(heads.some(x=>/EX-CORE\s+·\s+slot A/.test(x))&&heads.some(x=>/member 3/.test(x))&&heads.includes('JL256A'),'port map headings name each module slot and stack member with its own model: '+heads.slice(0,8).join(' / '));
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' diagram hardware browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
