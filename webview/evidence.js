(function(root){'use strict';
 // Supplementary data: monitoring exports (Auvik site and device reports as XLSX or
 // CSV, generic neighbor tables) and show-command output (routes, interfaces,
 // LLDP/CDP neighbors, MAC and ARP tables). Everything is parsed locally into one
 // normalized shape that the app joins with open configurations by device name or
 // management address. Nothing here changes a configuration model.
 var MAX_UNZIPPED=120*1024*1024;

 // ---------- names ----------
 var IFACE_PREFIX=[['twentyfivegige','twe'],['twentyfivegigabitethernet','twe'],['tengigabitethernet','te'],['fortygigabitethernet','fo'],['hundredgigabitethernet','hu'],['hundredgige','hu'],['gigabitethernet','gi'],['fastethernet','fa'],['port-channel','po'],['portchannel','po'],['ethernet','eth'],['loopback','lo'],['tunnel','tu'],['management','mgmt'],['mgmt','mgmt'],['vlan','vl'],['twe','twe'],['ten','te'],['gig','gi'],['te','te'],['tw','twe'],['fo','fo'],['hu','hu'],['gi','gi'],['fa','fa'],['po','po'],['eth','eth'],['et','eth'],['lo','lo'],['tu','tu'],['vl','vl']];
 function interfaceKey(name){
  var s=String(name==null?'':name).replace(/\s*\(.*\)\s*$/,'').replace(/\s+/g,'').toLowerCase();if(!s)return '';
  var m=s.match(/^([a-z][a-z-]*?)(\d.*)$/);if(!m)return s;
  for(var i=0;i<IFACE_PREFIX.length;i++)if(m[1]===IFACE_PREFIX[i][0])return IFACE_PREFIX[i][1]+m[2];
  return m[1]+m[2];
 }
 function interfaceLabel(name){return String(name==null?'':name).replace(/\s*\(.*\)\s*$/,'').trim();}
 function interfaceDescription(name){var m=String(name||'').match(/\((.*)\)\s*$/);return m?m[1].trim():'';}
 var IPV4=/^(?:\d{1,3}\.){3}\d{1,3}$/;
 function deviceKey(name){
  var s=String(name==null?'':name).trim().replace(/\.$/,'');if(!s)return '';
  if(!IPV4.test(s)&&!/@/.test(s))s=s.split('.')[0];
  return s.toLowerCase().replace(/[^a-z0-9@.]/g,'');
 }
 // Auvik names devices it cannot identify "Device@192.0.2.10" or "Unidentified Device".
 function genericDevice(name){return !name||/^(?:device@|unknown device$|unidentified device$)/i.test(String(name).trim());}
 function normalizeMAC(v){var hex=String(v||'').toLowerCase().replace(/[^0-9a-f]/g,'');return hex.length===12?hex.match(/../g).join(':'):'';}
 var MAC_TOKEN=/^(?:[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}|[0-9a-f]{6}-[0-9a-f]{6})$/i;

 // ---------- ZIP / XLSX ----------
 function u16(b,o){return b[o]|(b[o+1]<<8);}
 function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
 function isZip(bytes){return bytes&&bytes.length>22&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4;}
 async function inflateRaw(data){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot read compressed spreadsheets. Save the sheet as CSV and open that instead.');
  var stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
 }
 async function unzip(bytes,wanted){
  var end=-1;for(var i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(bytes,i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('The spreadsheet is damaged or is not an XLSX file.');
  var count=u16(bytes,end+10),offset=u32(bytes,end+16),files={},total=0,decoder=new TextDecoder('utf-8');
  for(var n=0;n<count;n++){
   if(u32(bytes,offset)!==0x02014b50)break;
   var method=u16(bytes,offset+10),size=u32(bytes,offset+20),usize=u32(bytes,offset+24),nameLen=u16(bytes,offset+28),extra=u16(bytes,offset+30),comment=u16(bytes,offset+32),local=u32(bytes,offset+42);
   var name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLen));offset+=46+nameLen+extra+comment;
   if(!wanted(name))continue;
   total+=usize;if(total>MAX_UNZIPPED)throw new Error('The spreadsheet is too large to open.');
   var start=local+30+u16(bytes,local+26)+u16(bytes,local+28),data=bytes.subarray(start,start+size);
   var out=method===0?data:method===8?await inflateRaw(data):null;if(out)files[name]=decoder.decode(out);
  }
  return files;
 }
 function xmlText(s){return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,function(_,x){return String.fromCodePoint(parseInt(x,16));}).replace(/&#(\d+);/g,function(_,d){return String.fromCodePoint(Number(d));}).replace(/&amp;/g,'&');}
 function attr(tag,name){var m=tag.match(new RegExp('\\s'+name+'="([^"]*)"'));return m?xmlText(m[1]):'';}
 function columnIndex(ref){var letters=String(ref||'').replace(/\d+/g,''),n=0;for(var i=0;i<letters.length;i++)n=n*26+letters.charCodeAt(i)-64;return n-1;}
 function sheetRows(xml,shared){
  var rows=[],rowRe=/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g,m;
  while((m=rowRe.exec(xml))){
   var row=[],cellRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,c,next=0;
   while(m[1]&&(c=cellRe.exec(m[1]))){
    var tag='<c'+c[1]+'>',ref=attr(tag,'r'),type=attr(tag,'t'),body=c[2]||'',idx=ref?columnIndex(ref):next,value='';
    if(type==='inlineStr'){value=(body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(t){return xmlText(t.replace(/<[^>]+>/g,''));}).join('');}
    else{var v=body.match(/<v>([\s\S]*?)<\/v>/);v=v?xmlText(v[1]):'';value=type==='s'?(shared[Number(v)]||''):type==='b'?(v==='1'?'TRUE':'FALSE'):v;}
    row[idx]=value;next=idx+1;
   }
   for(var k=0;k<row.length;k++)if(row[k]===undefined)row[k]='';
   rows.push(row);
  }
  return rows;
 }
 async function readXlsx(bytes){
  var files=await unzip(bytes,function(n){return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n);});
  if(!files['xl/workbook.xml'])throw new Error('The file is not an Excel workbook.');
  var shared=[];if(files['xl/sharedStrings.xml'])(files['xl/sharedStrings.xml'].match(/<si\b[^>]*>[\s\S]*?<\/si>/g)||[]).forEach(function(si){shared.push((si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g)||[]).map(function(t){return xmlText(t.replace(/<[^>]+>/g,''));}).join(''));});
  var rels={};(files['xl/_rels/workbook.xml.rels']||'').replace(/<Relationship\b[^>]*>/g,function(tag){rels[attr(tag,'Id')]=attr(tag,'Target').replace(/^\/?(xl\/)?/,'');return '';});
  var tables=[];(files['xl/workbook.xml'].match(/<sheet\b[^>]*>/g)||[]).forEach(function(tag){var target=rels[attr(tag,'r:id')],xml=target&&files['xl/'+target];if(xml)tables.push({name:attr(tag,'name'),rows:sheetRows(xml,shared)});});
  return tables;
 }
 function parseCSV(text){
  var rows=[],row=[],field='',q=false,s=String(text||'').replace(/^﻿/,''),delim=(s.split('\n')[0].match(/\t/g)||[]).length>(s.split('\n')[0].match(/,/g)||[]).length?'\t':',';
  for(var i=0;i<s.length;i++){var ch=s[i];
   if(q){if(ch==='"'){if(s[i+1]==='"'){field+='"';i++;}else q=false;}else field+=ch;continue;}
   if(ch==='"'&&field==='')q=true;else if(ch===delim){row.push(field);field='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=ch;}
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows.filter(function(r){return r.some(function(c){return String(c).trim();});});
 }
 function excelDate(v){var n=Number(v);if(!isFinite(n)||n<20000||n>80000)return String(v||'');var d=new Date(Math.round((n-25569)*86400000));return d.toISOString().slice(0,16).replace('T',' ');}

 // ---------- evidence shape ----------
 function emptyEvidence(filename,source){return {filename:filename||'',source:source,scope:'device',device:'',created:'',devices:[],interfaces:[],links:[],routes:[],arp:[],mac:[],networks:[],alerts:null,lifecycle:[],vulnerabilities:[],utilization:null,sections:[],notes:[]};}
 function addSection(ev,label,count){if(count)ev.sections.push({label:label,count:count});}
 function present(v){var s=String(v==null?'':v).trim();return s&&s!=='0'&&!/^no data available\.?$/i.test(s)?s:'';}
 function splitList(v){return present(v)?String(v).split(/\s*,\s*/).map(function(x){return x.replace(/\s*\(\d+\)$/,'').trim();}).filter(Boolean):[];}

 // A table is a sheet or CSV. Its header row is the first row that contains at least
 // two recognized column names; columns are looked up by name, not position.
 function findHeader(rows,groups){
  for(var i=0;i<Math.min(rows.length,12);i++){var lower=rows[i].map(function(c){return String(c).trim().toLowerCase();});if(groups.every(function(g){return g.some(function(n){return lower.includes(n);});}))return {index:i,cols:lower};}
  return null;
 }
 function reader(table,header){
  return table.rows.slice(header.index+1).filter(function(r){return r.some(function(c){return present(c);})&&!/^no data available/i.test(String(r[0]||''));}).map(function(r){return function(){for(var a=0;a<arguments.length;a++){var i=header.cols.indexOf(arguments[a]);if(i>=0&&present(r[i]))return String(r[i]).trim();}return '';};});
 }
 // Each group lists alternative column names; a header row needs one name from every group.
 var RECOGNIZERS=[
  {id:'interfaces',groups:[['interface name'],['oper status','parent device','admin status']]},
  {id:'devices',groups:[['device name'],['make & model','ip address(es)']]},
  {id:'routes',groups:[['destination'],['next hop']]},
  {id:'arp',groups:[['ip address'],['hardware (mac) address','mac address']]},
  {id:'fdb',groups:[['destination mac address']]},
  {id:'networks',groups:[['network name'],['type','# of devices']]},
  {id:'alerts',groups:[['severity'],['alert name']]},
  {id:'lifecycle',groups:[['last support'],['device']]},
  {id:'vulnerabilities',groups:[['cve id']]},
  {id:'utilization',groups:[['cpu'],['memory']]},
  {id:'neighbors',groups:[['local port','local interface','local intf'],['remote device','neighbor','system name','remote system name','neighbor device','device id'],['remote port','neighbor port','port id','remote port id']]}
 ];
 // Auvik "Connected To": "GigabitEthernet0/1  on SW2" (interface sheet) or
 // "SW2 through GigabitEthernet0/1" (device sheet; the port belongs to SW2).
 function parseConnectedOn(v){var all=parseConnectedList(v);return all[0]||null;}
 function parseConnectedList(v){var s=present(v);if(!s)return [];var out=[];s.split(/,\s+/).forEach(function(part){var m=part.match(/^(.*?)\s+on\s+(.+)$/);if(!m){if(out.length&&!/\son\s/.test(part))out[out.length-1].device+=', '+part;else out.push({device:part.trim(),port:''});return;}var port=m[1].trim();out.push({device:m[2].trim(),port:PLACEHOLDER_PORT.test(port)?'':port});});return out;}
 function parseThrough(v){return splitList(v).map(function(part){var m=part.match(/^(.*?)\s+through\s+(.+)$/);if(!m)return {device:part,port:''};var port=m[2].trim();return {device:m[1].trim(),port:PLACEHOLDER_PORT.test(port)?'':port};});}
 var PLACEHOLDER_PORT=/^(?:some|wired|wifi|wireless|unknown) interface$/i;
 function vlansFrom(v){var out=[];String(v||'').replace(/VLAN\s+(\d+)(?:\s*\(([^)]*)\))?/gi,function(_,id,name){if(!out.some(function(x){return x.id===id;}))out.push({id:id,name:name||''});return '';});return out;}
 function speedText(v){var s=present(v);return s&&!/^0 ?bps$/i.test(s)?s.replace(/\.0 /,' ').replace(/bit\/s/,'b/s'):'';}

 function fromTables(tables,filename){
  var ev=emptyEvidence(filename,'Spreadsheet'),recognized=0,auvik=false,title='';
  tables.forEach(function(t){
   var first=String((t.rows[0]||[])[0]||'');
   if(/^summary$/i.test(t.name)&&/ summary$/i.test(first)){auvik=true;title=first.replace(/\s+summary$/i,'');
    t.rows.forEach(function(r){var k=String(r[0]||'').trim(),v=r[1];if(/^created on$/i.test(k))ev.created=excelDate(v);var a=k.match(/^(emergency|critical|warning|informational) alerts$/i);if(a){ev.alerts=ev.alerts||{};ev.alerts[a[1].toLowerCase()]=Number(v)||0;}});return;}
   if(/evidence/i.test(t.name))return;
   var rec=null,header=null;if(/^top /i.test(t.name))return;for(var i=0;i<RECOGNIZERS.length&&!header;i++){header=findHeader(t.rows,RECOGNIZERS[i].groups);if(header)rec=RECOGNIZERS[i];}
   if(!header)return;
   var rows=reader(t,header),before=recognized;
   if(rec.id==='interfaces'){rows.forEach(function(get){var name=get('interface name');if(!name)return;var list=parseConnectedList(get('connected to')),n=list[0]||null;ev.interfaces.push({neighbors:list,device:get('parent device'),name:PLACEHOLDER_PORT.test(interfaceLabel(name))?'':interfaceLabel(name),description:interfaceDescription(name),admin:get('admin status'),oper:get('oper status'),mac:normalizeMAC(get('mac address')),type:get('type'),speed:speedText(get('negotiated speed')),vlans:vlansFrom(get('configuration details')),neighbor:n,source:'Auvik'});});recognized+=rows.length;}
   else if(rec.id==='devices'){rows.forEach(function(get){var name=get('device name');if(!name)return;var existing=ev.devices.find(function(d){return d.name===name;}),record=({name:name,type:get('type'),model:get('make & model'),ips:splitList(get('ip address(es)')),macs:splitList(get('mac address(es)')).map(normalizeMAC).filter(Boolean),networks:splitList(get('network(s)')),connected:parseThrough(get('connected to')),software:get('software version'),firmware:get('firmware version'),serial:get('serial number'),description:get('description'),status:get('status')});if(!existing){ev.devices.push(record);return;}Object.keys(record).forEach(function(k){var v=record[k];if(v&&(!Array.isArray(v)||v.length)&&(!existing[k]||Array.isArray(existing[k])&&!existing[k].length))existing[k]=v;});});recognized+=rows.length;}
   else if(rec.id==='routes'){rows.forEach(function(get){var hop=get('next hop');ev.routes.push({device:get('device name'),prefix:get('destination'),nextHop:hop==='0.0.0.0'?'':hop,metric:get('metric'),iface:get('gateway interface'),protocol:'',distance:'',source:'Auvik'});});recognized+=rows.length;}
   else if(rec.id==='arp'){rows.forEach(function(get){ev.arp.push({device:get('device name'),ip:get('ip address'),mac:normalizeMAC(get('hardware (mac) address','mac address')),iface:get('interface')});});recognized+=rows.length;}
   else if(rec.id==='fdb'){rows.forEach(function(get){ev.mac.push({device:get('device name'),mac:normalizeMAC(get('destination mac address')),iface:get('interface'),vlan:get('vlan')});});recognized+=rows.length;}
   else if(rec.id==='networks'){rows.forEach(function(get){var name=get('network name'),m=name.match(/^(\S+)(?:\s*\((.*)\))?$/);ev.networks.push({network:m?m[1]:name,name:m&&m[2]||'',type:get('type'),devices:get('# of devices')});});recognized+=rows.length;}
   else if(rec.id==='alerts'){ev.alertList=(ev.alertList||[]).concat(rows.map(function(get){return {severity:get('severity'),name:get('alert name'),entity:get('entity'),status:get('status'),detected:get('detected on')};}));recognized+=rows.length;}
   else if(rec.id==='lifecycle'){rows.forEach(function(get){ev.lifecycle.push({device:get('device'),model:get('make & model'),serial:get('serial number'),salesEnd:get('sales availability'),lastSupport:get('last support'),softwareEnd:get('software maintenance'),securityEnd:get('security software maintenance')});});recognized+=rows.length;}
   else if(rec.id==='vulnerabilities'){rows.forEach(function(get){ev.vulnerabilities.push({cve:get('cve id'),score:get('cvss score & severity'),devices:get('devices matched'),exploited:get('known exploited vulnerability'),description:get('description')});});recognized+=rows.length;}
   else if(rec.id==='utilization'){var last=rows.map(function(get){return {cpu:Number(get('cpu')),memory:Number(get('memory'))};}).filter(function(x){return isFinite(x.cpu);});if(last.length){var avg=function(k){return last.reduce(function(s,x){return s+(x[k]||0);},0)/last.length;};ev.utilization={cpu:avg('cpu'),memory:avg('memory'),samples:last.length};}}
   else if(rec.id==='neighbors'){rows.forEach(function(get){var local=get('local port','local interface','local intf'),remote=get('remote device','neighbor','system name','remote system name','neighbor device','device id');if(!local||!remote)return;ev.interfaces.push({device:get('device','device name','hostname','local device'),name:interfaceLabel(local),description:'',admin:'',oper:'',mac:'',type:'',speed:'',vlans:[],neighbor:{device:remote,port:get('remote port','neighbor port','port id','remote port id')},source:'Neighbor table'});});recognized+=rows.length;}
   if(recognized>before)addSection(ev,t.name||rec.id,recognized-before);
  });
  if(!recognized&&!auvik)return null;
  if(auvik){ev.source=ev.devices.length?'Auvik site export':'Auvik device report';ev.scope=ev.devices.length?'site':'device';}
  if(ev.scope==='device'){var parents=new Map();ev.interfaces.forEach(function(i){if(i.device)parents.set(i.device,(parents.get(i.device)||0)+1);});var top=Array.from(parents.entries()).sort(function(a,b){return b[1]-a[1];})[0];ev.device=top?top[0]:title.replace(/^.*?\s+-\s+/,'');if(parents.size>1)ev.scope='site';}
  if(title)ev.title=title;
  finish(ev);return ev;
 }

 // ---------- show-command output ----------
 var CODE_PROTOCOLS={C:'Connected',L:'Local',S:'Static',O:'OSPF',D:'EIGRP',B:'BGP',R:'RIP',i:'IS-IS',E:'EGP',M:'Mobile',U:'Per-user static',o:'ODR',P:'Periodic downloaded',H:'NHRP',l:'LISP',a:'Application',K:'Kernel'};
 function protocolFromCode(code){var c=String(code||'').replace(/[*+%&]/g,'').trim();if(!c)return '';var first=c[0];var p=CODE_PROTOCOLS[first]||c;var sub=c.slice(1).trim();return sub?p+' '+sub:p;}
 function splitSections(text){
  var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),sections=[],current={device:'',command:'',lines:[]};
  var prompt=/^\s*(?:<([^>\s]+)>|([A-Za-z0-9][\w.\-:/]*?)(?:\([\w.\-]+\))?\s*[#>$])\s*((?:sh(?:o(?:w)?)?|dis(?:p(?:lay)?)?|get|ip|show)\b.*)$/;
  lines.forEach(function(line){var m=line.match(prompt);if(m){if(current.lines.length||current.command)sections.push(current);current={device:m[1]||m[2]||'',command:m[3].trim(),lines:[]};}else current.lines.push(line);});
  sections.push(current);return sections.filter(function(s){return s.lines.some(function(l){return l.trim();});});
 }
 function columnSlicer(header,names){var lower=header.toLowerCase(),starts=names.map(function(n){return lower.indexOf(n.toLowerCase());});if(starts.some(function(s){return s<0;}))return null;return function(line){return starts.map(function(s,i){var end=i+1<starts.length?starts[i+1]:undefined;return line.slice(s,end).trim();});};}
 function parseRoutes(lines,device,out){
  var current=null,subnetMask='',count=0;
  lines.forEach(function(raw){var line=raw.replace(/\t/g,'    ');var m;
   if((m=line.match(/^\s+(\d+\.\d+\.\d+\.\d+)\/(\d+) is (?:variably )?subnetted/))){subnetMask=m[2];return;}
   // IOS / IOS-XE / FortiOS "get router info routing-table all"
   if((m=line.match(/^([A-Za-z][A-Za-z0-9 *+%&]{0,8}?)\s+(\d+\.\d+\.\d+\.\d+)(\/\d+)?\s*(.*)$/))&&/^[CLSODBRiEMUoPHlaK][A-Za-z]?[*+%&]?(?:\s+(?:IA|E1|E2|N1|N2|L1|L2|ia|su|EX)[*+%&]?)?$/.test(m[1].trim())){
    var rest=m[4],prefix=m[2]+(m[3]||(subnetMask?'/'+subnetMask:''));current={device:device,protocol:protocolFromCode(m[1]),prefix:prefix,nextHop:'',iface:'',distance:'',metric:'',source:'show ip route'};
    fillRoute(current,rest);out.push(current);count++;return;}
   if(current&&(m=line.match(/^\s+(\[\d+\/\d+\]\s+via\s+.*)$/))){var extra=Object.assign({},current,{nextHop:'',iface:''});fillRoute(extra,m[1]);out.push(extra);count++;return;}
   // NX-OS
   if((m=line.match(/^(\d+\.\d+\.\d+\.\d+\/\d+), ubest/))){current={device:device,prefix:m[1],protocol:'',nextHop:'',iface:'',distance:'',metric:'',source:'show ip route'};return;}
   if(current&&(m=line.match(/^\s+\*via\s+([^,\s]+),(?:\s*([A-Za-z][\w\/.\-]*),)?\s*\[(\d+)\/(\d+)\],\s*[^,]+,\s*([\w-]+)/))){out.push(Object.assign({},current,{nextHop:/^\d/.test(m[1])?m[1]:'',iface:m[2]||(/^\d/.test(m[1])?'':m[1]),distance:m[3],metric:m[4],protocol:m[5].replace(/^direct$/,'Connected').replace(/^local$/,'Local').replace(/^static$/,'Static')}));count++;return;}
   // AOS-CX
   if((m=line.match(/^(\S+\/\d+), vrf (\S+)/))){current={device:device,prefix:m[1],vrf:m[2],protocol:'',nextHop:'',iface:'',distance:'',metric:'',source:'show ip route'};return;}
   if(current&&(m=line.match(/^\s+via\s+([^,\s]+),\s+\[(\d+)\/(\d+)\],\s+([\w-]+)/))){out.push(Object.assign({},current,{nextHop:/^\d/.test(m[1])?m[1]:'',iface:/^\d+\.\d/.test(m[1])?'':m[1],distance:m[2],metric:m[3],protocol:m[4].replace(/^\w/,function(c){return c.toUpperCase();})}));count++;return;}
   // Linux "ip route"
   if((m=line.match(/^(default|\d+\.\d+\.\d+\.\d+(?:\/\d+)?)\s+(?:via\s+(\S+)\s+)?dev\s+(\S+)(.*)$/))){var proto=(m[4].match(/proto\s+(\S+)/)||[])[1]||'',metric=(m[4].match(/metric\s+(\d+)/)||[])[1]||'';out.push({device:device,prefix:m[1]==='default'?'0.0.0.0/0':m[1],nextHop:m[2]||'',iface:m[3],protocol:proto==='kernel'?'Connected':proto?proto[0].toUpperCase()+proto.slice(1):(m[2]?'Static':'Connected'),distance:'',metric:metric,source:'ip route'});count++;return;}
   // Aruba AOS-S
   if((m=line.match(/^\s*(\d+\.\d+\.\d+\.\d+\/\d+)\s+(\S+)\s+(\S+)?\s+(connected|static|ospf|rip|bgp)\s+\S*\s*(\d+)\s+(\d+)\s*$/i))){out.push({device:device,prefix:m[1],nextHop:/^\d/.test(m[2])?m[2]:'',iface:m[3]?'VLAN '+m[3]:'',protocol:m[4][0].toUpperCase()+m[4].slice(1).toLowerCase(),metric:m[5],distance:m[6],source:'show ip route'});count++;return;}
  });
  return count;
 }
 function fillRoute(r,rest){var m;
  if((m=rest.match(/\[(\d+)\/(\d+)\]/))){r.distance=m[1];r.metric=m[2];}
  if((m=rest.match(/via\s+(\d+\.\d+\.\d+\.\d+)/)))r.nextHop=m[1];
  if((m=rest.match(/directly connected,\s*([^,\s]+)/)))r.iface=m[1];
  else if((m=rest.match(/,\s*([A-Za-z][\w\/.\-:]*\d[\w\/.\-:]*)\s*$/)))r.iface=m[1];
  else if((m=rest.match(/via\s+[\d.]+,\s*([A-Za-z][\w\/.\-:]*)/)))r.iface=m[1];
  if(/is directly connected/.test(rest)&&!r.protocol)r.protocol='Connected';
 }
 function parseInterfaceStatus(lines,device,out){
  var slicer=null,count=0,brief=false,desc=false;
  lines.forEach(function(line){
   if(/^Port\s+Name\s+Status\s+Vlan\s+Duplex\s+Speed\s+Type/i.test(line)){slicer=columnSlicer(line,['Port','Name','Status','Vlan','Duplex','Speed','Type']);brief=desc=false;return;}
   if(/^Interface\s+IP-Address\s+OK\?\s+Method\s+Status\s+Protocol/i.test(line)){brief=true;slicer=null;desc=false;return;}
   if(/^Interface\s+Status\s+Protocol\s+Description/i.test(line)){desc=columnSlicer(line,['Interface','Status','Protocol','Description']);brief=false;slicer=null;return;}
   if(!line.trim()||/^-+(\s+-+)*\s*$/.test(line))return;
   var m;
   if(slicer){var c=slicer(line);if(!c[0]||!/\d/.test(c[0]))return;var status=c[2].toLowerCase();out.push({device:device,name:c[0],description:c[1],admin:/disabled|err-disabled/.test(status)?'Down':'Up',oper:/^connected$/.test(status)?'Up':/notconnect|disabled|down|err|inactive|sfp/.test(status)?'Down':c[2],state:c[2],vlan:c[3],duplex:c[4],speed:c[5].replace(/^a-/,''),media:c[6],source:'show interfaces status'});count++;return;}
   if(brief&&(m=line.match(/^(\S+)\s+(\S+)\s+(YES|NO)\s+(\S+)\s+(administratively down|up|down|deleted)\s+(up|down)\s*$/i))){out.push({device:device,name:m[1],ip:/^\d/.test(m[2])?m[2]:'',admin:/administratively/i.test(m[5])?'Down':'Up',oper:m[6][0].toUpperCase()+m[6].slice(1),source:'show ip interface brief'});count++;return;}
   if(desc){var d=desc(line);if(!d[0]||!/\d/.test(d[0]))return;var st=d[1].toLowerCase();out.push({device:device,name:d[0],description:d[3],admin:/admin/.test(st)?'Down':'Up',oper:/up/.test(d[2])?'Up':'Down',source:'show interfaces description'});count++;}
  });
  return count;
 }
 function parseInterfaceDetail(lines,device,out){
  var cur=null,count=0;
  lines.forEach(function(line){var m;
   if((m=line.match(/^(\S+) is (administratively down|up|down|disabled)(?:\s*\([^)]*\))?, line protocol is (\w+)/i))){cur={device:device,name:m[1],admin:/administratively|disabled/i.test(m[2])?'Down':'Up',oper:/^up/i.test(m[3])?'Up':'Down',source:'show interfaces'};out.push(cur);count++;return;}
   if(!cur)return;
   if((m=line.match(/^\s+Description:\s*(.*)$/)))cur.description=m[1].trim();
   else if((m=line.match(/^\s+Internet address is (\S+)/)))cur.ip=m[1];
   else if((m=line.match(/address is ([0-9a-f.:-]{12,17})/i))&&!cur.mac)cur.mac=normalizeMAC(m[1]);
   else if((m=line.match(/^\s+(Full|Half|Auto)[- ]duplex,\s*([^,]+)/i))){cur.duplex=m[1];cur.speed=m[2].trim();}
   if((m=line.match(/(\d+) input errors/)))cur.inputErrors=Number(m[1]);
   if((m=line.match(/(\d+) output errors/)))cur.outputErrors=Number(m[1]);
   if((m=line.match(/(\d+) CRC/)))cur.crc=Number(m[1]);
  });
  return count;
 }
 function parseNeighbors(lines,device,out,command){
  var count=0,text=lines.join('\n'),m;
  // CDP detail
  if(/Device ID:/i.test(text)&&/Port ID \(outgoing port\)/i.test(text)){
   text.split(/(?=^\s*Device ID:)/m).forEach(function(block){var id=block.match(/Device ID:\s*(\S+)/i);var intf=block.match(/Interface:\s*([^,\n]+),\s*Port ID \(outgoing port\):\s*(.+)/i);if(!id||!intf)return;var ip=block.match(/(?:IP(?:v4)? [Aa]ddress|IP address):\s*(\d+\.\d+\.\d+\.\d+)/);var plat=block.match(/Platform:\s*([^,\n]+)/i),caps=block.match(/Capabilities:\s*([^\n]+)/i);out.push({device:device,local:intf[1].trim(),remote:id[1].replace(/\(.*\)$/,''),remotePort:intf[2].trim(),remoteIP:ip?ip[1]:'',platform:plat?plat[1].trim():'',capabilities:caps?caps[1].trim():'',protocol:'CDP'});count++;});
   return count;
  }
  // LLDP detail (IOS, NX-OS, Arista, AOS-CX)
  if(/(?:Local Intf|Local Port id|Neighbor System-Name|detected \d+ LLDP neighbors?|System Name)\s*:?/i.test(text)&&/(?:Port id|Port ID|Neighbor Port-ID)\s*:/i.test(text)){
   var starts=/Local Port id:/i.test(text)?/(?=^\s*Chassis id:)/m:/(?=^\s*(?:Local Intf:|Interface\s+\S+\s+detected|Port\s*:\s*\S|-{10,}\s*$))/m;
   text.split(starts).forEach(function(block){
    var local=block.match(/(?:Local Intf|Local Port id)\s*:\s*(\S+)/i)||block.match(/^\s*Interface\s+(\S+)\s+detected/im)||block.match(/^\s*Port\s*:\s*(\S+)/im);
    var name=block.match(/(?:Neighbor System-Name|System Name)\s*:\s*"?([^"\n]+?)"?\s*$/im);
    var port=block.match(/^\s*(?:-\s*)?(?:Neighbor Port-ID|Port id|Port ID)\s*:\s*"?([^"\n]+?)"?\s*$/im);
    if(!local||!name||!port)return;
    var desc=block.match(/(?:Neighbor Port-Desc|Port Description|Port Descr)\s*:\s*"?([^"\n]*?)"?\s*$/im),ip=block.match(/(?:Management Address(?:es)?|Neighbor Management-Address|IP)\s*:\s*\n?\s*(?:IP:\s*)?(\d+\.\d+\.\d+\.\d+)/i),sys=block.match(/(?:System Description|Neighbor System-Description)\s*:\s*\n?\s*"?([^"\n]+)/i);
    var chassis=block.match(/(?:Chassis id|Chassis ID|Neighbor Chassis-ID)\s*:\s*(\S+)/i),caps=block.match(/(?:Enabled Capabilities|System Capabilities)\s*:\s*([^\n]+)/i);
    out.push({device:device,local:local[1],remote:name[1].trim(),remotePort:port[1].trim(),remotePortDescription:desc?desc[1].trim():'',remoteIP:ip?ip[1]:'',platform:sys?sys[1].trim().slice(0,120):'',chassis:chassis?normalizeMAC(chassis[1]):'',capabilities:caps?caps[1].trim():'',protocol:'LLDP'});count++;
   });
   if(count)return count;
  }
  var lldp=/lldp/i.test(command||''),cdp=/cdp/i.test(command||''),slicer=null,mode='',pending='';
  lines.forEach(function(line){
   if(/^Device ID\s+Local Intrfce\s+Holdtme/i.test(line)){slicer=columnSlicer(line,['Device ID','Local Intrfce','Holdtme','Capability','Platform','Port ID']);mode='cdp';return;}
   if(/^Device[ -]ID\s+Local Intf\s+Hold-?time\s+Capability\s+Port ID/i.test(line)){mode='lldp';slicer=null;return;}
   if(/^Port\s+Neighbor Device ID\s+Neighbor Port ID\s+TTL/i.test(line)){mode='arista';return;}
   if(/^LOCAL-PORT\s+CHASSIS-ID\s+PORT-ID/i.test(line)){slicer=columnSlicer(line,['LOCAL-PORT','CHASSIS-ID','PORT-ID','PORT-DESC','TTL','SYS-NAME']);mode='aoscx';return;}
   if(/^\s*LocalPort\s*\|\s*ChassisId/i.test(line)){var bar=line.replace('|',' ');slicer=columnSlicer(bar,['LocalPort','ChassisId','PortId','PortDescr','SysName']);mode='aoss';return;}
   if(!mode||!line.trim()||/^[-\s|+]+$/.test(line)||/^Total (?:entries|cdp)/i.test(line)||/^Capability codes/i.test(line))return;
   var m2;
   if(mode==='cdp'&&slicer){if(/^\S+\s*$/.test(line)){pending=line.trim();return;}var c=slicer(line);var id=c[0]||pending;pending='';if(!id||!c[1]||!c[5])return;out.push({device:device,local:c[1],remote:id.replace(/\(.*\)$/,''),remotePort:c[5],platform:c[4],protocol:'CDP'});count++;return;}
   if(mode==='lldp'&&(m2=line.match(/^(\S+)\s+(\S+)\s+(\d+)\s+(?:([A-Za-z,]+)\s+)?(\S+(?:\s\S+)?)\s*$/))){out.push({device:device,local:m2[2],remote:m2[1],remotePort:m2[5],protocol:'LLDP'});count++;return;}
   if(mode==='arista'&&(m2=line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+\d+\s*$/))){out.push({device:device,local:m2[1],remote:m2[2],remotePort:m2[3],protocol:'LLDP'});count++;return;}
   if((mode==='aoscx'||mode==='aoss')&&slicer){var a=slicer(mode==='aoss'?line.replace('|',' '):line);var sys=mode==='aoscx'?a[5]:a[4];if(!a[0]||!(sys||a[1]))return;out.push({device:device,local:a[0],remote:sys||a[1],remotePort:a[2],remotePortDescription:a[3],protocol:'LLDP'});count++;}
  });
  return count;
 }
 function parseMacTable(lines,device,out){
  var count=0;
  lines.forEach(function(line){var tokens=line.trim().replace(/^\*\s*/,'').split(/\s+/);if(tokens.length<3)return;var mi=tokens.findIndex(function(t){return MAC_TOKEN.test(t);});if(mi<0)return;
   var vlan=/^\d{1,4}$/.test(tokens[mi-1]||'')?tokens[mi-1]:/^\d{1,4}$/.test(tokens[mi+1]||'')?tokens[mi+1]:'';if(!vlan)return;var port=tokens[tokens.length-1];if(MAC_TOKEN.test(port)||/^(?:CPU|Router|Switch|Drop|sup-eth\d*|vPC)$/i.test(port)||!/\d/.test(port))return;
   out.push({device:device,mac:normalizeMAC(tokens[mi]),vlan:vlan,iface:port});count++;});
  return count;
 }
 function parseArp(lines,device,out){
  var count=0;
  lines.forEach(function(line){var tokens=line.trim().split(/\s+/),ip=tokens.find(function(t){return IPV4.test(t);}),mac=tokens.find(function(t){return MAC_TOKEN.test(t);});if(!ip||!mac)return;var last=tokens[tokens.length-1];out.push({device:device,ip:ip,mac:normalizeMAC(mac),iface:last!==mac&&/\d/.test(last)&&!/^ARPA$/i.test(last)&&!IPV4.test(last)?last:''});count++;});
  return count;
 }
 function configLike(text){return /^(?:hostname|sysname|set system host-name|config system global|version \d)/m.test(text)||/^interface \S+[^\n]*\n[ \t]+\S/m.test(text)||/^vlan \d+\s*\n[ \t]+name/m.test(text);}
 function fromText(text,filename){
  var source=String(text||'');if(!source.trim()||configLike(source))return null;
  var ev=emptyEvidence(filename,'Show command output'),raw={neighbors:[],status:[],detail:[]},devices=new Map();
  splitSections(source).forEach(function(s){
   var cmd=s.command.toLowerCase(),dev=s.device||'';if(dev)devices.set(dev,(devices.get(dev)||0)+1);
   var only=cmd?(/route/.test(cmd)?'route':/lldp|cdp/.test(cmd)?'neighbors':/mac/.test(cmd)?'mac':/arp/.test(cmd)?'arp':/(?:status|brief|description)/.test(cmd)?'status':/^(?:sh\w*|dis\w*)\s+int/.test(cmd)?'detail':'none'):'';
   if(only==='none')return;var label=s.command||'';
   function track(kind,n,fallback){if(n)addSection(ev,label||fallback,n);}
   if(!only||only==='route')track('route',parseRoutes(s.lines,dev,ev.routes),'Routing table');
   if(!only||only==='neighbors')track('neighbors',parseNeighbors(s.lines,dev,raw.neighbors,cmd),'Neighbors');
   if(!only||only==='status')track('status',parseInterfaceStatus(s.lines,dev,raw.status),'Interface status');
   if(!only||only==='detail')track('detail',parseInterfaceDetail(s.lines,dev,raw.detail),'Interfaces');
   if(!only||only==='mac')track('mac',parseMacTable(s.lines,dev,ev.mac),'MAC address table');
   if(!only||only==='arp')track('arp',parseArp(s.lines,dev,ev.arp),'ARP table');
  });
  if(!ev.sections.length)return null;
  var main=Array.from(devices.entries()).sort(function(a,b){return b[1]-a[1];})[0];ev.device=main?main[0]:'';if(devices.size>1)ev.scope='site';
  // Merge status, detail and neighbor rows into one interface list per device.
  var byKey=new Map();function iface(device,name){var key=deviceKey(device)+'\u0000'+interfaceKey(name);if(!byKey.has(key)){var x={device:device,name:name,description:'',admin:'',oper:'',mac:'',type:'',speed:'',vlans:[],neighbor:null,source:'Show commands'};byKey.set(key,x);ev.interfaces.push(x);}return byKey.get(key);}
  raw.detail.concat(raw.status).forEach(function(r){var x=iface(r.device,r.name);['description','admin','oper','mac','speed','duplex','ip','media','state','inputErrors','outputErrors','crc'].forEach(function(k){if(r[k]!==undefined&&r[k]!==''&&(x[k]===undefined||x[k]===''))x[k]=r[k];});if(r.vlan&&!x.vlans.length&&/^\d+$/.test(r.vlan))x.vlans=[{id:r.vlan,name:''}];if(r.vlan==='trunk')x.mode='Trunk';});
  raw.neighbors.forEach(function(n){var x=iface(n.device,n.local);x.neighbor={device:n.remote,port:n.remotePort,ip:n.remoteIP||'',platform:n.platform||'',protocol:n.protocol,portDescription:n.remotePortDescription||'',chassis:n.chassis||'',capabilities:n.capabilities||''};});
  finish(ev);return ev;
 }

 // ---------- normalize ----------
 function finish(ev){
  // Links between devices. Interface rows are authoritative; device-sheet links (which
  // name only the far port) fill in device pairs that no interface row covers. A link
  // is dropped when another link between the same devices covers both of its ports.
  var raw=[];
  ev.interfaces.forEach(function(i){(i.neighbors&&i.neighbors.length?i.neighbors:i.neighbor?[i.neighbor]:[]).forEach(function(n){if(n&&n.device)raw.push({a:{device:i.device||ev.device,port:i.name},b:{device:n.device,port:n.port||''},source:n.protocol||i.source,ip:n.ip||'',platform:n.platform||'',portDescription:n.portDescription||'',chassis:n.chassis||'',capabilities:n.capabilities||''});});});
  ev.interfaces=ev.interfaces.filter(function(i){return i.name;});
  var pairs=new Set(raw.map(function(l){return [deviceKey(l.a.device),deviceKey(l.b.device)].sort().join('~');}));
  ev.devices.forEach(function(d){(d.connected||[]).forEach(function(c){var pair=[deviceKey(d.name),deviceKey(c.device)].sort().join('~');if(!pairs.has(pair))raw.push({a:{device:d.name,port:''},b:{device:c.device,port:c.port},source:'Auvik'});});});
  function end(e){return {d:deviceKey(e.device),p:interfaceKey(e.port)};}
  function covers(big,small){var A=[end(big.a),end(big.b)],B=[end(small.a),end(small.b)];function fit(x,y){return x.d===y.d&&(!y.p||x.p===y.p);}return (fit(A[0],B[0])&&fit(A[1],B[1]))||(fit(A[0],B[1])&&fit(A[1],B[0]));}
  function weight(l){return (l.a.port?1:0)+(l.b.port?1:0);}
  raw=raw.filter(function(l){return l.a.device&&l.b.device&&deviceKey(l.a.device)!==deviceKey(l.b.device);}).sort(function(x,y){return weight(y)-weight(x);});
  ev.links=[];raw.forEach(function(l){if(!ev.links.some(function(k){return covers(k,l);}))ev.links.push(l);});
  if(!ev.device&&ev.scope==='device'&&ev.interfaces.length)ev.device=ev.interfaces[0].device;
  ev.interfaces.forEach(function(i){if(!i.device)i.device=ev.device;});
  ['routes','arp','mac'].forEach(function(k){ev[k].forEach(function(r){if(!r.device)r.device=ev.device;});});
  return ev;
 }
 function looksLikeText(bytes){var n=Math.min(bytes.length,4096);for(var i=0;i<n;i++){var b=bytes[i];if(b===0)return false;}return true;}
 async function load(bytes,filename){
  var name=String(filename||'').toLowerCase();
  if(isZip(bytes)&&/\.xlsx$/.test(name)){var tables=await readXlsx(bytes);var ev=fromTables(tables,filename);if(!ev)throw new Error('No supported tables were found in this workbook. Supported: Auvik site and device reports, and tables with local port and neighbor columns.');return ev;}
  if(/\.xlsx?$/.test(name))throw new Error('Older .xls workbooks are not supported. Save the sheet as .xlsx or CSV.');
  if(!looksLikeText(bytes))return null;
  var text=new TextDecoder('utf-8').decode(bytes);
  if(/\.csv$/.test(name)){var ev2=fromTables([{name:filename,rows:parseCSV(text)}],filename);if(!ev2)throw new Error('This CSV file has no recognized columns. Supported: Auvik table exports and neighbor tables with local port, neighbor and neighbor port columns.');return ev2;}
  return fromText(text,filename);
 }
 // Device records for joining with configurations: name, type, model and addresses.
 function deviceList(ev){
  var map=new Map();function touch(name){var k=deviceKey(name);if(!k)return null;if(!map.has(k))map.set(k,{name:name,key:k,type:'',model:'',ips:[],generic:genericDevice(name)});return map.get(k);}
  ev.devices.forEach(function(d){var x=touch(d.name);if(!x)return;Object.assign(x,{type:d.type||x.type,model:d.model||x.model,ips:d.ips||[],macs:d.macs||[],serial:d.serial,software:d.software,firmware:d.firmware,status:d.status,networks:d.networks,description:d.description});});
  if(ev.device)touch(ev.device);
  ev.links.forEach(function(l){touch(l.a.device);touch(l.b.device);});
  ev.interfaces.forEach(function(i){if(i.neighbor&&i.neighbor.device){var x=touch(i.neighbor.device);if(x&&i.neighbor.ip&&!x.ips.includes(i.neighbor.ip))x.ips.push(i.neighbor.ip);if(x&&i.neighbor.platform&&!x.model)x.model=i.neighbor.platform;if(x&&i.neighbor.chassis){x.macs=x.macs||[];if(!x.macs.includes(i.neighbor.chassis))x.macs.push(i.neighbor.chassis);}}});
  return Array.from(map.values());
 }
 root.SWEvidence={load:load,readXlsx:readXlsx,parseCSV:parseCSV,fromTables:fromTables,fromText:fromText,interfaceKey:interfaceKey,interfaceLabel:interfaceLabel,deviceKey:deviceKey,genericDevice:genericDevice,normalizeMAC:normalizeMAC,deviceList:deviceList,isZip:isZip,configLike:configLike};
 if(typeof module==='object'&&module.exports)module.exports=root.SWEvidence;
})(typeof globalThis!=='undefined'?globalThis:this);
