// Network diagrams across many fictional network designs (owner request: the drawing features must
// work with any network, not only the sites they were built on). Each design is drawn in every scope
// and style, as a site book, as letter pages, as SVG and as a Visio package, and checked against the
// routing rules, the WAN-at-the-top rules, port modules, line hops and the Visio package rules.
const assert=require('node:assert/strict'),zlib=require('node:zlib'),E=require('../webview/evidence.js'),M=require('../webview/site_map.js'),D=require('../webview/diagram.js'),T=require('../webview/stencils.js');
const HW=require('./harness.cjs').boot().ctx.SWHardware;
let checks=0;const fails=[];function ok(v,m){checks++;if(process.env.VARIETY_REPORT){if(!v)fails.push(m);return;}assert.ok(v,m);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=(method===8?zlib.inflateRawSync(data):data).toString();o+=30+nl+xl+size;}return files;}
// The routing rules (as tests/diagram-tests.cjs checks them): no shared collinear stretches, no line
// through a device other than its end stubs, and no relaxed (overlapping) routes.
// A stack or chassis carries its own lines across its face (leaders between the ports, stack cables in the gaps).
function routing(page){
 const issues=[],segs=[];
 page.lines.forEach((l,i)=>{if(!l.strict)issues.push('relaxed route '+(l.conn.A.key+'|'+(l.conn.aPorts[0]||'')));for(let j=1;j<l.points.length;j++)segs.push({i,a:l.points[j-1],b:l.points[j],end:j===1||j===l.points.length-1});});
 const overlap=(p,q,r,s)=>Math.min(Math.max(p,q),Math.max(r,s))-Math.max(Math.min(p,q),Math.min(r,s));
 for(let x=0;x<segs.length;x++)for(let y=x+1;y<segs.length;y++){const s=segs[x],t=segs[y];if(s.i===t.i||page.lines[s.i].groups.some(g=>page.lines[t.i].groups.includes(g)))continue;
  if(s.a[0]===s.b[0]&&t.a[0]===t.b[0]&&s.a[0]===t.a[0]&&overlap(s.a[1],s.b[1],t.a[1],t.b[1])>0)issues.push('vertical overlap at x='+s.a[0]);
  if(s.a[1]===s.b[1]&&t.a[1]===t.b[1]&&s.a[1]===t.a[1]&&overlap(s.a[0],s.b[0],t.a[0],t.b[0])>0)issues.push('horizontal overlap at y='+s.a[1]);}
 segs.forEach(s=>page.devices.forEach(d=>{const x0=Math.min(s.a[0],s.b[0]),x1=Math.max(s.a[0],s.b[0]),y0=Math.min(s.a[1],s.b[1]),y1=Math.max(s.a[1],s.b[1]);if(x1<=d.x||x0>=d.x+d.w||y1<=d.y||y0>=d.y+d.h)return;if(s.end&&x0===x1)return;const c=page.lines[s.i].conn;if(d.members&&(c.A.key===d.key||c.B&&c.B.key===d.key))return;issues.push('line through '+d.name);}));
 return issues;
}
// Stacks (owner request): a line meets a member only on its last stretch, straight into its own port from
// the port's side (above for a top-row port, below for a bottom-row port); nothing else crosses a member.
function faces(page){const out=[];page.devices.filter(d=>d.members&&!/chassis/i.test(d.name)).forEach(d=>d.members.forEach(m=>{
 page.lines.forEach(l=>{if(l.internal)return;const q=l.points;for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i],x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  if(x1<=m.x+1||x0>=m.x+m.w-1||y1<=m.y+1||y0>=m.y+m.h-1)continue;const end=i===1?a:i===q.length-1?b:null;
  if(end&&a[0]===b[0]){const other=end===a?b:a,mid=m.y+m.h/2;if(end[1]<mid?other[1]<end[1]:other[1]>end[1])continue;}out.push(d.name+' member '+m.id+' crossed by '+l.conn.A.key+'|'+l.conn.aPorts[0]);}});}));return out;}
