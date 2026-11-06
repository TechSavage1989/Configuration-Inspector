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
function emfFile(extra){const recs=[];const rec=(type,body)=>{const b=Buffer.alloc(8+body.length);b.writeUInt32LE(type,0);b.writeUInt32LE(8+body.length,4);body.copy(b,8);recs.push(b);};
 const head=Buffer.alloc(100);head.writeInt32LE(0,0);head.writeInt32LE(0,4);head.writeInt32LE(99,8);head.writeInt32LE(49,12);head.writeUInt32LE(0x464D4520,32);rec(1,head.subarray(0,80));
 const br=Buffer.alloc(16);br.writeUInt32LE(1,0);br.writeUInt32LE(0,4);br[8]=0x12;br[9]=0x34;br[10]=0x56;rec(39,br);
 const sel=Buffer.alloc(4);sel.writeUInt32LE(1,0);rec(37,sel);
 const pg=Buffer.alloc(16+4+12);pg.writeUInt32LE(3,16);[[0,0],[99,0],[50,49]].forEach((p,i)=>{pg.writeInt16LE(p[0],20+i*4);pg.writeInt16LE(p[1],22+i*4);});rec(86,pg);
 if(extra==='gradient')rec(118,Buffer.alloc(40));
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

// A fictional Visio 2003-2010 stencil (.vss): an OLE compound file whose VisioDocument
// stream holds pointer lists, a name table, one stencil page with a group shape (its
// transform and ten connection points: 8 ports in two rows, 2 uplinks) and a foreign
// shape with a PNG picture. One stream is stored "compressed" with literal-only blocks.
function vss(){
 const parts=[];let at=0x60;const put=buf=>{const o=at;parts.push([o,buf]);at+=buf.length;return {offset:o,length:buf.length};};
 const ptr=(type,s,format)=>{const b=Buffer.alloc(18);b.writeUInt32LE(type,0);b.writeUInt32LE(s.offset,8);b.writeUInt32LE(s.length,12);b.writeUInt16LE(format,16);return b;};
 const list=ptrs=>{const b=Buffer.alloc(16+ptrs.length*18);b.writeUInt32LE(8,0);b.writeUInt32LE(ptrs.length,8);ptrs.forEach((p,i)=>p.copy(b,16+i*18));return b;};
 const chunk=(type,data)=>{const h=Buffer.alloc(19);h.writeUInt32LE(type,0);h.writeUInt32LE(data.length,12);return Buffer.concat([h,data]);};
 const dbl=(...v)=>{const b=Buffer.alloc(v.length*9);v.forEach((x,i)=>{b[i*9]=0x40;b.writeDoubleLE(x,i*9+1);});return b;};
 const literal=buf=>{const out=[];for(let i=0;i<buf.length;i+=8){const part=buf.subarray(i,i+8);out.push(Buffer.from([0xff]),part);}return Buffer.concat(out);};
 const shapeHead=parent=>{const b=Buffer.alloc(40);b.writeUInt32LE(parent,10);return b;};
 const name2=s=>{const b=Buffer.alloc(4+(s.length+1)*2);b.writeUInt32LE(1,0);b.write(s,4,'utf16le');return b;};
 // Group: 4 in x 0.8 in, ports at x 1..2.5 (top y 0.6, bottom y 0.2), uplinks at x 3.6.
 const conns=[];for(let c=0;c<4;c++){conns.push(chunk(0x99,dbl(1+c*0.5,0.6,0,0)),chunk(0x99,dbl(1+c*0.5,0.2,0,0)));}conns.push(chunk(0x99,dbl(3.6,0.6,0,0)),chunk(0x99,dbl(3.6,0.2,0,0)));
 const group=put(Buffer.concat([chunk(0x47,shapeHead(0)),chunk(0x9b,Buffer.concat([dbl(2,0.4,4,0.8,2,0.4,0),Buffer.from([0,0])])),...conns]));
 const ftype=Buffer.alloc(60);dbl(0,0,4,0.8).copy(ftype,0);ftype.writeUInt16LE(1,36);ftype.writeUInt16LE(0,38);ftype.writeUInt32LE(4,49);
 const shapeList=ptrs=>{const b=Buffer.alloc(52+ptrs.length*18);b.writeUInt32LE(44,0);b.writeUInt32LE(5,10);b.writeUInt32LE(ptrs.length,44);ptrs.forEach((p,i)=>p.copy(b,52+i*18));return b;};
 const fShape=put(literal(Buffer.concat([Buffer.alloc(4),shapeList([ptr(0x9b,put(Buffer.concat([dbl(2,0.4,4,0.8,2,0.4,0),Buffer.from([0,0])])),0x40),ptr(0x98,put(ftype),0x40),ptr(0x0c,put(PNG),0x40)])])));
 const empty=Buffer.alloc(18),page=put(list([empty,empty,empty,empty,empty,ptr(0x47,group,0xd0),ptr(0x4e,fShape,0x52)]));
 const names=put(list([ptr(0x33,put(name2('EX-SW8 8-port switch')),0x40)]));
 const idx=Buffer.alloc(4+13);idx.writeUInt32LE(1,0);idx.writeUInt32LE(0,4);idx.writeUInt32LE(0,8);idx.writeUInt32LE(1,12);
 const stencils=put(list([ptr(0xc9,put(idx),0x40),ptr(0x1e,page,0x50)]));
 const trailer=put(list([ptr(0x32,names,0x50),ptr(0x1d,stencils,0x50)]));
 const doc=Buffer.alloc(Math.max(at,4200));doc[0x1a]=11;ptr(0x14,trailer,0x50).copy(doc,0x24);parts.forEach(([o,b])=>b.copy(doc,o));
 // Compound file: header, one FAT sector, one directory sector, then the stream.
 const ss=512,sectors=Math.ceil(doc.length/ss),file=Buffer.alloc(ss*(3+sectors));
 Buffer.from('d0cf11e0a1b11ae1','hex').copy(file,0);file.writeUInt16LE(0x3e,24);file.writeUInt16LE(3,26);file.writeUInt16LE(0xfffe,28);file.writeUInt16LE(9,30);file.writeUInt16LE(6,32);file.writeUInt32LE(1,44);file.writeUInt32LE(1,48);file.writeUInt32LE(4096,56);file.writeUInt32LE(0xfffffffe,60);file.writeUInt32LE(0xfffffffe,68);
 for(let i=0;i<109;i++)file.writeUInt32LE(i?0xffffffff:0,76+i*4);
 const fat=ss;for(let i=0;i<ss/4;i++)file.writeUInt32LE(0xffffffff,fat+i*4);file.writeUInt32LE(0xfffffffd,fat);file.writeUInt32LE(0xfffffffe,fat+4);for(let i=0;i<sectors;i++)file.writeUInt32LE(i===sectors-1?0xfffffffe:3+i,fat+(2+i)*4);
 const dir=ss*2,entry=(n,name,type,child,start,size)=>{const o=dir+n*128;file.write(name,o,'utf16le');file.writeUInt16LE((name.length+1)*2,o+64);file[o+66]=type;file[o+67]=1;file.writeUInt32LE(0xffffffff,o+68);file.writeUInt32LE(0xffffffff,o+72);file.writeUInt32LE(child,o+76);file.writeUInt32LE(start,o+116);file.writeUInt32LE(size,o+120);};
 entry(0,'Root Entry',5,1,0xfffffffe,0);entry(1,'VisioDocument',2,0xffffffff,2,doc.length);doc.copy(file,ss*3);
 return file;
}
module.exports.vss=vss;
