// Network diagrams: scope, faceplates, routing rules, SVG and Visio (.vsdx / .vssx).
const assert=require('node:assert/strict'),zlib=require('node:zlib'),E=require('../webview/evidence.js'),M=require('../webview/site_map.js'),D=require('../webview/diagram.js'),{demoSite}=require('./xlsx-writer.cjs');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.equal(a,b,m);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=(method===8?zlib.inflateRawSync(data):data).toString();o+=30+nl+xl+size;}return files;}
// Routing rules on a page: lines never share a collinear stretch (except branches of one
// shared port), never cross a device except the end stubs, and end on port centers
// entered vertically.
function routing(page){
 const issues=[],segs=[];
 page.lines.forEach((l,i)=>{if(!l.strict)issues.push('relaxed route '+i);for(let j=1;j<l.points.length;j++)segs.push({i,a:l.points[j-1],b:l.points[j],end:j===1||j===l.points.length-1});});
 const overlap=(p,q,r,s)=>Math.min(Math.max(p,q),Math.max(r,s))-Math.max(Math.min(p,q),Math.min(r,s));
 for(let x=0;x<segs.length;x++)for(let y=x+1;y<segs.length;y++){const s=segs[x],t=segs[y];if(s.i===t.i||page.lines[s.i].groups.some(g=>page.lines[t.i].groups.includes(g)))continue;
  if(s.a[0]===s.b[0]&&t.a[0]===t.b[0]&&s.a[0]===t.a[0]&&overlap(s.a[1],s.b[1],t.a[1],t.b[1])>0)issues.push('vertical overlap at x='+s.a[0]);
  if(s.a[1]===s.b[1]&&t.a[1]===t.b[1]&&s.a[1]===t.a[1]&&overlap(s.a[0],s.b[0],t.a[0],t.b[0])>0)issues.push('horizontal overlap at y='+s.a[1]);}
 segs.forEach(s=>page.devices.forEach(d=>{const x0=Math.min(s.a[0],s.b[0]),x1=Math.max(s.a[0],s.b[0]),y0=Math.min(s.a[1],s.b[1]),y1=Math.max(s.a[1],s.b[1]);if(x1<=d.x||x0>=d.x+d.w||y1<=d.y||y0>=d.y+d.h)return;if(s.end&&x0===x1)return;issues.push('line through '+d.name);}));
 return issues;
}
// A fictional campus: firewall, core, distribution and access switches with access points.
function campus(){
 const devices=[],links=[],add=(name,type,model)=>{devices.push({key:E.deviceKey(name),name,type,model,ips:['10.20.0.'+(devices.length+1)],open:-1});return E.deviceKey(name);};
 const fw=add('CAMPUS-FW','Firewall','Example Firewall 600'),core=add('CAMPUS-CORE','Switch','C9500-24Y4C');links.push({a:fw,b:core,aPort:'port1',bPort:'TwentyFiveGigE1/0/1',aSpeed:'10 Gb/s'});
 for(let b=1;b<=4;b++){const dist=add('BLDG'+b+'-MDF','Switch','JL675A');links.push({a:core,b:dist,aPort:'TwentyFiveGigE1/0/'+(b+4),bPort:'1/1/49',aSpeed:'10 Gb/s'});
  for(let f=1;f<=2;f++){const acc=add('BLDG'+b+'-IDF'+f,'Switch','WS-C3750G-24PS');links.push({a:dist,b:acc,aPort:'1/1/'+(50+f),bPort:'GigabitEthernet1/0/25'});
   for(let a=1;a<=5;a++){const ap=add('BLDG'+b+'-F'+f+'-AP'+a,'Access Point','Example AP 500');links.push({a:acc,b:ap,aPort:'GigabitEthernet1/0/'+a,bPort:'eth0'});}}
  links.push({a:dist,b:core,aPort:'1/1/52',bPort:'TwentyFiveGigE1/0/'+(b+12),aSpeed:'10 Gb/s'});}
 // One management port reported with two neighbors.
 const mgmt=add('MGMT-SW','Switch','');links.push({a:core,b:mgmt,aPort:'GigabitEthernet0/0',bPort:'GigabitEthernet1/0/1'},{a:fw,b:core,aPort:'mgmt',bPort:'GigabitEthernet0/0'});
 return {layout:M.layout(devices,links,{}),links,vlans:new Map(),ports:new Map(),title:'Example Campus'};
}
(async()=>{
 // Port names to faceplate slots.
 const pp=D.parsePort;
 ok(pp('GigabitEthernet1/0/5').group==='main'&&pp('GigabitEthernet1/0/5').n===5&&pp('Gi2/0/5').member===2,'Cisco ports and stack members');
 ok(pp('TenGigabitEthernet1/1/2').group==='up'&&pp('Te1/1/2').n===2,'Cisco uplink module ports');
 ok(pp('1/1/49').group==='main'&&pp('1/1/49').n===49,'Aruba CX ports');
 ok(pp('X0').n===0&&pp('port12').group==='main'&&pp('GigabitEthernet0/0').group==='mgmt','firewall and management ports');
 ok(pp('Some Interface').group==='other'&&pp('Port-channel1').group==='other','placeholders and aggregates are not front-panel ports');
 eq(pp('Unit: 0 Slot: 0 Port: 3 Gigabit - Level').n,3,'controller port names');
 ok(D.physicalPort('GigabitEthernet1/0/1')&&!D.physicalPort('Vlan10')&&!D.physicalPort('X0:V10')&&!D.physicalPort('Loopback0')&&!D.physicalPort('ssl.root')&&!D.physicalPort('CCCorp'),'only physical ports are drawn');
 ok(D.catalogFor('WS-C3750G-24PS').main===24&&D.catalogFor('JL675A').up===4&&!D.catalogFor('Unknown 123'),'model catalog');
 eq(D.linkType({aPort:'TenGigabitEthernet1/1/1',bPort:'Te1/0/11'},'switch','switch'),'fiber');eq(D.linkType({aPort:'GigabitEthernet1/0/7'},'switch','endpoint'),'copper');eq(D.linkType({aPort:'Gi1/0/1'},'switch','ap'),'wap');

 // Demo site from a monitoring export.
 const ev=await E.load(new Uint8Array(demoSite()),'example-site.xlsx'),devices=E.deviceList(ev).map(d=>Object.assign(d,{open:-1}));
 const links=ev.links.map(l=>({a:E.deviceKey(l.a.device),b:E.deviceKey(l.b.device),aPort:l.a.port,bPort:l.b.port,source:l.source,aSpeed:'10 Gb/s'}));
 const input={title:'Example Site',layout:M.layout(devices,links,{}),links,vlans:new Map([['examplecore',[{id:'10',name:'USERS'},{id:'30',name:'WIRELESS'}]]]),ports:new Map()};
 const site=D.diagram(input,{scope:'site',title:'Example Site'});
 ok(site.title==='Example Site - Existing Topology'&&site.devices.length===5,'whole site page: '+site.devices.map(d=>d.name).join(', '));
 const core=D.diagram(input,{scope:'downstream',focus:'examplecore'}),texts=core.shapes.filter(s=>s.type==='text').map(s=>s.text).join('\n');
 ok(core.title==='EXAMPLE-CORE and below'&&['EXAMPLE-FW1','EXAMPLE-ACCESS1','EXAMPLE-ACCESS3','EXAMPLE-AP1','VLAN 10 – USERS'].every(t=>texts.includes(t)),'device page: upstream device, switches below, access points and VLANs');
 ok(core.shapes.some(s=>s.type==='text'&&s.rotate&&s.text==='Te1/1/1'),'linked ports are named in the band beside their stub');
 const one=D.diagram(input,{scope:'downstream',focus:'examplecore',depth:1,aps:false,upstream:false});
 ok(!one.devices.some(d=>d.name==='EXAMPLE-FW1')&&!one.shapes.some(s=>s.type==='text'&&/EXAMPLE-AP1/.test(s.text)),'upstream device and access points can be left out');
 const hidden=D.diagram(input,{scope:'downstream',focus:'examplecore',hidden:new Set(['exampleaccess2'])});ok(!hidden.devices.some(d=>d.name==='EXAMPLE-ACCESS2'),'single devices can be left out');
 const near=D.diagram(input,{scope:'neighbors',focus:'exampleaccess1'});ok(near.title==='EXAMPLE-ACCESS1 - Connections'&&near.devices.some(d=>d.name==='EXAMPLE-CORE'),'device connections page');
 [site,core,near].forEach(p=>{const r=routing(p);ok(!r.length,p.title+': '+r.join('; '));});
 // Rows start on one left edge; hand edits move devices, change labels, ports and routes.
 {const firsts=new Map();core.devices.forEach(d=>{const row=d.y;if(!firsts.has(row)||d.x<firsts.get(row))firsts.set(row,d.x);});ok(new Set(firsts.values()).size===1,'the first device of every row starts on the same left edge: '+JSON.stringify([...firsts.values()]));
  const d0=core.devices.find(d=>d.key==='exampleaccess1'),moved=D.diagram(input,{scope:'downstream',focus:'examplecore',edits:{maxRow:core.maxRow,moves:{exampleaccess1:[90,45]},texts:{[core.shapes.find(x=>x.type==='text'&&x.node==='exampleaccess1'&&/^EXAMPLE-ACCESS1/.test(x.text)).tkey]:'Edited name'}}}),d1=moved.devices.find(d=>d.key==='exampleaccess1');
  ok(d1.x-d0.x===90&&d1.y-d0.y===45,'a moved device is drawn where it was put: '+[d1.x-d0.x,d1.y-d0.y]);ok(moved.shapes.some(s=>s.type==='text'&&s.text==='Edited name'),'an edited label replaces the text');
  ok(!routing(moved).filter(x=>!/relaxed/.test(x)).length,'links still follow the routing rules after a move: '+routing(moved).slice(0,3).join('; '));
  const l0=core.lines.find(l=>l.key&&l.key.indexOf('examplecore|')===0&&l.conn.B),alt=l0.points.map((p,i)=>i>0&&i<l0.points.length-1?[p[0],p[1]]:p);
  const custom=l0.points.length>=4?l0.points.map((p,i)=>i===1||i===2?[p[0]+(l0.points[1][1]===l0.points[2][1]?0:18),p[1]+(l0.points[1][1]===l0.points[2][1]?18:0)]:p):l0.points;
  const routed=D.diagram(input,{scope:'downstream',focus:'examplecore',edits:{maxRow:core.maxRow,lines:{[l0.key]:custom}}});ok(JSON.stringify(routed.lines.find(l=>l.key===l0.key).points)===JSON.stringify(custom),'a hand-drawn route is kept');
  const side=l0.key.split('~')[0],dev=side.slice(0,side.lastIndexOf('|')),port=side.slice(side.lastIndexOf('|')+1),swapped=D.diagram(input,{scope:'downstream',focus:'examplecore',edits:{maxRow:core.maxRow,ports:{[dev+'|'+port]:'GigabitEthernet1/0/20'}}});
  ok(swapped.shapes.some(s=>s.type==='text'&&s.rotate&&s.text==='Gi1/0/20'),'a link can be moved to another port');}


 // A larger campus: every view follows the routing rules.
 const big=campus(),keys=big.layout.nodes.map(n=>n.key);let lines=0;
 for(const o of [{scope:'site'}].concat(keys.map(k=>({scope:'downstream',focus:k})),keys.map(k=>({scope:'neighbors',focus:k})))){const p=D.diagram(big,o),r=routing(p);lines+=p.lines.length;if(r.length)ok(false,p.title+': '+r.slice(0,4).join('; '));}
 ok(lines>200,'campus views routed: '+lines+' lines');
 const coreBig=D.diagram(big,{scope:'downstream',focus:'campuscore'});
 // Ends: each line starts and ends on a port center (or an endpoint box edge) and the
 // first and last runs are vertical, so they enter top ports from above and bottom ports from below.
 ok(coreBig.lines.every(l=>{const p=l.points,a=p[0],b=p[1],y=p[p.length-1],z=p[p.length-2];return a[0]===b[0]&&y[0]===z[0];}),'lines reach ports with a vertical run');
 ok(coreBig.shapes.some(s=>s.type==='rect'&&s.radius===4&&s.w===8),'a port with two neighbors is drawn as a trunk with a junction');
 ok(coreBig.devices.length===15&&coreBig.title==='CAMPUS-CORE and below','the core page shows the firewall above and every switch below: '+coreBig.devices.map(d=>d.name).join(', '));

 // SVG and Visio.
 const svg=D.svg(core);ok(svg.startsWith('<svg')&&svg.includes('data-diagram-node="exampleaccess1"')&&!/undefined|NaN/.test(svg),'SVG groups each device for clicking');
 const files=unzip(Buffer.from(D.vsdx([core],'Example Site')));
 ok(['[Content_Types].xml','_rels/.rels','visio/document.xml','visio/pages/pages.xml','visio/pages/_rels/pages.xml.rels','visio/pages/page1.xml'].every(f=>files[f]),'Visio package parts: '+Object.keys(files).join(', '));
 ok(files['visio/pages/page1.xml'].includes('Type="Group"')&&files['visio/pages/page1.xml'].includes('N="Angle"')&&!/NaN|undefined|<Foreign|media\//.test(Object.values(files).join('')),'devices are plain-shape groups, labels rotate, no images');
 const book=D.build(big);ok(book.pages.length>=3&&book.pages[0].title==='Example Campus - Existing Topology','site book: '+book.pages.map(p=>p.title).join(' | '));
 const bf=unzip(Buffer.from(D.vsdx(book.pages,'Example Campus')));ok((bf['visio/pages/pages.xml'].match(/<Page /g)||[]).length===book.pages.length,'one Visio page per site book page');
 const lib=D.library(),lf=unzip(Buffer.from(D.vsdx(lib,'Device library'))),groups=Object.keys(lf).filter(n=>/^visio\/pages\/page\d+\.xml$/.test(n)).reduce((t,n)=>t+(lf[n].match(/Type="Group"/g)||[]).length,0);
 ok(groups===D.stencilPages().length&&groups>=30&&lib.length>=5&&lib.some(p=>p.shapes.some(s=>s.text==='Aruba 6100 48G 4SFP+')),'device library: '+groups+' grouped faceplates on '+lib.length+' pages');
 // Letter paper: every Visio page is 11 x 8.5 in (or 8.5 x 11) and the drawing fits inside.
 const letterPages=[lf['visio/pages/pages.xml'],bf['visio/pages/pages.xml']].join('');
 ok((letterPages.match(/<Cell N="PageWidth" V="([\d.]+)"/g)||[]).every(c=>/V="(11|8\.5)"/.test(c))&&(letterPages.match(/<Cell N="PageHeight" V="([\d.]+)"/g)||[]).every(c=>/V="(11|8\.5)"/.test(c)),'Visio pages are letter size');
 const fitted=D.onLetter(coreBig);ok((fitted.w===1056&&fitted.h===816||fitted.w===816&&fitted.h===1056)&&fitted.shapes.every(s=>s.type==='line'?s.points.every(p=>p[0]>=0&&p[0]<=fitted.w&&p[1]>=0&&p[1]<=fitted.h):s.x>=0&&s.y>=0&&s.x+s.w<=fitted.w+0.5&&s.y+s.h<=fitted.h+0.5),'the campus core page fits a letter sheet at '+Math.round(fitted.paper.scale*100)+'%');
 ok(D.fitLetter(coreBig).scale>=D.fitLetter(D.diagram(big,{scope:'downstream',focus:'campuscore',maxRow:1})).scale,'the chosen row width needs no more shrinking than one device per row');
 // Visio is stricter than LibreOffice: document settings are elements, fonts are named,
 // every cell name is one Visio writes, every part is well formed, ZIP dates are valid.
 const raw=Buffer.from(D.vsdx([core],'Example Site')),doc=files['visio/document.xml'];
 ok(/<DocumentSettings[^>]*><GlueSettings>9<\/GlueSettings><SnapSettings>/.test(doc)&&!/<DocumentSettings[^>]*>\s*<Cell/.test(doc),'document settings are elements');
 const faces=[...doc.matchAll(/<FaceName NameU="([^"]+)"/g)].map(m=>m[1]),fontCells=[...Object.values(files).join('').matchAll(/<Cell N="Font" V="([^"]*)"/g)].map(m=>m[1]);
 ok(!/Panos=/.test(doc)&&/Panose=/.test(doc)&&fontCells.length&&fontCells.every(c=>faces.includes(c)),'fonts are named and declared: '+faces.join(','));
 const VISIO_CELLS=new Set(['PinX','PinY','Width','Height','LocPinX','LocPinY','Angle','LineWeight','LineColor','LinePattern','FillForegnd','FillPattern','Rounding','VerticalAlign','HorzAlign','LeftMargin','RightMargin','TopMargin','BottomMargin','Font','Color','Style','Size','NoFill','NoLine','X','Y','PageWidth','PageHeight','PageScale','DrawingScale','DrawingSizeType','DrawingScaleType','PrintPageOrientation','BeginX','BeginY','EndX','EndY','ImgOffsetX','ImgOffsetY','ImgWidth','ImgHeight',
  'EnableLineProps','EnableFillProps','EnableTextProps','HideForApply','EndArrowSize','BeginArrow','EndArrow','LineCap','BeginArrowSize','LineColorTrans','CompoundType','FillBkgnd','ShdwForegnd','ShdwPattern','FillForegndTrans','FillBkgndTrans','ShdwForegndTrans','ShapeShdwType','ShapeShdwOffsetX','ShapeShdwOffsetY','ShapeShdwObliqueAngle','ShapeShdwScaleFactor','ShapeShdwBlur','ShapeShdwShow','TextBkgnd','DefaultTabStop','TextDirection','TextBkgndTrans','LockTextEdit','LockVtxEdit','ObjType','Case','Pos','FontScale','DblUnderline','Overline','Strikethru','DoubleStrikethrough','Letterspace','ColorTrans','AsianFont','ComplexScriptFont','ComplexScriptSize','LangID','IndFirst','IndLeft','IndRight','SpLine','SpBefore','SpAfter','Bullet','BulletStr','BulletFont','BulletFontSize','TextPosAfterBullet','Flags','OutputFormat','LockPreview','AddMarkup','ViewMarkup','PreviewQuality','PreviewScope','DocLangID']);
 const used=new Set((Object.values(files).join('').match(/<Cell N="[^"]+"/g)||[]).map(c=>c.slice(9,-1)));ok([...used].every(c=>VISIO_CELLS.has(c)),'only known cell names: '+[...used].filter(c=>!VISIO_CELLS.has(c)).join(','));
 const balanced=x=>{const st=[];for(const m of x.replace(/<\?[^>]*\?>/g,'').matchAll(/<(\/?)([A-Za-z:]+)[^>]*?(\/?)>/g)){if(m[3])continue;if(m[1]){if(st.pop()!==m[2])return false;}else st.push(m[2]);}return !st.length;};
 ok(Object.entries(files).filter(([n])=>/\.(xml|rels)$/.test(n)).every(([,x])=>balanced(x)),'every part is well formed');
 ok(/<\/StyleSheets><DocumentSheet NameU="TheDoc"[^>]*>[\s\S]*<\/DocumentSheet><\/VisioDocument>$/.test(doc),'the document has its own ShapeSheet (Visio error 271 without it)');
 ok(!/DefaultGuideStyle/.test(doc)&&Object.values(files).every(x=>typeof x!=='string'||!/<Text>(?!<cp IX)/.test(x)),'no guide style without a guide style sheet; text starts with its character and paragraph rows');
 ok(!Object.values(files).some(x=>/<\/Section><Cell/.test(x)),'cells come before sections in every shape, as the Visio schema requires');
 let zo=0,dates=true;while(raw.readUInt32LE(zo)===0x04034b50){if(raw.readUInt16LE(zo+12)===0)dates=false;zo+=30+raw.readUInt16LE(zo+26)+raw.readUInt16LE(zo+28)+raw.readUInt32LE(zo+18);}ok(dates,'ZIP entries carry valid dates');
 // Faceplates from the verified hardware profiles (hardware.js): every profile draws with
 // ports on the routing grid, in its own banks and order, without overlapping shapes.
 {const HW=require('./harness.cjs').boot().ctx.SWHardware;let drawn=0;const problems=[];
  HW.profiles.forEach(prof=>{const node={key:'hw'+drawn,name:'HW-'+drawn,role:'switch',model:prof.title,hw:{members:[{id:'1',profile:prof}],portOf:()=>null}};
   const pg=D.diagram({layout:M.layout([{key:node.key,name:node.name,type:'Switch',model:prof.title,ips:[],open:-1}],[],{}),links:[],vlans:new Map(),ports:new Map(),title:'x'},{scope:'site'});drawn++;
   const dev=new (D._Device)(node,[],[],'plate');const centers=[];dev.plates[0].groups.forEach(g=>{for(let i=0;i<g.count;i++){const sl=dev.place(dev.plates[0],g,i,g.names[i]);centers.push({x:sl.dx,row:sl.row,mid:g.mid,label:sl.number,pitch:g.pitch});}});
   if(centers.some(c=>c.x%9))problems.push(prof.title+': off grid');
   const byRow={};centers.forEach(c=>{(byRow[c.row]=byRow[c.row]||[]).push(c);});Object.values(byRow).forEach(r=>{r.sort((a,b)=>a.x-b.x);for(let i=1;i<r.length;i++)if(r[i].x-r[i-1].x<Math.max(r[i].pitch,r[i-1].pitch)-0.1&&!(r[i].pitch===27||r[i-1].pitch===27)&&r[i].x-r[i-1].x<18)problems.push(prof.title+': overlap at '+r[i].label);});
   const total=prof.banks.filter(b=>!b.mirror).reduce((n,b)=>n+b.names.length,0);if(centers.length!==total)problems.push(prof.title+': '+centers.length+' of '+total+' ports');
   if(!pg.shapes.length)problems.push(prof.title+': nothing drawn');});
  ok(drawn>=40&&!problems.length,drawn+' hardware profiles draw cleanly: '+problems.slice(0,6).join('; '));
  const cx=HW.profile('JL675A'),fg=HW.profile('FG-120G');ok(cx&&fg,'Aruba 6100 and FortiGate 120G profiles');
  const sw={key:'cx',name:'CX',role:'switch',model:'JL675A',hw:{members:[{id:'1',profile:cx}],portOf:n=>{const m=/(\d+)$/.exec(n);const local=m&&m[1];const b=cx.banks.find(b=>b.names.includes(local));return b?{member:'1',bank:cx.banks.indexOf(b),index:b.names.indexOf(local)}:null;}}};
  const d=new (D._Device)(sw,[],[],'plate'),p1=d.slot('1/1/1'),p2=d.slot('1/1/2'),p12=d.slot('1/1/12'),p13=d.slot('1/1/13'),p49=d.slot('1/1/49'),p51=d.slot('1/1/51');
  ok(p49.dx<p1.dx&&p49.number==='49'&&p51.row===0&&p49.row===0&&d.slot('1/1/50').row===1,'Aruba 6100: 49-52 at the left as on the switch, numbered 49-52: '+JSON.stringify([p49.dx,p1.dx,p49.number]));
  ok(p1.row===0&&p2.row===1&&p2.dx===p1.dx&&p13.dx-p12.dx===27,'odd ports on top, blocks of 12 with a gap: '+(p13.dx-p12.dx));
  const fw={key:'fg',name:'FG',role:'firewall',model:'FortiGate-120G',hw:{members:[{id:'1',profile:fg}],portOf:n=>{const b=fg.banks.find(b=>b.names.includes(n));return b?{member:'1',bank:fg.banks.indexOf(b),index:b.names.indexOf(n)}:null;}}};
  const f=new (D._Device)(fw,[],[],'plate'),x3=f.slot('x3'),port1=f.slot('port1'),ha=f.slot('ha');ok(ha.dx<port1.dx&&port1.dx<x3.dx&&x3.number==='X3'&&ha.number==='HA'&&f.plates[0].groups.find(g=>g.names.includes('x3')).form==='sfp','FortiGate 120G: HA/MGMT, ports, SFP and X1-X4 in order, SFP+ drawn as cages');
  const svg=D.svg({w:900,h:200,title:'t',shapes:[],lines:[],devices:[]});ok(typeof svg==='string','svg');}
 // Documentation pages: port map, wireless connections, VLANs and routing, trunk VLANs.
 {const HW=require('./harness.cjs').boot().ctx.SWHardware,cx=HW.profile('JL675A');
  const portOf=n=>{const m=/(\d+)$/.exec(n),b=m&&cx.banks.find(b=>b.names.includes(m[1]));return b?{member:'1',bank:cx.banks.indexOf(b),index:b.names.indexOf(m[1])}:null;};
  const ports=[];for(let i=1;i<=52;i++){const p={name:'1/1/'+i,admin:'Enabled',mode:'access',native:'10',tagged:[],ip:'',lag:'',up:i<20,speed:'1 Gb/s',neighbor:null,description:''};
   if(i>=41&&i<=48){p.mode='trunk';p.tagged=['20','30'];p.neighbor={name:'EXAMPLE-AP'+i,role:'ap',model:'Example AP',ip:'10.0.10.'+i};p.up=true;p.speed=i===43?'100 Mb/s':'1 Gb/s';}
   if(i===49){p.mode='trunk';p.native='1';p.tagged=['10','20','30'];p.neighbor={name:'EXAMPLE-FW',role:'firewall',model:'',ip:'10.0.0.1'};}if(i===52)p.admin='Disabled';ports.push(p);}
  const docs={devices:[{key:'fw',name:'EXAMPLE-FW',role:'firewall',model:'Example firewall',ip:'10.0.0.1',hw:null,ports:[{name:'port1',admin:'Enabled',mode:'',native:'',tagged:[],ip:'192.0.2.2/24',up:true,speed:'',neighbor:null,description:'WAN'}],vlans:[{id:'10',name:'Data',ip:'10.0.10.1/24'}],addresses:[{iface:'port1',ip:'192.0.2.2/24',note:'WAN'},{iface:'vlan10',ip:'10.0.10.1/24',note:''}],routes:[{dest:'0.0.0.0/0',gateway:'192.0.2.1',iface:'port1',note:''}]},
   {key:'sw',name:'EXAMPLE-CORE',role:'switch',model:'Aruba 6100',ip:'10.0.10.2',hw:{members:[{id:'1',profile:cx}],portOf},ports,vlans:[{id:'10',name:'Data',ip:'10.0.10.1/24'},{id:'20',name:'Voice',ip:''},{id:'30',name:'Guest',ip:''}],addresses:[{iface:'vlan10',ip:'10.0.10.1/24',note:''}],routes:[]}]};
  const pages=D.docPages({docs},{title:'Example Site',company:'EXAMPLE ORG',author:'Example Engineer',date:'2026-01-01',offset:1}),titles=pages.map(p=>p.title),txt=p=>p.shapes.filter(s=>s.type==='text').map(s=>s.text).join('\n');
  ok(['Port map','Wireless connections','VLANs and routing','Trunk VLANs'].every(t=>titles.includes(t)),'documentation pages: '+titles.join(', '));
  const pms=pages.filter(p=>p.title==='Port map');ok(pms.length===2&&txt(pms[0]).includes('EXAMPLE-FW')&&!txt(pms[0]).includes('EXAMPLE-CORE')&&txt(pms[1]).includes('EXAMPLE-CORE'),'the firewall has a port map page of its own');
  const pm=pms[1];ok(/1-40/.test(txt(pm))&&/41-48/.test(txt(pm))&&/Wireless access points/.test(txt(pm))&&/Disabled/.test(txt(pm))&&/To EXAMPLE-FW/.test(txt(pm)),'the port map groups ports by role with ranges and VLAN details');
  ok(pm.shapes.some(s=>s.type==='rect'&&s.fill==='#7fd1a6'),'access point ports are coloured on the faceplate');
  const wl=pages.find(p=>p.title==='Wireless connections');ok(/EXAMPLE-AP43/.test(txt(wl))&&/below 1 Gbps/.test(txt(wl)),'wireless page lists the access points and slow links');
  const vr=pages.find(p=>p.title==='VLANs and routing');ok(/0\.0\.0\.0\/0/.test(txt(vr))&&/Repeated addresses: 10\.0\.10\.1/.test(txt(vr)),'routes and repeated addresses');
  const tv=pages.find(p=>p.title==='Trunk VLANs');ok(tv.shapes.some(s=>s.type==='text'&&s.text==='N')&&tv.shapes.some(s=>s.type==='text'&&s.text==='T'),'trunk VLAN matrix');
  ok(pages.every((p,i)=>txt(p).includes((i+2<10?'0':'')+(i+2)+' / '+(pages.length+1<10?'0':'')+(pages.length+1)))&&pages.every(p=>p.letter.landscape&&p.letter.scale===1),'numbered after the diagram, on letter paper at full size');
  const files=unzip(Buffer.from(D.vsdx(pages,'Docs'))),names=(files['visio/pages/pages.xml'].toString().match(/ NameU="[^"]*"/g)||[]);ok(new Set(names).size===names.length&&names.length===pages.length,'every Visio page has its own name: '+names.join(' '));
  ok(D.docPages({docs:{devices:[]}},{}).length===0,'no documentation pages without configurations');}

   // Link kinds by cable or fiber type and speed, named as in the reference drawing.
  {const K=(l,a,b,fa)=>{const k=D.linkKind(l,a||'switch',b||'switch',fa,false);return D.kindStyle(k,{}).label;};
   ok(K({aPort:'1/1/49',bPort:'x3',aSpeed:'10G',aMedia:'SFP+ 10GBase-SR'})==='10 Gbps SR fiber'&&K({aPort:'1/1/51',bPort:'1/1/51',aMedia:'SFP-H10GB-CU1M'})==='10 Gbps SFP+ DAC'&&K({aPort:'Gi1/0/1',bPort:'Gi1/0/2',aSpeed:'1000'.replace('1000','1G')})==='1 Gbps copper'&&K({aPort:'port2'},'firewall','circuit')==='Local handoff'&&K({aPort:'1/1/41'},'switch','ap')==='AP copper'&&K({aPort:'1/1/50',aMedia:'10GBase-LR'})==='10 Gbps LR fiber','link kinds name the cable or fiber type and speed');
   const k=D.linkKind({aPort:'Gi1/0/1',bPort:'Gi1/0/2',aSpeed:'1G'},'switch','switch');ok(D.kindStyle(k,{linkStyles:{[k]:{color:'#123456',label:'Office copper'}}}).color==='#123456'&&D.kindStyle(k,{linkStyles:{[k]:{label:'Office copper'}}}).label==='Office copper','a link kind\'s color and name can be changed');}
console.log(checks+' network diagram checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