// ---------- fictional designs ----------
const k=E.deviceKey;
function site(name){const devices=[],links=[],ports=new Map();let ip=1;
 const s={name,devices,links,ports,
  dev(n,type,model,hwModel){devices.push({key:k(n),name:n,type,model:model||'',ips:['10.'+(devices.length%200)+'.0.'+(ip++%250+1)],open:-1,hwModel});return k(n);},
  link(a,b,ap,bp,speed,media){links.push({a,b,aPort:ap,bPort:bp,aSpeed:speed||'',aMedia:media||''});[[a,ap],[b,bp]].forEach(([d,p])=>{if(!p)return;if(!ports.has(d))ports.set(d,[]);if(!ports.get(d).includes(p))ports.get(d).push(p);});},
  circuit(fw,port,label){const c=s.dev(label||('ISP '+port+' circuit'),'Circuit','');s.link(fw,c,port,'','1 Gb/s');return c;}};
 return s;}
function input(s,extra){
 const devs=s.devices.map(d=>{const o=Object.assign({},d);delete o.hwModel;return o;}),layout=M.layout(devs,s.links,{});
 // Verified hardware profiles where the model has one (as diagramHardware() does in the app).
 const hwOf=new Map();s.devices.forEach(d=>{const p=d.hwModel&&HW.profile(d.hwModel);if(!p)return;const portOf=n=>{const m=/(\d+)$/.exec(String(n)),b=p.banks.find(b=>b.names.includes(n)||m&&b.names.includes(m[1]));return b?{member:'1',bank:p.banks.indexOf(b),index:Math.max(0,b.names.indexOf(b.names.includes(n)?n:m[1]))}:null;};hwOf.set(d.key,{members:[{id:'1',profile:p}],portOf});});
 [layout.all,layout.nodes].forEach(list=>list.forEach(n=>{if(hwOf.has(n.key))n.hw=hwOf.get(n.key);}));
 return Object.assign({layout,links:s.links,vlans:new Map(),ports:s.ports,title:s.name},extra||{});}
