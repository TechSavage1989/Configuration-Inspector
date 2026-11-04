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
 return {build:build,SETTINGS:SETTINGS.map(function(s){return {key:s.key,label:s.label};})};
});
