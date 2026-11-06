// Network diagrams: page model, SVG and Visio (.vsdx) package.
const assert=require('node:assert/strict'),zlib=require('node:zlib'),E=require('../webview/evidence.js'),M=require('../webview/site_map.js'),D=require('../webview/diagram.js'),{demoSite}=require('./xlsx-writer.cjs');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=(method===8?zlib.inflateRawSync(data):data).toString();o+=30+nl+xl+size;}return files;}
(async()=>{
 const ev=await E.load(new Uint8Array(demoSite()),'example-site.xlsx'),devices=E.deviceList(ev).map(d=>Object.assign(d,{open:-1}));
 const links=ev.links.map(l=>({a:E.deviceKey(l.a.device),b:E.deviceKey(l.b.device),aPort:l.a.port,bPort:l.b.port,source:l.source,aSpeed:'10 Gb/s'}));
 const layout=M.layout(devices,links,{}),built=D.build({title:'Example Site',layout,links,vlans:new Map([['examplecore',[{id:'10',name:'USERS'},{id:'30',name:'WIRELESS'}]]])});
 const titles=built.pages.map(p=>p.title);
 ok(titles[0]==='Example Site - Existing Topology','overview page first: '+titles.join(' | '));
 ok(titles.includes('EXAMPLE-CORE')&&titles.length===2,'a small site fits on one page below its core: '+titles.join(' | '));
 const access=built.pages.find(p=>p.title==='EXAMPLE-CORE'),texts=access.shapes.filter(s=>s.type==='text').map(s=>s.text).join('\n');
 ok(texts.includes('EXAMPLE-FW1')&&texts.includes('EXAMPLE-ACCESS1')&&texts.includes('EXAMPLE-ACCESS3')&&texts.includes('10.0.99.11')&&texts.includes('VLAN 10 – USERS')&&texts.includes('Legend'),'building page: upstream device, management address, VLANs and legend');
 ok(texts.includes('EXAMPLE-AP1'),'access points are drawn');
 ok(access.shapes.some(s=>s.type==='line'&&s.color===D.LINK_TYPES.wap.color),'access point cables use the access point color');
 eq=(a,b,m)=>{checks++;assert.equal(a,b,m);};
 eq(D.linkType({aPort:'TenGigabitEthernet1/1/1',bPort:'Te1/0/11'},'switch','switch'),'fiber');eq(D.linkType({aPort:'GigabitEthernet1/0/7'},'switch','endpoint'),'copper');eq(D.linkType({aPort:'Gi1/0/1'},'switch','ap'),'wap');eq(D.linkType({aPort:'1/1/49'},'switch','switch'),'fiber');
 const svg=D.svg(access);ok(svg.startsWith('<svg')&&svg.includes('EXAMPLE-CORE')&&!/undefined|NaN/.test(svg),'SVG renders without undefined values');
 const files=unzip(Buffer.from(D.vsdx(built.pages,'Example Site')));
 ok(['[Content_Types].xml','_rels/.rels','visio/document.xml','visio/pages/pages.xml','visio/pages/_rels/pages.xml.rels','visio/pages/page1.xml'].every(f=>files[f]),'Visio package parts: '+Object.keys(files).join(', '));
 ok((files['visio/pages/pages.xml'].match(/<Page /g)||[]).length===built.pages.length,'one Visio page per diagram page');
 ok(files['visio/pages/page1.xml'].includes('<PageContents')&&!/NaN|undefined/.test(Object.values(files).join('')),'page XML has no invalid values');
 ok(/application\/vnd\.ms-visio\.drawing\.main\+xml/.test(files['[Content_Types].xml']),'content types declare the Visio drawing');
 console.log(checks+' network diagram checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
