(function installDeviceSpecifications(root){
  'use strict';
  // Hardware enrichment is separate from the imported configuration. Only
  // public catalog indexes and immutable model blobs are downloaded.
  var API='https://api.github.com/repos/netbox-community/devicetype-library/',REPO='https://github.com/netbox-community/devicetype-library',WEEK=7*86400000,MAX_YAML=524288;
  var CACHE='config-inspector-device-specs-v1',PREFERENCE='config-inspector-auto-specs',SHA=/^[0-9a-f]{40}$/;
  var HPE_SKUS={JL805A:'Aruba-1960-12XGT-4SFPP',JL806A:'Aruba-1960-24G-2XGT-2SFPP',JL807A:'Aruba-1960-24G-PoE-2XGT-2SFPP-370W',JL808A:'Aruba-1960-48G-2XGT-2SFPP',JL809A:'Aruba-1960-48G-PoE-2XGT-2SFPP-600W'};
  function text(v){return v===null||v===undefined?'':String(v).trim();}
  function useful(v){return !!text(v)&&! /^(?:unknown|not specified|not configured|undefined|null|n\/a|multiple.*)$/i.test(text(v));}
  function norm(v){return text(v).toLowerCase().replace(/qsfp\+/g,'qsfpp').replace(/sfp\+/g,'sfpp').replace(/[^a-z0-9]/g,'');}
  function manufacturer(v){var n=norm(v);if(/forti/.test(n))return 'fortinet';if(/sonicwall/.test(n))return 'sonicwall';if(/aruba|^hpe|hewlettpackard|^procurve/.test(n))return 'hpe';if(/meraki/.test(n))return 'cisco';if(/paloalto|panos/.test(n))return 'paloaltonetworks';if(/juniper|junos/.test(n))return 'juniper';if(/cisco|^ios|nxos/.test(n))return 'cisco';if(/sophos/.test(n))return 'sophos';return n;}
  function modelKey(v,vendor){if(root.SWHardware&&vendor==='fortinet')v=root.SWHardware.canonical(v);var n=norm(v).replace(/^(?:sonicwall|fortinet|junipernetworks|juniper|paloaltonetworks|cisco|hewlettpackardenterprise|hewlettpackard|hpe)/,'');if(vendor==='fortinet')n=n.replace(/^(?:fortigate|fgt|fg)/,'fg');if(vendor==='hpe')n=n.replace(/^arubainstanton/,'aruba');if(vendor==='cisco')n=n.replace(/^catalyst/,'c');return n;}
  function allowedURL(url){return typeof url==='string'&&(url===API+'contents/device-types'||new RegExp('^'+API.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'git/(?:trees|blobs)/[0-9a-f]{40}$').test(url));}
  function publicSource(path){return /^device-types\/[^/]+\/[^/]+\.ya?ml$/.test(path)?REPO+'/blob/master/'+path.split('/').map(encodeURIComponent).join('/'):'';}
  function scalar(raw,strict){
    var s=text(raw);if(!s||/^(?:null|~)$/i.test(s))return '';
    if(s[0]==="'"){var m=s.match(/^'((?:[^']|'')*)'\s*(?:#.*)?$/);if(m)return m[1].replace(/''/g,"'");}
    else if(s[0]==='"'){var q=s.match(/^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);if(q){try{return JSON.parse(q[1]);}catch(e){}}}
    else if(!/^[!&*\[\]{}>|]/.test(s))return s.replace(/\s+#.*$/,'').trim();
    if(strict)throw new Error('Unsupported catalog scalar');return '';
  }
  function parseDefinition(source){
    if(typeof source!=='string'||source.length>MAX_YAML||source.includes('\u0000'))throw new Error('Invalid catalog size');
    var data=Object.create(null),section='',item=null,seenDocument=false,seenRoot=new Set(),items={interfaces:[],power:[],modules:[]};
    var roots=new Set(['manufacturer','model','part_number','u_height','weight','weight_unit','airflow','is_full_depth']),itemFields=new Set(['name','type','description','mgmt_only','poe_mode','poe_type','maximum_draw']);
    source.replace(/^\uFEFF/,'').split(/\r?\n/).forEach(function(line){
      if(!line.trim()||/^\s*#/.test(line))return;if(line==='---'){if(seenDocument)throw new Error('Multiple catalog documents');seenDocument=true;return;}
      if(line==='...')return;
      var top=line.match(/^([a-z_][a-z_0-9-]*):\s*(.*)$/i);
      if(top){seenDocument=true;var key=top[1];section=key==='interfaces'?'interfaces':key==='power-ports'?'power':key==='module-bays'?'modules':'';item=null;
        if(roots.has(key)){if(seenRoot.has(key))throw new Error('Duplicate catalog identity');seenRoot.add(key);data[key]=scalar(top[2],true);if(data[key].length>256)throw new Error('Catalog scalar too long');}
        if(section&&text(top[2])&&!/^\[\s*\]$/.test(text(top[2])))throw new Error('Unsupported catalog component list');return;
      }
      if(!section)return;
      var row=line.match(/^\s+-\s+([a-z_][a-z_0-9-]*):\s*(.*)$/i),prop=line.match(/^\s+([a-z_][a-z_0-9-]*):\s*(.*)$/i);
      if(row){item=Object.create(null);items[section].push(item);if(items[section].length>4096)throw new Error('Too many catalog components');prop=row;}
      if(!prop||!item||!itemFields.has(prop[1]))return;
      var k=prop[1];if(Object.prototype.hasOwnProperty.call(item,k))throw new Error('Duplicate catalog component field');item[k]=scalar(prop[2],k==='name'||k==='type');if(item[k].length>2048)throw new Error('Catalog field too long');
    });
    if(!useful(data.manufacturer)||!useful(data.model))throw new Error('Catalog identity missing');
    var names=new Set();items.interfaces.forEach(function(p){if(!useful(p.name)||!useful(p.type)||p.name.length>160||p.type.length>100||!portCount(p)||names.has(norm(p.name)))throw new Error('Invalid or ambiguous catalog port');names.add(norm(p.name));});
    return {manufacturer:data.manufacturer,model:data.model,partNumber:data.part_number||'',rackUnits:/^\d+(?:\.\d+)?$/.test(data.u_height||'')?data.u_height:'',weight:/^\d+(?:\.\d+)?$/.test(data.weight||'')?data.weight:'',weightUnit:/^(?:kg|g|lb|oz)$/.test(data.weight_unit||'')?data.weight_unit:'',airflow:data.airflow||'',fullDepth:/^(true|false)$/.test(data.is_full_depth||'')?data.is_full_depth:'',interfaces:items.interfaces,power:items.power,modules:items.modules};
  }
  function portType(value,description){
    var v=text(value).toLowerCase(),form='',rate='',kind='physical',medium='';
    if(/^(?:virtual|bridge|lag|wireless|ieee802\.11|gsm|cdma|lte|5g|serial|t1|e1|t3|e3|docsis|gpon|xgpon|xgspon|epon)/.test(v)){
      kind=/^(?:lag)/.test(v)?'aggregate':/^bridge/.test(v)?'bridge':/^virtual/.test(v)?'virtual':/wireless|ieee802\.11/.test(v)?'wireless':/gsm|cdma|lte|^5g/.test(v)?'cellular':/pon/.test(v)?'optical':/docsis/.test(v)?'coax':'serial';
    }
    var m=v.match(/^(\d+(?:\.\d+)?)([mgt])?base/);if(m){var n=Number(m[1])*(m[2]==='t'?1000000:m[2]==='g'?1000:1);rate=n>=1000?n/1000+'G':n+'M';}
    var cages=[['qsfp-dd','QSFP-DD'],['qsfpdd','QSFP-DD'],['qsfp112','QSFP112'],['qsfp56','QSFP56'],['qsfp28','QSFP28'],['qsfpp','QSFP+'],['qsfp+','QSFP+'],['osfp','OSFP'],['sfp112','SFP112'],['sfp56','SFP56'],['sfp28','SFP28'],['sfpp','SFP+'],['sfp+','SFP+'],['sfp','SFP'],['cfp8','CFP8'],['cfp4','CFP4'],['cfp2','CFP2'],['cfp','CFP'],['xfp','XFP'],['xenpak','XENPAK'],['gbic','GBIC'],['x2','X2']];
    for(var c of cages)if(v.includes(c[0])){form=c[1];break;}
    if(/base[- ]?t1[ls]?(?:\b|$)|single.pair/.test(v)){form='Single-pair Ethernet';medium='Copper';}
    else if(/base[- ]?t(?:x)?(?:\b|$)|rj[- ]?45|^copper$/.test(v)){form='RJ45';medium='Copper';}
    else if(!form&&/fiber|fibre|optical|base[- ]?(?:s[rx]|l[rx]|er|zx)|pon/.test(v)){form='Optical';medium='Fiber';}
    if(/dac|twinax|direct.attach/.test(v)){form=form||'Pluggable';medium='Direct attach cable';}
    if(/base[- ]?cr\d*(?:\b|$)/.test(v)){form=form||'Pluggable';medium='Direct attach cable';}
    if(/shared|combo/i.test(description||'')&&/base[- ]?t|rj[- ]?45/i.test(description||'')&&form&&form!=='RJ45'){form='Shared RJ45 / '+form;medium='';}
    return {kind:kind,form:form,rate:rate,media:medium,type:text(value)};
  }
  function catalogPort(result,port){
    var media=portType(port.type,port.description),model=modelKey(result.spec.model,manufacturer(result.spec.manufacturer));
    // The community TZ470/TZ570 files currently describe these cages as 1G
    // SFP. Preserve the manufacturer's explicit SFP+ capacity instead.
    if(manufacturer(result.spec.manufacturer)==='sonicwall'&&/^tz(?:470|570|670)w?$/.test(model)&&/^x[89]$/i.test(port.name)){
      var rate=model.startsWith('tz470')?'2.5G':model.startsWith('tz570')?'5G':'10G';
      if(media.form!=='SFP+'||media.rate!==rate){media.form='SFP+';media.rate=rate;media.overrideSource='https://www.sonicwall.com/support/knowledge-base/supported-sonicwall-and-3rd-party-sfp-and-sfp-modules-that-can-be-used-with-sonicwall-tz-series/kA1VN0000000Iza0AE';}
    }
    return media;
  }
  function portCount(port){var count=1;for(var match of text(port.name).matchAll(/\[(\d+)-(\d+)\]/g)){var start=Number(match[1]),end=Number(match[2]);if(end<start||end-start>4095)return 0;count*=end-start+1;if(count>4096)return 0;}return count;}
  function identities(target){var vendor=manufacturer(target.vendor),a=[target.model,target.product,target.partNumber].filter(useful),result=new Set(a.map(function(x){return modelKey(x,vendor);}));
    if(vendor==='hpe')a.forEach(function(x){var skus=text(x).toUpperCase().match(/\bJ[LPRS]\d{3}[A-Z]\b/g)||[];skus.forEach(function(sku){result.add(norm(sku));if(HPE_SKUS[sku])result.add(modelKey(HPE_SKUS[sku],vendor));});});return result;
  }
  function selectFile(files,target){var keys=identities(target),vendor=manufacturer(target.vendor),matches=files.filter(function(f){return keys.has(modelKey(f.name.replace(/\.ya?ml$/i,''),vendor));});return matches.length===1?matches[0]:null;}
  function verifies(spec,target){var ids=identities(target),vendor=manufacturer(target.vendor);return manufacturer(spec.manufacturer)===vendor&&[spec.model,spec.partNumber].some(function(x){return useful(x)&&ids.has(modelKey(x,vendor));});}
  function targets(model){
    var meta=model.meta||{},vendor=meta.vendorId||meta.vendor||'',devices=(model.categories.system||[]).filter(function(r){return r.family==='device'&&(useful(r.summary.model)||useful(r.summary.productName));}),members=(model.categories.switching||[]).filter(function(r){return useful(r.summary.model)&&/stack|vsf|virtual.chassis/i.test(r.family+' '+(r.summary.section||''));}),result=[];
    function add(r,member){var s=r&&r.summary||{},m=s.model||s.productName||meta.model||meta.productName||'',scope=r&&r.scope||'global',position=member?(text(s.memberId||s.member).match(/\d+/)||text(r.name).match(/\d+/)||text(r.index).match(/\d+/)||[])[0]||'':'';if(!useful(m))return;
      var target={key:(member?'member:'+position:scope),vendor:s.manufacturer||s.vendor||vendor,model:text(m),product:text(s.productName||(!r?meta.productName:'')),partNumber:text(s.partNumber||s.productId||s.hardwareId||(!r?meta.hardwareId:'')),scope:scope,member:position,recordId:r&&r.id||'',global:!member&&scope==='global'&&devices.length<2};
      if(!result.some(function(t){return t.key===target.key&&modelKey(t.model,manufacturer(t.vendor))===modelKey(target.model,manufacturer(target.vendor));}))result.push(target);
    }
    if(root.SWHardware){var inventory=root.SWHardware.inventory(model);inventory.members.forEach(function(m){if(!members.some(function(r){return String(r.summary.memberId||r.summary.member||'')===m.id;}))members.push({id:m.recordId,scope:m.scope,name:'Member '+m.id,summary:{model:m.model,member:m.id}});});}members.forEach(function(r){add(r,true);});if(!members.length)devices.forEach(function(r){add(r,false);});
    if(!result.length)add(null,false);
    if(root.SWHardware)root.SWHardware.annotations(meta).filter(function(a){return !a.slot;}).forEach(function(a){var target=result.find(function(t){return t.scope===a.scope&&t.member===(a.member||'');});if(target){target.model=a.model;target.product='';target.partNumber='';}else{if(a.member&&!root.SWHardware.inventory(model).members.length)result=result.filter(function(t){return t.scope!==a.scope||t.member;});result.push({key:a.member?'member:'+a.member:a.scope,vendor:vendor,model:a.model,product:'',partNumber:'',scope:a.scope,member:a.member||'',recordId:'',global:!a.member&&a.scope==='global'});}});
    return result;
  }
  function normalizedPort(value){return text(value).toLowerCase().replace(/^(?:tengigabitethernet|twentyfivegige|hundredgige|fortygigabitethernet|gigabitethernet|fastethernet|ethernet|tengige|twentyfivegigabitethernet|ge|gi|te|eth|xe|et)(?=[-\d])/,'').replace(/^-/,'').replace(/\s+/g,'');}
  function matchPort(spec,record,target,model){
    var name=text(record.name).toLowerCase(),ports=spec.interfaces||[],exact=ports.filter(function(p){return p.name.toLowerCase()===name;});if(exact.length===1)return exact[0];
    var candidate=normalizedPort(name);if(manufacturer(target.vendor)==='hpe'&&model&&model.meta.vendorId==='aruba-instant-on'&&/^(?:1|ge1|te1)\/0\/\d+$/i.test(name))candidate=candidate.split('/').pop();var matches=ports.filter(function(p){
      var template=p.name;if(template.includes('{module}'))return false;if(template.includes('{vc_position}')){if(!target.member)return false;template=template.replace(/\{vc_position\}/g,target.member);}
      var normalized=normalizedPort(template),range=normalized.match(/^(.*)\[(\d+)-(\d+)\](.*)$/);if(range){var start=Number(range[2]),end=Number(range[3]);if(end<start||end-start>4095)return false;var pattern=new RegExp('^'+range[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\d+)'+range[4].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),m=candidate.match(pattern);return !!m&&Number(m[1])>=start&&Number(m[1])<=end;}
      return normalized===candidate;
    });return matches.length===1?matches[0]:null;
  }
  function createManager(options){
    options=options||{};var storage=options.storage,fetcher=options.fetch||root.fetch&&root.fetch.bind(root),clock=options.now||Date.now,cache=Object.create(null),pending=new Map(),controllers=new Set(),modelStates=new WeakMap(),enabled=true,blockedUntil=0,epoch=0,watched=new Map();
    try{if(storage===undefined)storage=root.localStorage;enabled=!storage||storage.getItem(PREFERENCE)!=='false';var old=storage&&JSON.parse(storage.getItem(CACHE)||'null');if(old&&old.version===1&&Array.isArray(old.items))old.items.slice(-50).forEach(function(pair){if(Array.isArray(pair)&&typeof pair[0]==='string'&&pair[0].length<300&&pair[1]&&Number.isFinite(pair[1].at)&&pair[1].at>=0&&pair[1].at<=clock()+300000)cache[pair[0]]=pair[1];});}catch(e){}
    function save(){if(!storage)return;try{var entries=Object.keys(cache).map(function(k){return [k,cache[k]];}).sort(function(a,b){return a[1].at-b[1].at;}).slice(-50);while(entries.length&&JSON.stringify(entries).length>2200000)entries.shift();storage.setItem(CACHE,JSON.stringify({version:1,items:entries}));}catch(e){}}
    async function request(url,max){
      if(!allowedURL(url)||!fetcher)throw new Error('Specification download unavailable');if(clock()<blockedUntil)throw new Error('Catalog request limit reached');
      var requestEpoch=epoch,ctrl=new AbortController(),timer=setTimeout(function(){ctrl.abort();},12000);controllers.add(ctrl);
      try{var response=await fetcher(url,{method:'GET',credentials:'omit',mode:'cors',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'},signal:ctrl.signal});
        if(response.status===403||response.status===429){var reset=Number(response.headers.get('x-ratelimit-reset'))*1000,retry=Number(response.headers.get('retry-after'))*1000;blockedUntil=Math.max(clock()+60000,Math.min(clock()+3600000,reset||clock()+retry||clock()+60000));}
        if(!response.ok)throw new Error('Catalog request failed ('+response.status+')');if(Number(response.headers.get('content-length'))>max)throw new Error('Catalog response too large');
        var body='';if(response.body&&response.body.getReader){var reader=response.body.getReader(),decoder=new TextDecoder(),bytes=0;while(true){var part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>max){await reader.cancel();throw new Error('Catalog response too large');}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}else{body=await response.text();if(body.length>max)throw new Error('Catalog response too large');}
        if(requestEpoch!==epoch)throw new Error('Specification cache was cleared');return JSON.parse(body);
      }finally{clearTimeout(timer);controllers.delete(ctrl);}
    }
    async function cached(key,force,loader,validate){
      var taskEpoch=epoch,old=cache[key],valid=old&&validate(old.data);if(valid&&!force&&clock()-old.at<WEEK)return {data:old.data,at:old.at,cached:true};
      if(pending.has(key))return pending.get(key);
      var task=(async function(){try{var data=await loader();if(taskEpoch!==epoch)throw new Error('Specification cache was cleared');if(!validate(data))throw new Error('Invalid catalog response');var at=clock();cache[key]={at:at,data:data};save();return {data:data,at:at,cached:false};}catch(e){if(taskEpoch!==epoch)throw e;if(valid)return {data:old.data,at:old.at,cached:true,stale:true,error:e.message};throw e;}finally{if(taskEpoch===epoch)pending.delete(key);}})();pending.set(key,task);return task;
    }
    function validNames(xs){return Array.isArray(xs)&&xs.length<15000&&xs.every(function(x){return x&&typeof x.name==='string'&&x.name.length<200&&!/[\/\\\u0000]/.test(x.name)&&SHA.test(x.sha);});}
    async function vendorFiles(target,force){
      var rootIndex=await cached('manufacturers',force,async function(){var xs=await request(API+'contents/device-types',1800000);if(!Array.isArray(xs)||xs.length>=1000)throw new Error('Incomplete manufacturer index');return xs.filter(function(x){return x.type==='dir';}).map(function(x){return {name:x.name,sha:x.sha};});},validNames),wanted=manufacturer(target.vendor),vendors=rootIndex.data.filter(function(v){return norm(v.name)===wanted;});
      if(vendors.length!==1)throw new Error('Manufacturer is not listed in the catalog');var vendor=vendors[0];
      var files=await cached('vendor:'+vendor.name+':'+vendor.sha,false,async function(){var tree=await request(API+'git/trees/'+vendor.sha,4000000);if(tree.truncated||!Array.isArray(tree.tree))throw new Error('Incomplete model index');return tree.tree.filter(function(v){return v.type==='blob'&&/\.ya?ml$/i.test(v.path);}).map(function(v){return {name:v.path,sha:v.sha};});},validNames);
      return {vendor:vendor.name,files:files.data,stale:rootIndex.stale||files.stale};
    }
    function validBlob(data){if(!data||typeof data.yaml!=='string'||!SHA.test(data.sha)||!publicSource(data.path))return false;try{parseDefinition(data.yaml);return true;}catch(e){return false;}}
    function lastGood(target){var matches=Object.keys(cache).filter(function(k){return k.startsWith('model:');}).map(function(k){return cache[k];}).filter(function(e){return validBlob(e.data)&&verifies(parseDefinition(e.data.yaml),target);}).sort(function(a,b){return b.at-a.at;});if(!matches.length)return null;var e=matches[0];return {spec:parseDefinition(e.data.yaml),source:publicSource(e.data.path),path:e.data.path,sha:e.data.sha,at:e.at,cached:true,stale:clock()-e.at>=WEEK};}
    async function lookup(target,force){
      var lookupEpoch=epoch,previous=lastGood(target);if(previous&&!force&&!previous.stale)return previous;
      try{var index=await vendorFiles(target,force);if(index.stale&&previous)return Object.assign({},previous,{stale:true,error:'Catalog index download unavailable'});var file=selectFile(index.files,target);if(!file)throw new Error('No exact model or SKU match in the catalog');
        var path='device-types/'+index.vendor+'/'+file.name;
        var result=await cached('model:'+path,force,async function(){var blob=await request(API+'git/blobs/'+file.sha,900000);if(blob.encoding!=='base64'||blob.sha!==file.sha||typeof blob.content!=='string'||blob.size>MAX_YAML)throw new Error('Invalid catalog blob');var bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),function(c){return c.charCodeAt(0);});if(bytes.byteLength>MAX_YAML)throw new Error('Catalog definition too large');var yaml=new TextDecoder('utf-8',{fatal:true}).decode(bytes),spec=parseDefinition(yaml);if(!verifies(spec,target))throw new Error('Catalog model identity does not match');return {yaml:yaml,path:path,sha:file.sha};},validBlob);
        var spec=parseDefinition(result.data.yaml);if(!verifies(spec,target))throw new Error('Catalog model identity does not match');return {spec:spec,source:publicSource(result.data.path),path:result.data.path,sha:result.data.sha,at:result.at,cached:result.cached,stale:result.stale||index.stale,error:result.error};
      }catch(e){if(lookupEpoch!==epoch)throw e;if(previous)return Object.assign({},previous,{stale:true,error:e.message});throw e;}
    }
    function state(model){var s=modelStates.get(model);if(!s){s={targets:targets(model).map(function(t){return {target:t,status:'pending',result:lastGood(t)};}),listeners:new Set(),loading:false,checked:false,lastChecked:0,generation:0};modelStates.set(model,s);}return s;}
    function announce(s){s.listeners.forEach(function(fn){fn();});}
    async function refresh(model,force){var s=state(model);if(s.loading||!enabled&&!force)return;s.loading=true;s.checked=true;var refreshEpoch=epoch,generation=++s.generation;
      try{await Promise.all(s.targets.map(async function(entry){entry.status='loading';announce(s);try{var result=await lookup(entry.target,force);if(refreshEpoch===epoch&&generation===s.generation){entry.result=result;entry.status=result.stale?'cached':'ready';entry.error=result.error||'';}}catch(e){if(refreshEpoch===epoch&&generation===s.generation){entry.status=entry.result?'cached':'unavailable';entry.error=e.message;}}}));}finally{if(refreshEpoch===epoch&&generation===s.generation){s.loading=false;s.lastChecked=clock();announce(s);}}}
    function forRecord(model,record){var entries=state(model).targets,scope=record.scope||'global',members=entries.filter(function(e){return e.target.member;}),selected;
      if(members.length){var coordinate=root.SWHardware&&root.SWHardware.coordinates(model,record),match=text(record.name).match(/^(?:[a-z]+-)?(\d+)\//i),member=coordinate&&coordinate.member||match&&match[1];if(!member)return null;selected=members.filter(function(e){return e.target.member===member;});}
      else{selected=entries.filter(function(e){return !e.target.global&&e.target.scope===scope;});if(!selected.length)selected=entries.filter(function(e){return e.target.global;});}
      return selected.length===1?selected[0]:null;
    }
    function hardware(model,record){var entry=forRecord(model,record);if(!entry||!entry.result)return null;var port=matchPort(entry.result.spec,record,entry.target,model);if(!port)return null;var media=catalogPort(entry.result,port);return Object.assign(media,{poe:port.poe_mode==='pse'?'PoE output'+(port.poe_type?' / '+port.poe_type.replace(/^type\d+-/,''):''):port.poe_mode==='pd'?'PoE powered device':'',basis:(media.overrideSource?'Vendor reference; ':'')+'Community catalog: '+entry.result.spec.model+(entry.result.stale?' (cached)':''),source:entry.result.source,sha:entry.result.sha,at:entry.result.at,port:port.name});}
    return {enabled:function(){return enabled;},setEnabled:function(value){enabled=!!value;if(!enabled)controllers.forEach(function(c){c.abort();});try{if(storage)storage.setItem(PREFERENCE,String(enabled));}catch(e){}},watch:function(model,callback){var s=state(model);if(callback){s.listeners.add(callback);watched.set(model,s);}if(enabled&&(!s.checked||clock()-s.lastChecked>=WEEK))refresh(model,false);return function(){s.listeners.delete(callback);if(!s.listeners.size)watched.delete(model);};},retarget:function(model){var s=state(model);s.generation++;s.loading=false;s.checked=false;s.targets=targets(model).map(function(t){return {target:t,status:'pending',result:lastGood(t)};});announce(s);if(enabled)refresh(model,false);},refresh:refresh,entries:function(model){return state(model).targets;},loading:function(model){return state(model).loading;},hardware:hardware,forRecord:forRecord,lookup:lookup,clear:function(options){epoch++;controllers.forEach(function(c){c.abort();});pending.clear();cache=Object.create(null);blockedUntil=0;modelStates=new WeakMap();if(options&&options.resetPreferences)enabled=true;watched.forEach(function(s,model){s.generation++;s.loading=false;s.checked=true;s.lastChecked=clock();s.targets=targets(model).map(function(t){return {target:t,status:'pending',result:null};});modelStates.set(model,s);announce(s);});try{if(storage)storage.removeItem(CACHE);}catch(e){return false;}return true;},cacheInfo:function(){return {items:Object.keys(cache).length};},_cache: function(){return cache;}};
  }
  var manager=createManager();
  function reportAppendix(model){
    var h=root.SWCore.escapeHTML,entries=manager.entries(model).filter(function(e){return e.result;});if(!entries.length)return '';
    return '<section id="hardware-specifications"><h2>Device hardware specifications</h2><p>Community catalog data describes model capabilities. It does not establish configured speed, fitted optics, installed expansion modules or interface use. Configuration values remain authoritative.</p>'+entries.map(function(entry){var r=entry.result,s=r.spec,rows=[['Manufacturer',s.manufacturer],['Catalog model',s.model],['Part number',s.partNumber],['Rack height',s.rackUnits?s.rackUnits+' U':''],['Weight',s.weight&&s.weightUnit?s.weight+' '+s.weightUnit:''],['Airflow',s.airflow],['Configuration context',entry.target.member?'Stack member '+entry.target.member:entry.target.scope],['Retrieved',new Date(r.at).toISOString()],['Catalog blob SHA',r.sha],['Catalog status',r.stale?'Cached; current download unavailable':'Downloaded model specification']].filter(function(p){return p[1];});
      var ports=(model.categories.interfaces||[]).map(function(p){var owner=manager.forRecord(model,p);return owner===entry?{r:p,hardware:manager.hardware(model,p)}:null;}).filter(function(p){return p&&p.hardware;});
      return '<article><h3>'+h(s.model)+'</h3><p><a href="'+h(r.source)+'" rel="noreferrer">NetBox Community Device Type Library</a> / CC0 1.0</p><table>'+rows.map(function(p){return '<tr><th>'+h(p[0])+'</th><td>'+h(p[1])+'</td></tr>';}).join('')+'</table>'+(ports.length?'<h4>Matched configured interface names</h4><table><thead><tr><th>Interface</th><th>Connector</th><th>Rated capacity</th><th>PoE capability</th></tr></thead><tbody>'+ports.map(function(p){return '<tr><td>'+h(p.r.name)+'</td><td>'+h(p.hardware.form||p.hardware.type)+(p.hardware.overrideSource?' / <a href="'+h(p.hardware.overrideSource)+'">Vendor correction</a>':'')+'</td><td>'+h(p.hardware.rate)+'</td><td>'+h(p.hardware.poe)+'</td></tr>';}).join('')+'</tbody></table>':'')+(s.modules.length?'<p>Expansion bays are model capabilities; installed modules are not inferred.</p>':'')+'</article>';
    }).join('')+'</section>';
  }
  root.SWDeviceSpecs={manager:manager,createManager:createManager,parseDefinition:parseDefinition,portType:portType,catalogPort:catalogPort,portCount:portCount,manufacturer:manufacturer,modelKey:modelKey,selectFile:selectFile,verifies:verifies,targets:targets,matchPort:matchPort,allowedURL:allowedURL,reportAppendix:reportAppendix,repository:REPO};
  var originalReport=root.SWCore.report;root.SWCore.report=function(model,redact){var html=originalReport(model,redact),appendix=reportAppendix(model);return appendix?html.replace('</body>',appendix+'</body>'):html;};
})(typeof globalThis!=='undefined'?globalThis:this);
