(function installMikroTik(root){
 'use strict';
 var C=root.SWCore,I=root.SWImporters,MAX=25*1024*1024,LIMIT=250000,MAGIC=0xb1a1ac88;
 var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
 function str(v){return v===undefined||v===null?'':String(v);}
 function unique(xs){return Array.from(new Set(xs.filter(function(x){return x!==''&&x!==undefined&&x!==null;})));}
 function list(v){return str(v).split(',').map(function(x){return x.trim();}).filter(Boolean);}
 function yes(v){return /^(?:yes|true|1|enabled|on)$/i.test(str(v));}
 function state(p){return own(p,'disabled')?(yes(p.disabled)?'Disabled':'Enabled'):'Not specified';}
 function safeName(s){return str(s).replace(/[\r\n\0]/g,' ');}
 function bytes64(b){var chunks=[];for(var p=0;p<b.length;p+=8192)chunks.push(String.fromCharCode.apply(null,b.subarray(p,p+8192)));return btoa(chunks.join(''));}
 function hex(b){return Array.from(b,function(x){return x.toString(16).padStart(2,'0');}).join('');}
 function ip4(n){if(typeof n!=='number'||n<0||n>0xffffffff)return '';return [n&255,n>>>8&255,n>>>16&255,n>>>24].join('.');}
 function maskPrefix(mask){var n=C.ipv4(mask);if(n===null)return '';var bits=n.toString(2).padStart(32,'0');return /^1*0*$/.test(bits)?str(bits.indexOf('0')<0?32:bits.indexOf('0')):'';}
 function mac(v){return v&&typeof v.hex==='string'&&v.hex.length===12?v.hex.match(/../g).join(':'):'';}
 function M2(bytes,depth,budget){
  depth=depth||0;budget=budget||{fields:0};if(depth>24)throw new Error('RouterOS record nesting exceeds the supported limit.');
  var p=0,out=[];function take(n){if(!Number.isInteger(n)||n<0||p+n>bytes.length)throw new Error('Incomplete RouterOS binary field.');var v=bytes.subarray(p,p+n);p+=n;return v;}
  function num(n){var b=take(n),v=0;for(var i=n-1;i>=0;i--)v=v*256+b[i];return v;}
  if(num(1)!==77||num(1)!==50)throw new Error('Unknown RouterOS record encoding.');
  while(p<bytes.length){
   if(++budget.fields>LIMIT)throw new Error('The backup exceeds the 250,000 field limit.');
   var marker=num(4),id=marker&0xffffff,t=marker>>>24,v;
   function binary(n){return {hex:hex(take(n))};}
   function integer(n){var b=take(n),v=0n;for(var q=n-1;q>=0;q--)v=v*256n+BigInt(b[q]);return v<=BigInt(Number.MAX_SAFE_INTEGER)?Number(v):v.toString();}
   if(t===0||t===1)v=!!t;
   else if(t===9)v=num(1);
   else if(t===8||t===16)v=integer(t===8?4:8);
   else if(t===24)v=binary(16);
   else if([32,33,40,41,48,49].includes(t)){
    var raw=take(num(t&1?1:2));if((t&254)===32){try{v=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch(e){v={hex:hex(raw)};}}
    else if((t&254)===40)v=M2(raw,depth+1,budget);else v={hex:hex(raw)};
   }else if(t&128){
    var length=num(2),sub=t&127;if(length>LIMIT-budget.fields)throw new Error('The binary array exceeds the supported field limit.');v=[];budget.fields+=length;
    for(var j=0;j<length;j++){
     if(sub===0||sub===1)v.push(!!num(1));
     else if([8,9,16,24].includes(sub))v.push(sub===24?binary(16):integer(sub===9?1:sub===8?4:8));
     else if([32,40,48].includes(sub)){var raw=take(num(2));v.push(sub===40?M2(raw,depth+1,budget):sub===32?new TextDecoder().decode(raw):{hex:hex(raw)});}
     else throw new Error('Unknown RouterOS array type 0x'+t.toString(16)+'.');
    }
   }else throw new Error('Unknown RouterOS field type 0x'+t.toString(16)+'.');
   out.push({id:id,type:t,value:v});
  }
  return out;
 }
 function unpackBackup(bytes,filename){
  var data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(data.length>MAX)throw new Error('The file exceeds the 25 MB limit.');
  var p=0,tables=[],budget={fields:0},unknown=0;
  function uint(){if(p+4>data.length)throw new Error('The RouterOS backup is truncated.');var n=(data[p]|data[p+1]<<8|data[p+2]<<16|data[p+3]<<24)>>>0;p+=4;return n;}
  function blob(){var n=uint();if(n>MAX||p+n>data.length)throw new Error('The RouterOS backup contains an invalid file size.');var b=data.subarray(p,p+n);p+=n;return b;}
  var magic=uint();if(magic===0x7291a8ef||magic===0x7391a8ef)throw new Error('This RouterOS backup is encrypted. Open an unencrypted .backup or a RouterOS .rsc text export.');
  if(magic!==MAGIC)throw new Error('Unrecognized MikroTik backup header. Open a RouterOS .backup or .rsc export.');
  if(uint()!==data.length)throw new Error('The RouterOS backup length does not match its header. The file may be incomplete.');
  var names=new Set();
  while(p<data.length){
   if(tables.length>=8192)throw new Error('The backup contains too many internal tables.');
   var name=new TextDecoder('utf-8',{fatal:true}).decode(blob()),index=blob(),dat=blob();
   if(!name||name.length>256||/[\x00-\x1f\x7f\\]/.test(name)||name[0]==='/'||name.split('/').some(function(v){return !v||v==='.'||v==='..';})||names.has(name))throw new Error('Invalid or repeated RouterOS table name.');names.add(name);
   if(index.length%12)throw new Error('The RouterOS index is incomplete.');
   var rows=[],offset=0;for(var q=0;q<index.length;q+=12){
    if(rows.length>=LIMIT)throw new Error('The backup contains too many records.');
    var view=new DataView(index.buffer,index.byteOffset+q,12),id=view.getInt32(0,true),size=view.getUint32(4,true),flags=view.getUint32(8,true);
    if(size<2||offset+size>dat.length)throw new Error('The RouterOS record index exceeds its table.');
    var record=dat.subarray(offset,offset+size),declared=record[0]|record[1]<<8,fields=[],error='';
    if(declared!==size)error='Unrecognized record length';else try{fields=M2(record.subarray(2),0,budget);}catch(e){if(/limit/.test(e.message))throw e;error=e.message;}
    if(error)unknown++;
    rows.push({index:id,offset:offset,size:size,flags:flags,fields:fields,error:error});offset+=size;
   }
   if(offset!==dat.length)unknown++;
   tables.push({name:name,indexBase64:bytes64(index),dataBase64:bytes64(dat),rows:rows});
  }
  return {text:JSON.stringify({format:'mikrotik-routeros-backup',version:1,size:data.length,unknownRecords:unknown,tables:tables}),filename:filename};
 }
 function validateEnvelope(env){
  function invalid(){throw new Error('Invalid RouterOS backup data.');}
  if(!env||env.version!==1||!Array.isArray(env.tables)||env.tables.length>8192||!Number.isInteger(env.size)||env.size<8||env.size>MAX)invalid();
  var fields=0,rows=0,names=new Set(),encoded=0;
  function visit(xs,depth){if(depth>24||!Array.isArray(xs))invalid();xs.forEach(function(f){if(++fields>LIMIT)invalid();if(!f||!Number.isInteger(f.id)||f.id<0||f.id>0xffffff||!Number.isInteger(f.type)||f.type<0||f.type>255)invalid();var v=f.value;if((f.type&254)===40)visit(v,depth+1);else if(f.type===168){if(!Array.isArray(v))invalid();v.forEach(function(x){visit(x,depth+1);});}else if(Array.isArray(v)){fields+=v.length;if(fields>LIMIT||v.some(function(x){return typeof x!=='string'&&typeof x!=='number'&&typeof x!=='boolean'&&!(x&&typeof x==='object'&&typeof x.hex==='string');}))invalid();}else if(typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean'&&!(v&&typeof v==='object'&&typeof v.hex==='string'&&/^(?:[a-f0-9]{2})*$/.test(v.hex)))invalid();});}
  env.tables.forEach(function(t){if(!t||typeof t.name!=='string'||!t.name||t.name.length>256||/[\x00-\x1f\x7f\\]/.test(t.name)||t.name[0]==='/'||t.name.split('/').some(function(v){return !v||v==='.'||v==='..';})||names.has(t.name)||!Array.isArray(t.rows))invalid();names.add(t.name);['indexBase64','dataBase64'].forEach(function(k){if(typeof t[k]!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t[k]))invalid();encoded+=t[k].length;if(encoded>MAX*1.4)invalid();});t.rows.forEach(function(r){if(++rows>LIMIT||!r||!Number.isInteger(r.index)||r.index<-2147483648||r.index>2147483647||!Number.isInteger(r.offset)||r.offset<0||!Number.isInteger(r.size)||r.size<2||r.size>MAX||typeof r.error!=='string')invalid();visit(r.fields,0);});});
 }
 function get(fields,id,type){var a=(fields||[]).filter(function(f){return f.id===id&&(type===undefined||(typeof type==='string'?typeof f.value===type:f.type===type));});return a.length===1?a[0].value:undefined;}
 function flatten(fields,prefix,out){(fields||[]).forEach(function(f,i){var path=prefix+'/0x'+f.id.toString(16).padStart(6,'0')+':'+f.type.toString(16).padStart(2,'0')+'['+i+']';if((f.type&254)===40)flatten(f.value,path,out);else if(f.type===168)f.value.forEach(function(row,j){flatten(row,path+'/'+j,out);});else out.push({id:f.id,type:f.type,value:f.value,path:path});});return out;}
 function binaryNodes(envelope,b){
  var rows=[],ifaceNames=new Map(),groupNames=new Map(),listNames=new Map();
  function tables(name){return envelope.tables.filter(function(t){return t.name===name;}).flatMap(function(t){return t.rows.filter(function(r){return r.index>=0&&!r.error;});});}
  tables('net/devices').forEach(function(r){ifaceNames.set(get(r.fields,0xfe0001,'number'),get(r.fields,0x10006,'string'));});
  tables('group').forEach(function(r){groupNames.set(get(r.fields,0xfe0001,'number'),get(r.fields,1,'string'));});
  tables('net/devlist').forEach(function(r){listNames.set(get(r.fields,0xfe0001,'number'),get(r.fields,0xfe0010,'string'));});
  function ref(n){return ifaceNames.get(n)||'';}
  function refs(ns){return Array.isArray(ns)?ns.map(function(n){return ref(n)||listNames.get(n)||'';}).filter(Boolean).join(','):'';}
  function put(p,key,value){if(value!==undefined&&value!==null&&value!=='')p[key]=str(value);}
  function numeric(f,id){return get(f,id,'number');}
  envelope.tables.forEach(function(t){
   var storage={_entries:[],children:[],label:t.name+' binary storage'};
   b.entry(storage,'routeros/storage/'+t.name+'/secret-index-base64','secret-index-base64',t.indexBase64);
   b.entry(storage,'routeros/storage/'+t.name+'/secret-data-base64','secret-data-base64',t.dataBase64);
   rows.push({menu:'@binary-storage',p:{name:t.name},node:storage});
   t.rows.forEach(function(row,ri){
    var f=row.fields,p={},menu='',kind='',node={_entries:[],children:[],label:t.name},isActive=row.index>=0&&!row.error;
    put(p,'disabled',get(f,0xfe000a,'boolean'));put(p,'comment',get(f,0xfe0009,'string'));put(p,'name',get(f,0xfe0010,'string'));
    var fields=flatten(f,'',[]),privateTable=/^(?:user|cert|ssh|radius|ipsec|ppp|scripts|scheduler|email|net\/apn|diskd-smb-user)(?:\/|$)/.test(t.name);
    fields.forEach(function(v){var value=typeof v.value==='object'?JSON.stringify(v.value):str(v.value),secret=privateTable&&!((t.name==='user'||t.name==='group')&&[1,2,0xfe0001,0xfe0009,0xfe000a,0xfe0010].includes(v.id));b.entry(node,'routeros/'+t.name+'/record['+ri+']'+v.path+(secret?'/secret':''),'field-0x'+v.id.toString(16),value);});
    b.entry(node,'routeros/'+t.name+'/record['+ri+']/$index','index',row.index);if(row.error)b.entry(node,'routeros/'+t.name+'/record['+ri+']/$encoding','encoding',row.error);
    if(!isActive){rows.push({menu:'@binary-original',p:{name:t.name+' record '+row.index},node:node});return;}
    if(t.name==='net/devices'){
     var type=numeric(f,0x10001),inner=get(f,0x10008,41)||get(f,0x10008,40)||[],v=function(id,typ){return get(inner,id,typ);};
     menu=type===1?'interface ethernet':type===12?'interface bridge':type===30?'interface vlan':type===76?'interface loopback':'interface';kind=str(type);
     p.name=get(f,0x10006,'string')||p.name;put(p,'default-name',get(f,0x10031,'string'));put(p,'disabled',v(0xfe000a,'boolean'));put(p,'mtu',v(0x10064,'number'));put(p,'l2mtu',v(0x10065,'number'));put(p,'mac-address',mac(v(0x3e9)));put(p,'comment',get(f,0x1000a,'string'));
     if(type===1){
      put(p,'auto-negotiation',v(0x3f3,'boolean'));put(p,'pluggable-port',v(0x400,'boolean'));
      var speedModes={0:'10M',1:'10M',2:'100M',3:'100M',4:'1G',5:'1G',12:'10G',15:'2.5G',24:'40G',25:'40G',31:'25G',33:'25G',34:'50G',37:'100G',38:'100G',40:'50G',41:'1G',42:'10G',43:'10G',47:'2.5G',48:'5G',53:'50G',54:'50G',58:'100G',59:'100G',63:'200G',66:'200G',70:'400G',73:'400G',90:'100M',91:'100M'};
      if(v(0x3f3,'boolean')===false)put(p,'speed',speedModes[v(0x41b,'number')]);
      var ads=v(0x40c,136);if(ads)put(p,'advertised-speeds',unique(ads.map(function(x){return speedModes[x];})).join(', '));
     }else if(type===30){put(p,'vlan-id',v(0x7d1,'number'));put(p,'interface',ref(v(0x7d2,'number')));put(p,'use-service-tag',v(0x7d3,'boolean'));}
     else if(type===12){put(p,'vlan-filtering',v(0x6a,'boolean'));put(p,'igmp-snooping',v(0x69,'boolean'));put(p,'pvid',v(0x6b,'number'));put(p,'protocol-mode',['none','stp','rstp','mstp'][v(0x64,'number')]);}
    }else if(t.name==='net/addrs'){
     menu='ip address';put(p,'address',ip4(numeric(f,1)));var mask=ip4(numeric(f,3));if(p.address&&maskPrefix(mask)!=='')p.address+='/'+maskPrefix(mask);put(p,'network',ip4(numeric(f,2)));put(p,'interface',ref(numeric(f,10))||ref(numeric(f,5)));
    }else if(t.name==='bridgeports'){
     menu='interface bridge port';put(p,'interface',ref(numeric(f,3)));put(p,'bridge',ref(numeric(f,4)));put(p,'pvid',numeric(f,19));put(p,'frame-types',['admit-all','admit-only-vlan-tagged','admit-only-untagged-and-priority-tagged'][numeric(f,20)]);put(p,'ingress-filtering',get(f,21,'boolean'));put(p,'hw',get(f,15,'boolean'));
    }else if(t.name==='bridge-vlans'){
     menu='interface bridge vlan';var ids=get(f,1,136)||[],ranges=[];for(var k=0;k<ids.length;k+=2)if(ids[k]>=1&&ids[k]<=4094&&ids[k+1]>=ids[k]&&ids[k+1]<=4094)ranges.push(ids[k]===ids[k+1]?str(ids[k]):ids[k]+'-'+ids[k+1]);put(p,'vlan-ids',ranges.join(','));put(p,'bridge',ref(numeric(f,2)));put(p,'tagged',refs(get(f,3,136)));put(p,'untagged',refs(get(f,4,136)));
    }else if(t.name==='net/devlist'){
     menu='interface list';put(p,'include',(get(f,1,136)||[]).map(function(id){return listNames.get(id);}).filter(Boolean).join(','));put(p,'exclude',(get(f,2,136)||[]).map(function(id){return listNames.get(id);}).filter(Boolean).join(','));
    }else if(t.name==='net/devlist-member'){
     menu='interface list member';put(p,'interface',ref(numeric(f,1)));put(p,'list',listNames.get(numeric(f,2)));
    }else if(t.name==='system'){
     menu='system identity';put(p,'name',get(f,12,'string'));put(p,'version',get(f,13,'string'));if(!p.name)menu='@binary-original';
    }else if(t.name==='dhcp/client'){
     menu='ip dhcp-client';put(p,'interface',ref(numeric(f,2)));put(p,'use-peer-dns',get(f,13,'boolean'));put(p,'use-peer-ntp',get(f,14,'boolean'));put(p,'add-default-route',numeric(f,18)===0?'no':numeric(f,18)===1?'yes':numeric(f,18)===2?'special-classless':undefined);put(p,'default-route-distance',numeric(f,15));
    }else if(t.name==='user'){
     menu='user';put(p,'name',get(f,1,'string'));put(p,'group',groupNames.get(numeric(f,2)));
    }else if(t.name==='group'){
     menu='user group';put(p,'name',get(f,1,'string'));
    }else if(t.name==='ntp'){
     menu='system ntp client';put(p,'enabled',get(f,4,'boolean'));
    }else if(t.name==='resolver/config'){
     menu='ip dns';var nested=get(f,10,168)||[];put(p,'servers',nested.map(function(x){return ip4(get(x,1,'number'));}).filter(Boolean).join(','));put(p,'allow-remote-requests',get(f,3,'boolean'));put(p,'use-doh-server',get(f,16,'string'));
    }else if(t.name==='net/vrf'){
     menu='ip vrf';var all=get(f,3,168)||[];put(p,'interfaces',all.map(function(v){return ref(get(v,4,'number'));}).filter(Boolean).join(','));if(p.name==='main'&&!p.interfaces)menu='@binary-original';
    }else if(t.name==='log-actions'){
     menu='system logging action';put(p,'name',get(f,1,'string'));put(p,'target',['memory','disk','echo','remote','email'][numeric(f,2)]);put(p,'remote',ip4(numeric(f,7)));put(p,'remote-port',numeric(f,8));
    }
    rows.push({menu:menu||'@binary-original',p:p,node:node,kind:kind,table:t.name});
   });
  });
  return rows;
 }
 // Read RouterOS export syntax as data. Bracket expressions, scripts and variables are never executed.
 function statements(source){
  var out=[],line=1,start=1,buf='',quote=false,escape=false,braces=0;
  for(var i=0;i<source.length;i++){
   var c=source[i];if(c==='\r'&&source[i+1]==='\n')continue;
   if(c==='\n'){
    if(escape){buf=buf.slice(0,-1);escape=false;line++;continue;}
    if(quote||braces){buf+='\n';line++;continue;}
    out.push({text:buf,start:start,end:line});buf='';line++;start=line;continue;
   }
   buf+=c;if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"'){quote=!quote;continue;}if(!quote){if(c==='{')braces++;if(c==='}')braces--;if(braces<0)braces=0;}
  }
  if(buf)out.push({text:buf,start:start,end:line});if(quote||braces)throw new Error('The RouterOS export contains an unfinished quoted value or script block.');return out;
 }
 function tokens(s){
  var out=[],buf='',quote=false,escape=false,depth=0,brace=0,inword=false;
  function push(){if(inword){out.push(buf);buf='';inword=false;}}
  for(var i=0;i<s.length;i++){
   var c=s[i];if(escape){buf+='\\'+c;escape=false;inword=true;continue;}if(c==='\\'){escape=true;inword=true;continue;}
   if(c==='"'){quote=!quote;buf+=c;inword=true;continue;}
   if(!quote){if(c==='#'&&!depth&&!brace)break;if(c==='[')depth++;else if(c===']')depth--;else if(c==='{')brace++;else if(c==='}')brace--;if(/\s/.test(c)&&!depth&&!brace){push();continue;}}
   buf+=c;inword=true;
  }
  if(escape)buf+='\\';push();return out;
 }
 function literal(s){
  if(s[0]==='"'&&s[s.length-1]==='"')s=s.slice(1,-1);
  var out='';for(var i=0;i<s.length;){if(s[i]!=='\\'){out+=s[i++];continue;}var run=s.slice(i).match(/^(?:\\[0-9a-fA-F]{2})+/);if(run){var bytes=Uint8Array.from(run[0].match(/[0-9a-fA-F]{2}/g),function(h){return parseInt(h,16);});try{out+=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){out+=Array.from(bytes,function(x){return String.fromCharCode(x);}).join('');}i+=run[0].length;continue;}var c=s[i+1];if(c!==undefined&&/[\\"nrt $]/.test(c)){out+=({n:'\n',r:'\r',t:'\t'})[c]||c;i+=2;}else out+=s[i++];}return out;
 }
 function expression(s){var quoted=false,escaped=false;for(var i=0;i<s.length;i++){var c=s[i];if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"'){quoted=!quoted;continue;}if(c==='$'||c==='['&&!quoted)return true;}return false;}
 function props(ts){var p=Object.create(null);ts.forEach(function(t){var m=t.match(/^([A-Za-z0-9_.-]+)=(.*)$/s);if(m&&!expression(m[2]))p[m[1]]=literal(m[2]);});return p;}
 function textNodes(source,b){
  var rows=[],section='',byMenu=new Map();
  function add(menu,p,node){var row={menu:menu,p:p,node:node};rows.push(row);if(!byMenu.has(menu))byMenu.set(menu,[]);byMenu.get(menu).push(row);return row;}
  statements(source).forEach(function(st){
   var raw=st.text,t=raw.trim();if(!t||t[0]==='#')return;
   var node={_entries:[],children:[],label:'RouterOS command'},ts=tokens(t);if(ts[0]&&ts[0][0]==='/'){var absolute=ts[0].split('/').filter(Boolean),tail=absolute[absolute.length-1];if(absolute.length>1&&/^(?:add|set|enable|disable|remove)$/.test(tail))ts=['/'+absolute.slice(0,-1).join('/'),tail].concat(ts.slice(1));}var at=ts.findIndex(function(w){return /^(?:add|set|enable|disable|remove)$/.test(w);}),menu=section;
   if(t[0]==='/'){
    var end=at<0?ts.length:at;menu=ts.slice(0,end).join(' ').replace(/\//g,' ').trim().replace(/\s+/g,' ');if(at<0){section=menu;var header=b.entry(node,'routeros/'+menu.replace(/ /g,'/')+'/line['+st.start+']/$section','menu',raw);header.sourceLineStart=st.start;header.sourceLineEnd=st.end;add('@section',{},node);return;}
   }else if(at!==0){menu='@uninterpreted';}
   var command=at>=0?ts[at]:'',args=at>=0?ts.slice(at+1):[],privateLine=C.secretKey(t)||/\b(?:on-event|on-up|on-down|source)\s*=/.test(t),e=b.entry(node,'routeros/'+menu.replace(/ /g,'/')+'/line['+st.start+']'+(privateLine?'/secret':''),privateLine?'secret':'command',raw);
   e.sourceLineStart=st.start;e.sourceLineEnd=st.end;
   if(menu==='@uninterpreted'||!command){add('@uninterpreted',{},node);b.note('Scripts and unresolved expressions are retained without execution.');return;}
   var p=props(args),selector=args.find(function(x){return /^\[/.test(x);}),target=null;
   if(command==='add'){add(menu,p,node);return;}
   if(command==='set'&&!selector&&(!args.length||args[0].includes('='))){
    target=(byMenu.get(menu)||[]).find(function(r){return r.singleton;});if(!target){target=add(menu,{},node);target.singleton=true;}else target.node._entries.push(e);Object.assign(target.p,p);return;
   }
   var wanted={};if(selector){var m=selector.match(/^\[\s*find\s+(?:where\s+)?(.+)\s*\]$/s);if(m&&!/\b(?:and|or)\b|[<>!~]/.test(m[1]))wanted=props(tokens(m[1]));}
   else if(args[0]&&!args[0].includes('='))wanted.name=literal(args[0]);
   var candidates=menu==='interface'?rows.filter(function(r){return /^interface(?: (?:ethernet|bridge|vlan|bonding|wireguard|vrrp|loopback|gre|eoip|vxlan|veth|wifi|wireless|pppoe-client))?$/.test(r.menu);}):byMenu.get(menu)||[];
   var matches=candidates.filter(function(r){return Object.keys(wanted).length&&Object.keys(wanted).every(function(k){return r.p[k]===wanted[k];});});
   if(matches.length===1)target=matches[0];
   else if(!matches.length&&command==='set'&&(/^interface(?: ethernet)?$/.test(menu))&&(wanted['default-name']||wanted.name)&&Object.keys(wanted).length===1){target=add(menu,Object.assign({},wanted,{name:wanted['default-name']||wanted.name}),node);}
   if(!target&&wanted.name&&Object.keys(wanted).length===1&&/^(?:ip service|user|user group)$/.test(menu)&&!/^\d+$|^\*/.test(wanted.name))target=add(menu,{name:wanted.name},node);
   if(!target){add('@uninterpreted',{},node);b.note('Unresolved RouterOS selectors are preserved as source commands. Use an export with explicit interface names for full interpretation.');return;}
   if(target.node!==node)target.node._entries.push(e);if(command==='remove')target.removed=true;else if(command==='enable'||command==='disable')target.p.disabled=command==='disable'?'yes':'no';else Object.assign(target.p,p);
  });
  return rows;
 }
 function parseRouterOS(source,options,envelope){
  var b=new I.Builder('mikrotik',source,options,envelope?'RouterOS binary backup':'RouterOS text export'),nodes=envelope?binaryNodes(envelope,b):textNodes(source,b),interfaces=new Map(),pools=new Map(),lists=new Map(),vlanRecords=[],deferred=[],features=[];
  b.meta.deviceType='router';b.meta.configurationKind='RouterOS configuration';b.meta.sourceKind=envelope?'Binary backup':'Text export';
  if(!envelope){var ver=source.match(/^#.*\bby RouterOS\s+(\S+)/m),model=source.match(/^#\s*model\s*=\s*(.+)$/m),serial=source.match(/^#\s*serial number\s*=\s*(.+)$/mi);if(ver)b.meta.firmware=ver[1];if(model)b.meta.model=model[1].trim();if(serial)b.meta.serial=serial[1].trim();}
  function record(row,cat,family,name,summary){var r=b.record(cat,family,name||row.p.name||family,'global',row.node,Object.assign({status:state(row.p),comment:row.p.comment||''},summary||{}));row.record=r;return r;}
  function original(row){return record(row,'other','routeros-source',row.p.name||row.menu,{section:row.menu});}
  function iface(name,type,row){
   if(!name)return null;var r=interfaces.get(name);if(!r){r=row?record(row,'interfaces',type,name,{interfaceType:type,mode:'Not specified'}):b.record('interfaces',type,name,'global',null,{interfaceType:type,mode:'Not specified'});if(!row)r.derived=true;interfaces.set(name,r);}else if(row){b.claim(row.node,r);row.record=r;}
   return r;
  }
  function addr(r,v,kind){var a=I.address(v);if(!a.ip)return;r.addresses=r.addresses||[];if(!r.addresses.some(function(x){return x.ip===a.ip&&x.mask===a.mask;})){a.kind=kind||'IPv4';r.addresses.push(a);}if(!r.summary.ip)Object.assign(r.summary,{ip:a.ip,mask:a.mask,network:a.network});}
  function fact(label,value,ref,critical){return value===undefined||value===null||value===''?null:{label:label,value:str(value),ref:ref||'',critical:critical!==false};}
  function feature(row,topic,name,fs,refs){var good=fs.filter(Boolean);if(!good.length)return original(row);var r=record(row,topic==='aaa'?'identities':topic==='vrf'?'routes':topic==='options'?'network':'system','routeros-'+topic,name,{mikrotikTopic:topic,featureData:JSON.stringify(good)});r.references=refs||{};features.push(r);return r;}
  nodes.filter(function(n){return !n.removed&&/^interface(?: (?:ethernet|bridge|vlan|bonding|wireguard|vrrp|loopback|gre|eoip|vxlan|veth|wifi|wireless|pppoe-client))?$/.test(n.menu);}).forEach(function(n){
   var p=n.p,name=p.name||p['default-name'];if(!name){original(n);return;}var type=n.menu.slice(10)||'Interface';type=({ethernet:'Ethernet',bridge:'Bridge',vlan:'VLAN interface',bonding:'Link aggregation',wireguard:'WireGuard tunnel',loopback:'Loopback',vrrp:'VRRP virtual interface',wifi:'Wireless',wireless:'Wireless','pppoe-client':'PPPoE tunnel'})[type]||type;
   var r=iface(name,type,n),s=r.summary;Object.assign(s,{status:state(p),comment:p.comment||'',mtu:p.mtu||'',mac:p['mac-address']||'',speed:p.speed||'',defaultName:p['default-name']||'',autoNegotiation:own(p,'auto-negotiation')?(yes(p['auto-negotiation'])?'Enabled':'Disabled'):'',advertisedSpeeds:p['advertised-speeds']||p.advertise||''});
   if(p['default-name'])r.aliases=unique([p['default-name']]);
   if(type==='Ethernet'){
    var native=p['default-name']||name,pluggable=own(p,'pluggable-port')?yes(p['pluggable-port']):/^(?:sfp|qsfp)/i.test(native),form=pluggable?/^qsfp28/i.test(native)?'QSFP28':/^qsfpplus/i.test(native)?'QSFP+':/^sfp28/i.test(native)?'SFP28':/^sfp-sfpplus/i.test(native)?'SFP+':/^sfp/i.test(native)?'SFP':'Pluggable':/^ether\d+$/i.test(native)?'RJ45':'';
    s.portConnector=form;if(form)s.portIdentification='RouterOS interface identity'+(envelope?' and pluggable-port flag':'');
    if(form&&form!=='RJ45'&&form!=='Pluggable')s.portCapacity=({'SFP+':'10G',SFP28:'25G','QSFP+':/[-:]([2-4])$/.test(native)?'10G':'40G',QSFP28:/[-:]([2-4])$/.test(native)?'25G':'100G',SFP:'1G'})[form]||'';
    var lane=native.match(/^(qsfp(?:plus|28)\d+)[-:]([1-4])$/i);if(lane){s.physicalPort=lane[1];s.breakoutLane=lane[2];s.breakoutGroup=lane[1];}
   }else if(type==='VLAN interface'){
    s.vlan=p['vlan-id']||'';s.parent=p.interface||'';s.mode='VLAN';r.references.interfaces=s.parent?[s.parent]:[];
   }else if(type==='Bridge'){
    s.mode='Bridge';s.vlanFiltering=own(p,'vlan-filtering')?(yes(p['vlan-filtering'])?'Enabled':'Disabled'):'';s.protocol=p['protocol-mode']||'';s.igmpSnooping=own(p,'igmp-snooping')?(yes(p['igmp-snooping'])?'Enabled':'Disabled'):'';
   }else if(type==='Link aggregation'){
    r.members=list(p.slaves);s.members=r.members.join(', ');s.mode='Aggregation';s.protocol=p.mode||'';r.references.interfaces=r.members.slice();
   }else if(type==='PPPoE tunnel')s.mode='PPPoE';
  });
  function resolveInterface(name){if(interfaces.has(name))return interfaces.get(name);return Array.from(interfaces.values()).find(function(r){return (r.aliases||[]).includes(name);});}
  function refPort(name){return resolveInterface(name)||iface(name,'Interface',null);}
  function vlanIds(value){var out=[];list(value).forEach(function(part){var m=part.match(/^(\d+)(?:-(\d+))?$/);if(!m)return;var a=Number(m[1]),z=Number(m[2]||a);if(a<1||z>4094||z<a)return;for(var i=a;i<=z;i++)out.push(str(i));});return unique(out);}
  nodes.forEach(function(n){
   if(n.record)return;if(n.removed){original(n);return;}var p=n.p,m=n.menu,r;
   if(m==='interface bridge port'){
    var port=p.interface&&refPort(p.interface),bridge=p.bridge&&resolveInterface(p.bridge);if(!port||!bridge){original(n);return;}
    b.claim(n.node,port);n.record=port;bridge.sourceFieldKeys=unique((bridge.sourceFieldKeys||[]).concat(n.node._entries.map(function(e){return e.key;})));
    if(!yes(p.disabled)){bridge.members=unique(bridge.members.concat(port.name));bridge.summary.members=bridge.members.join(', ');bridge.references.interfaces=bridge.members.slice();port.summary.bridge=bridge.name;port.references.interfaces=unique((port.references.interfaces||[]).concat(bridge.name));
     if(p.pvid){port.summary.nativeVLAN=p.pvid;if(p['frame-types']!=='admit-only-vlan-tagged'&&bridge.summary.vlanFiltering==='Enabled')port.summary.untaggedVLANs=unique(list(port.summary.untaggedVLANs).concat(p.pvid)).join(', ');}if(p['frame-types'])port.summary.frameTypes=p['frame-types'];if(own(p,'ingress-filtering'))port.summary.ingressFiltering=yes(p['ingress-filtering'])?'Enabled':'Disabled';
    }
   }else if(m==='interface bridge vlan'){
    var ids=vlanIds(p['vlan-ids']);if(!ids.length){original(n);return;}
    ids.forEach(function(id,i){var v=i?b.record('vlans','vlan',id,'global',null,{}):record(n,'vlans','vlan',id,{});if(i){v.derived=true;v.relatedRecordId=n.record.id;}Object.assign(v.summary,{vlan:id,vlanName:p.comment||'',bridge:p.bridge||'',taggedPorts:p.tagged||'',untaggedPorts:p.untagged||'',status:state(p)});v.references.interfaces=unique(list(p.tagged).concat(list(p.untagged),p.bridge||[]));vlanRecords.push(v);});
   }else if(m==='interface list'){
    r=record(n,'links','interface-list',p.name,{kind:'Interface list',members:'',include:p.include||'',exclude:p.exclude||''});r.members=[];lists.set(p.name,r);
   }else if(m==='interface list member')deferred.push(n);
   else if(m==='ip address'||m==='ipv6 address'){
    var port=p.interface&&refPort(p.interface);if(!port||!p.address){original(n);return;}b.claim(n.node,port);n.record=port;
    if(!yes(p.disabled)){addr(port,p.address,m==='ipv6 address'?'IPv6':'IPv4');if(port.summary.mode!=='Bridge'&&port.summary.mode!=='VLAN')port.summary.mode='Static';port.sourceFieldKeys=unique((port.sourceFieldKeys||[]).concat(n.node._entries.map(function(e){return e.key;})));}
   }else if(m==='ip pool'||m==='ipv6 pool'){
    r=record(n,'network','dhcp-pool',p.name,{kind:'DHCP pool',ranges:p.ranges||p.prefix||'',prefix:p.prefix||'',nextPool:p['next-pool']||''});pools.set(p.name,r);
   }else if(m==='ip dhcp-server'||m==='ipv6 dhcp-server'){
    r=record(n,'network','dhcp-server',p.name,{kind:'DHCP server',interface:p.interface||'',addressPool:p['address-pool']||'',leaseTime:p['lease-time']||''});r.references.interfaces=list(p.interface);r.references.dhcpPools=list(p['address-pool']);deferred.push(n);
   }else if(m==='ip dhcp-server network'){
    r=record(n,'network','dhcp-network',p.address,{kind:'DHCP network',network:p.address||'',gateway:p.gateway||'',mask:p.netmask||'',dns:p['dns-server']||'',domain:p.domain||'',ntp:p['ntp-server']||''});
   }else if(m==='ip dhcp-server lease'){
    r=record(n,'network','dhcp-reservation',p['host-name']||p.address,{kind:'Reservation',ip:p.address||'',mac:p['mac-address']||'',hostname:p['host-name']||'',clientId:p['client-id']||'',server:p.server||''});r.references.dhcpPools=list(p.server);
   }else if(m==='ip dhcp-client'||m==='ipv6 dhcp-client'){
    r=feature(n,'options',(p.interface||'Interface')+' DHCP client',[fact('Interface',p.interface,'interfaces'),fact('Address assignment','DHCP'),fact('Use supplied DNS',own(p,'use-peer-dns')?(yes(p['use-peer-dns'])?'Yes':'No'):''),fact('Use supplied time servers',own(p,'use-peer-ntp')?(yes(p['use-peer-ntp'])?'Yes':'No'):''),fact('Add default route',own(p,'add-default-route')?(p['add-default-route']==='special-classless'?'Special classless routes':yes(p['add-default-route'])?'Yes':'No'):''),fact('Default route distance',p['default-route-distance'],'',false),fact('Configured state',state(p),'',false)],{interfaces:list(p.interface)});var port=resolveInterface(p.interface);if(port&&!yes(p.disabled)&&!port.summary.ip)port.summary.mode='DHCP';
   }else if(m==='ip dhcp-relay'){
    r=record(n,'network','dhcp-relay',p.name,{kind:'DHCP relay',interface:p.interface||'',servers:p['dhcp-server']||'',ip:p['local-address']||''});r.references.interfaces=list(p.interface);
   }else if(m==='ip dns'){
    r=record(n,'network','dns-servers','DNS servers',{kind:'DNS servers',dns:list(p.servers).join(', '),dnsHostname:p['use-doh-server']||'',allowRemoteRequests:own(p,'allow-remote-requests')?(yes(p['allow-remote-requests'])?'Enabled':'Disabled'):''});
   }else if(m==='ip dns static'){
    r=record(n,'network','dns-host',p.name||p.regexp||p.address,{kind:'DNS record',dnsHostname:p.name||'',ip:p.address||'',target:p['cname']||p['forward-to']||p['mx-exchange']||p.text||'',recordType:p.type||'',ttl:p.ttl||'',regexp:p.regexp||''});
   }else if(m==='ip route'||m==='ipv6 route'){
    r=record(n,'routes','static-route',p['dst-address']||'Route '+b.records.length,{destination:p['dst-address']||'',gateway:p.gateway||'',interface:p['routing-interface']||'',metric:p.distance||'',routeType:yes(p.blackhole)?'Discard':p.type||'Static',routingTable:p['routing-table']||p['routing-mark']||'',ipVersion:m==='ipv6 route'?'IPv6':'IPv4',status:state(p)});r.references.interfaces=unique(list(p.gateway).map(function(x){return x.includes('%')?x.split('%')[1]:resolveInterface(x)?x:'';}).filter(Boolean));
   }else if(m==='routing table'||m==='ip vrf'){
    r=feature(n,'vrf',p.name||'Routing context',[fact('Routing context',p.name),fact('Interfaces',p.interfaces,'interfaces'),fact('Install routes in forwarding table',own(p,'fib')?(yes(p.fib)?'Yes':'No'):'')],{interfaces:list(p.interfaces)});
   }else if(/^routing (?:ospf|bgp|rip|filter|rule)/.test(m)){
    r=feature(n,/filter/.test(m)?'routefilter':'advanced',p.name||m,[fact('Protocol',m.split(' ')[1].toUpperCase()),fact('Router ID',p['router-id']),fact('Local AS',p.as),fact('Remote address',p['remote.address']),fact('Remote AS',p['remote.as']),fact('Networks',p.networks),fact('Interfaces',p.interfaces||p.interface,'interfaces'),fact('Area',p.area),fact('Instance',p.instance),fact('Filter rule',p.rule),fact('Configured state',state(p),'',false)],{interfaces:list(p.interfaces||p.interface)});
   }else if(/^ip(?:v6)? firewall (?:filter|nat|raw|mangle)$/.test(m)){
    var nat=/ nat$/.test(m),src=p['src-address-list']||p['src-address']||'Any',dst=p['dst-address-list']||p['dst-address']||'Any',service=p.protocol||p['dst-port']?unique([p.protocol,p['dst-port']]).join(' / '):'Any',from=p['in-interface-list']||p['in-interface']||'Any',to=p['out-interface-list']||p['out-interface']||'Any';
    r=record(n,nat?'nat':'policies',nat?'nat-rule':'firewall-rule',p.comment||p.chain+' / '+(p.action||'Unspecified action'),nat?{source:src,destination:dst,service:service,translatedSource:/src-nat|masquerade/.test(p.action||'')?p['to-addresses']||'Masquerade':'Original',translatedDestination:/dst-nat|redirect|netmap/.test(p.action||'')?p['to-addresses']||'Redirect':'Original',translatedService:p['to-ports']||'Original',inbound:from,outbound:to,action:p.action||'',chain:p.chain||''}:{source:src,destination:dst,service:service,sourceZone:from,destinationZone:to,action:({accept:'Allow',drop:'Discard',reject:'Reject'})[p.action]||p.action||'',chain:p.chain||'',priority:str(b.records.length),ipVersion:/^ipv6/.test(m)?'IPv6':'IPv4'});
    r.matches={source:[src],destination:[dst],services:[service],sourceZones:[from],destinationZones:[to]};r.references={source:list(p['src-address-list']),destination:list(p['dst-address-list']),service:service==='Any'?[]:[service],interfaces:unique(list(p['in-interface']).concat(list(p['out-interface']))),interfaceLists:unique(list(p['in-interface-list']).concat(list(p['out-interface-list']))),links:unique(list(p['in-interface-list']).concat(list(p['out-interface-list'])))};
    if(service!=='Any'){var sr=b.records.find(function(x){return x.category==='services'&&x.name===service;});if(!sr){sr=b.record('services','service',service,'global',null,{kind:'Service',protocol:p.protocol||'',ports:p['dst-port']||'',start:p['dst-port']||''});sr.derived=true;sr.relatedRecordId=r.id;}r.summary.service=sr.name;}
    if(nat&&p['to-ports']){var translatedName=unique([p.protocol,p['to-ports']]).join(' / '),translated=b.records.find(function(x){return x.category==='services'&&x.name===translatedName;});if(!translated){translated=b.record('services','service',translatedName,'global',null,{kind:'Service',protocol:p.protocol||'',ports:p['to-ports'],start:p['to-ports']});translated.derived=true;translated.relatedRecordId=r.id;}r.summary.translatedService=translated.name;r.references.translatedService=[translated.name];}
   }else if(/^ip(?:v6)? firewall address-list$/.test(m)){
    r=record(n,'addresses','address',p.address,{kind:p.address&&p.address.includes('/')?'Network':'Host',value:p.address||'',network:p.address||'',ipVersion:/^ipv6/.test(m)?'IPv6':'IPv4'});deferred.push(n);
   }else if(m==='user'){
    r=record(n,'identities','administrator',p.name,{kind:'Administrator',accountType:'device',role:p.group||'',allowedAddress:p.address||''});r.references.groups=list(p.group);
   }else if(m==='user group'){
    r=record(n,'identities','device-user-group',p.name,{kind:'Device group',accountType:'device',permissions:p.policy||''});
   }else if(m==='radius'){
    r=record(n,'identities','radius',p.address||'RADIUS server',{kind:'RADIUS server',server:p.address||'',port:p['authentication-port']||'',accountingPort:p['accounting-port']||'',services:p.service||'',protocol:p.protocol||''});
   }else if(m==='user aaa'){
    r=feature(n,'aaa','Device authentication',[fact('Use RADIUS',p['use-radius']),fact('Default group',p['default-group']),fact('Accounting',p.accounting),fact('Interim update',p['interim-update'])]);
   }else if(m==='system identity'){
    if(p.name)b.meta.name=p.name;if(p.version)b.meta.firmware=p.version;r=record(n,'system','device',p.name||'Device information',{name:p.name||'',model:b.meta.model||'',firmware:b.meta.firmware||'',serial:b.meta.serial||''});
   }else if(m==='system resource'||m==='system routerboard'){
    if(p['board-name']||p.model)b.meta.model=p['board-name']||p.model;if(p.version)b.meta.firmware=p.version;if(p['serial-number'])b.meta.serial=p['serial-number'];r=record(n,'system','device',p['board-name']||p.model||'Device information',{model:b.meta.model,firmware:b.meta.firmware,serial:b.meta.serial});
   }else if(m==='system clock'){
    r=feature(n,'time','Time zone',[fact('Time zone',p['time-zone-name']),fact('Automatic time zone',p['time-zone-autodetect'],'',false)]);
   }else if(/^system ntp (?:client|server)(?: servers)?$/.test(m)){
    r=feature(n,'time',/server$/.test(m)?'NTP server':'NTP client',[fact('Time servers',p.servers||p.address||unique([p['primary-ntp'],p['secondary-ntp']]).join(', ')),fact('NTP synchronization',own(p,'enabled')?(yes(p.enabled)?'Enabled':'Disabled'):''),fact('Mode',p.mode,'',false)]);
   }else if(m==='system logging action'){
    if(p.target==='remote'&&p.remote&&!/^(?:0\.0\.0\.0|::)$/.test(p.remote))r=feature(n,'syslog',p.name||p.remote,[fact('Syslog server',p.remote),fact('Port',p['remote-port']),fact('Source IP',p['src-address']),fact('Log format',p['bsd-syslog'],'',false)]);else original(n);
   }else if(m==='ip service'){
    r=feature(n,'access',p.name||p['.id']||'Management service',[fact('Service',p.name||p['.id']),fact('Allowed addresses',p.address),fact('Port',p.port),fact('Certificate',p.certificate,'certificates',false),fact('Configured state',state(p),'',false)]);
   }else if(m==='snmp'||m==='snmp community'){
    r=feature(n,'snmp',m==='snmp'?'SNMP':'SNMP access',[fact('SNMP',p.enabled),fact('Allowed hosts',p.addresses),fact('Trap targets',p['trap-target']),fact('Contact',p.contact,'',false),fact('Location',p.location,'',false),fact('Security',p.security,'',false)]);
   }else if(m==='ip cloud'){
    r=feature(n,'ddns','Dynamic DNS',[fact('Dynamic DNS',p['ddns-enabled']),fact('Hostname',p['dns-name']),fact('Update time',p['update-time'],'',false)]);
   }else if(m==='ip neighbor discovery-settings'){
    r=feature(n,'discovery','Neighbor discovery',[fact('Interface list',p['discover-interface-list'],'links'),fact('Discovery protocols',p.protocol)]);
   }else if(m==='interface wireguard peers'){
    r=record(n,'vpn','wireguard',p.name||p.comment||p['endpoint-address']||'WireGuard peer',{protocol:'WireGuard',peer:p['endpoint-address']||'',port:p['endpoint-port']||'',remote:p['allowed-address']||'',tunnelInterface:p.interface||'',status:state(p)});r.references.interfaces=list(p.interface);
   }else if(/^ip ipsec (?:peer|policy|identity|profile|proposal)$/.test(m)){
    r=record(n,'vpn',/ policy$/.test(m)?'ipsec-tunnel':/ peer$/.test(m)?'ike-gateway':'ipsec-settings',p.name||p.comment||p.address||m,{protocol:'IPsec',peer:p.address||'',local:p['src-address']||p['local-address']||'',remote:p['dst-address']||'',exchangeMode:p['exchange-mode']||'',proposal:p.proposal||'',profile:p.profile||'',ikeGateways:p.peer||''});if(p.peer)r.references.ikeGateways=list(p.peer);
   }else original(n);
  });
  deferred.forEach(function(n){var p=n.p,r=n.record;if(n.menu==='interface list member'){
    var g=lists.get(p.list);if(!g){original(n);return;}b.claim(n.node,g);if(!yes(p.disabled))g.members=unique(g.members.concat(p.interface||[]));g.summary.members=g.members.join(', ');g.summary.interfaces=g.summary.members;g.references.interfaces=g.members.slice();
   }else if(/ dhcp-server$/.test(n.menu)){
    var pool=pools.get(p['address-pool']);if(pool){r.summary.ranges=pool.summary.ranges;r.references.dhcpPools=[pool.id];}
   }else if(/firewall address-list$/.test(n.menu)){
    var name=p.list;if(!name)return;var g=b.records.find(function(x){return x.category==='addresses'&&x.summary.kind==='Group'&&x.name===name;});if(!g){g=b.record('addresses','address-group',name,'global',null,{kind:'Group'});g.derived=true;}g.members=unique(g.members.concat(r.name));g.references.addresses=g.members.slice();g.summary.members=g.members.join(', ');g.sourceFieldKeys=unique((g.sourceFieldKeys||[]).concat(n.node._entries.map(function(e){return e.key;})));
   }});
  vlanRecords.forEach(function(v){if(v.summary.status==='Disabled')return;var added=Array.from(interfaces.values()).filter(function(p){return p.summary.bridge===v.summary.bridge&&list(p.summary.untaggedVLANs).includes(v.summary.vlan);}).map(function(p){return p.name;});v.summary.untaggedPorts=unique(list(v.summary.untaggedPorts).concat(added)).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});}).join(', ');v.references.interfaces=unique((v.references.interfaces||[]).concat(added));['taggedPorts','untaggedPorts'].forEach(function(k){list(v.summary[k]).forEach(function(name){var port=resolveInterface(name);if(!port)return;var key=k==='taggedPorts'?'taggedVLANs':'untaggedVLANs';port.summary[key]=unique(list(port.summary[key]).concat(v.summary.vlan)).join(', ');port.references.vlans=unique((port.references.vlans||[]).concat(v.id));});});});
  interfaces.forEach(function(r){var s=r.summary;if(s.taggedVLANs)s.portMode=s.untaggedVLANs?'Hybrid':'Trunk';else if(s.untaggedVLANs||s.nativeVLAN)s.portMode='Access';if(s.parent){var p=resolveInterface(s.parent);if(p){r.references.interfaces=[p.name];if(s.vlan)p.references.vlans=unique((p.references.vlans||[]).concat(s.vlan));}}if(s.bridge){var bridge=resolveInterface(s.bridge);if(bridge&&bridge.summary.vlanFiltering==='Disabled')s.vlanFiltering='Disabled on '+bridge.name;}});
  interfaces.forEach(function(port){if(port.summary.interfaceType!=='Bridge')return;var group=b.record('links','bridge-group',port.name,'global',null,{kind:'Bridge',groupType:'Bridge',members:port.members.join(', '),interfaces:port.members.join(', '),protocol:port.summary.protocol||'',vlanFiltering:port.summary.vlanFiltering||'',status:port.summary.status});group.derived=true;group.relatedRecordId=port.id;group.members=port.members.slice();group.references.interfaces=unique([port.name].concat(port.members));group.sourceFieldKeys=port.sourceFieldKeys||[];});
  if(!b.meta.name)b.meta.name=options&&options.filename?options.filename.replace(/\.[^.]+$/,''):'MikroTik configuration';
  if(/^CRS|^CSS/i.test(b.meta.model)||nodes.some(function(n){return n.menu==='interface bridge';})&&Array.from(interfaces.keys()).filter(function(n){return /^sfp|^qsfp/.test(n);}).length>=8)b.meta.deviceType='switch';
  if(envelope){b.meta.partial=true;b.meta.partialConfiguration='Known binary field mappings';b.note('Binary backup decoded locally. Known fields are mapped to networking records; all internal table bytes and decoded fields are retained in original fields. Unknown fields are not assigned guessed meanings.');b.note('The backup does not establish a RouterOS version, model or serial number unless an explicit identity field is present. Internal database version flags are not firmware versions.');if(envelope.unknownRecords)b.note(envelope.unknownRecords+' binary record(s) or table tails use an unrecognized encoding and are retained as original data.');}
  else b.note('RouterOS exports are interpreted without running commands or scripts. Omitted defaults and inherited or dynamic state are not inferred.');
  var model=b.finish([]);if(envelope)model.decodedText=model.entries.filter(function(e){return !/routeros\/storage\//.test(e.key);}).map(function(e){return e.key+' = '+e.value;}).join('\n');return model;
 }
 function detect(s){if(/^\s*#.*\bby RouterOS\b/m.test(s))return true;var first=s.replace(/^\uFEFF/,'').split(/\r?\n/).map(function(s){return s.trim();}).find(function(s){return s&&s[0]!=='#';})||'';return /^\/(?:interface|ip|ipv6|system|routing|radius|user|queue|ppp|snmp)(?:[ /]|$)/.test(first);}
 var unpack=I.unpack;I.unpack=function(bytes,filename){var data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),m=data.length>=4?(data[0]|data[1]<<8|data[2]<<16|data[3]<<24)>>>0:0;if([MAGIC,0x7291a8ef,0x7391a8ef].includes(m))return unpackBackup(data,filename);return unpack(bytes,filename);};
 var parse=C.parse;C.parse=function(input,options){if(typeof input==='string'){
  if(input.length>36*1024*1024)throw new Error('The configuration exceeds the supported size limit.');
  var trim=input.trim();if(/^\{\s*"format"\s*:\s*"mikrotik-routeros-backup"/.test(trim)){var env;try{env=JSON.parse(trim);}catch(e){throw new Error('The RouterOS backup data is incomplete.');}validateEnvelope(env);return parseRouterOS('',options||{},env);}
  if(!/^\s*[{[<]/.test(input)&&detect(input))return parseRouterOS(input,options||{},null);
 }return parse(input,options);};
 var configText=I.configurationText;
 function sourceView(model,fields,redact){
  fields=fields.filter(function(e){return !/^routeros\/storage\//.test(e.key);});
  if(model.meta.sourceKind!=='Text export')return fields.map(function(e){return e.key+' = '+C.redactValue(e.key,e.value,redact!==false);}).join('\n');
  var menu='',out=[];fields.forEach(function(e){var m=e.key.match(/^routeros\/(.+)\/line\[/);if(!m)return;var next='/'+m[1].replace(/\//g,' ');if(e.base==='menu'){out.push(e.value);menu=next;return;}if(next!==menu){out.push(next);menu=next;}out.push(C.redactValue(e.key,e.value,redact!==false));});return out.join('\n');
 }
 I.configurationText=function(model,redact){
  if(model.meta.vendorId!=='mikrotik')return configText(model,redact);
  if(model.meta.sourceKind==='Text export'&&model.decodedText){
   if(redact===false)return model.decodedText;
   var lines=model.decodedText.split(/\r?\n/);model.entries.filter(function(e){return C.secretKey(e.key);}).forEach(function(e){if(Number.isInteger(e.sourceLineStart))for(var i=e.sourceLineStart-1;i<e.sourceLineEnd;i++)lines[i]='[REDACTED]';});return lines.join('\n');
  }return sourceView(model,model.entries,redact);
 };
 function sourceEntries(model,records){var selected=new Set(),keys=new Set();records.forEach(function(r){(r.fields||[]).forEach(function(e){selected.add(e);});(r.sourceFieldKeys||[]).forEach(function(k){keys.add(k);});if(r.relatedRecordId){var x=model.records.find(function(x){return x.id===r.relatedRecordId;});if(x)(x.fields||[]).forEach(function(e){selected.add(e);});}});return model.entries.filter(function(e){return selected.has(e)||keys.has(e.key);});}
 ['recordConfigurationText','sectionConfigurationText'].forEach(function(method){var prior=I[method];I[method]=function(model,record,redact){if(model.meta.vendorId!=='mikrotik')return prior(model,record,redact);var fields=sourceEntries(model,Array.isArray(record)?record:[record]);return {text:sourceView(model,fields,redact),note:model.meta.sourceKind==='Text export'?'Related RouterOS export commands. Scripts and expressions are not executed.':'Decoded RouterOS binary fields. Unknown field IDs retain their original values.'};};});
 var sections=I.configurationSections;I.configurationSections=function(model){if(model.meta.vendorId!=='mikrotik')return sections(model);var groups=new Map();model.entries.forEach(function(e){var m=e.key.match(/^routeros\/(.+?)\/(?:record|line)\[/),name=m?m[1].replace(/\//g,' / '):'Binary storage';if(!groups.has(name))groups.set(name,{id:'global|'+name,name:name,scope:'global',fields:[],recordIds:[]});var g=groups.get(name);g.fields.push(e);if(!g.recordIds.includes(e.recordId))g.recordIds.push(e.recordId);});return Array.from(groups.values()).sort(function(a,b){return a.name.localeCompare(b.name);});};
 var resolve=C.resolve;C.resolve=function(model,type,value,version,scope){var result=resolve(model,type,value,version,scope);if(result||!model||model.meta.vendorId!=='mikrotik'||!['interfaces','zones'].includes(type))return result;var candidates=(type==='zones'?['interfaces','links']:['links']).map(function(t){return resolve(model,t,value,version,scope);}).filter(Boolean);return candidates.length===1?candidates[0]:null;};
 root.SWMikroTik={unpack:unpackBackup,decodeRecord:M2,detect:detect,parse:parseRouterOS};root.SWMikroTikFactory=installMikroTik.toString();
})(typeof globalThis!=='undefined'?globalThis:this);
