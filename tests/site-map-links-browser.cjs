// Site map links: every link ends in a port tag on each device, joined by a right-angled line; tags and
// lines never cover each other or a device. The fictional export repeats what monitoring tools report:
// VLAN interfaces as neighbours, and a firewall interface that is down listed beside the real one.
const assert=require('node:assert/strict'),path=require('node:path'),{xlsx}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const dev=(name,type,model,ip)=>['Up',name,type,model,'',ip,'','0','','','',''];
const devices=[['DEVICES','','','','','','','','','','',''],['Status','Device Name','Type','Make & Model','MAC Address(es)','IP Address(es)','Network(s)','Connected To','Software Version','Serial Number','Firmware Version','Description'],
 dev('LAB-FW','Firewall','Example Firewall 100','192.0.2.1'),dev('LAB-CORE-01','Switch','Example Switch 48','192.0.2.2'),dev('LAB-EDGE-02','Switch','Example Switch 48','192.0.2.3'),
 dev('LAB-VOICE-01','Switch','Example Switch 48P','192.0.2.4'),dev('LAB-REMOTE-A','Switch','Example Switch 10','192.0.2.5'),dev('LAB-REMOTE-B','Switch','Example Switch 10','192.0.2.6'),dev('LAB-SPARE','Switch','Example Switch 10','192.0.2.7'),dev('LAB-EDGE-02 Member 2','Switch','Example Switch 48','')];
const row=(oper,name,parent,connected,type='Ethernet')=>['Up',oper,name,'',type,parent,'1.0 Gbit/s',connected,''];
const interfaces=[['INTERFACES','','','','','','','',''],['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'],
 row('Up','port1','LAB-FW','6  on LAB-CORE-01'),row('Up','port2','LAB-FW','41  on LAB-CORE-01'),row('Down','dmz','LAB-FW',0),
 row('Up','6','LAB-CORE-01','port1  on LAB-FW, dmz  on LAB-FW'),row('Up','41','LAB-CORE-01','port2  on LAB-FW, dmz  on LAB-FW'),
 row('Up','43','LAB-CORE-01','43  on LAB-EDGE-02, DEFAULT_VLAN  on LAB-EDGE-02'),row('Up','44','LAB-CORE-01','44  on LAB-EDGE-02'),
 row('Up','48','LAB-CORE-01','58  on LAB-VOICE-01, DEFAULT_VLAN  on LAB-VOICE-01'),
 row('Up','45','LAB-CORE-01','VLAN1  on LAB-REMOTE-A'),row('Up','46','LAB-CORE-01','VLAN1  on LAB-REMOTE-B'),
 row('Up','DEFAULT_VLAN','LAB-CORE-01','43  on LAB-EDGE-02, g9  on LAB-REMOTE-A','Virtual NIC'),
 row('Up','43','LAB-EDGE-02','DEFAULT_VLAN  on LAB-CORE-01, 43  on LAB-CORE-01'),row('Up','44','LAB-EDGE-02','44  on LAB-CORE-01'),
 row('Up','58','LAB-VOICE-01','48  on LAB-CORE-01'),row('Up','Some Stack Port','LAB-EDGE-02 Member 2','Some Stack Port  on LAB-EDGE-02'),row('Up','g9','LAB-REMOTE-A','DEFAULT_VLAN  on LAB-CORE-01')];