const designs=[];
{// Cisco campus: firewall, a core stack, access switches with uplinks and access points.
 const s=site('Example Cisco campus'),fw=s.dev('CAMPUS-FW','Firewall','FortiGate-60F','FortiGate-60F'),core=s.dev('CAMPUS-CORE','Switch','C9300-48P','C9300-48P');
 s.circuit(fw,'wan1','ISP-A circuit');s.link(fw,core,'internal1','TenGigabitEthernet1/1/1','10 Gb/s','10GBase-SR');s.link(fw,core,'internal2','TenGigabitEthernet2/1/1','10 Gb/s','10GBase-SR');
 for(let i=1;i<=4;i++){const a=s.dev('CAMPUS-IDF'+i,'Switch','WS-C2960X-48FPD-L','WS-C2960X-48FPD-L');s.link(core,a,'TenGigabitEthernet1/1/'+(i+1),'TenGigabitEthernet1/0/1','10 Gb/s','10GBase-LR');
  for(let j=1;j<=3;j++){const ap=s.dev('IDF'+i+'-AP'+j,'Access Point','Example AP 500');s.link(a,ap,'GigabitEthernet1/0/'+j,'eth0','1 Gb/s');}}
 designs.push(s);}
{// SonicWall with three WAN circuits (one on a bottom-row port) and Aruba CX switches.
 const s=site('Example SonicWall site'),fw=s.dev('EDGE-FW','Firewall','TZ470','TZ470'),sw=s.dev('EDGE-CORE','Switch','JL675A','JL675A'),sw2=s.dev('EDGE-ACCESS','Switch','JL675A','JL675A');
 s.circuit(fw,'X1','Fiber ISP circuit');s.circuit(fw,'X2','Cable ISP circuit');s.circuit(fw,'X3','LTE backup circuit');s.link(fw,sw,'X0','1/1/49','10 Gb/s','SFP-10G-DAC');s.link(sw,sw2,'1/1/51','1/1/51','10 Gb/s','SFP+ DAC');
 designs.push(s);}
{// An HA firewall pair, each with its own circuit, both uplinked to the core, core to four switches.
 const s=site('Example HA pair'),f1=s.dev('HA-FW1','Firewall','FortiGate-100F','FortiGate-100F'),f2=s.dev('HA-FW2','Firewall','FortiGate-100F','FortiGate-100F'),core=s.dev('HA-CORE','Switch','JL675A','JL675A');
 s.circuit(f1,'wan1','Primary circuit');s.circuit(f2,'wan2','Secondary circuit');s.link(f1,f2,'ha1','ha1','1 Gb/s');s.link(f1,core,'x1','1/1/49','10 Gb/s','10GBase-SR');s.link(f2,core,'x1','1/1/50','10 Gb/s','10GBase-SR');
 for(let i=1;i<=4;i++){const a=s.dev('HA-ACCESS'+i,'Switch','JL675A','JL675A');s.link(core,a,'1/1/'+i,'1/1/52','1 Gb/s');}
 designs.push(s);}
{// No firewall: a router at the top, switches below, and no WAN circuits.
 const s=site('Example routed site'),r=s.dev('EXAMPLE-RTR','Router','ISR4331'),sw=s.dev('EXAMPLE-SW1','Switch','WS-C3850-24T'),sw2=s.dev('EXAMPLE-SW2','Switch','WS-C3850-24T');
 s.link(r,sw,'GigabitEthernet0/0/1','GigabitEthernet1/0/24','1 Gb/s');s.link(sw,sw2,'GigabitEthernet1/1/1','GigabitEthernet1/1/1','1 Gb/s');designs.push(s);}
{// Wide: one core with twelve access switches, four access points each.
 const s=site('Example wide site'),fw=s.dev('WIDE-FW','Firewall','FortiGate-200F','FortiGate-200F'),core=s.dev('WIDE-CORE','Switch','JL675A','JL675A');s.circuit(fw,'port1','Wide ISP circuit');s.link(fw,core,'x1','1/1/49','10 Gb/s','10GBase-SR');
 for(let i=1;i<=12;i++){const a=s.dev('WIDE-IDF'+i,'Switch','JL675A','JL675A');s.link(core,a,'1/1/'+i,'1/1/52','1 Gb/s');for(let j=1;j<=4;j++){const ap=s.dev('WIDE'+i+'-AP'+j,'Access Point','Example AP 515');s.link(a,ap,'1/1/'+j,'eth0','1 Gb/s');}}
 designs.push(s);}
{// Deep: a chain of six switches below the firewall.
 const s=site('Example deep site'),fw=s.dev('DEEP-FW','Firewall','FortiGate-60F','FortiGate-60F');s.circuit(fw,'wan1','Deep ISP circuit');let up=fw,upPort='internal1';
 for(let i=1;i<=6;i++){const sw=s.dev('DEEP-SW'+i,'Switch','JL675A','JL675A');s.link(up,sw,upPort,'1/1/49','10 Gb/s','10GBase-SR');up=sw;upPort='1/1/50';}designs.push(s);}
{// Redundant: two uplinks between the same pair and a ring of three switches.
 const s=site('Example redundant site'),fw=s.dev('RING-FW','Firewall','FortiGate-100F','FortiGate-100F'),a=s.dev('RING-SW1','Switch','JL675A','JL675A'),b=s.dev('RING-SW2','Switch','JL675A','JL675A'),c=s.dev('RING-SW3','Switch','JL675A','JL675A');
 s.circuit(fw,'wan1','Ring ISP circuit');s.link(fw,a,'x1','1/1/49','10 Gb/s','10GBase-SR');s.link(fw,a,'x2','1/1/50','10 Gb/s','10GBase-SR');s.link(a,b,'1/1/51','1/1/51','10 Gb/s','SFP+ DAC');s.link(b,c,'1/1/52','1/1/51','10 Gb/s','SFP+ DAC');s.link(c,a,'1/1/52','1/1/52','10 Gb/s','SFP+ DAC');designs.push(s);}
{// High speed: 25, 40 and 100 Gbps links on SFP28 and QSFP ports, with LR, ER, DAC and AOC media.
 const s=site('Example data center'),fw=s.dev('DC-FW','Firewall','FortiGate-400F','FortiGate-400F'),sp=s.dev('DC-SPINE','Switch','C9500-24Y4C','C9500-24Y4C'),l1=s.dev('DC-LEAF1','Switch','C9500-24Y4C','C9500-24Y4C'),l2=s.dev('DC-LEAF2','Switch','C9500-24Y4C','C9500-24Y4C');
 s.circuit(fw,'port1','DC ISP circuit');s.link(fw,sp,'x1','TwentyFiveGigE1/0/1','25 Gb/s','25GBase-LR');s.link(sp,l1,'HundredGigE1/0/25','HundredGigE1/0/25','100 Gb/s','QSFP28 AOC');s.link(sp,l2,'HundredGigE1/0/26','HundredGigE1/0/25','40 Gb/s','QSFP-40G-CU3M DAC');s.link(l1,l2,'TwentyFiveGigE1/0/24','TwentyFiveGigE1/0/24','25 Gb/s','25GBase-ER');designs.push(s);}
{// Unknown hardware and unusual port names (Juniper, MikroTik, Huawei, placeholders).
 const s=site('Example mixed vendors'),gw=s.dev('MIX-GW','Firewall',''),j=s.dev('MIX-JUNIPER','Switch','EX2300-24T'),m=s.dev('MIX-MIKROTIK','Switch','CRS326'),h=s.dev('MIX-HUAWEI','Switch','S5735'),u=s.dev('MIX-UNKNOWN','Switch','');
 s.circuit(gw,'eth0','Mixed ISP circuit');s.link(gw,j,'eth1','ge-0/0/0','1 Gb/s');s.link(j,m,'xe-0/1/0','sfp-sfpplus1','10 Gb/s','10GBase-SR');s.link(m,h,'ether2','GE1/0/1','1 Gb/s');s.link(h,u,'XGE0/0/1','Some Interface','');s.link(u,s.dev('MIX-PRINTER','Printer','Example printer'),'Wired Interface','eth0','');designs.push(s);}
{// Many circuits on one firewall.
 const s=site('Example multi-WAN site'),fw=s.dev('MW-FW','Firewall','FortiGate-200F','FortiGate-200F'),sw=s.dev('MW-CORE','Switch','JL675A','JL675A');
 ['port1','port2','port3','port4'].forEach((p,i)=>s.circuit(fw,p,'Carrier '+(i+1)+' circuit'));s.link(fw,sw,'x1','1/1/49','10 Gb/s','10GBase-SR');designs.push(s);}
{// A single device.
 const s=site('Example single device');s.dev('SOLO-SW','Switch','JL675A','JL675A');designs.push(s);}
