// A fictional Visio stencil for tests: an 8-port switch with two uplinks (PNG artwork,
// connection points on its ports) and an access point (EMF artwork).
const zlib=require('node:zlib');
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
module.exports={stencil,zip,unzip,emfFile};
