// Vendor stencils: reading masters, matching, port positions from connection points,
// EMF artwork, and diagrams and Visio downloads that use them. The stencil is built here
// from fictional shapes; no vendor artwork is part of the repository.
const assert=require('node:assert/strict'),zlib=require('node:zlib'),T=require('../webview/stencils.js'),D=require('../webview/diagram.js'),M=require('../webview/site_map.js'),E=require('../webview/evidence.js');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function crc32(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}let x=0xffffffff;for(const v of b)x=(x>>>8)^t[(x^v)&0xff];return (x^0xffffffff)>>>0;}
// A deflated ZIP, as Visio writes them.
function zip(files){const parts=[],central=[];let off=0;for(const [name,content] of files){const n=Buffer.from(name),raw=Buffer.isBuffer(content)?content:Buffer.from(content),data=zlib.deflateRawSync(raw),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc32(raw),14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);parts.push(h,n,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc32(raw),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(off,42);central.push(c,n);off+=30+n.length+data.length;}
 const cd=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(files.length,8);e.writeUInt16LE(files.length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cd,e]);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=method===8?zlib.inflateRawSync(data):data;o+=30+nl+xl+size;}return files;}
// A 1x1 PNG.
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
// An EMF with a solid brush and one polygon.
function emfFile(){const recs=[];const rec=(type,body)=>{const b=Buffer.alloc(8+body.length);b.writeUInt32LE(type,0);b.writeUInt32LE(8+body.length,4);body.copy(b,8);recs.push(b);};
 const head=Buffer.alloc(100);head.writeInt32LE(0,0);head.writeInt32LE(0,4);head.writeInt32LE(99,8);head.writeInt32LE(49,12);head.writeUInt32LE(0x464D4520,32);rec(1,head.subarray(0,80));
 const br=Buffer.alloc(16);br.writeUInt32LE(1,0);br.writeUInt32LE(0,4);br[8]=0x12;br[9]=0x34;br[10]=0x56;rec(39,br);
 const sel=Buffer.alloc(4);sel.writeUInt32LE(1,0);rec(37,sel);
 const pg=Buffer.alloc(16+4+12);pg.writeUInt32LE(3,16);[[0,0],[99,0],[50,49]].forEach((p,i)=>{pg.writeInt16LE(p[0],20+i*4);pg.writeInt16LE(p[1],22+i*4);});rec(86,pg);
 rec(14,Buffer.alloc(12));const all=Buffer.concat(recs);all.writeUInt32LE(all.length,48);return all;}
// A stencil with one 8-port switch (2 SFP uplinks) whose ports carry connection points,
// and one access point.
function stencil(){
 const conn=[];let ix=0;const pt=(x,y)=>conn.push(`<Row T='Connection' IX='${ix++}'><Cell N='X' V='${x}'/><Cell N='Y' V='${y}'/></Row>`);
 for(let c=0;c<4;c++){pt(1+c*0.5,0.6);pt(1+c*0.5,0.2);}pt(3.6,0.6);pt(3.6,0.2);
 const sw=`<?xml version='1.0' encoding='utf-8' ?><MasterContents xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><Shapes><Shape ID='5' NameU='EX-SW8' Type='Group' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='PinX' V='2'/><Cell N='PinY' V='0.4'/><Cell N='Width' V='4'/><Cell N='Height' V='0.8'/><Cell N='LocPinX' V='2'/><Cell N='LocPinY' V='0.4'/><Section N='Property'><Row N='PartNumber'><Cell N='Value' V='EX-SW8' U='STR'/></Row><Row N='Manufacturer'><Cell N='Value' V='Example Networks' U='STR'/></Row></Section><Section N='Connection'>${conn.join('')}</Section><Shapes><Shape ID='6' Type='Foreign' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='PinX' V='2'/><Cell N='PinY' V='0.4'/><Cell N='Width' V='4'/><Cell N='Height' V='0.8'/><Cell N='LocPinX' V='2'/><Cell N='LocPinY' V='0.4'/><ForeignData ForeignType='Bitmap' CompressionType='PNG'><Rel r:id='rId1'/></ForeignData></Shape></Shapes></Shape></Shapes></MasterContents>`;
 const ap=`<?xml version='1.0' encoding='utf-8' ?><MasterContents xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><Shapes><Shape ID='5' NameU='EX-AP515 rear' Type='Group'><Cell N='PinX' V='0.5'/><Cell N='PinY' V='0.5'/><Cell N='Width' V='1'/><Cell N='Height' V='1'/><Cell N='LocPinX' V='0.5'/><Cell N='LocPinY' V='0.5'/><Shapes><Shape ID='6' Type='Foreign'><Cell N='PinX' V='0.5'/><Cell N='PinY' V='0.5'/><Cell N='Width' V='1'/><Cell N='Height' V='1'/><Cell N='LocPinX' V='0.5'/><Cell N='LocPinY' V='0.5'/><ForeignData ForeignType='EnhMetaFile'><Rel r:id='rId1'/></ForeignData></Shape></Shapes></Shape></Shapes></MasterContents>`;
 const rel=t=>`<?xml version='1.0' encoding='UTF-8'?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${t}"/></Relationships>`;
 return zip([['[Content_Types].xml','<Types/>'],['visio/document.xml','<VisioDocument/>'],
  ['visio/masters/masters.xml',`<?xml version='1.0' encoding='utf-8' ?><Masters xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><Master ID='2' NameU='Dynamic connector'><Rel r:id='rId9'/></Master><Master ID='7' NameU='EX-SW8 8-port switch' Name='EX-SW8 8-port switch'><PageSheet/><Rel r:id='rId1'/></Master><Master ID='8' NameU='EX-AP515 rear' Name='EX-AP515 rear'><PageSheet/><Rel r:id='rId2'/></Master></Masters>`],
  ['visio/masters/_rels/masters.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master7.xml"/><Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master8.xml"/></Relationships>'],
  ['visio/masters/master7.xml',sw],['visio/masters/_rels/master7.xml.rels',rel('sw.png')],['visio/masters/master8.xml',ap],['visio/masters/_rels/master8.xml.rels',rel('ap.emf')],
  ['visio/media/sw.png',PNG],['visio/media/ap.emf',emfFile()]]);
}
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