// ---------- checks ----------
const views=[{style:'auto'},{style:'plate'},{style:'box'},{style:'auto',aps:true,others:true,unconfigured:true,upstream:true},{style:'plate',modules:false}];
function topOf(inp){const t=D.tree(inp.layout);return inp.layout.all.filter(n=>n.role!=='circuit'&&!t.parent?.get?.(n.key)).map(n=>n.key);}
function pageChecks(name,p){
 const r=routing(p);ok(r.length===0,name+': routing rules: '+r.slice(0,4).join('; '));
 const circ=(p.eps||[]).filter(e=>e.role==='circuit');
 // Circuits stacked in rows within their device's width (as in NetworkDiagramStudio): only the links of circuits
 // stacked higher may pass a lower circuit on their way up.
 const epOf=l=>{if(l.conn.ep==null)return null;const t=l.points[l.points.length-1];return circ.find(e=>Math.abs(t[1]-(e.y+e.h))<2&&t[0]>=e.x&&t[0]<=e.x+e.w)||null;};
 if(circ.length){const over=p.lines.filter(l=>l.points.some((q,i)=>i&&circ.some(e=>{const s=l.points[i-1],own=epOf(l);if(own&&own.y<e.y-1)return false;return Math.min(q[1],s[1])<e.y&&Math.max(q[0],s[0])>e.x&&Math.min(q[0],s[0])<e.x+e.w;})));ok(over.length===0,name+': nothing above a WAN circuit: '+over.map(l=>l.conn.A.key).join(','));
  ok(circ.every(e=>{const d=p.devices.find(v=>v.key===e.dev);return !d||e.y+e.h<=d.y;}),name+': WAN circuits sit above their device');}
 ok(p.shapes.filter(s=>s.type==='line'&&s.arcs).every(s=>Object.keys(s.arcs).every(i=>{const a=s.points[i-1],b=s.points[i];return a&&b&&a[1]===b[1]&&s.arcs[i]>0;})),name+': hops are arcs over horizontal stretches');
 ok(p.shapes.every(s=>s.type!=='line'||s.points.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])))&&p.shapes.every(s=>s.type==='line'||[s.x,s.y,s.w,s.h].every(Number.isFinite)),name+': every shape has finite geometry');}
