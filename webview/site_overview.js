(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWSiteOverview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Site overview across every open configuration. Only facts present in the exports
 // are compared: shared subnets, duplicate addresses, VLAN definitions and names,
 // descriptions that name another open device, and common management settings.
 // Running configurations do not contain live neighbor (CDP/LLDP) tables, so no
 // physical link is asserted.
 function text(v){return v===undefined||v===null?'':String(v).trim();}
 function list(v){return text(v).split(/\s*[,;]\s*|\s+(?=\d+\.\d+\.\d+\.\d+)/).map(text).filter(Boolean);}
 function uniq(a){return Array.from(new Set(a));}
 function natural(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}
 function facts(r){try{return JSON.parse(r.summary.featureData||'[]');}catch(e){return [];}}
 function factValues(model,label){var out=[];(model.records||[]).forEach(function(r){if(!r.summary||!r.summary.featureRoot)return;facts(r).forEach(function(f){if(label.test(text(f.label)))out=out.concat(list(f.value));});});return out;}
 function summaryValues(model,family,key){var out=[];(model.records||[]).forEach(function(r){if(r.summary&&!r.summary.featureRoot&&r.family===family)out=out.concat(list(r.summary[key]));});return out;}
 function ipv4(v){var m=text(v).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return null;var p=m.slice(1).map(Number);return p.every(function(x){return x<=255;})?p:null;}
 function usable(ip){var p=ipv4(ip);if(p)return !(p[0]===0||p[0]===127||p[0]>=224||ip==='255.255.255.255');return /:/.test(ip)&&!/^(?:::1?|fe80:)/i.test(ip);}
 var SETTINGS=[
  {key:'ntp',label:'NTP servers',get:function(m){return summaryValues(m,'time','ntpServers').concat(factValues(m,/^NTP servers?$/i));}},
  {key:'timezone',label:'Time zone',single:true,get:function(m){return summaryValues(m,'time','timezone').concat(factValues(m,/^Time zone$/i));}},
  {key:'dns',label:'DNS servers',get:function(m){return summaryValues(m,'dns','servers').concat(factValues(m,/^(?:DNS servers?|Primary DNS|Secondary DNS)$/i));}},
  {key:'domain',label:'DNS domain',single:true,get:function(m){return summaryValues(m,'dns','domain').concat(factValues(m,/^(?:DNS domain|Domain name|Domain)$/i));}},
  {key:'syslog',label:'Syslog servers',get:function(m){return summaryValues(m,'logging','destinations').concat(factValues(m,/^(?:Syslog servers?|Remote log servers?|Log servers?)$/i));}},
  {key:'snmpTargets',label:'SNMP trap destinations',get:function(m){return summaryValues(m,'snmp','destinations').concat(factValues(m,/^Trap destinations?$/i));}},
  {key:'snmpLocation',label:'SNMP location',single:true,get:function(m){return (m.records||[]).filter(function(r){return r.family==='snmp'&&!r.summary.featureRoot;}).map(function(r){return text(r.summary.location);}).filter(Boolean);}},
  {key:'users',label:'Local user accounts',get:function(m){return (m.records||[]).filter(function(r){return r.category==='identities'&&!r.summary.featureRoot&&/^user$/i.test(r.family)&&r.summary.kind!=='Group';}).map(function(r){return text(r.name);}).filter(Boolean);}},
  {key:'stp',label:'Spanning-tree mode',single:true,get:function(m){return summaryValues(m,'spanning-tree','mode');}}
 ];
 function normalize(values,single){values=uniq(values.map(text).filter(Boolean));if(single)return values.length?values[0]:'';return values.sort(natural).join(', ');}
 function interfacesOf(model){return (model.categories&&model.categories.interfaces||[]).filter(function(r){return !r.summary.featureRoot&&!r.derived;});}
 function addressesOf(r){var out=(r.addresses||[]).filter(function(a){return a&&a.ip;}).map(function(a){return {ip:text(a.ip).split('/')[0],network:text(a.network)};});if(!out.length&&text(r.summary.ip))out.push({ip:text(r.summary.ip).split('/')[0],network:text(r.summary.network)});return out.filter(function(a){return usable(a.ip);});}
 function build(models){
  models=(models||[]).filter(Boolean);
  var devices=models.map(function(m,i){return {index:i,name:text(m.meta.name)||'Device '+(i+1),vendor:text(m.meta.vendor),model:text(m.meta.model),filename:text(m.meta.filename)};});
  // Settings consistency.
  var settings=SETTINGS.map(function(def){
   var per=models.map(function(m,i){var v='';try{v=normalize(def.get(m),def.single);}catch(e){v='';}return {device:i,value:v};});
   var present=per.filter(function(p){return p.value;}),groups=new Map();
   present.forEach(function(p){if(!groups.has(p.value))groups.set(p.value,[]);groups.get(p.value).push(p.device);});
   var ordered=Array.from(groups,function(g){return {value:g[0],devices:g[1]};}).sort(function(a,b){return b.devices.length-a.devices.length||natural(a.value,b.value);});
   var status=!present.length?'absent':ordered.length>1?'differs':present.length<models.length?'partial':'same';
   return {key:def.key,label:def.label,status:status,values:per,groups:ordered,missing:per.filter(function(p){return !p.value;}).map(function(p){return p.device;})};
  }).filter(function(s){return s.status!=='absent';});
  // VLANs.
  var vlanMap=new Map();
  models.forEach(function(m,i){(m.categories&&m.categories.vlans||[]).filter(function(r){return !r.summary.featureRoot&&r.family==='vlan';}).forEach(function(r){var id=text(r.summary.vlan||r.name);if(!/^\d+$/.test(id))return;if(!vlanMap.has(id))vlanMap.set(id,[]);var ports=text(r.summary.ports).split(/,\s*/).filter(Boolean).length;vlanMap.get(id).push({device:i,name:text(r.summary.vlanName),ports:ports,address:text(r.summary.ip),declared:r.declared!==undefined?!!r.declared:!r.derived});});});
  var vlans=Array.from(vlanMap,function(e){var names=uniq(e[1].map(function(x){return x.name;}).filter(Boolean));return {id:e[0],entries:e[1],names:names,status:names.length>1?'name-differs':e[1].length===1&&models.length>1?'single':'same'};}).sort(function(a,b){return Number(a.id)-Number(b.id);});
  // Addresses: duplicates and shared subnets.
  var byIP=new Map(),byNet=new Map();
  models.forEach(function(m,i){interfacesOf(m).forEach(function(r){addressesOf(r).forEach(function(a){var key=(r.summary.vrf?text(r.summary.vrf)+' / ':'')+a.ip;if(!byIP.has(key))byIP.set(key,[]);byIP.get(key).push({device:i,interface:text(r.name),ip:a.ip,vrf:text(r.summary.vrf)});if(a.network&&!/\/(?:32|128)$/.test(a.network)){var nk=(r.summary.vrf?text(r.summary.vrf)+' / ':'')+a.network;if(!byNet.has(nk))byNet.set(nk,[]);byNet.get(nk).push({device:i,interface:text(r.name),ip:a.ip});}});});});
  var duplicates=Array.from(byIP,function(e){return {address:e[0],entries:e[1]};}).filter(function(d){return uniq(d.entries.map(function(x){return x.device;})).length>1;}).sort(function(a,b){return natural(a.address,b.address);});
  var subnets=Array.from(byNet,function(e){return {network:e[0],entries:e[1]};}).filter(function(s){return uniq(s.entries.map(function(x){return x.device;})).length>1;}).sort(function(a,b){return natural(a.network,b.network);});
  // Descriptions naming another open device.
  var mentions=[];
  models.forEach(function(m,i){interfacesOf(m).forEach(function(r){var d=text(r.summary.comment);if(!d)return;devices.forEach(function(other){if(other.index===i||other.name.length<3)return;var escaped=other.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('(?:^|[^A-Za-z0-9_-])'+escaped+'(?:$|[^A-Za-z0-9_-])','i').test(d))mentions.push({device:i,interface:text(r.name),mentions:other.index,description:d});});});});
  return {devices:devices,settings:settings,vlans:vlans,duplicates:duplicates,subnets:subnets,mentions:mentions};
 }
 // Checks across devices that need to know which ports are cabled together (links: [{a, b, aPort, bPort}], a and b
 // being indexes into models). Each finding names both ends, so it can be fixed on the right device.
 function vlanList(v){return uniq(text(v).split(/[,\s]+/).filter(function(x){return /^\d+$/.test(x);}));}
 function portKey(n){return text(n).toLowerCase().replace(/\s+/g,'').replace(/^(?:gigabitethernet|gi)(?=\d)/,'gi').replace(/^(?:tengigabitethernet|te)(?=\d)/,'te').replace(/^(?:fastethernet|fa)(?=\d)/,'fa').replace(/^(?:port-channel|po)(?=\d)/,'po').replace(/^(?:ethernet|eth)(?=\d)/,'eth');}
 function linkChecks(models,links,options){options=options||{};var key=options.key||portKey,findings=[],seen={};
  var maps=models.map(function(m){var by=new Map();interfacesOf(m).forEach(function(r){by.set(key(r.name),r);});return by;});
  function port(i,name){var r=maps[i]&&maps[i].get(key(name));if(!r)return null;var s=r.summary||{},agg=text(s.aggregate),lag=agg?maps[i].get(key(agg)):null,ls=lag&&lag.summary||{};
   var tagged=vlanList(s.taggedVLANs),native=vlanList(s.nativeVLAN)[0]||vlanList(s.untaggedVLANs)[0]||'';if(!tagged.length&&lag)tagged=vlanList(ls.taggedVLANs);if(!native&&lag)native=vlanList(ls.nativeVLAN)[0]||vlanList(ls.untaggedVLANs)[0]||'';
   var mode=text(s.portMode||ls.portMode),trunk=/trunk|tagged/i.test(mode)||tagged.length>0;tagged=tagged.filter(function(v){return v!==native;});
   return {name:text(r.name),native:native,tagged:tagged,trunk:trunk,all:/trunk/i.test(mode)&&!tagged.length,lag:agg,members:lag?text(ls.members).split(/[,\s]+/).filter(Boolean).length:0};}
  function name(i){return text(models[i].meta&&models[i].meta.name)||('Device '+(i+1));}
  function add(f){var k=f.kind+'|'+f.id;if(seen[k])return;seen[k]=1;findings.push(f);}
  (links||[]).forEach(function(l){if(l.a==null||l.b==null||l.a===l.b||!models[l.a]||!models[l.b])return;var A=port(l.a,l.aPort),B=port(l.b,l.bPort);if(!A||!B)return;
   var ends=[{device:l.a,name:name(l.a),port:A.name},{device:l.b,name:name(l.b),port:B.name}],id=[l.a+':'+key(A.name),l.b+':'+key(B.name)].sort().join('~'),where=name(l.a)+' '+A.name+' and '+name(l.b)+' '+B.name;
   // Native (untagged) VLAN: frames sent untagged by one end land in another VLAN on the other.
   if((A.trunk||B.trunk)&&A.native&&B.native&&A.native!==B.native)add({kind:'native',severity:'warning',id:id,ends:ends,title:'Native VLAN differs',detail:where+' use untagged VLAN '+A.native+' and '+B.native+'. Untagged traffic changes VLAN across this link.'});
   // Tagged VLANs carried by one end only (an end that allows every VLAN is not compared).
   if(A.trunk&&B.trunk&&!A.all&&!B.all){var ca=A.tagged.concat(A.native?[A.native]:[]),cb=B.tagged.concat(B.native?[B.native]:[]),onlyA=A.tagged.filter(function(v){return cb.indexOf(v)<0;}),onlyB=B.tagged.filter(function(v){return ca.indexOf(v)<0;});
    if(onlyA.length||onlyB.length)add({kind:'trunk',severity:'warning',id:id,ends:ends,onlyA:onlyA,onlyB:onlyB,title:'Trunk VLANs differ',detail:[onlyA.length?'VLAN '+onlyA.join(', ')+' only on '+name(l.a)+' '+A.name:'',onlyB.length?'VLAN '+onlyB.join(', ')+' only on '+name(l.b)+' '+B.name:''].filter(Boolean).join('; ')+'. Those VLANs do not pass this link.'});}
   if(A.trunk!==B.trunk&&!(A.all||B.all)&&(A.tagged.length||B.tagged.length))add({kind:'mode',severity:'warning',id:id,ends:ends,title:'Trunk on one end only',detail:where+': one end carries tagged VLANs and the other is an untagged (access) port.'});
   // Link aggregation: both ends in a LAG, with the same number of member ports.
   if(A.lag||B.lag){var lid=[l.a+':'+key(A.lag||A.name),l.b+':'+key(B.lag||B.name)].sort().join('~');
    if(!A.lag||!B.lag)add({kind:'lag',severity:'warning',id:lid,ends:ends,title:'Link aggregation on one end only',detail:(A.lag?name(l.a)+' '+A.name+' is in '+A.lag:name(l.b)+' '+B.name+' is in '+B.lag)+', but the port at the other end is not in an aggregation.'});
    else if(A.members&&B.members&&A.members!==B.members)add({kind:'lag',severity:'warning',id:lid,ends:ends,title:'Link aggregation sizes differ',detail:name(l.a)+' '+A.lag+' has '+A.members+' member port'+(A.members===1?'':'s')+' and '+name(l.b)+' '+B.lag+' has '+B.members+'.'});}});
  // Spanning tree: which switch wins the root election by configured priority (lowest wins; an unset priority is the
  // default 32768, and a tie is decided by MAC address, which a configuration does not show).
  var switches=[];models.forEach(function(m,i){if(options.isSwitch&&!options.isSwitch(m,i))return;var pr=null;(m.entries||[]).forEach(function(e){var v=text(e.value);if(!/spanning-tree/i.test(v))return;var x=/\bpriority\s+(\d+)/i.exec(v);if(!x||/\bport-priority\b|interface/i.test(v))return;var n=Number(x[1]);if(n<=15)n*=4096;if(pr==null||n<pr)pr=n;});
   var degree=(links||[]).filter(function(l){return l.a===i||l.b===i;}).length;switches.push({device:i,name:name(i),priority:pr,effective:pr==null?32768:pr,links:degree});});
  if(switches.length>1){var low=Math.min.apply(null,switches.map(function(x){return x.effective;})),roots=switches.filter(function(x){return x.effective===low;}),busiest=switches.slice().sort(function(p,q){return q.links-p.links;})[0];
   if(switches.every(function(x){return x.priority==null;}))add({kind:'stp',severity:'info',id:'none',ends:[],title:'No spanning-tree priority is set',detail:'None of the '+switches.length+' switches sets a bridge priority, so the root bridge is whichever has the lowest MAC address. Set a low priority on the core switch.'});
   else if(roots.length>1)add({kind:'stp',severity:'warning',id:'tie',ends:roots.map(function(x){return {device:x.device,name:x.name,port:''};}),title:'Spanning-tree root priority is shared',detail:roots.map(function(x){return x.name;}).join(', ')+' share the lowest priority ('+low+'); the lowest MAC address among them becomes root.'});
   else if(busiest.links>roots[0].links&&busiest.device!==roots[0].device)add({kind:'stp',severity:'info',id:'place',ends:[{device:roots[0].device,name:roots[0].name,port:''}],title:'Spanning-tree root may be in an unexpected place',detail:roots[0].name+' has the lowest priority ('+low+') and becomes root, but '+busiest.name+' has more links to other open devices ('+busiest.links+' against '+roots[0].links+').'});}
  var order={native:0,trunk:1,mode:2,lag:3,stp:4};findings.sort(function(p,q){return order[p.kind]-order[q.kind]||natural(p.id,q.id);});
  return {findings:findings,switches:switches,checked:(links||[]).filter(function(l){return l.a!=null&&l.b!=null&&l.a!==l.b&&port(l.a,l.aPort)&&port(l.b,l.bPort);}).length};}
 return {build:build,linkChecks:linkChecks,SETTINGS:SETTINGS.map(function(s){return {key:s.key,label:s.label};})};
});
