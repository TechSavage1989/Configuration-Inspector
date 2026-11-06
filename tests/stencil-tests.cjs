// Vendor stencils: reading masters, matching, port positions from connection points,
// EMF artwork, and diagrams and Visio downloads that use them. The stencil is built here
// from fictional shapes; no vendor artwork is part of the repository.
const assert=require('node:assert/strict'),zlib=require('node:zlib'),T=require('../webview/stencils.js'),D=require('../webview/diagram.js'),M=require('../webview/site_map.js'),E=require('../webview/evidence.js');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const {stencil,unzip}=require('./stencil-writer.cjs');
(async()=>{
 const st=await T.read(new Uint8Array(stencil()),'example.vssx');
 ok(st.masters.length===2&&st.masters[0].name==='EX-SW8 8-port switch'&&st.masters[0].part==='EX-SW8'&&st.masters[0].manufacturer==='Example Networks','masters with their properties (connectors skipped): '+st.masters.map(m=>m.name).join(', '));
 const sw=st.masters[0],ap=st.masters[1];
 ok(sw.connections.length===10&&sw.pictures.length===1&&sw.pictures[0].ext==='png','connection points and picture');
 ok(T.match({model:'Example EX-SW8',role:'switch'},st.masters)===sw&&T.match({model:'Switch',parts:['EX-SW8'],role:'switch'},st.masters)===sw,'matched by model or part number');
 ok(T.match({model:'EX-AP515',role:'ap'},st.masters)===ap,'access point by model');
 ok(T.match({model:'Other 9999',role:'switch'},st.masters)===null,'no stencil for an unknown model');
 const L=T.layout(sw,8,2);
 ok(L&&L.main.length===8&&L.up.length===2,'8 ports and 2 uplinks from the connection points');
 ok(L.main[0].row===0&&L.main[1].row===1&&L.main[2].fx>L.main[0].fx&&Math.abs(L.main[0].fx-0.25)<0.01&&Math.abs(L.main[0].fy-0.25)<0.01,'odd ports on top, numbered by column: '+JSON.stringify(L.main.slice(0,3)));
 ok(T.layout(sw,24,4)===null,'no port map when the counts do not fit');
 ok(T.layout(sw,4,2)&&T.layout(sw,4,2).main.length===8,'known ports that fit a block use it');
 const art=T.artwork(sw);ok(art&&art.body.includes('data:image/png;base64,'),'PNG artwork');
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
 console.log(checks+' stencil checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
