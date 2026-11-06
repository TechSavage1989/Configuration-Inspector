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
  'EnableLineProps','EnableFillProps','EnableTextProps','HideForApply','EndArrowSize','BeginArrow','EndArrow','LineCap','BeginArrowSize','LineColorTrans','CompoundType','FillBkgnd','ShdwForegnd','ShdwPattern','FillForegndTrans','FillBkgndTrans','ShdwForegndTrans','ShapeShdwType','ShapeShdwOffsetX','ShapeShdwOffsetY','ShapeShdwObliqueAngle','ShapeShdwScaleFactor','ShapeShdwBlur','ShapeShdwShow','TextBkgnd','DefaultTabStop','TextDirection','TextBkgndTrans','LockTextEdit','LockVtxEdit','ObjType','Case','Pos','FontScale','DblUnderline','Overline','Strikethru','DoubleStrikethrough','Letterspace','ColorTrans','AsianFont','ComplexScriptFont','ComplexScriptSize','LangID','IndFirst','IndLeft','IndRight','SpLine','SpBefore','SpAfter','Bullet','BulletStr','BulletFont','BulletFontSize','TextPosAfterBullet','Flags']);
 const used=new Set((Object.values(files).join('').match(/<Cell N="[^"]+"/g)||[]).map(c=>c.slice(9,-1)));ok([...used].every(c=>VISIO_CELLS.has(c)),'only known cell names: '+[...used].filter(c=>!VISIO_CELLS.has(c)).join(','));
 const balanced=x=>{const st=[];for(const m of x.replace(/<\?[^>]*\?>/g,'').matchAll(/<(\/?)([A-Za-z:]+)[^>]*?(\/?)>/g)){if(m[3])continue;if(m[1]){if(st.pop()!==m[2])return false;}else st.push(m[2]);}return !st.length;};
 ok(Object.entries(files).filter(([n])=>/\.(xml|rels)$/.test(n)).every(([,x])=>balanced(x)),'every part is well formed');
 ok(!Object.values(files).some(x=>/<\/Section><Cell/.test(x)),'cells come before sections in every shape, as the Visio schema requires');
 let zo=0,dates=true;while(raw.readUInt32LE(zo)===0x04034b50){if(raw.readUInt16LE(zo+12)===0)dates=false;zo+=30+raw.readUInt16LE(zo+26)+raw.readUInt16LE(zo+28)+raw.readUInt32LE(zo+18);}ok(dates,'ZIP entries carry valid dates');
 console.log(checks+' network diagram checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