function visioChecks(name,pages){
 const f=unzip(Buffer.from(D.vsdx(pages,name))),xml=Object.keys(f).filter(n=>/\.xml$/.test(n)).map(n=>f[n]).join('');
 ok(Object.keys(f)[0]==='[Content_Types].xml'&&f['visio/windows.xml']&&/RecalcDocument/.test(f['docProps/custom.xml']||''),name+': Visio package form');
 ok(!/NaN|Infinity|undefined/.test(xml),name+': no invalid numbers in the Visio XML');
 const lw=[...xml.matchAll(/<Cell N="LineWeight" V="([^"]+)" U="PT" F="([\d.]+) pt"\/>/g)];ok(lw.length>0&&lw.every(m=>Math.abs(+m[1]-(+m[2])/72)<6e-6),name+': line weights in points');
 const mx=f['visio/masters/masters.xml']||'',ids=[...mx.matchAll(/<Master ID="([^"]*)"/g)].map(m=>m[1]),refs=[...xml.matchAll(/ Master="([^"]*)"/g)].map(m=>m[1]);
 ok(ids.every(i=>/^\d+$/.test(i))&&refs.every(r=>ids.includes(r)),name+': numbered masters that every instance uses');
 const pageCount=(f['visio/pages/pages.xml'].match(/<Page /g)||[]).length,names=[...f['visio/pages/pages.xml'].matchAll(/<Page ID="\d+" NameU="([^"]*)"/g)].map(m=>m[1]);ok(pageCount===pages.length&&new Set(names).size===names.length,name+': one uniquely named Visio page per page');}
(async()=>{
 // NetworkDiagramStudio shapes for one design: front panel pictures placed by port name, and a module shape.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
 const cx=HW.profile('JL675A'),anchors={};cx.banks.forEach((b,bi)=>b.names.forEach((n,i)=>{anchors['1/1/'+n]=[Math.min(0.99,0.03+0.018*(bi*30+Math.floor(i/2))),i%2?0.7:0.3];}));
 const sm=T.fromImage({id:'art-variety-sw',name:'JL675A example panel',width:2400,height:240,ext:'png',data:new Uint8Array(png),anchors,models:['ARUBA/JL675A']}),opt=T.fromImage({id:'art-variety-sr',name:'SR optic',width:400,height:240,ext:'png',data:new Uint8Array(png)});
 const stencilFor=s=>{const m=new Map();s.devices.forEach(d=>{if(d.model==='JL675A')m.set(d.key,{art:T.artwork(sm),master:sm,anchors:sm.anchors});});return m;};
 let slowest=0,slowName='';
 for(const s of designs){
  for(const withStencils of [false,true]){
   const inp=input(s,withStencils?{stencils:stencilFor(s)}:{}),tag=s.name+(withStencils?' (stencils)':'');
   const tops=inp.layout.all.filter(n=>n.role!=='circuit').map(n=>n.key).slice(0,3);
   for(const v of views){for(const scope of ['site','downstream']){for(const focus of scope==='site'?[null]:tops){
    const t0=Date.now(),opts=Object.assign({scope,title:s.name},focus?{focus}:{},v,withStencils?{moduleArt:{sr:{art:T.artwork(opt),master:opt}}}:{});let p;
    try{p=D.diagram(inp,opts);}catch(e){ok(false,tag+' '+JSON.stringify(opts)+': drawing failed: '+e.stack);}
    const ms=Date.now()-t0;if(ms>slowest){slowest=ms;slowName=tag+' '+scope+' '+(focus||'')+' '+v.style;}
    pageChecks(tag+' '+scope+(focus?' from '+focus:'')+' '+v.style,p);
    const svg=D.svg(D.onLetter(p));ok(svg.startsWith('<svg')&&!/NaN|undefined/.test(svg),tag+': SVG output');}}}
   // Port modules: a fiber or DAC link on a cage port lists its module, unless modules are off.
   const fiber=s.links.some(l=>/SR|LR|ER|DAC|AOC|CU\d/i.test(l.aMedia||''));
   if(fiber){const p=D.diagram(inp,{scope:'site',title:s.name,style:'plate'}),txt=p.shapes.filter(x=>x.type==='text').map(x=>x.text).join('\n');ok(/PORT MODULES/.test(txt),tag+': port modules listed for its fiber and DAC links');
    ok(!/PORT MODULES/.test(D.diagram(inp,{scope:'site',title:s.name,style:'plate',modules:false}).shapes.filter(x=>x.type==='text').map(x=>x.text).join('\n')),tag+': Show > Port modules turns them off');}
   // The whole site book, as letter pages, through the Visio writer.
   let book;try{book=D.build(inp);}catch(e){ok(false,tag+': site book failed: '+e.stack);}
   ok(book.pages.length>=1,tag+': site book');book.pages.forEach((p,i)=>pageChecks(tag+' book page '+(i+1),p));
   visioChecks(tag,book.pages.map(p=>D.onLetter(p)));
   if(withStencils&&stencilFor(s).size){const p=D.diagram(inp,{scope:'site',title:s.name,style:'plate'});ok(p.shapes.some(x=>x.type==='image'&&x.master===sm),tag+': devices drawn with their NDS shape');
    const a=D.stencilAnchors(Object.assign({},inp.layout.all.find(n=>n.model==='JL675A'),{stencil:stencilFor(s).values().next().value}),s.ports.get(s.devices.find(d=>d.model==='JL675A').key)||[]);ok(Object.values(a).every(v=>v.every(n=>n>=0&&n<=1)),tag+': hardware pack anchors are fractions');}
  }
 }
 {// Link types follow the media and the ports: an AOC is its own type with an AOC cable end, and a link
  // into an RJ45 jack is copper (its cage end takes an RJ45 copper module), not fiber.
  const txt=p=>p.shapes.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  const dc=txt(D.diagram(input(designs[7]),{scope:'site',title:'DC',style:'plate'})),ha=txt(D.diagram(input(designs[2]),{scope:'site',title:'HA',style:'plate'}));
  ok(/100 Gbps QSFP AOC/.test(dc)&&/AOC\s+cable\s+end/.test(dc)&&!/100 Gbps fiber/.test(dc),'an AOC link is its own link type with an AOC cable end');
  ok(/1 Gbps copper/.test(ha)&&/RJ45\s+copper\s+module/.test(ha)&&!/1 Gbps fiber/.test(ha),'a link from an RJ45 jack into a cage is copper, with an RJ45 module in the cage');
  const legend=D.diagram(input(designs[7]),{scope:'site',title:'DC',style:'plate'}).shapes.filter(x=>x.type==='text'&&x.lmod);ok(legend.length&&legend.every(x=>x.text.split('\n').every(l=>l.length*9.5*0.6<=200-62+2)),'module names fit the legend column');}
 {// Owner request: stacks drawn as stacks. Each member is its own faceplate directly beneath the one before,
  // in a frame named for the stack; the VSF links from the configuration join the members (a ring closes
  // back to the first); uplinks and access points land on the member that has their port.
  function stackHw(model,n){const p=HW.profile(model),members=[...Array(n)].map((_,i)=>({id:String(i+1),profile:p})),links=[];for(let i=1;i<=n;i++)links.push({member:String(i),link:'1',port:i+'/51',technology:'VSF'},{member:String(i),link:'2',port:i+'/52',technology:'VSF'});
   return {members,links,technology:'VSF',portOf:name=>{const m=/^(\d+)\/(\d+)$/.exec(String(name));if(!m)return null;const b=p.banks.find(b=>b.names.includes(m[2]));return b?{member:m[1],bank:p.banks.indexOf(b),index:b.names.indexOf(m[2])}:null;}};}
  const s=site('Example stacks'),core=s.dev('EX-MDF','Switch','JL675A','JL675A'),st1=s.dev('EX-1FL-STACK','Switch','JL558A'),st2=s.dev('EX-2FL-STACK','Switch','JL558A'),ap=s.dev('EX-AP1','Access Point','AP-515');
  s.link(core,st1,'1/1/49','1/49','10 Gb/s','10GBase-SR');s.link(core,st2,'1/1/50','2/50','10 Gb/s','10GBase-SR');s.link(st1,ap,'3/7','eth0','1 Gb/s');
  const inp=input(s),hw1=stackHw('JL558A',5),hw2=stackHw('JL558A',2);[inp.layout.all,inp.layout.nodes].forEach(l=>l.forEach(n=>{if(n.key===st1)n.hw=hw1;if(n.key===st2)n.hw=hw2;}));
  // One device per stack (owner request: as close as possible): members 9 px apart, VSF cables inside the stack.
  const on=(dev,pt)=>dev&&dev.members.find(m=>pt[0]>=m.x-1&&pt[0]<=m.x+m.w+1&&pt[1]>=m.y-1&&pt[1]<=m.y+m.h+1);
  for(const scope of ['downstream','site']){const p=D.diagram(inp,{scope,focus:core,style:'plate',aps:true,title:'Stacks'}),d1=p.devices.find(d=>d.key===st1),d2=p.devices.find(d=>d.key===st2),m1=d1&&d1.members||[],m2=d2&&d2.members||[];
   const gapsOf=ms=>ms.slice(1).map((m,i)=>Math.round(m.y-(ms[i].y+ms[i].h)));
   ok(m1.length===5&&m2.length===2&&m1.every((m,i)=>!i||Math.abs(m.x-m1[0].x)<1&&m.y>m1[i-1].y+m1[i-1].h)&&new Set(gapsOf(m1)).size===1,scope+': each stack member is drawn beneath the one before, evenly spaced: '+m1.map(d=>Math.round(d.x)+','+Math.round(d.y)).join(' '));
   ok(faces(p).length===0,scope+': no line runs across a stack member, each port entered from its own side: '+faces(p).slice(0,3).join('; '));
   ok(!p.devices.some(d=>/#/.test(d.key)),scope+': a stack stays one device');
   const sl=p.lines.filter(l=>/^stack/.test(l.conn.type));ok(sl.length===5+2,scope+': VSF links join the members, as a ring: '+sl.length);
   ok(sl.every(l=>l.conn.A===l.conn.B&&l.points.every(q=>q[0]>=l.conn.A.x-20&&q[0]<=l.conn.A.x+l.conn.A.w+20&&q[1]>=l.conn.A.y&&q[1]<=l.conn.A.y+l.conn.A.h)),scope+': stack cables stay with their stack (the ring closes along its side)');
   const up=p.lines.find(l=>l.conn.aPorts[0]==='1/1/50'),end=up&&(up.conn.B.key===st2?up.points[up.points.length-1]:up.points[0]);ok(up&&on(d2,end)&&on(d2,end).id==='2','the uplink lands on the member that has its port (2/50 on member 2)');
   const apl=p.lines.find(l=>l.conn.ep!=null&&l.conn.A.key===st1);ok(apl&&on(d1,apl.points[0])&&on(d1,apl.points[0]).id==='3','an access point is drawn on its member (3/7 on member 3)');
   ok(p.shapes.some(x=>x.type==='text'&&/VSF stack \u00b7 5 members/.test(x.text))&&p.shapes.some(x=>x.type==='text'&&x.text==='Member 5'),scope+': the stack and each member are named');
   const txt=p.shapes.filter(x=>x.type==='text').map(x=>x.text).join('\n');ok(/VSF stack link/.test(txt),scope+': the legend names the VSF stack link');
   const r=routing(p);ok(r.length===0,scope+': stacks follow the routing rules: '+r.slice(0,4).join('; '));}
  const title=D.diagram(inp,{scope:'downstream',focus:st1,style:'plate',title:'Stacks'}).title;ok(title==='EX-1FL-STACK and below','a stack drawn from itself is titled with its name: '+title);
  visioChecks('Example stacks',[D.onLetter(D.diagram(inp,{scope:'downstream',focus:core,style:'plate',title:'Stacks'}))]);
  ok(D.diagram(inp,{scope:'site',style:'box',title:'Stacks'}).devices.some(d=>d.key===st1),'box style keeps a stack as one box');
  // A taller stack to the right of a shorter one keeps its own column below the shorter one's last member.
  const t=site('Uneven stacks'),tc=t.dev('EX-MDF','Switch','JL675A','JL675A'),ta=t.dev('EX-1FL-STACK','Switch','JL558A'),tb=t.dev('EX-2FL-STACK','Switch','JL558A');
  t.link(tc,ta,'1/1/49','1/49','10 Gb/s','10GBase-SR');t.link(tc,tb,'1/1/50','1/49','10 Gb/s','10GBase-SR');
  const ti=input(t),ha=stackHw('JL558A',3),hb=stackHw('JL558A',7);[ti.layout.all,ti.layout.nodes].forEach(l=>l.forEach(n=>{if(n.key===ta)n.hw=ha;if(n.key===tb)n.hw=hb;}));
  for(const scope of ['downstream','site']){const p=D.diagram(ti,{scope,focus:tc,style:'plate',title:'Uneven stacks'}),col=k=>((p.devices.find(d=>d.key===k)||{}).members||[]).map(m=>Math.round(m.x)),a=col(ta),b=col(tb);
   ok(a.length===3&&b.length===7&&new Set(a).size===1&&new Set(b).size===1&&a[0]!==b[0],scope+': every stack keeps its own column, however many members: '+a.join(',')+' / '+b.join(','));
   const ms=(p.devices.find(d=>d.key===tb)||{members:[]}).members,gaps=ms.slice(1).map((m,i)=>Math.round(m.y-(ms[i].y+ms[i].h)));
   ok(gaps.length===6&&gaps.every(g=>g===gaps[0]&&g>=9&&g<=36),scope+': stack members are evenly spaced, no further apart than their lines need (owner request): '+gaps.join(', '));
   ok(faces(p).length===0,scope+': no line runs across a member of an uneven stack: '+faces(p).slice(0,3).join('; '));
   const r=routing(p);ok(r.length===0,scope+': uneven stacks follow the routing rules: '+r.slice(0,4).join('; '));}}
 ok(slowest<8000,'every drawing finishes quickly: slowest '+slowest+' ms ('+slowName+')');
 if(fails.length){console.log(fails.length+' FAILED');const seen=new Map();fails.forEach(f=>{const key=f.replace(/: .*/s,'').replace(/^.*?(routing rules|nothing above|WAN circuits sit|hops are|finite|SVG|port modules|Port modules|site book|Visio|line weights|numbered|uniquely|drawn with|anchors|drawing failed|quickly).*/,'$1');seen.set(f.slice(0,160),1);});[...seen.keys()].slice(0,60).forEach(x=>console.log(' - '+x));}
 console.log(checks+' network design variety checks passed (slowest drawing '+slowest+' ms)');
})().catch(e=>{console.error(e);process.exit(1);});