const book=xlsx([{name:'Devices',rows:devices},{name:'Interfaces',rows:interfaces}]);
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles({name:'lab-site.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:book});
  await page.locator('.site-map').waitFor({timeout:15000});
  const g=await page.evaluate(()=>{const box=e=>{const b=e.getBBox(),m=e.getCTM();return {x:b.x+m.e,y:b.y+m.f,w:b.width,h:b.height};};
   return {edges:[...document.querySelectorAll('.site-edge')].map(e=>({key:e.getAttribute('data-sitemap-edge'),d:e.querySelector('path:not(.edge-hit)').getAttribute('d'),tabs:[...e.querySelectorAll('.port-tab')].map(t=>({text:t.querySelector('text').textContent,...box(t.querySelector('rect'))}))})),
    nodes:[...document.querySelectorAll('.site-node')].map(n=>({key:n.getAttribute('data-sitemap-node'),...box(n.querySelector('rect'))})),floating:document.querySelectorAll('.site-edge > text').length};});
  const edge=k=>g.edges.find(e=>e.key===k),texts=k=>edge(k).tabs.map(t=>t.text).sort().join(' | ');
  ok(g.edges.length===5,'five connections: '+g.edges.map(e=>e.key).join(' '));
  ok(g.edges.every(e=>e.tabs.length===2)&&g.floating===0,'every link ends in a port tag on each device; no text floats on a line');
  ok(texts('edge:labcore01~labfw')==='6, 41 | port1, port2','the firewall interface that is down is not a cable: '+texts('edge:labcore01~labfw'));
  ok(texts('edge:labcore01~labedge02')==='43, 44 | 43, 44','a VLAN interface neighbour beside the real port is not a cable: '+texts('edge:labcore01~labedge02'));
  ok(texts('edge:labcore01~labvoice01')==='48 | 58','one cable to the voice switch');
  ok(texts('edge:labcore01~labremotea')==='45 | g9','two VLAN interface reports join into one cable: '+texts('edge:labcore01~labremotea'));
  ok(texts('edge:labcore01~labremoteb')==='46 | ?','a port known on one side only shows ? on the other: '+texts('edge:labcore01~labremoteb'));
  ok(!g.nodes.some(n=>/member/.test(n.key))&&g.nodes.length===7,'a stack member listed as its own device is part of its stack: '+g.nodes.map(n=>n.key).join(' '));
  // Tags sit on their device's edge and overlap nothing.
  const tabs=g.edges.flatMap(e=>e.tabs.map(t=>({...t,edge:e.key}))),hit=(a,b)=>a.x<b.x+b.w-0.5&&b.x<a.x+a.w-0.5&&a.y<b.y+b.h-0.5&&b.y<a.y+a.h-0.5;
  ok(tabs.every((a,i)=>tabs.every((b,j)=>i>=j||!hit(a,b))),'no two port tags overlap');
  ok(tabs.every(t=>g.nodes.every(n=>!hit(t,n))),'no port tag covers a device');
  ok(tabs.every(t=>g.nodes.some(n=>t.x>=n.x-11&&t.x+t.w<=n.x+n.w+11&&(Math.abs(t.y-(n.y+n.h))<1.5||Math.abs(t.y+t.h-n.y)<1.5))),'every port tag is attached to a device edge');
  // Lines: right angles only, clear of devices and tags, and no two lines share a stretch.
  const segs=[];let straight=true;
  g.edges.forEach(e=>{const n=e.d.match(/-?\d+(?:\.\d+)?/g).map(Number),cmds=e.d.match(/[MLQ]/g);let pts=[],i=0;cmds.forEach(c=>{if(c==='Q'){pts.push([n[i+2],n[i+3]]);i+=4;}else{pts.push([n[i],n[i+1]]);i+=2;}});
   if(/[^MLQ\d\s.\-]/.test(e.d))straight=false;for(let k=1;k<pts.length;k++){const a=pts[k-1],b=pts[k];if(Math.abs(a[0]-b[0])>7.5&&Math.abs(a[1]-b[1])>7.5)straight=false;if(Math.abs(a[0]-b[0])>8||Math.abs(a[1]-b[1])>8)segs.push({edge:e.key,x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1])});}});
  ok(straight,'links are right-angled lines (rounded corners only)');
  const box=s=>({x:s.x1-1,y:s.y1-1,w:s.x2-s.x1+2,h:s.y2-s.y1+2});
  ok(segs.every(s=>g.nodes.every(n=>!hit(box(s),{x:n.x+1,y:n.y+1,w:n.w-2,h:n.h-2}))),'no line passes over a device');
  ok(segs.every(s=>tabs.every(t=>t.edge===s.edge||!hit(box(s),t))),'no line passes over another link\'s port tag');
  ok(segs.every((a,i)=>segs.every((b,j)=>i>=j||a.edge===b.edge||!((a.y1===a.y2&&b.y1===b.y2&&Math.abs(a.y1-b.y1)<4&&a.x1<b.x2&&b.x1<a.x2)||(a.x1===a.x2&&b.x1===b.x2&&Math.abs(a.x1-b.x1)<4&&a.y1<b.y2&&b.y1<a.y2)))),'no two links run on top of each other');
  // Pointing at a link lights up both of its tags; clicking it lists its cables.
  await page.locator('[data-sitemap-edge="edge:labcore01~labfw"] path.edge-hit').click({force:true});await page.locator('.site-map-detail').waitFor();
  ok(await page.locator('.site-edge.selected .port-tab').count()===2&&await page.locator('.site-map-detail .site-link-row').count()===2,'a selected link highlights both tags and lists two cables');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  if(process.env.SHOT){await page.screenshot({path:process.env.SHOT});}
  console.log(checks+' site map link checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
