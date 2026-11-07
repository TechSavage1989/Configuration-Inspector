// Vendor stencils: reading masters, matching, port positions from connection points,
// EMF artwork, and diagrams and Visio downloads that use them. The stencil is built here
// from fictional shapes; no vendor artwork is part of the repository.
const assert=require('node:assert/strict'),zlib=require('node:zlib'),T=require('../webview/stencils.js'),D=require('../webview/diagram.js'),M=require('../webview/site_map.js'),E=require('../webview/evidence.js');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const {stencil,unzip,vss}=require('./stencil-writer.cjs');
(async()=>{
 const st=await T.read(new Uint8Array(stencil()),'example.vssx');
 ok(st.masters.length===2&&st.masters[0].name==='EX-SW8 8-port switch'&&st.masters[0].part==='EX-SW8'&&st.masters[0].manufacturer==='Example Networks','masters with their properties (connectors skipped): '+st.masters.map(m=>m.name).join(', '));
 const sw=st.masters[0],ap=st.masters[1];
 ok(sw.connections.length===10&&sw.pictures.length===1&&sw.pictures[0].ext==='png','connection points and picture');
 ok(T.match({model:'Example EX-SW8',role:'switch'},st.masters)===sw&&T.match({model:'Switch',parts:['EX-SW8'],role:'switch'},st.masters)===sw,'matched by model or part number');
 ok(T.match({model:'EX-AP515',role:'ap'},st.masters)===ap,'access point by model');
 ok(T.match({model:'Other 9999',role:'switch'},st.masters)===null,'no stencil for an unknown model');
 const fam=[{name:'EX-120/121F',part:'EX-120',connections:[]},{name:'EX-90/91G',part:'EX-90',connections:[]},{name:'EX/EXW-60/61F',part:'',connections:[]},{name:'EX-SW48 Switch rear',part:'EXSW48',connections:[]},{name:'EX-SW48 Switch',part:'EXSW48',connections:[]}];
 ok(T.match({model:'EX-120G'},fam)===null&&T.match({model:'EX-120F'},fam)===fam[0],'another generation of a series (120F for a 120G) is never chosen automatically');
 ok(T.match({model:'EX-91G'},fam)===fam[1]&&T.match({model:'EX-61F'},fam)===fam[2],'paired model names (90/91G, EX/EXW-60/61F) match either model');
 // Known port groups each take their own run of stencil ports (HA/MGMT 2, ports 16, X1-X4).
 const cols=[0.2,0.6,0.7,0.8,0.9,1.2,1.3,1.4,1.5,1.9,2.0],bm={name:'EX-FW',w:2.4,h:0.8,connections:[].concat(...cols.map(x=>[{x,y:0.6},{x,y:0.2}]))};
 const banks=T.bankLayout(bm,[2,16,4]);ok(banks&&banks[0].length===2&&banks[1].length===16&&banks[2].length===4&&Math.abs(banks[2][0].fx-1.9/2.4)<0.01&&banks[2][1].row===1,'port groups map to the stencil ports in order: '+JSON.stringify(banks&&banks.map(b=>b&&b.length)));
 ok(T.bankLayout(bm,[2,16,8,4])===null,'a stencil whose ports are not exactly the device ports is not mapped group by group (it would shift ports)');
 {const r=(p,a,b)=>Array.from({length:b-a+1},(_,i)=>p+(a+i)),prof={title:'EX-FW',banks:[{label:'HA',names:['ha','mgmt'],form:'RJ45',rows:2},{label:'1G',names:r('port',1,16),form:'RJ45',rows:2},{label:'10G',names:r('x',1,4),form:'SFP+',rows:2}]};
  const node={key:'fw',name:'FW',role:'firewall',model:'EX-FW',hw:{members:[{id:'1',profile:prof}],portOf:n=>{const b=prof.banks.find(b=>b.names.includes(n));return b?{member:'1',bank:prof.banks.indexOf(b),index:b.names.indexOf(n)}:null;}},stencil:{art:{w:240,h:80,body:''},master:bm,banks:c=>T.bankLayout(bm,c)}};
  const dev=new (D._Device)(node,[],[],'plate'),x3=dev.slot('x3'),p1=dev.slot('port1');
  ok(dev.positions[x3.key].exact&&Math.abs(dev.positions[x3.key].x-(dev.plates[0].x+9+2.0/2.4*dev.img.w))<0.01&&x3.row===0&&p1.dx<x3.dx,'a known device on a stencil: X3 lands exactly on its cage: '+JSON.stringify([x3.dx,p1.dx]));
  // Extra chassis points at both ends (so the groups do not map one to one): the device's layout
  // is fitted onto the stencil's points and every port still lands on its own point.
  const bm2=Object.assign({},bm,{connections:bm.connections.concat([{x:0.02,y:0.6},{x:0.02,y:0.2},{x:2.38,y:0.6},{x:2.38,y:0.2}])});ok(T.bankLayout(bm2,[2,16,4])===null,'extra points defeat the one-to-one group mapping');
  const node2=Object.assign({},node,{stencil:{art:{w:240,h:80,body:''},master:bm2,banks:c=>T.bankLayout(bm2,c),edges:()=>T.portPoints(bm2)}});
  const d2=new (D._Device)(node2,[],[],'plate'),at=n=>{const sl=d2.slot(n),p=d2.positions[sl.key];return p&&{fx:Math.round((p.x-d2.plates[0].x-9)/d2.img.w*2.4*100)/100,row:sl.row,exact:p.exact};};
  const got=['ha','mgmt','port1','port2','port16','x1','x2','x3','x4'].map(n=>[n,at(n)]);
  // Like a 48-port switch with 4 SFP+ cages on the left: each cage marked at both edges (four columns
  // for two cage columns), then 24 RJ45 columns in four blocks of six.
  {const conn=[],W=10,H=1;const add=(x,yTop,yBot)=>{conn.push({x,y:yTop},{x,y:yBot});};[0.5,0.8,1.05,1.35].forEach(x=>add(x,0.7,0.3));for(let blk=0;blk<4;blk++)for(let c=0;c<6;c++)add(1.9+blk*2.0+c*0.3,0.72,0.28);conn.push({x:0.01,y:0.5},{x:9.99,y:0.5});
   const sw={name:'EX-SW48',w:W,h:H,connections:conn},r=(p,a,b)=>Array.from({length:b-a+1},(_,i)=>p+(a+i)),pf={title:'EX-SW48',banks:[{label:'Uplinks',names:r('',49,52),form:'SFP+',rows:2},{label:'1G',names:r('',1,48),form:'RJ45',rows:2}]};
   const nd={key:'sw',name:'SW',role:'switch',model:'EX-SW48',hw:{members:[{id:'1',profile:pf}],portOf:n=>{const b=pf.banks.find(b=>b.names.includes(n));return b?{member:'1',bank:pf.banks.indexOf(b),index:b.names.indexOf(n)}:null;}},stencil:{art:{w:1000,h:100,body:''},master:sw,banks:c=>T.bankLayout(sw,c),edges:()=>T.portPoints(sw)}};
   const d3=new (D._Device)(nd,[],[],'plate'),x=n=>{const sl=d3.slot(n),p=d3.positions[sl.key];return p&&Math.round((p.x-d3.plates[0].x-9)/d3.img.w*W*100)/100;},rw=n=>d3.slot(n).row;
   const res={p1:x('1'),p2:x('2'),p12:x('12'),p13:x('13'),p48:x('48'),p49:x('49'),p51:x('51')};
   ok(res.p1===1.9&&res.p2===1.9&&rw('1')===0&&rw('2')===1&&res.p12===3.4&&res.p13===3.9&&res.p48===9.4&&res.p49<1.9&&res.p51<1.9&&res.p49<res.p51,'a 48-port switch stencil with cage edge points: ports 1-48 land on their jacks, 49-52 on the cages: '+JSON.stringify(res));}
  // The layout of a real 48-port stencil: the four SFP+ cages (two cage columns) carry five points
  // per row (two on one cage column, three on the other), then 24 RJ45 columns in blocks of six.
  {const conn=[],W=32,H=1;const add=(x,a,b)=>conn.push({x,y:a},{x,y:b});[1.25,1.8,2.4,2.95,3.5].forEach(x=>add(x,0.68,0.3));for(let blk=0;blk<4;blk++)for(let c=0;c<6;c++)add(4.7+blk*(6*1.05+0.5)+c*1.05,0.7,0.3);
   const sw={name:'EX-SW48B',w:W,h:H,connections:conn},r=(p,a,b)=>Array.from({length:b-a+1},(_,i)=>p+(a+i)),pf={title:'EX-SW48B',banks:[{label:'Uplinks',names:r('',49,52),form:'SFP+',rows:2},{label:'1G',names:r('',1,48),form:'RJ45',rows:2}]};
   const nd={key:'sw2',name:'SW2',role:'switch',model:'EX-SW48B',hw:{members:[{id:'1',profile:pf}],portOf:n=>{const b=pf.banks.find(b=>b.names.includes(n));return b?{member:'1',bank:pf.banks.indexOf(b),index:b.names.indexOf(n)}:null;}},stencil:{art:{w:3200,h:100,body:''},master:sw,banks:c=>T.bankLayout(sw,c),edges:()=>T.portPoints(sw)}};
   const d4=new (D._Device)(nd,[],[],'plate'),x=n=>{const sl=d4.slot(n),p=d4.positions[sl.key];return p&&Math.round((p.x-d4.plates[0].x-9)/d4.img.w*W*100)/100;};
   const res={p49:x('49'),p50:x('50'),p51:x('51'),p1:x('1'),p2:x('2'),p13:x('13'),p47:x('47'),p48:x('48')},last=4.7+3*(6*1.05+0.5)+5*1.05;
   ok(Math.abs(res.p49-1.53)<0.05&&res.p50===res.p49&&Math.abs(res.p51-2.95)<0.05&&res.p1===4.7&&res.p2===4.7&&Math.abs(res.p13-(4.7+6.8))<0.02&&Math.abs(res.p48-last)<0.02&&res.p47===res.p48,'cages marked by several points: 49-52 land on their cages and 1-48 on their jacks: '+JSON.stringify(res));}
  ok(got.every(([n,p])=>p&&p.exact)&&at('ha').fx===0.2&&at('mgmt').row===1&&at('port1').fx===0.6&&at('port16').fx===1.5&&at('x1').fx===1.9&&at('x3').fx===2&&at('x4').row===1,'ports are fitted onto the stencil despite extra points: '+JSON.stringify(got));}
 const aps=[{name:'EX-AP900 side',part:'EXAP900',w:3,h:0.4,connections:[]},{name:'EX-AP900',part:'EXAP900',w:3.2,h:0.45,connections:[]},{name:'EX-AP900 top',part:'EXAP900',w:2,h:2,connections:[]}];
 ok(T.match({model:'EX-AP900',parts:['EXAP900'],role:'ap'},aps)===aps[2],'an access point is drawn face-on, not from the side');
 ok(T.match({model:'EXSW48',role:'switch'},fam)===fam[4]&&T.match({model:'EXSW48',role:'ap'},fam)===fam[4],'the front view is chosen over the rear view');
 const L=T.layout(sw,8,2);
 ok(L&&L.main.length===8&&L.up.length===2,'8 ports and 2 uplinks from the connection points');
 ok(L.main[0].row===0&&L.main[1].row===1&&L.main[2].fx>L.main[0].fx&&Math.abs(L.main[0].fx-0.25)<0.01&&Math.abs(L.main[0].fy-0.25)<0.01,'odd ports on top, numbered by column: '+JSON.stringify(L.main.slice(0,3)));
 ok(T.layout(sw,24,4)===null,'no port map when the counts do not fit');
 ok(T.layout(sw,4,2)&&T.layout(sw,4,2).main.length===8,'known ports that fit a block use it');
 const art=T.artwork(sw);ok(art&&art.body.includes('data:image/png;base64,'),'PNG artwork');
 {const {emfFile}=require('./stencil-writer.cjs'),c=T.emf(emfFile('clip'));ok(c&&/<clipPath id="[^"]+"><path d="M/.test(c.body)&&/<g clip-path="url\(#/.test(c.body)&&!/<rect /.test(c.body),'a clip path limits what follows, and a no-op BitBlt paints nothing: '+(c&&c.body.slice(0,160)));}
 {const {emfFile}=require('./stencil-writer.cjs'),m=T.emf(emfFile('mask')),o=T.emf(emfFile('oddrop'));ok(m&&!m.partial&&/mix-blend-mode:multiply/.test(m.body)&&/mix-blend-mode:lighten/.test(m.body)&&o.partial&&!/<image/.test(o.body),'bitmaps follow their raster operation: a mask pair blends instead of covering the picture, and an operation the app cannot draw marks the picture partial');}
 {const {emfFile}=require('./stencil-writer.cjs');ok(T.emf(emfFile())&&!T.emf(emfFile()).partial&&T.emf(emfFile('gradient')).partial,'a picture with records the app cannot draw (a gradient fill) is marked partial, so it is not used automatically');}
 const apArt=T.artwork(ap);ok(apArt&&/<path d="M[^"]+" fill="#123456"/.test(apArt.body),'EMF artwork: '+(apArt&&apArt.body.slice(0,160)));
 // A diagram that uses the stencil.
 const devices=[],links=[],add=(n,t,m)=>{devices.push({key:E.deviceKey(n),name:n,type:t,model:m,ips:['10.30.0.'+(devices.length+1)],open:-1});return E.deviceKey(n);};
 const core=add('STENCIL-CORE','Switch','Example EX-SW8'),acc=add('STENCIL-ACCESS','Switch','Example EX-SW8'),ap1=add('STENCIL-AP1','Access Point','EX-AP515');
 links.push({a:core,b:acc,aPort:'GigabitEthernet1/1/1',bPort:'GigabitEthernet1/1/2',aSpeed:'10 Gb/s'},{a:acc,b:ap1,aPort:'GigabitEthernet1/0/3',bPort:'eth0'});
 const layout=M.layout(devices,links,{}),stencils=new Map();layout.all.forEach(n=>{const m=T.match(n,st.masters);if(m)stencils.set(n.key,{master:m,art:T.artwork(m),layout:(a,b)=>T.layout(m,a,b)});});
 const page=D.diagram({layout,links,vlans:new Map(),ports:new Map([[core,Array.from({length:8},(_,i)=>'GigabitEthernet1/0/'+(i+1))]]),stencils,title:'Stencil test'},{scope:'downstream',focus:layout.nodes.slice().sort((a,b)=>a.y-b.y)[0].key});
 const images=page.shapes.filter(s=>s.type==='image');
 ok(images.length===3&&images.every(s=>s.master),'devices and the access point are drawn with their stencils: '+images.length);
 ok(page.lines.every(l=>l.strict),'links route as usual');
 const accDev=page.devices.find(d=>d.key===acc),apLine=page.lines.find(l=>l.conn.ep!=null),start=apLine.points[0];
 const img=images.find(s=>s.x>=accDev.x&&s.x<accDev.x+accDev.w&&s.y>=accDev.y&&s.y<accDev.y+accDev.h);

 ok(img&&Math.abs(start[1]-(img.y+L.main[2].fy*img.h))<1.5&&Math.abs(start[0]-(img.x+L.main[2].fx*img.w))<=4.5,'the access point link starts at port 3 on the stencil: '+JSON.stringify(start));
 const svg=D.svg(page);ok(svg.includes('<svg x=')&&svg.includes('data:image/png;base64,'),'SVG embeds the artwork');
 const files=unzip(Buffer.from(D.vsdx([page],'Stencil test'))),names=Object.keys(files);
 ok(names.includes('visio/masters/masters.xml')&&names.filter(n=>/^visio\/masters\/master\d+\.xml$/.test(n)).length===2&&names.some(n=>/^visio\/media\/stencil\d+_rId1\.png$/.test(n))&&names.some(n=>/\.emf$/.test(n)),'Visio download carries the masters and their media: '+names.join(', '));
 const pageXML=files['visio/pages/page1.xml'].toString(),masters=files['visio/masters/masters.xml'].toString();
 ok((pageXML.match(/Master="\d+"/g)||[]).length===3&&/MasterShape="6"/.test(pageXML)&&/<ForeignData[^>]*><Rel r:id="rId\d+"\/><\/ForeignData>/.test(pageXML),'instances of the masters with their pictures');
 ok(/<Master ID="2"/.test(masters)&&/<Master ID="3"/.test(masters)&&!/LineStyle=["']3/.test(files['visio/masters/master2.xml'].toString()),'masters renumbered and their styles reset');
 ok(files['visio/pages/_rels/page1.xml.rels'].toString().includes('../media/stencil')&&/Extension="png"/.test(files['[Content_Types].xml'].toString())&&/vnd\.ms-visio\.master\+xml/.test(files['[Content_Types].xml'].toString()),'page relationships and content types');
 const plain=unzip(Buffer.from(D.vsdx([D.diagram({layout,links,vlans:new Map(),ports:new Map()},{scope:'site'})],'x')));ok(!Object.keys(plain).some(n=>/masters/.test(n)),'without stencils no masters are written');
 // Visio 2003-2010 stencils (.vss), read natively.
 const old=await T.read(new Uint8Array(vss()),'example.vss'),om=old.masters[0];
 ok(old.legacy&&old.masters.length===1&&om.name==='EX-SW8 8-port switch'&&om.part==='EX-SW8','a .vss stencil is read without Visio: '+om.name);
 ok(om.connections.length===10&&om.pictures.length===1&&om.pictures[0].ext==='png'&&Math.abs(om.w-4)<1e-9&&Math.abs(om.h-0.8)<1e-9,'its frame, connection points and picture (from a compressed stream)');
 const OL=T.layout(om,8,2);ok(OL&&OL.main.length===8&&OL.up.length===2&&Math.abs(OL.main[0].fx-0.25)<0.01&&OL.main[1].row===1,'ports from the .vss connection points');
 ok(T.match({model:'Example EX-SW8',role:'switch'},old.masters)===om&&T.artwork(om).body.includes('data:image/png;base64,'),'matched and drawn');
 const ostencils=new Map();layout.all.forEach(n=>{const m=T.match(n,old.masters);if(m)ostencils.set(n.key,{master:m,art:T.artwork(m),layout:(a,b)=>T.layout(m,a,b)});});
 const opage=D.diagram({layout,links,vlans:new Map(),ports:new Map(),stencils:ostencils,title:'Old stencil'},{scope:'site'});
 const ostyle=D.diagram({layout,links,vlans:new Map(),ports:new Map(),stencils:ostencils,title:'Old stencil'},{scope:'downstream',focus:layout.nodes.slice().sort((a,b)=>a.y-b.y)[0].key});
 const of=unzip(Buffer.from(D.vsdx([ostyle],'Old stencil'))),mx=Object.keys(of).filter(n=>/^visio\/masters\/master\d+\.xml$/.test(n)).map(n=>of[n].toString()).join('');
 ok(ostyle.shapes.some(s=>s.type==='image'&&s.master===om)&&/<Section N="Connection"><Row T="Connection" IX="0"><Cell N="X"/.test(mx)&&/ForeignType="Bitmap" CompressionType="PNG"/.test(mx)&&Object.keys(of).some(n=>/^visio\/media\/stencil\d+_rId1\.png$/.test(n)),'Visio downloads carry a master built from the .vss shape');
 const bad=vss();bad[512*3+0x1a]=6;await T.read(new Uint8Array(bad),'ancient.vss').then(()=>ok(false,'a Visio 2002 stencil is refused'),e=>ok(e.legacy&&/2002 or earlier/.test(e.message),'a Visio 2002 stencil is reported: '+e.message));
 {// NetworkDiagramStudio hardware shapes (NDS-hardware packs): a picture with port anchors by name.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
  const nm=T.fromImage({id:'art-example-2',name:'EX-NDS24 example switch',width:2400,height:240,ext:'png',data:new Uint8Array(png),anchors:{'1/1/1':[0.2,0.3],'1/1/2':[0.2,0.7],'1/1/25':[0.9,0.3],bad:[1.5,0]},models:['EXAMPLE/EXNDS24'],file:'example pack'});
  ok(nm.w===17.4&&Math.abs(nm.h-1.74)<1e-9&&nm.connections.length===3&&!nm.anchors.bad&&/ForeignType="Bitmap" CompressionType="PNG"/.test(nm.xml)&&T.artwork(nm)&&nm.pictures[0].ext==='png','an NDS shape becomes a picture master with a connection point on each anchor');
  ok(T.score({name:'SW',model:'EX-NDS24',parts:[]},nm)>=100&&T.score({name:'SW',model:'EX-NDS48',parts:[]},nm)<100,'the models an NDS shape lists choose it for those devices');
  const art=T.artwork(nm),node={key:'sw',name:'SW',role:'switch',model:'EX-NDS24',stencil:{art:art,master:nm,anchors:nm.anchors}},ports=['1/1/1','1/1/2','1/1/25','1/1/3'];
  const a=D.stencilAnchors(node,ports);
  ok(a['1/1/1']&&Math.abs(a['1/1/1'][0]-0.2)<1e-3&&Math.abs(a['1/1/1'][1]-0.3)<1e-3&&Math.abs(a['1/1/25'][0]-0.9)<1e-3&&Math.abs(a['1/1/2'][1]-0.7)<1e-3,'ports land on their anchors by name: '+JSON.stringify(a));
  ok(!a['1/1/3'],'a port without an anchor is not written as one (its place is only an estimate)');
  // Visio needs numeric master IDs: an NDS shape's own id (art-...) must not reach masters.xml.
  const nl=[{a:'sw',b:'sw2',aPort:'1/1/25',bPort:'1/1/25',aSpeed:'10 Gb/s'}],pg=D.diagram({layout:M.layout([{key:'sw',name:'SW',type:'Switch',model:'EX-NDS24',ips:['10.0.0.9'],open:-1},{key:'sw2',name:'SW2',type:'Switch',model:'EX-NDS24',ips:['10.0.0.10'],open:-1}],nl,{}),links:nl,vlans:new Map(),ports:new Map([['sw',ports],['sw2',ports]]),stencils:new Map([['sw',node.stencil],['sw2',node.stencil]]),title:'NDS'},{scope:'downstream',focus:'sw',style:'plate'});
  const vf=unzip(Buffer.from(D.vsdx([pg],'NDS shapes'))),mx=vf['visio/masters/masters.xml'].toString(),ids=[...mx.matchAll(/<Master ID="([^"]*)"/g)].map(m=>m[1]),refs=[...vf['visio/pages/page1.xml'].toString().matchAll(/ Master="([^"]*)"/g)].map(m=>m[1]);
  ok(ids.length===1&&ids.every(i=>/^\d+$/.test(i))&&refs.length&&refs.every(r=>ids.includes(r))&&Object.keys(vf).some(n=>/^visio\/media\/.*\.png$/.test(n)),'an NDS shape is exported to Visio as a numbered master its instances use: '+ids.join(',')+' / '+refs.join(','));}
 console.log(checks+' stencil checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
