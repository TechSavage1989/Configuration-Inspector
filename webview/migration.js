(function(root){'use strict';
 // Migration validation: every object from the original (left) configuration is
 // matched to an object on the migrated (right) configuration and their normalized
 // facts are compared. Facts are computed once per record and looked up through
 // indexes, so large switch and firewall exports stay fast.
 function stable(x){if(Array.isArray(x))return x.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(x&&typeof x==='object'){var o={};Object.keys(x).sort().forEach(k=>o[k]=stable(x[k]));return o;}return String(x==null?'':x).trim();}
 var categories=['interfaces','vlans','routes','network','addresses','services','policies','nat','vpn','zones','links','identities','authentication','deviceusers','security','switching','certificates'];
 var fields={interfaces:['ip','mask','vlan','nativeVLAN','untaggedVLANs','taggedVLANs','mode','aggregate','status'],vlans:['vlan','ip','mask','status'],routes:['destination','gateway','interface','metric','administrativeDistance','status'],network:['dns','dns6','servers','start','end','ranges','gateway','mask','domain','relayServers','status'],addresses:['ip','mask','network','start','end','fqdn','ipVersion'],services:['protocol','port','ports','destinationPort','sourcePort','ipVersion'],policies:['source','destination','service','inbound','outbound','action','status'],nat:['source','destination','service','translatedSource','translatedDestination','translatedService','inbound','outbound','status'],vpn:['peer','remoteGateway','local','remote','interface','status'],zones:['status'],links:['status']};
 var critical=['policies','nat','vpn','security','switching','certificates','identities','authentication','deviceusers'];
 function push(map,key,value){var list=map.get(key);if(!list)map.set(key,list=[]);list.push(value);}
 function indexer(model){
  var byId=new Map(),byName=new Map(),cache=new Map(),shallow=new Map(),signatures=new Map();
  (model.records||[]).forEach(function(r){byId.set(r.id,r);push(byName,r.name,r);});
  // Own facts: summary fields and addresses only. Referenced objects are described by
  // their own facts (one level), which keeps the comparison meaningful without
  // expanding reference chains such as VLAN -> ports -> VLANs exponentially.
  function own(r){
   if(shallow.has(r.id))return shallow.get(r.id);var out={},s=r.summary||{};
   (fields[r.category]||[]).forEach(function(k){var v=s[k];if(v==null||v===''||/^(Not specified|Unknown)$/i.test(v))return;if(k==='mask'&&root.SWCore){var n=root.SWCore.prefix(String(v));if(typeof n==='number'&&n>=0)v='/'+n;}out[k]=stable(v);});
   if(r.addresses&&r.addresses.length)out.addresses=stable(r.addresses.map(a=>({ip:a.ip,mask:root.SWCore&&root.SWCore.prefix(a.mask)>=0?'/'+root.SWCore.prefix(a.mask):a.mask||''})));
   shallow.set(r.id,out);return out;
  }
  function facts(r){
   if(cache.has(r.id))return cache.get(r.id);var out=Object.assign({},own(r));
   if(r.members&&r.members.length)out.members=stable(r.members.map(name=>{var found=(byName.get(name)||[]).filter(x=>x.category===r.category&&x.scope===r.scope);return found.length===1?(found[0].id===r.id?{unresolved:'Cyclic reference'}:own(found[0])):name;}));
   Object.keys(r.references||{}).forEach(k=>{var names=r.references[k];if(!Array.isArray(names)||!names.length)return;out['references.'+k]=stable(names.map(name=>{var exact=byId.has(name)?[byId.get(name)]:[];var found=exact.length?exact:(byName.get(name)||[]).filter(x=>x.scope===r.scope||x.scope==='global');return found.length===1?{category:found[0].category,values:own(found[0])}:{unresolved:name};}));});
   cache.set(r.id,out);return out;
  }
  function signature(r){if(!signatures.has(r.id))signatures.set(r.id,JSON.stringify(stable(facts(r))));return signatures.get(r.id);}
  return {facts:facts,signature:signature};
 }
 function analyze(source,target,mappings){
  mappings=mappings||{};
  var S=indexer(source),T=indexer(target),used=new Set(),items=[];
  var targets=(target.records||[]).filter(t=>categories.includes(t.category)&&!t.derived),byCategory=new Map(),bySignature=new Map(),byName=new Map();
  targets.forEach(function(t){push(byCategory,t.category,t);push(bySignature,t.category+'\u0000'+t.scope+'\u0000'+T.signature(t),t);push(byName,t.category+'\u0000'+t.scope+'\u0000'+t.name,t);});
  function free(list){return (list||[]).filter(t=>!used.has(t.id));}
  (source.records||[]).filter(r=>categories.includes(r.category)&&!r.derived).forEach(function(r){
   var a=S.facts(r),mapped=mappings[r.id],candidates=byCategory.get(r.category)||[],matches,basis;
   if(mapped){matches=free(candidates).filter(t=>t.id===mapped);basis='Explicit mapping';}
   else{matches=Object.keys(a).length?free(bySignature.get(r.category+'\u0000'+r.scope+'\u0000'+S.signature(r))):[];basis='Matching normalized facts';
    if(matches.length!==1){matches=free(byName.get(r.category+'\u0000'+r.scope+'\u0000'+r.name));basis='Matching name and context';}}
   var b=matches.length===1?matches[0]:null,other=b?T.facts(b):{},keys=Array.from(new Set(Object.keys(a).concat(Object.keys(other)))),rows=keys.map(k=>({key:k,before:a[k],after:other[k],equal:JSON.stringify(stable(a[k]))===JSON.stringify(stable(other[k]))}));if(b)used.add(b.id);
   var unsupported=!fields[r.category]||!Object.keys(a).some(k=>!['status','mode'].includes(k))||JSON.stringify([a,other]).includes('unresolved'),isCritical=critical.includes(r.category);
   var status=!b?(matches.length>1||mapped?'Needs review':'Missing'):rows.some(x=>!x.equal)?'Difference':unsupported||isCritical?'Needs review':'Verified match';
   var reason=status==='Difference'?'Some compared settings are different on the new configuration. The changed rows are highlighted.':!b?(matches.length>1?'Several objects on the new configuration match. Choose the right one below.':'No matching object was found on the new configuration. Choose it below if it was renamed, or confirm it is no longer needed.'):isCritical?'Rules and security settings depend on order, defaults and vendor behavior, so they always need a manual check.':unsupported?'Too few comparable settings were recognized to confirm this match automatically.':'The compared settings are identical. Settings this app does not compare are not checked.';
   items.push({source:r,target:b,status,basis,rows,candidates,reason:reason});
  });
  targets.filter(r=>!used.has(r.id)).forEach(r=>items.push({source:null,target:r,status:'Additional',basis:'Only on the new configuration',rows:[],reason:'This object exists only on the new configuration. Confirm it was added on purpose.'}));
  return {items};
 }
 root.SWMigration={analyze};if(typeof module==='object'&&module.exports)module.exports=root.SWMigration;
})(typeof globalThis!=='undefined'?globalThis:this);
