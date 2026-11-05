// Minimal XLSX writer for tests: sheets of plain cells, stored with inline strings.
const zlib=require('node:zlib');
function crc32(buf){let c,crc=0xffffffff;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function zip(files){
 const locals=[],centrals=[];let offset=0;
 for(const [name,text] of files){
  const data=Buffer.from(text,'utf8'),packed=zlib.deflateRawSync(data),nameBuf=Buffer.from(name),crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBuf.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBuf.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,nameBuf,packed);centrals.push(central,nameBuf);offset+=30+nameBuf.length+packed.length;
 }
 const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,end]);
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function col(i){let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function sheetXML(rows){return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,ri)=>'<row r="'+(ri+1)+'">'+r.map((v,ci)=>v===''||v==null?'':typeof v==='number'?'<c r="'+col(ci)+(ri+1)+'"><v>'+v+'</v></c>':'<c r="'+col(ci)+(ri+1)+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';}
function xlsx(sheets){
 const files=[['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>']];
 sheets.forEach((s,i)=>files.push(['xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(s.rows)]));
 return zip(files);
}
// A fictional Auvik-style site export: one firewall, a core, three access switches,
// access points and endpoints. All names and addresses are documentation examples.
function demoSite(){
 const dev=(name,type,model,ip,connected,extra={})=>['Up',name,type,model,'',ip,'',connected,extra.software||'',extra.serial||'','',''];
 const devices=[['DEVICES','','','','','','','','','','',''],['Status','Device Name','Type','Make & Model','MAC Address(es)','IP Address(es)','Network(s)','Connected To','Software Version','Serial Number','Firmware Version','Description'],
  dev('EXAMPLE-FW1','Firewall','Example Firewall 600','192.0.2.1, 10.0.99.1','EXAMPLE-CORE through TenGigabitEthernet1/0/1',{software:'7.4.2',serial:'EXAMPLE-FW-0001'}),
  dev('EXAMPLE-CORE','Switch','Example Core 9500','10.0.99.2','EXAMPLE-FW1 through port1, EXAMPLE-ACCESS1 through TenGigabitEthernet1/1/1, EXAMPLE-ACCESS2 through TenGigabitEthernet1/1/1, EXAMPLE-ACCESS3 through TenGigabitEthernet1/1/1',{serial:'EXAMPLE-CORE-0001'}),
  dev('EXAMPLE-ACCESS1','Switch','Example Access 48P','10.0.99.11','EXAMPLE-CORE through TenGigabitEthernet1/0/11'),
  dev('EXAMPLE-ACCESS2','Switch','Example Access 48P','10.0.99.12','EXAMPLE-CORE through TenGigabitEthernet1/0/12'),
  dev('EXAMPLE-ACCESS3','Switch','Example Access 24P','10.0.99.13','EXAMPLE-CORE through TenGigabitEthernet1/0/13'),
  dev('EXAMPLE-AP1','Access Point','Example AP 500','10.0.30.21','EXAMPLE-ACCESS1 through GigabitEthernet1/0/1'),
  dev('EXAMPLE-AP2','Access Point','Example AP 500','10.0.30.22','EXAMPLE-ACCESS2 through GigabitEthernet1/0/1'),
  dev('EXAMPLE-PRINTER','Printer','Example Printer','10.0.10.50','EXAMPLE-ACCESS1 through GigabitEthernet1/0/7')];
 const iface=(admin,oper,name,mac,parent,speed,connected,vlans)=>[admin,oper,name,mac,'Ethernet',parent,speed,connected,vlans];
 const interfaces=[['INTERFACES','','','','','','','',''],['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'],
  iface('Up','Up','port1','00:00:5e:00:53:01','EXAMPLE-FW1','10 Gbit/s','TenGigabitEthernet1/0/1  on EXAMPLE-CORE',0),
  iface('Up','Up','TenGigabitEthernet1/0/1 (to firewall)','00:00:5e:00:53:11','EXAMPLE-CORE','10 Gbit/s','port1  on EXAMPLE-FW1','VLAN 99 (MANAGEMENT)'),
  iface('Up','Up','TenGigabitEthernet1/0/11','00:00:5e:00:53:12','EXAMPLE-CORE','10 Gbit/s','TenGigabitEthernet1/1/1  on EXAMPLE-ACCESS1','VLAN 10 (USERS), VLAN 99 (MANAGEMENT)'),
  iface('Up','Up','TenGigabitEthernet1/0/12','00:00:5e:00:53:13','EXAMPLE-CORE','10 Gbit/s','TenGigabitEthernet1/1/1  on EXAMPLE-ACCESS2','VLAN 10 (USERS), VLAN 99 (MANAGEMENT)'),
  iface('Up','Up','TenGigabitEthernet1/0/13','00:00:5e:00:53:14','EXAMPLE-CORE','10 Gbit/s','TenGigabitEthernet1/1/1  on EXAMPLE-ACCESS3','VLAN 10 (USERS), VLAN 99 (MANAGEMENT)'),
  iface('Up','Up','TenGigabitEthernet1/1/1 (Uplink to core)','00:00:5e:00:53:21','EXAMPLE-ACCESS1','10 Gbit/s','TenGigabitEthernet1/0/11  on EXAMPLE-CORE','VLAN 10 (USERS), VLAN 99 (MANAGEMENT)'),
  iface('Up','Up','GigabitEthernet1/0/1 (AP)','00:00:5e:00:53:22','EXAMPLE-ACCESS1','1.0 Gbit/s','eth0  on EXAMPLE-AP1','VLAN 30 (WIRELESS)'),
  iface('Up','Down','GigabitEthernet1/0/2','00:00:5e:00:53:23','EXAMPLE-ACCESS1','0 bps',0,'VLAN 10 (USERS)'),
  iface('Down','Down','GigabitEthernet1/0/3','00:00:5e:00:53:24','EXAMPLE-ACCESS1','0 bps',0,'VLAN 10 (USERS)'),
  iface('Up','Up','GigabitEthernet1/0/7 (Printer)','00:00:5e:00:53:25','EXAMPLE-ACCESS1','100 Mbit/s','Some Interface  on EXAMPLE-PRINTER','VLAN 10 (USERS)')];
 return xlsx([
  {name:'Summary',rows:[['Example Organization Summary',''],['Created On',46000.5],['Emergency Alerts',0],['Critical Alerts',0],['Warning Alerts',1],['Informational Alerts',3]]},
  {name:'Devices',rows:devices},
  {name:'Interfaces',rows:interfaces},
  {name:'Routes',rows:[['ROUTES','','','',''],['Device Name','Destination','Next Hop','Metric','Gateway Interface'],['EXAMPLE-FW1','0.0.0.0/0','192.0.2.254','1','wan1'],['EXAMPLE-FW1','10.0.10.0/24','10.0.99.2','10','port1']]},
  {name:'Forwarding Database (FDB)',rows:[['FORWARDING DATABASE (FDB)','','',''],['Device Name','Destination MAC Address','Interface','VLAN'],['EXAMPLE-ACCESS1','00:00:5e:00:53:a1','GigabitEthernet1/0/7',10],['EXAMPLE-ACCESS1','00:00:5e:00:53:a1','GigabitEthernet1/0/7',''],['EXAMPLE-ACCESS1','00:00:5e:00:53:a2','GigabitEthernet1/0/1',30]]},
  {name:'ARP Entries',rows:[['ARP ENTRIES','','',''],['Device Name','IP Address','Hardware (MAC) Address','Interface'],['EXAMPLE-FW1','10.0.10.50','00:00:5e:00:53:a1','port1']]},
  {name:'Vendor Device Lifecycle Info...',rows:[['VENDOR DEVICE LIFECYCLE INFORMATION','','','',''],['Device','Make & Model','Serial Number','Sales Availability','Last Support','Software Maintenance'],['EXAMPLE-ACCESS3','Example Access 24P','EXAMPLE-0003','2015-01-30','2020-01-31','2016-01-30']]},
  {name:'Vulnerabilities',rows:[['VULNERABILITIES','','','',''],['CVE ID','CVSS Score & Severity','Devices Matched','Known Exploited Vulnerability','Description'],['CVE-0000-0001','7.5 High','1','','Example vulnerability description for tests.']]}
 ]);
}
module.exports={xlsx,zip,demoSite};
