(function(root){'use strict';
 // Network diagrams from the site map data. A diagram shows a chosen part of the
 // network (a device and what is below it, a device and its neighbors, or the whole
 // site). Switches are drawn as faceplates with numbered ports sized from the device's
 // own interfaces or a built-in model catalog; links are colored by type and routed on
 // a grid so they reach port centers from above (top row) or below (bottom row), go
 // around devices and never run on top of each other. Pages are plain shape lists
 // rendered to SVG or written as a Visio .vsdx; the catalog also exports as a library.
 var LINK_TYPES={
  fiber:{label:'10 Gbps fiber / uplink',color:'#e02b20'},
  copper:{label:'1 Gbps copper',color:'#f0c330'},
  slow:{label:'100 Mbps or slower (dashed)',color:'#8a94a6',dash:true},
  wap:{label:'AP copper',color:'#18a34a'},
  other:{label:'Other / speed not reported',color:'#8a94a6'},
  wan:{label:'Local handoff (provider)',color:'#f0c330'}
 };
 var ROLE_FILL={firewall:'#c0504d',router:'#e6a23c',switch:'#4f81bd',controller:'#6b62d9',ap:'#22b14c',endpoint:'#8a94a6',circuit:'#8e44ad'};
 var ROLE_LABEL={firewall:'Firewall',router:'Router',switch:'Switch',controller:'Controller',ap:'Access point',endpoint:'Device',circuit:'Provider circuit'};
 var NEAR=3,HW=2,NEAR_R=3,VBOW=-1,HOP=6,AP_SCALE=1,G=9,BAND=72,BEND=90,CROSS=30,CROSS_STRICT=20000,TOP=126,EP_W=126,EP_H=54,EP_PITCH=153,MARGIN=36,HEAD=18,FOOT=18;
 function speedValue(s){var m=String(s||'').match(/([\d.]+)\s*([GM])/i);if(!m)return 0;return Number(m[1])*(m[2].toUpperCase()==='G'?1000:1);}
 function linkType(l,aRole,bRole){if(aRole==='circuit'||bRole==='circuit')return 'wan';
  if(aRole==='ap'||bRole==='ap')return 'wap';
  var ports=(l.aPort||'')+' '+(l.bPort||''),speed=Math.max(speedValue(l.aSpeed),speedValue(l.bSpeed));
  if(speed>=10000||/\b(?:te|ten|tw|twe|twenty|fo|forty|hu|hundred|xe|et)\s*\d|tengig|twentyfive|forty|hundred|sfp|\b1\/1\/(?:49|5\d)\b/i.test(ports))return 'fiber';
  if(speed>=100||/gigabit|\bgi\s*\d|\bfa\s*\d|fastethernet|\beth\d|port\d/i.test(ports))return 'copper';
  return 'other';
 }
 // Link kinds by cable or fiber type and speed, as the reference drawing names them ("10 Gbps
 // SR fiber", "10 Gbps SFP+ DAC", "1 Gbps local handoff", "AP copper"). The media comes from
 // the port's reported media (show interfaces status) or else its connector (SFP cage or RJ45).
 var LINK_MEDIA={custom:{name:'',color:'#8a94a6',order:8.5},sr:{name:'SR fiber',color:'#e02b20',order:1},lr:{name:'LR fiber',color:'#00a3e0',order:2},fiber:{name:'fiber',color:'#e02b20',order:3},dac:{name:'DAC',color:'#111111',order:4},aoc:{name:'AOC',color:'#7b3fa0',order:4.5},stack:{name:'Stack link',color:'#5a3fc0',order:0.5},wan:{name:'local handoff',color:'#f0c330',order:5},copper:{name:'copper',color:'#f0c330',order:6},wap:{name:'AP copper',color:'#18a34a',order:7},other:{name:'Media unspecified',color:'#8a94a6',order:8}};
 var KINDS={};
 function speedText(v){return v>=1000?(Math.round(v/100)/10)+' Gbps':v>0?v+' Mbps':'';}
 function mediaOf(s){s=String(s||'');if(!s)return '';if(/twinax|\bDAC\b|-CU\d|CU\d+M|copper.*sfp|sfp.*copper/i.test(s))return 'dac';if(/\bAOC\b|active optical|-AOC\d/i.test(s))return 'aoc';if(/(?:base-?|-|\b)(?:LR|LX|ER|ZR|LRM)\d?\b/i.test(s))return 'lr';if(/(?:base-?|-|\b)(?:SR|SX)\d?\b/i.test(s))return 'sr';if(/base-?T\b|RJ-?45|10\/100|BaseTX/i.test(s))return 'copper';if(/sfp|fiber|fibre|optic/i.test(s))return 'fiber';return '';}
 function linkKind(l,aRole,bRole,aFiber,bFiber,aCopper,bCopper){var speed=Math.max(speedValue(l.aSpeed),speedValue(l.bSpeed)),ports=(l.aPort||'')+' '+(l.bPort||''),m;
  if(l.stack){var sk='stack'+(l.tech?'-'+String(l.tech).toLowerCase().replace(/[^a-z0-9]+/g,''):'');if(!KINDS[sk])KINDS[sk]={label:(l.tech?l.tech+' stack link':'Stack link'),color:LINK_MEDIA.stack.color,dash:false,media:'stack',speed:0,width:2.5};return sk;}
  if(aRole==='circuit'||bRole==='circuit')m='wan';else if(aRole==='ap'||bRole==='ap')m='wap';
  else m=mediaOf(l.aMedia)||mediaOf(l.bMedia)||(aCopper||bCopper?'copper':'')||((aFiber||bFiber||/\b(?:te|ten|tw|twe|twenty|fo|forty|hu|hundred|xe|et)\s*\d|tengig|twentyfive|forty|hundred|sfp|^x\d|\sx\d/i.test(ports)?'fiber':speed>=10||/gigabit|\bgi\s*\d|\bfa\s*\d|fastethernet|\beth\d|port\d/i.test(ports)?'copper':'other'));
  if(!speed&&/^(?:sr|lr|fiber|dac|aoc)$/.test(m))speed=/\bhu|hundred/i.test(ports)?100000:/\bfo|forty/i.test(ports)?40000:/\btw|twe|twentyfive/i.test(ports)?25000:10000;
  // Access point links are one kind at 1 Gbps or an unreported speed (one legend entry).
  if(m==='wap'&&speed===1000)speed=0;var st=speedText(speed),key=m+(speed?'-'+speed:''),label=m==='wap'?'AP copper'+(speed&&speed!==1000?', '+st:''):m==='other'?'Media unspecified'+(st?', '+st:''):m==='dac'?st+' '+(speed>=40000?'QSFP':speed>=25000?'SFP28':'SFP+')+' DAC':m==='aoc'?st+' '+(speed>=40000?'QSFP':speed>=25000?'SFP28':'SFP+')+' AOC':(st?st+' ':'')+LINK_MEDIA[m].name;
  if(!KINDS[key])KINDS[key]={label:label.charAt(0).toUpperCase()+label.slice(1),color:LINK_MEDIA[m].color,dash:speed>0&&speed<1000,media:m,speed:speed};return key;}
 // A kind's look, with the colors and names changed by hand (view.linkStyles, kept per kind).
 // One style per link type (owner request): its legend entry and every link of the type share the
 // color, name, thickness and line pattern, so an edit to either changes both.
 function cableName(m){var c=LINK_MEDIA[m];if(!c||m==='custom')return '';var n=m==='wan'?'Copper handoff':m==='wap'?'Copper (access point)':m==='other'?'':c.name;return n?n.charAt(0).toUpperCase()+n.slice(1):'';}
 function kindStyle(key,view){var k=KINDS[key]||LINK_TYPES[key]||LINK_TYPES.other,o=view&&view.linkStyles&&view.linkStyles[key]||{},speed=o.speed!=null?String(o.speed):k.speedText!=null?k.speedText:speedText(k.speed||0),cable=o.cable!=null?String(o.cable):k.cable!=null?k.cable:cableName(k.media||key),composed=(o.speed!=null||o.cable!=null)?[speed,cable].filter(Boolean).join(' '):'';return {module:o.module||k.module||'auto',speed:speed,cable:cable,label:o.label||composed||k.label,color:o.color||k.color,dash:o.dash!=null?!!o.dash:k.dash,width:Number(o.width||k.width)||(isFiberKind(key)?2.5:2),media:k.media||key};}
 // Port modules (owner request, as NetworkDiagramStudio draws them): a cage port in use shows the
 // module that fits its link type and speed (an optic by reach, a DAC or AOC cable end, an RJ45
 // copper module), unless a module was chosen for the link type; the legend lists each module and
 // the ports that use it.
 var MODULES={sr:{name:'SR fiber optic',optic:2},lr:{name:'LR fiber optic',optic:2},er:{name:'ER fiber optic',optic:2},zr:{name:'ZR fiber optic',optic:2},bidi:{name:'BiDi fiber optic',optic:1},wdm:{name:'CWDM/DWDM optic',optic:2},fiber:{name:'Fiber optic',optic:2},dac:{name:'DAC cable end',cable:1},aoc:{name:'AOC cable end',cable:2},copper:{name:'RJ45 copper module',jack:1}};
 function autoModule(text){var t=String(text||'');if(/\bDAC\b|twinax|\bACC\b|direct attach/i.test(t))return 'dac';if(/\bAOC\b|active optical/i.test(t))return 'aoc';if(/\bZR\d?\b/i.test(t))return 'zr';if(/\bER\d?\b/i.test(t))return 'er';if(/bidi/i.test(t))return 'bidi';if(/[CD]WDM/i.test(t))return 'wdm';if(/\bLR\d?\b|\bLX\b|single-?mode|\bOS[12]\b/i.test(t))return 'lr';if(/\bSR\d?\b|\bSX\b|multi-?mode|\bOM[1-5]\b/i.test(t))return 'sr';if(/fib|optic/i.test(t))return 'fiber';if(/copper|\bcat\s?\d|rj-?45|\bpoe\b|handoff|base-?t\b/i.test(t))return 'copper';return '';}
 function moduleFor(kind,view,form,role){var st=kindStyle(kind,view),k=KINDS[kind]||{},id=st.module&&st.module!=='auto'?st.module:autoModule([st.cable,st.label,LINK_MEDIA[st.media]?LINK_MEDIA[st.media].name:''].join(' '));if(!id||id==='none'||!MODULES[id])return null;
  var sp=speedValue(st.speed)||k.speed||0,ff=form==='qsfp'?(sp>=100000?'QSFP28':sp>=40000?'QSFP+':'QSFP'):(sp>=25000?'SFP28':sp>=10000?'SFP+':'SFP'),sl=sp>=1000?(sp/1000)+'G':sp?sp+'M':'';
  // Module artwork from a NetworkDiagramStudio hardware pack (its optics: switch and firewall SR optic,
  // LR optic, DAC cable end) replaces the schematic module.
  var ma=view&&view.moduleArt,slot=id==='dac'||id==='aoc'?'dac':/^(lr|er|zr)$/.test(id)?'lr':/^(sr|fiber|wdm|bidi)$/.test(id)?(role==='firewall'&&ma&&ma.fg_sr?'fg_sr':'sr'):'';
  return {id:id,ff:ff,label:[ff,sl,MODULES[id].name].filter(Boolean).join(' '),art:ma&&slot&&ma[slot]||null};}
 // A module drawn in a cage (or a legend swatch): optics show their LC receptacles, cable ends a
 // dark plug, copper modules an RJ45 jack.
 function drawModule(page,id,x,y,w,h,color,art){var m=MODULES[id]||MODULES.fiber;
  if(art&&art.art){page.rect(x,y,w,h,{fill:'#ffffff',stroke:'none'});page.image(x,y,w,h,{art:art.art,master:art.master});page.rect(x,y,w,h,{fill:'none',stroke:color||'#5b6b82',width:1});return;}
  if(m.cable){page.rect(x,y,w,h,{fill:'#2d3748',stroke:color||'#2d3748',width:1});page.rect(x+w*0.2,y+h/2-0.75,w*0.6,1.5,{fill:m.cable===2?(color||'#9aa9c0'):'#9aa9c0',stroke:'none'});return;}
  if(m.jack){page.rect(x,y,w,h,{fill:'#ffffff',stroke:color||'#5b6b82',width:1});page.rect(x+w*0.28,y+h*0.22,w*0.44,h*0.56,{fill:'#5b6b82',stroke:'none'});return;}
  page.rect(x,y,w,h,{fill:'#d5dbe3',stroke:color||'#5b6b82',width:1});var n=m.optic,sw=w*(n===1?0.34:0.27),sh=h*0.5;
  for(var i=0;i<n;i++)page.rect(x+(n===1?(w-sw)/2:w*(0.14+i*0.45)),y+(h-sh)/2,sw,sh,{fill:'#2d3748',stroke:'none'});}
 function isFiberKind(key){return /^(?:sr|lr|fiber|dac|aoc)(?:-|$)/.test(key);}
 function slowLink(l){var s=Math.max(speedValue(l.aSpeed),speedValue(l.bSpeed));return s>0&&s<1000;}
 function short(p){var s=String(p||'').trim(),m=s.match(/\bport:?\s*(\d+)/i);if(m&&/unit|slot/i.test(s))return 'Port '+m[1];
  return s.replace(/^TwentyFiveGigE/i,'Twe').replace(/^TenGigabitEthernet/i,'Te').replace(/^GigabitEthernet/i,'Gi').replace(/^FastEthernet/i,'Fa').replace(/^FortyGigabitEthernet/i,'Fo').replace(/^HundredGigE/i,'Hu').replace(/^Port-channel/i,'Po').replace(/^Ethernet/i,'Eth').replace(/\s*\(.*\)$/,'');}
 function clip(t,n){t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t;}
 function snap(v){return Math.round(v/G)*G;}
 function up9(v){return Math.ceil(v/G)*G;}

 // ---------- device catalog and ports ----------
 // Known models: copper (or fixed SFP) ports on the main board and uplink ports.
 var CATALOG=[
  {re:/WS-C3750G-24/i,label:'Cisco Catalyst 3750G-24',main:24,up:4},{re:/WS-C3750G-48/i,label:'Cisco Catalyst 3750G-48',main:48,up:4},
  {re:/WS-C3750X-24/i,label:'Cisco Catalyst 3750-X 24',main:24,up:4,mod:true},{re:/WS-C3750X-48/i,label:'Cisco Catalyst 3750-X 48',main:48,up:4,mod:true},
  {re:/WS-C3560E-24/i,label:'Cisco Catalyst 3560-E 24',main:24,up:2},{re:/WS-C3560E-48/i,label:'Cisco Catalyst 3560-E 48',main:48,up:2},
  {re:/WS-C3560X-24/i,label:'Cisco Catalyst 3560-X 24',main:24,up:4,mod:true},{re:/WS-C3560X-48/i,label:'Cisco Catalyst 3560-X 48',main:48,up:4,mod:true},
  {re:/WS-C3650-24/i,label:'Cisco Catalyst 3650 24',main:24,up:4,mod:true},{re:/WS-C3650-48/i,label:'Cisco Catalyst 3650 48',main:48,up:4,mod:true},
  {re:/WS-C3850-24/i,label:'Cisco Catalyst 3850 24',main:24,up:4,mod:true},{re:/WS-C3850-48/i,label:'Cisco Catalyst 3850 48',main:48,up:4,mod:true},
  {re:/WS-C2960X?-24/i,label:'Cisco Catalyst 2960 24',main:24,up:4},{re:/WS-C2960X?-48/i,label:'Cisco Catalyst 2960 48',main:48,up:4},
  {re:/C9200L?-24/i,label:'Cisco Catalyst 9200 24',main:24,up:4,mod:true},{re:/C9200L?-48/i,label:'Cisco Catalyst 9200 48',main:48,up:4,mod:true},
  {re:/C9300L?-24/i,label:'Cisco Catalyst 9300 24',main:24,up:4,mod:true},{re:/C9300L?-48/i,label:'Cisco Catalyst 9300 48',main:48,up:4,mod:true},
  {re:/C9500-16X/i,label:'Cisco Catalyst 9500-16X',main:16,up:0,fiber:true},{re:/C9500-24Y4C/i,label:'Cisco Catalyst 9500-24Y4C',main:24,up:4,fiber:true},
  {re:/C9500-40X/i,label:'Cisco Catalyst 9500-40X',main:40,up:0,fiber:true},{re:/C9500-48Y4C/i,label:'Cisco Catalyst 9500-48Y4C',main:48,up:4,fiber:true},
  {re:/AIR-CT5508/i,label:'Cisco 5508 Wireless Controller',main:8,up:0,fiber:true,rows:1},
  {re:/JL675A|JL676A/i,label:'Aruba 6100 48G 4SFP+',main:48,up:4,upFirst:true},{re:/JL677A|JL678A/i,label:'Aruba 6100 24G 4SFP+',main:24,up:4,upFirst:true},{re:/JL679A/i,label:'Aruba 6100 12G 2SFP+',main:12,up:2},
  {re:/JL253A/i,label:'Aruba 2930F 24G 4SFP+',main:24,up:4},{re:/JL256A/i,label:'Aruba 2930F 48G PoE+ 4SFP+',main:48,up:4},{re:/JL258A/i,label:'Aruba 2930F 8G PoE+ 2SFP+',main:8,up:2},
  {re:/J9775A/i,label:'HPE 2530-48G',main:48,up:4},{re:/J9776A/i,label:'HPE 2530-24G',main:24,up:4},
  {re:/MS2[25]0-24/i,label:'Meraki MS 24-port',main:24,up:4},{re:/MS2[25]0-48/i,label:'Meraki MS 48-port',main:48,up:4},
  {re:/TZ\s*600/i,label:'SonicWall TZ600',main:10,up:0},
  // Families named without a part number: counts come from the device's own ports.
  {re:/(?:HPE?|Aruba)(?:\s+CX)?\s*6100\b/i,label:'Aruba 6100',main:0,up:4,upFirst:true,family:true}
 ];
 function catalogFor(model){model=String(model||'');for(var i=0;i<CATALOG.length;i++)if(CATALOG[i].re.test(model))return CATALOG[i];return null;}
 // Front-panel geometry: ports in two rows (odd numbers on top) or one row, in blocks
 // (usually 12 ports, six columns) with a small gap between blocks. Positions stay on the
 // 9 px routing grid.
 function portPos(g,idx){var rows=g.rows||2,pitch=g.pitch||18,col=rows===1?idx:Math.floor(idx/2),block=Math.max(1,Math.ceil((g.per||g.count)/rows));return {dx:g.x+pitch*col+9*Math.floor(col/block),row:rows===1?(g.rowOffset?1:0):idx%2};}
 function groupWidth(g){var rows=g.rows||2,pitch=g.pitch||18,cols=rows===1?g.count:Math.ceil(g.count/2),block=Math.max(1,Math.ceil((g.per||g.count)/rows));return pitch*(cols-1)+9*Math.floor((cols-1)/block);}
 // Connector kinds, for the port shape and size: RJ45 jacks are taller than wide, SFP
 // cages wider than tall, QSFP cages wider still (on a wider pitch).
 function formOf(form){form=String(form||'');return /QSFP|X2|CX4|OSFP/i.test(form)?'qsfp':/Shared|or SFP/i.test(form)?'shared':/SFP/i.test(form)?'sfp':'rj45';}
 // A short faceplate label for a port name from a hardware profile (49, X1, HA, MGMT).
 function portLabel(name){var s=String(name||'').replace(/^(?:ethernet\d+\/|port|internal|uplink|lan)/i,'');return s.length>4?s.slice(-4):s.toUpperCase();}
 var FIBER_PREFIX=/^(?:te|ten|tengig\w*|tw|twe|twentyfive\w*|fo|forty\w*|hu|hundred\w*|xe|et|sfp)$/;
 function parsePort(name){
  var s=short(name),m;
  if(!s||/^(?:some|wired|wifi|unknown) interface$/i.test(s)||/^(?:po\d|port-?channel|lag|trk|bridge)/i.test(s))return {member:1,group:'other',n:0,name:s};
  if((m=s.match(/^Port (\d+)$/)))return {member:1,group:'main',n:Number(m[1]),name:s};
  var pre=((s.match(/^[A-Za-z][A-Za-z-]*/)||[''])[0]).toLowerCase(),nums=(s.slice(pre.length).match(/\d+/g)||[]).map(Number),fiber=FIBER_PREFIX.test(pre);
  if(!nums.length)return {member:1,group:'other',n:0,name:s};
  if(nums.length>=3){var member=nums[0]||1,module=nums[1],n=nums[nums.length-1];if(pre&&module>0)return {member:member,group:'up',n:n,fiber:true,name:s};return {member:member,group:'main',n:n,fiber:fiber,name:s};}
  if(nums.length===2)return nums[1]===0?{member:1,group:'mgmt',n:1,name:s}:{member:1,group:nums[0]<=1?'main':'slot'+nums[0],n:nums[1],fiber:fiber,name:s};
  return {member:1,group:/^(?:|gi|ge|eth|ethernet|port|fa|lan|g)$/.test(pre)?'main':pre,n:nums[0],fiber:fiber,name:s,single:true};
 }
 // Physical ports from an interface inventory: skips VLANs, loopbacks, tunnels,
 // aggregates, subinterfaces and named logical interfaces.
 function physicalPort(name){var s=short(name);return /^Port \d+$/.test(s)||/^(?:[A-Za-z][A-Za-z-]*)?\s?\d+(?:\/\d+){0,3}$/.test(s)&&!/^(?:vlan|vl|lo|loopback|tunnel|tu|po|lag|trk|bvi|null|ssl|modem|u|wlan|vap|sw|npu|dialer|di|bdi|irb|ae|reth)\s?\d/i.test(s);}
 var SIZES=[4,8,10,12,16,24,28,48,52];
 function sizeFor(n){for(var i=0;i<SIZES.length;i++)if(SIZES[i]>=n)return SIZES[i];return n+n%2;}
 // A device drawn as one faceplate per stack member: groups of two-row ports (odd
 // numbers on top), then a label area with the name, model and address.
 function Device(node,inventory,linkPorts,style){
  this.node=node;this.key=node.key;this.style=style;this.terms=[];this.cat=node.cat||catalogFor([node.model].concat(node.parts||[]).join(' '));
  if(style==='box'){this.w=198;this.h=72;return;}
  if(node.hw&&node.hw.members&&node.hw.members.some(function(m){return m.profile;})){this.fromProfile(node.hw);this.stencilPlate(node);return;}
  var cat=this.cat,members=new Map();
  function memberOf(k){if(!members.has(k))members.set(k,{n:k,groups:new Map(),other:[]});return members.get(k);}
  var parsed=(inventory||[]).filter(physicalPort).concat(linkPorts||[]).map(parsePort);
  if(!parsed.some(function(p){return p.group==='main';})){var counts={};parsed.forEach(function(p){if(p.group!=='other'&&p.group!=='up')counts[p.group]=(counts[p.group]||0)+1;});var best=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];if(best){this.promote=best;parsed.forEach(function(p){if(p.group===best)p.group='main';});}}
  if(!parsed.some(function(p){return p.group!=='other';}))memberOf(1);
  // Without a catalog entry, 25-28 or 49-52 ports on a 24- or 48-port board are the
  // uplink (SFP) ports, as on most access switches.
  var top=0;parsed.forEach(function(p){if(p.group==='main'&&!p.single)top=Math.max(top,p.n);});
  if(!cat){if(top>48&&top<=52)cat=this.cat={main:48,up:4};else if(top>24&&top<=28)cat=this.cat={main:24,up:4};}
  // A family named without its part number: the board size from the highest port.
  else if(cat.family){var fm=top>48?48:top>24?24:top>12?12:top?sizeFor(top):48;cat=this.cat=Object.assign({},cat,{main:fm,up:fm===12?2:cat.up});}
  var overflow=false,moduleUp=false;
  var zero={};parsed.forEach(function(p){if(p.single&&p.n===0)zero[p.member+'|'+p.group]=true;});
  parsed.forEach(function(p){var mem=memberOf(p.member);if(p.group==='other'){if(p.name&&mem.other.indexOf(p.name)<0)mem.other.push(p.name);return;}
   var n=p.n+(zero[p.member+'|'+p.group]?1:0);if(p.group==='main'&&cat&&n>cat.main&&cat.up){p.group='up';n-=cat.main;overflow=true;}else if(p.group==='up')moduleUp=true;
   var g=mem.groups.get(p.group)||{name:p.group,max:0,fiber:p.group==='up'||!!(cat&&cat.fiber&&p.group==='main'),zero:!!zero[p.member+'|'+p.group]};g.max=Math.max(g.max,n);if(p.fiber&&p.group!=='main')g.fiber=true;mem.groups.set(p.group,g);});
  var self=this,x=0;this.plates=[];
  Array.from(members.values()).sort(function(a,b){return a.n-b.n;}).slice(0,8).forEach(function(mem,i){
   var main=mem.groups.get('main')||{name:'main',max:0,fiber:!!(cat&&cat.fiber)};main.count=cat&&cat.main?Math.max(cat.main,main.max):main.max?sizeFor(main.max):mem.groups.size>1||mem.other.length?0:8;mem.groups.set('main',main);
   if(cat&&cat.up){var up=mem.groups.get('up')||{name:'up',max:0,fiber:true};up.count=Math.max(cat.up,up.max);mem.groups.set('up',up);}
   // Uplinks continue the port numbers (49-52 on a 48-port board) unless the device
   // names them on a network module (Gi1/1/1-4).
   var upg=mem.groups.get('up');if(upg&&cat)upg.base=overflow||!moduleUp&&!cat.mod?cat.main:0;
   var order=(cat&&cat.upFirst?['up','main']:['main','up']).concat(Array.from(mem.groups.keys()).filter(function(k){return k!=='main'&&k!=='up';}).sort());
   var gx=81,col=0,groups=[];
   function place(g){g.rows=g.name==='main'&&cat&&cat.rows||2;g.mid=g.rows===1;g.per=g.name==='main'?(cat&&cat.per)||(g.count>=24?12:g.count):g.count;g.x=gx;g.col=col;col+=Math.ceil(g.count/(g.rows===1?1:2))+1;gx+=groupWidth(g)+27;groups.push(g);}
   order.forEach(function(k){var g=mem.groups.get(k);if(!g)return;if(g.count==null)g.count=g.max+g.max%2;if(!g.count)return;place(g);});
   if(mem.other.length)place({name:'other',count:mem.other.length,names:mem.other,fiber:false});
   var w=up9(gx-27+9+18);
   self.plates.push({member:mem.n,x:x,w:w,groups:groups,first:i===0});x+=w+27;});
  this.w=x-27;this.plateH=72;this.h=HEAD+72+FOOT;this.stencilPlate(node);
 }
 // Faceplates from verified hardware profiles (hardware.js): each bank keeps its connector,
 // rows, order and side, so ports sit where they are on the device.
 Device.prototype.fromProfile=function(hw){
  var self=this,x=0;this.plates=[];this.hw=hw;
  // A modular chassis (hw.chassis) draws each module as its own card in slot order, the
  // chassis icon on the first only (owner request: real modules, not a blank faceplate).
  var card=!!(hw.chassis||hw.card);hw.members.filter(function(m){return m.profile;}).slice(0,hw.chassis?16:12).forEach(function(mem,i){
   var gx=card?(hw.grid?18:36):81,col=0,groups=[],banks=mem.profile.banks.filter(function(b){return !b.mirror;}),front=banks.filter(function(b){return b.side!=='rear';}),rear=banks.filter(function(b){return b.side==='rear';});
   front.concat(rear).forEach(function(b){var bi=mem.profile.banks.indexOf(b),f=formOf(b.displayForm||b.form),rows=b.rows||2,g={name:'b'+bi,bank:bi,count:b.names.length,rows:rows,rowOffset:b.rowOffset||0,names:b.names,labels:b.names.map(portLabel),form:f,fiber:f==='sfp'||f==='qsfp',pitch:f==='qsfp'?27:18,per:rows===2&&b.names.length>=24?12:b.names.length,rear:b.side==='rear',title:b.label};
    g.x=gx;g.col=col;col+=Math.ceil(g.count/rows)+1;gx+=groupWidth(g)+27;groups.push(g);});
   var w=up9(gx-27+9+18);
   self.plates.push({member:mem.id,x:x,y:0,w:w,groups:groups,first:i===0,title:mem.profile.title,model:mem.model||'',slot:!!hw.chassis,card:card,empty:!!(mem.empty||mem.profile.empty),row:mem.row||0,col:mem.col||0});x+=w+(hw.chassis?9:27);});
  this.w=x-(hw.chassis?9:27);this.plateH=72;this.h=HEAD+72+FOOT;
  // A chassis with a known front panel is built as it is in the rack (owner request): its module cards in
  // the slot grid 9 px apart inside the chassis frame, all one width, ports centred on each card.
  // A stack is the same with one column: its members 9 px apart, one under the next, no chassis frame.
  if(hw.grid){var P=hw.chassis?9:0,cw=up9(Math.max.apply(null,this.plates.map(function(p){return p.w;}).concat([hw.chassis?270:0]))),rows=hw.grid.rows,cols=hw.grid.cols;
   this.plates.forEach(function(pl){var gs=pl.groups,last=gs[gs.length-1],used=gs.length?last.x+groupWidth(last)-gs[0].x:0,shift=card&&gs.length?snap((cw-used)/2)-gs[0].x:0;gs.forEach(function(g){g.x+=shift;});pl.w=cw;pl.x=P+pl.col*(cw+G);pl.y=P+pl.row*(72+G);});
   this.grid={rows:rows,cols:cols,cw:cw,pad:P,chassis:!!hw.chassis};this.w=2*P+cols*cw+(cols-1)*G;this.plateH=2*P+rows*72+(rows-1)*G;this.h=HEAD+this.plateH+FOOT;}
 };
 Device.prototype.stencilPlate=function(node){
  var x;
  // A vendor stencil replaces the drawn faceplate: its artwork per stack member, with
  // ports at the stencil's connection points when they fit the port counts.
  var st=node.stencil;if(st&&st.art){var a=st.art,ratio=a.w/a.h,iw=ratio>2.5?720:Math.min(162,a.w),ih=iw/ratio;if(ih>126){ih=126;iw=ih*ratio;}
   var gs=this.plates[0].groups;if(this.hw){var big=gs.filter(function(g){return !g.rear;}).sort(function(a,b){return b.count-a.count;});if(big[0])big[0].role='main';var upr=big.find(function(g){return g!==big[0]&&g.fiber;});if(upr)upr.role='up';}
   var main=gs.find(function(g){return (g.role||g.name)==='main';}),upg=gs.find(function(g){return (g.role||g.name)==='up';});
   this.stencil=st;this.img={w:Math.round(iw*100)/100,h:Math.round(ih*100)/100};this.plateH=Math.max(54,up9(ih+G));this.h=HEAD+this.plateH+FOOT;this.imgTop=HEAD+(this.plateH-this.img.h)/2;this.map=st.layout?st.layout(main?main.count:0,upg?upg.count:0):null;
   // Known port groups: each group on its own run of the stencil's ports (front groups only).
   if(this.hw&&st.banks){var bm=st.banks(gs.map(function(g){return g.rear?0:g.count;}));if(bm){this.bankMap={};gs.forEach(function(g,i){if(bm[i])this.bankMap[g.name]=bm[i];},this);}}
   // Otherwise the device's real port layout is fitted onto the stencil's ports.
   if(this.hw&&!this.bankMap&&st.edges){var cand=st.edges();if(cand&&cand.length>=3)this.fitMap=fitPorts(gs,cand);}
   x=0;this.plates.forEach(function(pl){pl.stencil=true;pl.x=x;pl.w=up9(iw+G*2);x+=pl.w+27;});this.w=x-27;this.positions={};}
  this.room();
 }
 // Name above the faceplate, model and address below it (owner request: details stacked
 // with the device, not in a card beside it): the device is at least as wide as that text.
 function textW(t,size,bold){return String(t||'').length*size*(bold?0.6:0.54);}
 function footOf(dev){var n=dev.node,g=dev.hw&&dev.hw.grid;return [(n.model||(dev.stencil&&dev.stencil.master&&dev.stencil.master.name)||(dev.hw&&dev.hw.model)||ROLE_LABEL[n.role]||'')+(g&&g.title&&String(n.model||dev.hw.model||'').indexOf(g.title)<0?(g.stack?'  \u00b7  ':' ')+g.title:''),(n.ips||[])[0]||''].filter(Boolean).join('  |  ');}
 Device.prototype.room=function(){var need=up9(Math.max(textW(clip(this.node.name,40),11,true),textW(footOf(this),9.5))+G*2);if(this.w>=need)return;var last=this.plates[this.plates.length-1];last.w+=need-this.w;this.w=need;};
 // The port slot for a port name: plate, column center and row (0 top, 1 bottom).
 Device.prototype.slot=function(name){
  if(this.hw){var at=this.hw.portOf(name),pl=at&&(this.plates.find(function(x){return String(x.member)===String(at.member);})||this.plates[0]),hg=pl&&pl.groups.find(function(x){return x.bank===at.bank;});
   if(hg&&at.index>=0)return this.place(pl,hg,at.index,name);}
  var p=parsePort(name),cat=this.cat,plate=this.plates.find(function(pl){return pl.member===p.member;})||this.plates[0];
  if(this.promote&&p.group===this.promote)p.group='main';
  if(p.group==='main'&&cat&&cat.up&&p.n>cat.main){p.group='up';p.n-=cat.main;}
  var g=plate.groups.find(function(x){return x.name===p.group;}),idx;
  if(!g||p.group==='other'){g=plate.groups.find(function(x){return x.name==='other';});if(!g){var last=plate.groups[plate.groups.length-1];g={name:'other',count:0,rows:2,col:plate.groups.reduce(function(c,x){return Math.max(c,x.col+Math.ceil(x.count/2)+1);},0),x:last?last.x+groupWidth(last)+27:81,names:[]};plate.groups.push(g);}
   idx=g.names.indexOf(p.name);if(idx<0){g.names.push(p.name);g.count=g.names.length;idx=g.names.length-1;}}
  else{idx=p.n+(g.zero?1:0)-1;idx=Math.max(0,idx)%Math.max(2,g.count+g.count%2);}
  return this.place(plate,g,idx,p.name);
 };
 // Port anchors by port name (NetworkDiagramStudio hardware shapes): matched on the short port name,
 // letter case and spaces ignored.
 var anchorIndex=typeof WeakMap==='function'?new WeakMap():null;
 function anchorKey(n){return short(n).toLowerCase().replace(/\s+/g,'');}
 function anchorAt(map,name){if(!map||!name)return null;var idx=anchorIndex&&anchorIndex.get(map);if(!idx){idx={};Object.keys(map).forEach(function(k){idx[anchorKey(k)]=map[k];});if(anchorIndex)anchorIndex.set(map,idx);}return idx[anchorKey(name)]||null;}
 Device.prototype.place=function(plate,g,idx,portName){
  var p={name:portName},pp=portPos(g,idx),col=g.col+Math.floor(idx/(g.rows===1?1:2)),row=pp.row,key=plate.member+'|'+g.name+'|'+idx;
  if(plate.stencil){var list=this.bankMap?this.bankMap[g.name]:this.map&&((g.role||g.name)==='main'?this.map.main:(g.role||g.name)==='up'?this.map.up:null),own=this.stencil&&this.stencil.points&&this.stencil.points[g.name+'|'+idx],an=!own&&this.stencil&&anchorAt(this.stencil.anchors,portName||g.names&&g.names[idx]),pos=own?{fx:own[0],fy:own[1],row:own[1]>0.5?1:0}:an?{fx:an[0],fy:an[1],row:an[1]>0.5?1:0}:!this.bankMap&&this.fitMap?this.fitMap[g.name+'|'+idx]:list&&list[idx],img=this.img,dx,py;
   // Port points placed by hand on this stencil (by port group and index, for every member) come first.
   if(pos){dx=plate.x+G+pos.fx*img.w;py=this.imgTop+pos.fy*img.h;row=pos.row;}
   // A known group the stencil has no ports for: where it sits on the drawn faceplate,
   // across the middle 80% of the artwork.
   else if(this.hw){var gs2=plate.groups.filter(function(x){return !x.rear&&x.count;}),first=gs2[0],last=gs2[gs2.length-1],x0=first?first.x:81,x1=last?last.x+groupWidth(last):x0+1;dx=plate.x+G+img.w*(0.1+0.8*(pp.dx-x0)/Math.max(1,x1-x0));py=row?this.imgTop+img.h:this.imgTop;}
   else{var cols=plate.groups.reduce(function(c,x){return Math.max(c,x.col+Math.ceil(x.count/2));},1);dx=plate.x+G+(col+0.5)/cols*img.w;py=row?this.imgTop+img.h:this.imgTop;}
   var ex=dx;dx=snap(dx);this.positions[key]={x:ex,y:py,exact:!!pos&&pos.exact!==false};
   return {key:key,plate:plate,dx:dx,ex:ex,py:py,row:row,fiber:g.fiber,form:g.form||(g.fiber?'sfp':''),number:'',name:p.name};}
  // In a chassis grid a link leaves toward the nearer edge of the chassis (top half up, bottom half down).
  var side=this.grid?((plate.row||0)+(row?0.5:0)<this.grid.rows/2?'top':'bottom'):null;
  return {key:key,plate:plate,dx:plate.x+pp.dx,row:row,side:side,fiber:g.fiber,form:g.form||(g.fiber?'sfp':''),py:HEAD+(plate.y||0)+(g.mid?36:row?51:21),number:g.labels?g.labels[idx]:g.name==='other'?'':String((g.base||0)+(g.zero?idx:idx+1)),name:p.name};
 };
 Device.prototype.fit=function(){if(this.style!=='box'){if(this.plates)this.fitHeader();return;}var top=this.terms.filter(function(t){return t.side==='top';}).length,bottom=this.terms.length-top;this.w=Math.max(198,up9(36+18*Math.max(top,bottom)));};
 function drawPlate(page,dev,used,fills){
  var node=dev.node,x0=dev.x,y=dev.y,y0=y;
  if(dev.stencil){dev.plates.forEach(function(pl){var x=x0+pl.x;
    page.rect(x,y+HEAD,pl.w,dev.plateH,{fill:'#f4f7fb',stroke:'#c9d3df',width:1,radius:4});page.image(x+G,y+dev.imgTop,dev.img.w,dev.img.h,{art:dev.stencil.art,master:dev.stencil.master});});
   drawHeader(page,dev);
   // Linked ports: a ring in the link color on the stencil.
   // A port with a module (owner request: modules fill the ports in use) shows the module in its cage,
   // sized to the port pitch on the stencil; other linked ports keep the ring.
   var pitch=1e9;if(dev.mods&&dev.mods.size){var pts=Object.keys(dev.positions).map(function(k){return dev.positions[k];});pts.forEach(function(a){pts.forEach(function(b){var ex=Math.abs(b.x-a.x);if(a!==b&&Math.abs(b.y-a.y)<4&&ex>3)pitch=Math.min(pitch,ex);});});}
   var mw=Math.max(10,Math.min(26,pitch<1e9?pitch*0.82:16)),mh=Math.max(7,mw*0.6);
   if(used)used.forEach(function(color,key){var p=dev.positions[key];if(!p)return;var md=dev.mods&&dev.mods.get(key);
    if(md){page.rect(x0+p.x-mw/2-1.5,y+p.y-mh/2-1.5,mw+3,mh+3,{fill:'#ffffff',stroke:color,width:2,radius:2,pkey:dev.portKeys&&dev.portKeys[key]});drawModule(page,md.id,x0+p.x-mw/2,y+p.y-mh/2,mw,mh,color,md.art);return;}
    page.rect(x0+p.x-6,y+p.y-6,12,12,{fill:'none',stroke:color,width:2,radius:6,pkey:dev.portKeys&&dev.portKeys[key]});});
   // Port roles on a stencil (port map pages, as in the reference drawing): a numbered square
   // over each port in the role color, sized to the port pitch; outlined only when down.
   if(fills){var all=[];fills.forEach(function(fl,key){var p=dev.positions[key];if(p)all.push({p:p,fl:fl});});
    all.forEach(function(a){var dx=1e9,dy=1e9;all.forEach(function(b){if(b===a)return;var ex=Math.abs(b.p.x-a.p.x),ey=Math.abs(b.p.y-a.p.y);if(ey<4&&ex>2)dx=Math.min(dx,ex);if(ex<4&&ey>2)dy=Math.min(dy,ey);});
     var w=Math.max(9,Math.min(24,dx<1e9?dx*0.8:14)),hh=Math.max(9,Math.min(w*0.95,dy<1e9?dy*0.7:w*0.95)),fl=a.fl,down=!fl.up;
     page.rect(x0+a.p.x-w/2,y+a.p.y-hh/2,w,hh,{fill:down?'#ffffff':fl.fill,stroke:down?(fl.fill==='#f4f5f7'?'#b6bfcc':fl.fill):'#3d4a5c',width:down?1.5:0.75});
     if(fl.label)page.text(x0+a.p.x-w/2,y+a.p.y-hh/2+(hh-Math.min(9,hh*0.62))/2-1,w,hh,fl.label,{size:Math.min(9,hh*0.62,w/(Math.max(2,fl.label.length)*0.62)),bold:true,color:'#1f2937'});});}
   return;}
  if(dev.grid&&dev.grid.chassis)page.rect(x0,y0+HEAD,dev.w,dev.plateH,{fill:'#c3ccd8',stroke:'#3d5a80',width:1.5,radius:5});
  dev.plates.forEach(function(pl){var x=x0+pl.x,y=y0+HEAD+(pl.y||0);
   page.rect(x,y,pl.w,72,{fill:pl.empty?'#eef2f7':'#dfe7f3',stroke:pl.empty?'#9aa9bd':'#3d5a80',width:pl.empty?1:1.5,radius:4,dash:!!pl.empty});if(!pl.card)page.rect(x+10,y+10,44,52,{fill:ROLE_FILL[node.role]||'#4f81bd',stroke:'none'});
   // A chassis module card carries its slot name in a ring at the left, as on the chassis.
   // A stack member's number and model inside its role block, beside its ports (owner request), leaving
   // the face clear for the lines.
   if(dev.grid&&!pl.card){page.text(x+11,y+22,42,10,'Member '+pl.member,{size:7,bold:true,color:'#ffffff'});if(pl.model)page.text(x+11,y+34,42,10,clip(pl.model,10),{size:7,color:'#ffffff'});}
   if(pl.card&&dev.grid){var cl=String(pl.member)+(pl.model?'  \u00b7  '+pl.model:pl.empty?'  \u00b7  empty':'');page.text(x+5,y+2,pl.w-10,10,cl,{size:7.5,bold:true,align:'left',color:'#1b3a4b'});}
   else if(pl.card){page.rect(x+5,y+28,26,16,{fill:'#ffffff',stroke:'#3d5a80',width:0.75,radius:8});page.text(x+5,y+30,26,12,String(pl.member),{size:String(pl.member).length>2?7:8.5,bold:true,align:'center',color:'#1b3a4b'});}
   pl.groups.forEach(function(g){for(var i=0;i<g.count;i++){var pp=portPos(g,i),row=pp.row,cx=x+pp.dx,cy=y+(g.mid?36:row?51:21),key=pl.member+'|'+g.name+'|'+i,u=used&&used.get(key),label=g.labels?g.labels[i]:g.name==='other'?'':String((g.base||0)+(g.zero?i:i+1));
    var fl=fills&&fills.get(key),md=u&&!fl&&dev.mods&&dev.mods.get(key);drawPort(page,g.form||(g.fiber?'sfp':'rj45'),cx,cy,row,u,fl,md);
    if(label&&!md)page.text(cx-9,cy-4.5,18,9,label,{size:label.length>2?5:6.5,bold:!!(fl&&fl.up),color:(g.form==='sfp'||g.form==='qsfp'||!g.form&&g.fiber)&&!u&&!fl?'#ffffff':'#1f2937'});}});
  });
  drawHeader(page,dev);
 }
 // The widest span along one edge of a device (from lo to hi) that no link stub crosses,
 // preferring the leftmost span the text fits in.
 function gapsOf(dev,side,lo,hi){var xs=(dev.terms||[]).filter(function(t){return t.side===side&&t.slot&&!(t.conn&&t.conn.internal);}).map(function(t){return t.slot.lane!=null?t.slot.lane:t.slot.ex!=null?t.slot.ex:t.slot.dx;}).filter(function(x){return x>lo-12&&x<hi+12;}).sort(function(a,b){return a-b;}),gaps=[],from=lo;
  xs.forEach(function(x){if(x-11>from)gaps.push([from,x-11]);from=Math.max(from,x+11);});if(hi>from)gaps.push([from,hi]);return gaps;}
 function freeSpan(dev,side,lo,hi,want){var gaps=gapsOf(dev,side,lo,hi);return gaps.find(function(g){return g[1]-g[0]>=want;})||gaps.slice().sort(function(a,b){return (b[1]-b[0])-(a[1]-a[0]);})[0]||[lo,hi];}
 function widest(dev,side){return gapsOf(dev,side,4,dev.w-4).reduce(function(m,g){return Math.max(m,g[1]-g[0]);},0);}
 // Before layout: the name goes on the edge (top or bottom) with room for it between the link
 // stubs and the model and address on the other; the device widens only if neither fits.
 Device.prototype.fitHeader=function(){var name=textW(clip(this.node.name,40),11,true),foot=textW(footOf(this),9.5),self=this;
  function fits(){var t=widest(self,'top'),b=widest(self,'bottom');if(name<=t&&foot<=b)return 'top';if(name<=b&&foot<=t)return 'bottom';return null;}
  // A stack or chassis keeps its members' widths (its side lanes are planned on them).
  if(this.grid){this.nameSide=fits()||'top';return;}
  for(var k=0;k<60;k++){var side=fits();if(side){this.nameSide=side;return;}var last=this.plates[this.plates.length-1];last.w+=G;this.w+=G;}this.nameSide='top';};
 function drawHeader(page,dev){if(dev.noLabel)return;var node=dev.node,x0=dev.x,y=dev.y,name=clip(node.name,40),foot=footOf(dev),up=dev.nameSide!=='bottom',topY=y+1,botY=y+HEAD+dev.plateH+2;
  var a=freeSpan(dev,up?'top':'bottom',4,dev.w-4,textW(name,11,true)),aw=a[1]-a[0];page.text(x0+a[0],up?topY:botY,aw,15,clip(name,Math.max(4,Math.floor(aw/6.6))),{size:11,bold:true,align:'left',color:'#1b3a4b'});
  dev.plates.forEach(function(pl,i){var t=dev.grid?(i?'':foot):pl.slot?(i?pl.model:[node.model||(dev.hw&&dev.hw.model)||'',pl.model].filter(Boolean).join('  ·  ')+((node.ips||[])[0]?'  |  '+node.ips[0]:'')):i?'Member '+pl.member:foot;if(!t)return;var side=up?'bottom':'top',tw=textW(t,9.5),b=dev.grid?freeSpan(dev,side,4,dev.w-4,tw):freeSpan(dev,side,pl.x+4,pl.x+pl.w-4,tw),bw=b[1]-b[0];
   // A stack's or chassis' model line with no room between its links goes beside the name instead of being cut short.
   if(dev.grid&&bw<tw&&a[1]-a[0]>=Math.min(aw,textW(name,11,true))+12+tw){page.text(x0+a[0]+textW(name,11,true)+12,(up?topY:botY)+2,tw+4,14,t,{size:9.5,align:'left',color:'#4a5568'});return;}
   page.text(x0+b[0],up?botY:topY+1,bw,14,clip(t,Math.max(4,Math.floor(bw/5.1))),{size:9.5,align:'left',color:'#4a5568'});});}
 // Port shapes in real proportions: an RJ45 jack (11.7 x 13.5 mm) with its latch notch on
 // the outer edge (top row up, bottom row down), an SFP cage (13.7 x 8.6 mm) and a QSFP cage
 // (18.4 x 8.5 mm), at the 18 px column pitch of a 14.5 mm port spacing.
 function drawPort(page,form,cx,cy,row,u,fl,md){if(md&&md.form&&form!=='sfp'&&form!=='qsfp')form=md.form;var line=u||(fl?fl.stroke||'#3d4a5c':'#7a8ca8'),w=u?1.6:fl?1:0.75,fill=fl?fl.up?fl.fill:'#ffffff':null;
  if(form==='sfp'||form==='qsfp'){var cw=form==='qsfp'?22:15,ch=10;if(md){page.rect(cx-cw/2,cy-ch/2,cw,ch,{fill:'#ffffff',stroke:u,width:1.6});drawModule(page,md.id,cx-cw/2+1.8,cy-ch/2+1.8,cw-3.6,ch-3.6,u,md.art);return;}page.rect(cx-cw/2,cy-ch/2,cw,ch,{fill:fill||(u?'#ffffff':'#5b6b82'),stroke:fl?line:u?u:'#3d4a5c',width:fl&&!fl.up?1.6:w});return;}
  page.rect(cx-6.5,cy-7.5,13,15,{fill:fill||'#ffffff',stroke:fl&&!fl.up?fl.fill==='#f4f5f7'?'#b6bfcc':fl.fill:line,width:fl&&!fl.up?1.6:w});if(form==='shared')page.rect(cx-6.5,cy-7.5,4,4,{fill:'#5b6b82',stroke:'none'});
  page.rect(cx-2.5,row?cy+5.5:cy-7.5,5,2,{fill:u||'#9aa9c0',stroke:'none'});}
 function drawBox(page,dev){var n=dev.node,x=dev.x,y=dev.y,extra=[(n.attached||[]).filter(function(a){return a.role==='ap';}).length,(n.attached||[]).filter(function(a){return a.role!=='ap';}).length];
  page.rect(x,y,dev.w,dev.h,{fill:'#ffffff',stroke:ROLE_FILL[n.role]||'#4f81bd',width:1.5,radius:6});page.rect(x,y,6,dev.h,{fill:ROLE_FILL[n.role]||'#4f81bd',stroke:'none'});
  page.text(x+14,y+8,dev.w-20,dev.h-12,clip(n.name,34)+'\n'+clip([n.model||ROLE_LABEL[n.role],(n.ips||[])[0]].filter(Boolean).join(' · '),40)+(extra[0]||extra[1]?'\n'+[extra[0]?extra[0]+' AP'+(extra[0]>1?'s':''):'',extra[1]?extra[1]+' device'+(extra[1]>1?'s':''):''].filter(Boolean).join(' · '):''),{size:10,align:'left',firstBold:true,lineHeight:16});}

 // ---------- pages ----------
 function Page(title){this.title=title;this.shapes=[];this.w=0;this.h=0;this.groupId=0;this.cur=null;}
 Page.prototype.push=function(s){if(this.cur){s.g=this.cur.id;s.node=this.cur.node;s.kind=this.cur.kind;}this.shapes.push(s);return this;};
 Page.prototype.rect=function(x,y,w,h,o){this.grow(x+w,y+h);return this.push(Object.assign({type:'rect',x:x,y:y,w:w,h:h},o||{}));};
 Page.prototype.text=function(x,y,w,h,text,o){this.grow(x+w,y+h);return this.push(Object.assign({type:'text',x:x,y:y,w:w,h:h,text:String(text)},o||{}));};
 Page.prototype.image=function(x,y,w,h,o){this.grow(x+w,y+h);return this.push(Object.assign({type:'image',x:x,y:y,w:w,h:h},o||{}));};
 Page.prototype.line=function(points,o){var self=this;points.forEach(function(p){self.grow(p[0],p[1]);});return this.push(Object.assign({type:'line',points:points},o||{}));};
 Page.prototype.grow=function(x,y){this.w=Math.max(this.w,x+MARGIN);this.h=Math.max(this.h,y+MARGIN);};
 Page.prototype.begin=function(node,kind){this.cur={id:++this.groupId,node:node,kind:kind||''};};
 Page.prototype.end=function(){this.cur=null;};
 // The connection types down a column at the left, as in the reference drawing.
 var LEGEND_W=198;
 function legendColumn(page,x,y,types,roles,view,modules){
  page.text(x,y,LEGEND_W-36,14,'CONNECTION TYPES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});y+=30;
  types.forEach(function(t){var k=kindStyle(t,view);page.line([[x,y+7],[x+30,y+7]],{color:k.color,width:k.width,dash:k.dash,lkind:t});page.text(x+40,y,LEGEND_W-80,16,k.label,{size:10,align:'left',lkind:t});y+=27;});
  if(modules&&modules.length){y+=12;page.text(x,y,LEGEND_W-36,14,'PORT MODULES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});y+=26;
   modules.forEach(function(m){page.rect(x,y,34,22,{fill:'#eef2f7',stroke:'#9aa9c0',width:1});drawModule(page,m.mod.id,x+5,y+5,24,12,m.color,m.mod.art);var lw=LEGEND_W-62,words=m.mod.label.split(' '),ln=[''];words.forEach(function(w){var t=ln[ln.length-1];if(t&&textW(t+' '+w,9.5,true)>lw)ln.push(w);else ln[ln.length-1]=t?t+' '+w:w;});ln=ln.slice(0,2);page.text(x+40,y+1,LEGEND_W-76,ln.length*13+2,ln.join('\n'),{size:9.5,bold:true,align:'left',lineHeight:13,lmod:m.mod.id});if(ln.length>1)y+=8;
    var rows=[],cur='',maxW=LEGEND_W-44;m.ports.forEach(function(pt,i){var add=(cur?' / ':'')+pt;if(cur&&textW(cur+add,8)>maxW){rows.push(cur+' /');cur=pt;}else cur+=add;});if(cur)rows.push(cur);if(rows.length>5){rows=rows.slice(0,5);rows[4]=clip(rows[4],30)+' …';}page.text(x,y+30,LEGEND_W-40,rows.length*11+2,rows.join('\n'),{size:8,align:'left',lineHeight:11,color:'#4a5568'});y+=30+rows.length*11+14;});}
  if(roles&&roles.length){y+=12;page.text(x,y,LEGEND_W-36,14,'DEVICES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});y+=30;roles.forEach(function(r){page.rect(x,y+2,24,12,{fill:ROLE_FILL[r],stroke:'none'});page.text(x+40,y,LEGEND_W-80,16,ROLE_LABEL[r],{size:10,align:'left'});y+=27;});}
  return y;
 }
 function legendRow(page,x,y,types,roles){
  types.forEach(function(t){page.line([[x,y+8],[x+34,y+8]],{color:LINK_TYPES[t].color,width:4,dash:LINK_TYPES[t].dash});page.text(x+42,y,170,16,LINK_TYPES[t].label,{size:10.5,align:'left'});x+=42+LINK_TYPES[t].label.length*5.6+24;});
  (roles||[]).forEach(function(r){page.rect(x,y+2,24,12,{fill:ROLE_FILL[r],stroke:'none'});page.text(x+30,y,110,16,ROLE_LABEL[r],{size:10.5,align:'left'});x+=30+ROLE_LABEL[r].length*5.6+22;});
  return x;
 }

 // ---------- orthogonal router ----------
 function Heap(){this.k=[];this.v=[];}
 Heap.prototype.push=function(key,val){var k=this.k,v=this.v,i=k.length;k.push(key);v.push(val);while(i>0){var p=(i-1)>>1;if(k[p]<=key)break;k[i]=k[p];v[i]=v[p];i=p;}k[i]=key;v[i]=val;};
 Heap.prototype.pop=function(){var k=this.k,v=this.v,top=v[0],lk=k.pop(),lv=v.pop(),n=k.length;if(n){var i=0;for(;;){var l=2*i+1;if(l>=n)break;var r=l+1,c=r<n&&k[r]<k[l]?r:l;if(k[c]>=lk)break;k[i]=k[c];v[i]=v[c];i=c;}k[i]=lk;v[i]=lv;}return top;};
 var DX=[1,0,-1,0],DY=[0,1,0,-1];
 function Router(w,h){this.C=Math.ceil(w/G)+1;this.R=Math.ceil(h/G)+1;var n=this.C*this.R;this.blocked=new Uint8Array(n);this.node=new Int32Array(n);this.term=new Int32Array(n);this.zone=new Int32Array(n);this.avoid=new Uint8Array(n);this.near=new Uint16Array(n);this.nearBy=new Int32Array(n);this.hdrOk={};this.free={};this.hUse=new Int32Array(n);this.vUse=new Int32Array(n);this.g=new Float64Array(n*4);this.prev=new Int32Array(n*4);this.seen=new Int32Array(n*4);this.done=new Int32Array(n*4);this.gen=0;}
 Router.prototype.at=function(x,y){var c=Math.round(x/G),r=Math.round(y/G);if(c<0||r<0||c>=this.C||r>=this.R)return -1;return r*this.C+c;};
 // Block every grid node inside the rectangle (edges included).
 Router.prototype.block=function(x,y,w,h){var c0=Math.max(0,Math.ceil(x/G)),c1=Math.min(this.C-1,Math.floor((x+w)/G)),r0=Math.max(0,Math.ceil(y/G)),r1=Math.min(this.R-1,Math.floor((y+h)/G));for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++)this.blocked[r*this.C+c]=1;};
 // A zone (an endpoint corridor) costs extra for routes that do not belong to it.
 Router.prototype.shun=function(x,y,w,h,kind){var c0=Math.max(0,Math.ceil(x/G)),c1=Math.min(this.C-1,Math.floor((x+w)/G)),r0=Math.max(0,Math.ceil(y/G)),r1=Math.min(this.R-1,Math.floor((y+h)/G));for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++){var v=r*this.C+c;if(this.avoid[v]!==1)this.avoid[v]=kind||1;}};
 Router.prototype.reserve=function(x,y,w,h,owner){var c0=Math.max(0,Math.ceil(x/G)),c1=Math.min(this.C-1,Math.floor((x+w)/G)),r0=Math.max(0,Math.ceil(y/G)),r1=Math.min(this.R-1,Math.floor((y+h)/G));for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++)this.zone[r*this.C+c]=owner;};
 Router.prototype.route=function(net,s,sDir,t,tDir,relaxed,owner){
  var C=this.C,R=this.R,g=this.g,prev=this.prev,seen=this.seen,done=this.done,gen=++this.gen,heap=new Heap(),tc=t%C,tr=(t/C)|0;
  function h(v){return HW*(Math.abs(v%C-tc)+Math.abs(((v/C)|0)-tr));}
  var st=s*4+sDir;g[st]=0;seen[st]=gen;prev[st]=-1;heap.push(h(s),st);var limit=C*R*4;
  while(heap.k.length&&limit-->0){var cur=heap.pop();if(done[cur]===gen)continue;done[cur]=gen;var v=cur>>2,d=cur&3,gc=g[cur];
   if(v===t){var path=[],x=cur;while(x>=0){var nv=x>>2;if(path[path.length-1]!==nv)path.push(nv);x=prev[x];}path.reverse();return path;}
   var occ=this.node[v]&&this.node[v]!==net&&v!==s,vc=v%C,vr=(v/C)|0;
   for(var nd=0;nd<4;nd++){if(nd===((d+2)&3))continue;var turn=nd!==d;if(occ&&turn&&!relaxed)continue;
    var cx=vc+DX[nd],cy=vr+DY[nd];if(cx<0||cy<0||cx>=C||cy>=R)continue;var u=cy*C+cx;
    if(u!==t&&(this.blocked[u]||this.term[u]&&this.term[u]!==net))continue;
    var e=Math.min(u,v),usedBy=nd===0||nd===2?this.hUse[e]:this.vUse[e],cost=1;
    if(usedBy&&usedBy!==net){if(!relaxed)continue;cost+=80;}
    if(occ&&turn)cost+=40;if(this.zone[u]&&this.zone[u]!==owner)cost+=4;if(turn)cost+=BEND;if(this.avoid[u]===1||this.avoid[u]===2&&!this.hdrOk[net])cost+=200;if(this.near[u])cost+=NEAR*this.near[u];if(this.node[u]&&this.node[u]!==net)cost+=this.free[net]||this.free[this.node[u]]?CROSS:this.cross||CROSS;if(u===t&&nd!==tDir)cost+=BEND;
    var ns=u*4+nd,ng=gc+cost;if(seen[ns]!==gen||ng<g[ns]){seen[ns]=gen;g[ns]=ng;prev[ns]=cur;heap.push(ng+h(u),ns);}}}
  return null;
 };
 // Occupancy rebuilt from every committed path but one (for re-routing that one).
 Router.prototype.rebuild=function(paths,skip){this.node.fill(0);this.near.fill(0);this.nearBy.fill(0);this.hUse.fill(0);this.vUse.fill(0);var self=this;paths.forEach(function(p){if(p.net!==skip&&p.path)self.commit(p.net,p.path);});};
 // Crossings (cells of another net) and bends of a path, for comparing two routes.
 Router.prototype.score=function(net,path){var x=0,b=0,C=this.C;for(var i=1;i<path.length-1;i++){if(this.node[path[i]]&&this.node[path[i]]!==net&&!this.free[net]&&!this.free[this.node[path[i]]])x++;var d1=path[i]-path[i-1],d2=path[i+1]-path[i];if(d1!==d2)b++;}return {cross:x,bends:b};};
 Router.prototype.commit=function(net,path){var C=this.C,R=this.R,RN=NEAR_R,s0=0;for(var j=1;j<=path.length;j++){if(j<path.length&&j>=2&&path[j]-path[j-1]===path[j-1]-path[j-2])continue;var e=path[j-1],c0=Math.max(0,Math.min(path[s0]%C,e%C)-RN),c1=Math.min(C-1,Math.max(path[s0]%C,e%C)+RN),r0=Math.max(0,Math.min((path[s0]/C)|0,(e/C)|0)-RN),r1=Math.min(R-1,Math.max((path[s0]/C)|0,(e/C)|0)+RN);
  for(var rr=r0;rr<=r1;rr++)for(var cc=c0;cc<=c1;cc++){var w=rr*C+cc;if(this.nearBy[w]!==net){this.nearBy[w]=net;this.near[w]++;}}s0=j-1;}for(var i=0;i<path.length;i++){var v=path[i];if(!this.node[v])this.node[v]=net;if(i){var u=path[i-1],e=Math.min(u,v);if(Math.abs(u-v)===1)this.hUse[e]=this.hUse[e]||net;else this.vUse[e]=this.vUse[e]||net;}}};
 function compress(points){var out=[];points.forEach(function(p){if(out.length&&out[out.length-1][0]===p[0]&&out[out.length-1][1]===p[1])return;if(out.length>=2){var a=out[out.length-2],b=out[out.length-1];if((a[0]===b[0]&&b[0]===p[0])||(a[1]===b[1]&&b[1]===p[1])){out[out.length-1]=p;return;}}out.push(p);});return out;}

 // ---------- scope: which devices a diagram shows ----------
 function tree(layout){
  var shown=layout.nodes,byKey=new Map(shown.map(function(n){return [n.key,n];})),children=new Map(),parentOf=new Map(),adj=new Map();
  layout.edges.forEach(function(e){(adj.get(e.a)||adj.set(e.a,[]).get(e.a)).push(e.b);(adj.get(e.b)||adj.set(e.b,[]).get(e.b)).push(e.a);});
  shown.slice().sort(function(a,b){return a.y-b.y||a.x-b.x;}).forEach(function(n){var ups=(adj.get(n.key)||[]).map(function(k){return byKey.get(k);}).filter(function(m){return m&&m.y<n.y-1;}).sort(function(a,b){return b.y-a.y||a.x-b.x;});if(ups[0]){parentOf.set(n.key,ups[0].key);(children.get(ups[0].key)||children.set(ups[0].key,[]).get(ups[0].key)).push(n.key);}});
  children.forEach(function(list){list.sort(function(a,b){return byKey.get(a).x-byKey.get(b).x;});});
  return {byKey:byKey,children:children,parentOf:parentOf,adj:adj};
 }
 // options: focus, scope ('downstream' | 'neighbors' | 'site'), depth (number or 0 for
 // all), upstream (show the device above the focus), hidden (Set of keys to leave out).
 function scope(layout,o){
  var t=tree(layout),hidden=o.hidden||new Set(),rows=[],depthLimit=o.depth>0?o.depth:Infinity;
  function ok(k){return t.byKey.has(k)&&!hidden.has(k);}
  var out=scopeRows();
  // Devices added by hand join the row of their tier (or a new row in tier order).
  (o.added?Array.from(o.added):[]).forEach(function(k){if(!ok(k)||out.rows.some(function(r){return r.indexOf(k)>=0;}))return;var y=t.byKey.get(k).y,at=out.rows.findIndex(function(r){return t.byKey.get(r[0]).y===y;});
   if(at>=0)out.rows[at].push(k);else{var before=out.rows.findIndex(function(r){return t.byKey.get(r[0]).y>y;});if(before<0)out.rows.push([k]);else out.rows.splice(before,0,[k]);}});
  return out;
  function scopeRows(){
  if(o.scope==='site'||!o.focus||!t.byKey.has(o.focus)){var ys=Array.from(new Set(layout.nodes.map(function(n){return n.y;}))).sort(function(a,b){return a-b;});ys.forEach(function(y){var row=layout.nodes.filter(function(n){return n.y===y&&ok(n.key)&&!n.isolated;}).sort(function(a,b){return a.x-b.x;}).map(function(n){return n.key;});if(row.length)rows.push(row);});
   var iso=layout.nodes.filter(function(n){return n.isolated&&ok(n.key);}).map(function(n){return n.key;});if(iso.length&&o.scope==='site')rows.push(iso);return {rows:rows,tree:t};}
  var focus=o.focus,parent=t.parentOf.get(focus),context=new Set();
  if(o.upstream!==false&&parent&&ok(parent)){rows.push([parent]);context.add(parent);}
  rows.push([focus]);
  if(o.scope==='neighbors'){var ups=[],downs=[];(t.adj.get(focus)||[]).forEach(function(k){if(!ok(k)||k===parent)return;var n=t.byKey.get(k),f=t.byKey.get(focus);(n.y<f.y-1?ups:downs).push(k);});
   if(o.upstream!==false&&ups.length){if(rows.length>1)rows[0]=rows[0].concat(ups);else rows.unshift(ups);ups.forEach(function(k){context.add(k);});}if(downs.length){rows.push(downs.sort(function(a,b){return t.byKey.get(a).x-t.byKey.get(b).x;}));downs.forEach(function(k){context.add(k);});}return {rows:rows,tree:t,context:context};}
  var level=[focus],d=0;while(level.length&&d<depthLimit){var next=[];level.forEach(function(k){(t.children.get(k)||[]).forEach(function(c){if(ok(c))next.push(c);});});if(next.length)rows.push(next);level=next;d++;}
  return {rows:rows,tree:t,context:context};
  }
 }

 // ---------- render ----------
 // input: {layout, links, vlans: Map, ports: Map key -> [port names]}
 // view: {title, rows (from scope), style 'plate' | 'box', aps, others, vlansFor, maxRow}
 function epKey(d,a){return a.node.group?'group:'+d.key:(a.node.key||a.node.name||'');}
 function render(input,view){EP_W=126;EP_PITCH=153;EP_H=view.tallAps?108:54;AP_SCALE=1;
  var layout=input.layout,all=new Map(layout.all.map(function(n){return [n.key,n];})),shownByKey=new Map(layout.nodes.map(function(n){return [n.key,n];})),style=view.style==='box'?'box':'plate';
  var page=new Page(view.title||'Network diagram'),devices=new Map(),rowsOut=[],used=new Set();
  var maxRow=view.maxRow||(style==='box'?10:3);
  view.rows.forEach(function(row){for(var i=0;i<row.length;i+=maxRow)rowsOut.push(row.slice(i,i+maxRow));});
  rowsOut.forEach(function(row,r){row.forEach(function(k){var n=Object.assign({},shownByKey.get(k)||all.get(k));if(input.stencils&&input.stencils.get(k))n.stencil=input.stencils.get(k);var ports=[];(input.links||[]).forEach(function(l){if(l.a===k)ports.push(l.aPort);if(l.b===k)ports.push(l.bPort);});(n.attached||[]).forEach(function(a){ports.push(a.port);});var dev=new Device(n,input.ports&&input.ports.get(k)||[],ports,style);dev.row=r;devices.set(k,dev);});});
  // Endpoints (access points and named devices) beside their switch on faceplate pages.
  var ipCount={};devices.forEach(function(dev){(dev.node.attached||[]).forEach(function(a){var n=all.get(a.key),ip=n&&(n.ips||[])[0];if(ip)ipCount[ip]=(ipCount[ip]||0)+1;});});
  function epIP(n){var ip=(n.ips||[])[0];return ip&&ipCount[ip]<3?ip:'';}
  devices.forEach(function(dev){dev.eps=[];dev.others=0;if(style==='box'||view.context&&view.context.has(dev.key))return;var list=(dev.node.attached||[]).map(function(a){return {node:all.get(a.key)||{name:a.name,role:a.role,key:a.key},port:a.port};}).filter(function(a){return a.node.role==='ap'?view.aps!==false:a.node.role==='circuit'?view.wan!==false:view.others!==false;});
   var named=list.filter(function(a){return !a.node.generic;}).sort(function(a,b){return (a.node.role==='ap'?0:1)-(b.node.role==='ap'?0:1)||String(a.port).localeCompare(String(b.port),undefined,{numeric:true});});
   // Access points condensed into one box per switch (the ports stay marked).
   var apList=named.filter(function(a){return a.node.role==='ap';});if(view.apGroup&&apList.length>1){var models=apList.map(function(a){return a.node.model;}).filter(function(m,i,all){return m&&all.indexOf(m)===i;});
    named=[{node:{name:apList.length+' access points',role:'ap',key:'',model:models.length===1?models[0]:models.length+' models',group:true},port:apList[0].port,ports:apList.map(function(a){return a.port;})}].concat(named.filter(function(a){return a.node.role!=='ap';}));}
   dev.eps=named.slice(0,12);dev.others=list.length-(view.apGroup&&apList.length>1?apList.length-1:0)-dev.eps.length;});
  // Endpoint boxes are wide enough for the longest full name on the page (owner request: access
  // points show their whole name); the image takes 52 px when a stencil draws the endpoint.
  var longest=0;devices.forEach(function(dev){(dev.eps||[]).forEach(function(a){if(!a.node.group)longest=Math.max(longest,String(a.node.name||'').length);});});
  // Even grid steps, so an endpoint's center (where its link lands) is on the routing grid.
  if(longest){EP_W=view.tallAps?Math.max(90,Math.ceil((14+longest*9*0.56)/18)*18):Math.max(126,Math.ceil((60+longest*9*0.56)/18)*18);EP_PITCH=EP_W+27;}
  // Connections: one per physical link on faceplates, one per device pair on boxes.
  var conns=[],seenLinks=new Set();
  (input.links||[]).forEach(function(l){var A=devices.get(l.a),B=devices.get(l.b);if(!A||!B||A===B&&!l.stack)return;var key=[l.a+'|'+short(l.aPort),l.b+'|'+short(l.bPort)].sort().join('~');if(seenLinks.has(key))return;seenLinks.add(key);
   var fa=false,fb=false,ca=false,cb=false;if(style==='plate'){try{var sa=A.slot(l.aPort||''),sb=B.slot(l.bPort||'');fa=!!sa.fiber;fb=!!sb.fiber;ca=sa.form==='rj45';cb=sb.form==='rj45';}catch(e){}}var type=linkKind(l,A.node.role,B.node.role,fa,fb,ca,cb),dash=slowLink(l);
   if(style==='box'){var pk=[l.a,l.b].sort().join('~'),c=conns.find(function(x){return x.pair===pk;});if(c){c.aPorts.push(l.a===c.A.key?l.aPort:l.bPort);c.bPorts.push(l.a===c.A.key?l.bPort:l.aPort);if(isFiberKind(type))c.type=type;return;}conns.push({pair:pk,A:A,B:B,aPorts:[l.aPort],bPorts:[l.bPort],type:type,dash:dash});return;}
   conns.push({A:A,B:B,aPorts:[l.aPort],bPorts:[l.bPort],type:type,dash:dash});});
  devices.forEach(function(dev){dev.eps.forEach(function(a,j){var l=(input.links||[]).find(function(x){return x.a===dev.key&&x.b===a.node.key&&short(x.aPort)===short(a.port)||x.b===dev.key&&x.a===a.node.key&&short(x.bPort)===short(a.port);})||{aPort:a.port};conns.push({A:dev,ep:j,aPorts:[a.port],bPorts:[],type:linkKind(l,dev.node.role,a.node.role,false,false),dash:slowLink(l)});});});
  // A link given its own type by hand (name and color): links sharing that name share one legend entry.
  var lk=view.edits&&view.edits.lineKinds;if(lk)conns.forEach(function(c){var key=c.A.key+'|'+short(c.aPorts[0]||'')+'~'+(c.B?c.B.key+'|'+short(c.bPorts[0]||''):'ep:'+epKey(c.A,c.A.eps[c.ep])),o=lk[key];if(!o||!o.label)return;var k='custom:'+String(o.label).toLowerCase();KINDS[k]={label:o.label,color:o.color||'#8a94a6',dash:!!o.dash,width:Number(o.width)||0,media:'custom',speed:0,speedText:o.speed||'',cable:o.cable||'',module:o.module||'auto'};c.type=k;});
  conns.forEach(function(c){used.add(c.type);});
  // Terminals on faceplates come from the port slot; boxes get a side per direction.
  var usedPorts=new Map(),modulesUsed=new Map();
  conns.forEach(function(c,i){c.net=i+1;
   if(style==='plate'){c.ta=termPlate(c.A,c.aPorts[0],c);if(c.B)c.tb=termPlate(c.B,c.bPorts[0],c);}
   else{var sideA=c.A.row<c.B.row?'bottom':c.A.row>c.B.row?'top':'bottom',sideB=c.B.row<c.A.row?'bottom':c.B.row>c.A.row?'top':'bottom';c.ta={dev:c.A,side:sideA,label:portList(c.aPorts),conn:c};c.tb={dev:c.B,side:sideB,label:portList(c.bPorts),conn:c};c.A.terms.push(c.ta);c.B.terms.push(c.tb);}});
  // Stack cables stay with the stack (owner request: no loops around the page): between neighbouring
  // members (the lower port of one, the upper port of the next) straight across the 9 px gap, any
  // other (a ring's closing cable, crossed link ports) out through the gaps and down a lane hugging the
  // stack's side. Drawn directly, without a route, a stub or a label.
  conns.forEach(function(c){if(c.B!==c.A||!c.A.grid||!c.ta||!c.tb||!c.ta.slot||!c.tb.slot||!c.ta.slot.plate||!c.tb.slot.plate)return;c.internal=true;c.ta.label='';c.tb.label='';});
  function portList(list){var s=list.filter(Boolean).map(short);return s.length?clip(s[0],10)+(s.length>1?' +'+(s.length-1):''):'';}
  function termPlate(dev,port,c){var po=view.edits&&view.edits.ports&&view.edits.ports[dev.key+'|'+short(port||'')];if(po){port=po;}var s=dev.slot(port||'');
   // A port's link point moved by hand (a stencil whose marks miss its ports).
   var pp=view.edits&&view.edits.portPos&&view.edits.portPos[dev.key+'|'+short(port||'')];if(pp&&style==='plate'){s=Object.assign({},s);var ex=(s.ex!=null?s.ex:s.dx)+pp[0];s.ex=ex;s.dx=snap(ex);s.py=(s.py!=null?s.py:HEAD+(s.row?51:21))+pp[1];if(dev.positions&&dev.positions[s.key])dev.positions[s.key]={x:ex,y:s.py,exact:true};}var far=c&&c.B&&(c.A===dev?c.B:c.A),fs=dev.grid&&far&&far!==dev?(far.row<dev.row?'top':far.row>dev.row?'bottom':null):null;if(dev.grid&&c&&c.ep!=null&&dev.eps&&dev.eps[c.ep]&&dev.eps[c.ep].node.role==='circuit')fs='top';
   var t={dev:dev,slot:s,side:fs||s.side||(s.row?'bottom':'top'),label:clip(short(port),10),conn:c};(dev.portKeys=dev.portKeys||{})[s.key]=dev.portKeys[s.key]||dev.key+'|'+short(port||'');var prior=dev.terms.find(function(x){return x.slot.key===s.key;});if(prior){t.shared=prior;prior.shares=(prior.shares||0)+1;t.k=prior.shares;t.label='';}else{dev.terms.push(t);usedPorts.set(dev.key+'|'+s.key,kindStyle(c.type,view).color);if(view.modules!==false&&s.form!=='rj45'&&s.form!=='shared'){
     // A port the hardware does not show as a cage (an add-in network module, or hardware without a
     // profile) still takes a module when its link is fiber, DAC or AOC: an optic or cable end is fitted.
     var cage=s.form==='sfp'||s.form==='qsfp',sp0=(KINDS[c.type]||{}).speed||speedValue(kindStyle(c.type,view).speed),md=moduleFor(c.type,view,cage?s.form:sp0>=40000?'qsfp':'sfp',dev.node.role);if(md&&!cage&&md.id==='copper')md=null;if(md&&!cage)md.form=sp0>=40000?'qsfp':'sfp';if(md){(dev.mods=dev.mods||new Map()).set(s.key,md);var mu=modulesUsed.get(md.label)||{mod:md,color:kindStyle(c.type,view).color,ports:[]};mu.ports.push(dev.node.name+' '+short(port||''));modulesUsed.set(md.label,mu);}}}return t;}
  devices.forEach(function(dev){(dev.eps||[]).forEach(function(a){(a.ports||[]).forEach(function(p){if(style!=='plate')return;var sl=dev.slot(p||'');if(!usedPorts.has(dev.key+'|'+sl.key))usedPorts.set(dev.key+'|'+sl.key,kindStyle(linkKind({},dev.node.role,'ap'),view).color);});});});
  // Label bands above and below each faceplate, as small as their port labels allow (owner
  // request: as much as possible on one readable sheet): horizontal labels beside their stubs
  // when neighbors leave room, otherwise rotated labels in a band as tall as the longest.
  function bandFor(d,side){var ts=d.terms.filter(function(t){return t.side===side&&t.label&&t.slot;}).map(function(t){return {x:t.slot.lane!=null?t.slot.lane:t.slot.ex!=null?t.slot.ex:t.slot.dx,w:textW(t.label,12,true)};}).sort(function(a,b){return a.x-b.x;});
   // No port labels on this side: a thin band (stubs of unlabeled shared ports still pass through it).
   if(!ts.length)return {h:G*2,flat:true};
   if(ts.every(function(t,i){return i===ts.length-1||ts[i+1].x-t.x>=t.w+10;}))return {h:36,flat:true};
   return {h:Math.min(90,Math.max(36,up9(Math.max.apply(null,ts.map(function(t){return t.w;}))+16))),flat:false};}
  // Stacks (owner request: no line runs across a member's face; a top-row port is reached from above and a
  // bottom-row port from below): a link leaves its port into the gap on the port's own side, runs along that
  // gap to the side of the stack and along the side to the stack's edge. Each gap is as tall as the lines the
  // busiest gap carries need (6 px apart), and every gap of a stack is that tall (members evenly spaced).
  devices.forEach(function(d){if(!d.grid||d.grid.chassis)return;var n=d.grid.rows,regs=[],side={left:{up:[],down:[],ring:0},right:{up:[],down:[],ring:0}},mid=d.w/2;for(var r=0;r<=n;r++)regs.push([]);
   function reg(sl){return sl.row?(sl.plate.row||0)+1:(sl.plate.row||0);}
   function dist(x,sd){return sd==='left'?x:d.w-x;}
   d.terms.forEach(function(t){if(!t.slot||!t.slot.plate||t.shared||t.conn&&t.conn.internal)return;var m=t.slot.plate.row||0,low=!!t.slot.row,up=t.side==='top';t.slot.lane=null;t.slot.gy=null;
    if(!low&&up&&m===0||low&&!up&&m===n-1)return;var sd=t.slot.dx<mid?'left':'right',e={slot:t.slot,r:reg(t.slot),above:low,x:t.slot.dx,side:sd};regs[e.r].push(e);side[sd][up?'up':'down'].push(e);});
   var ext=function(sd){return side[sd].up.length+side[sd].down.length;};
   // Stack cables other than straight drops take the side with fewer links (no crossings), nearest the stack.
   conns.forEach(function(c){if(!c.internal||c.A!==d)return;var a=c.ta.slot,b=c.tb.slot,ra=a.plate.row||0,rb=b.plate.row||0,hi=ra<rb?a:b,lo=hi===a?b:a;
    if(Math.abs(ra-rb)===1&&hi.row===1&&lo.row===0&&(a.plate.col||0)===(b.plate.col||0)){c.drop=true;return;}
    var sd=ext('left')<ext('right')?'left':ext('right')<ext('left')?'right':(a.dx+b.dx)/2<mid?'left':'right';c.ring={side:sd,k:side[sd].ring++};
    [a,b].forEach(function(sl){regs[reg(sl)].push({slot:sl,r:reg(sl),above:!!sl.row,x:sl.dx,side:sd});});});
   // In a gap, lines from the member above take the upper tracks and those from below the lower ones; of two
   // from above the one nearer the side stays higher, of two from below the one nearer the side lower.
   regs.forEach(function(list){list.sort(function(p,q){return (p.above?0:1)-(q.above?0:1)||(p.above?dist(p.x,p.side)-dist(q.x,q.side):dist(q.x,q.side)-dist(p.x,p.side));});});
   var H=function(k){return k?up9(6*(k+1)):0},gap=G;for(var r2=1;r2<n;r2++)gap=Math.max(gap,H(regs[r2].length));var p0=H(regs[0].length),pn=H(regs[n].length),olds=new Map(),seen=new Set();
   d.plates.forEach(function(pl){olds.set(pl,pl.y||0);pl.y=p0+(pl.row||0)*(72+gap);});d.grid.gap=gap;d.plateH=p0+n*72+(n-1)*gap+pn;d.h=HEAD+d.plateH+FOOT;
   d.terms.forEach(function(t){var sl=t.slot;if(!sl||!sl.plate||seen.has(sl)||!olds.has(sl.plate))return;seen.add(sl);sl.py+=(sl.plate.y||0)-olds.get(sl.plate);});
   regs.forEach(function(list,r){if(!list.length)return;var top=HEAD+(r===0?0:p0+r*72+(r-1)*gap),h=r===0?p0:r===n?pn:gap;list.forEach(function(e,i){e.slot.gy=Math.round((top+h*(i+1)/(list.length+1))*2)/2;});});
   // Side lanes: stack cables innermost (4 px apart), then links two grid steps apart (room for their port labels), the one leaving from
   // lower down further out when going up (higher up when going down), so no lane crosses a gap's line.
   var out={left:0,right:0};['left','right'].forEach(function(sd){var inner=side[sd].ring?G*Math.ceil((4*side[sd].ring+4)/G):0,ups=side[sd].up.slice().sort(function(p,q){return p.slot.gy-q.slot.gy;}),downs=side[sd].down.slice().sort(function(p,q){return q.slot.gy-p.slot.gy;}),all=ups.concat(downs);
    all.forEach(function(e,i){var off=inner+G+2*G*i;e.slot.lane=sd==='left'?-off:d.w+off;});out[sd]=all.length?inner+G+2*G*(all.length-1)+G*2:inner?inner+G:0;});
   d.sideL=out.left;d.sideR=out.right;});
  // Chassis leaders (as in a hand-drawn chassis): a link to an inner module runs straight across the chassis
  // face to its edge, moved into the gap beside its port column when a linked port or another leader is in
  // the way. Lanes are relative to the device, chosen nearest the edge first.
  devices.forEach(function(d){if(!d.grid||!d.grid.chassis)return;var ts=d.terms.filter(function(t){return t.slot&&!t.shared;}),top=HEAD,bot=HEAD+d.plateH,lanes=[],marks=[],span=function(t){return Math.abs((t.side==='top'?top:bot)-t.slot.py);};
   var LANE_STEPS=[0];for(var ls=1;ls<=14;ls++)LANE_STEPS.push(9*ls,-9*ls);
  // Leaders pass between ports, not over them (owner request: no overlaps): every port on the face counts.
   // So do the drawn role block and the member or module label.
   var blocks=[];d.plates.forEach(function(pl){var py=HEAD+(pl.y||0),lab=pl.card?String(pl.member)+(pl.model?'  \u00b7  '+pl.model:pl.empty?'  \u00b7  empty':''):'';if(lab)blocks.push({x0:pl.x+5,x1:pl.x+5+textW(lab,7.5,true),y0:py,y1:py+11});if(!pl.card)blocks.push({x0:pl.x+10,x1:pl.x+54,y0:py+10,y1:py+62});
    if(pl.empty)return;pl.groups.forEach(function(g){if(g.rear)return;for(var i=0;i<g.count;i++){var pp=portPos(g,i);marks.push({x:pl.x+pp.dx,y:py+(g.mid?36:pp.row?51:21)});}});});
   // No two leaders' sideways steps lie on one another (owner request: parallel lines never overlap exactly):
   // a step that would is moved to another lane, or else to its own track between the port rows.
   var vias=[];
   ts.slice().sort(function(a,b){return span(a)-span(b);}).forEach(function(t){if(t.conn&&t.conn.internal)return;var x0=t.slot.dx,y0=t.slot.py,y1=t.side==='top'?top:bot,lo=Math.min(y0,y1),hi=Math.max(y0,y1),dir=t.side==='top'?-1:1,lead=11*dir;
    var stepFree=function(x){var yv=y0+lead,a=Math.min(x,x0),b=Math.max(x,x0);return x===x0||!vias.some(function(v){return Math.abs(v.y-yv)<1&&Math.min(b,v.b)-Math.max(a,v.a)>0.5;})&&!lanes.some(function(l){return l.x>a+0.5&&l.x<b-0.5&&Math.abs(l.vy-yv)<1;});};
    var free=function(x){return stepFree(x)&&!ts.some(function(o){return o!==t&&Math.abs(o.slot.dx-x)<8&&o.slot.py>lo-8&&o.slot.py<hi+8;})&&!marks.some(function(o){return (o.x!==x0||o.y!==y0)&&Math.abs(o.x-x)<8&&o.y>lo-8&&o.y<hi+8;})&&!blocks.some(function(b){var yv=y0+lead;return x>b.x0-3&&x<b.x1+3&&b.y1>lo&&b.y0<hi||x!==x0&&yv>b.y0-2&&yv<b.y1+2&&Math.max(x,x0)>b.x0-3&&Math.min(x,x0)<b.x1+3;})&&!lanes.some(function(l){return Math.abs(l.x-x)<4&&l.hi>lo-12&&l.lo<hi+12||l.side===t.side&&Math.abs(l.x-x)<14;});},lane=x0;
    [11,15,19].some(function(m){lead=m*dir;return LANE_STEPS.some(function(dx){if(free(x0+dx)){lane=x0+dx;return true;}return false;});})||(lead=11*dir);
    t.slot.lane=lane;t.slot.lead=lead;lanes.push({x:lane,lo:lo,hi:hi,side:t.side,vy:y0+lead});if(lane!==x0)vias.push({y:y0+lead,a:Math.min(lane,x0),b:Math.max(lane,x0)});});});
  // Names and model lines go between the leaders where they leave the device.
  devices.forEach(function(dev){dev.fit();});
  devices.forEach(function(d){if(style==='box'){d.bt=d.bb=BAND;return;}var a=bandFor(d,'top'),b=bandFor(d,'bottom');d.bt=a.h;d.bb=b.h;d.ft=a.flat;d.fb=b.flat;});
  // Endpoints sit above their switch when cabled to a top-row port and below it for a
  // bottom-row port, each near its port.
  devices.forEach(function(d){d.top=[];d.bot=[];});
  // WAN circuits sit above their device whatever the port row (owner request: the hierarchy runs
  // from the WAN down); a bottom-row port's link leaves downward and routes around to the circuit.
  conns.forEach(function(c){if(c.ep==null)return;var t=c.ta.shared||c.ta,a0=c.A.eps[c.ep],e={conn:c,a:a0,dx:t.slot.lane!=null?t.slot.lane:t.slot.dx,side:a0.node.role==='circuit'?'top':c.ta.side};(e.side==='top'?c.A.top:c.A.bot).push(e);});
  // Access points grow to use the room their switch leaves (owner request), up to twice the size,
  // while every row still fits within its device's width and stays on the routing grid.
  if(view.tallAps){var fit=2;devices.forEach(function(d){[d.top,d.bot].forEach(function(list){var n=list.length;if(!n)return;fit=Math.min(fit,((d.w-(n-1)*27)/n)/EP_W);});});
   if(fit>1.05){var nw=Math.max(EP_W,Math.floor(EP_W*fit/18)*18);AP_SCALE=nw/EP_W;EP_W=nw;EP_PITCH=EP_W+27;EP_H=Math.ceil(108*AP_SCALE/9)*9;}}
  // Compact (owner request): access points and other endpoints stay within the left and right edges
  // of their switch, firewall or stack whenever they fit, each as near its port as its neighbors
  // allow; the gap between them shrinks (down to one grid step) before the row may run past the
  // device, and a row that still cannot fit is centered on the device.
  devices.forEach(function(d){[d.top,d.bot].forEach(function(list){var n=list.length;if(!n)return;list.sort(function(p,q){return p.dx-q.dx;});
    var body=d.w,lo=0,hi=Math.max(0,snap(body-EP_W)),pitch=EP_PITCH;
    if(n>1&&(n-1)*pitch+EP_W>body)pitch=Math.max(EP_W+G,Math.floor((body-EP_W)/(n-1)/G)*G);
    var x=null;list.forEach(function(e){var ideal=snap(e.dx-EP_W/2);x=x==null?ideal:Math.max(ideal,x+pitch);e.rx=x;});
    var span=(n-1)*pitch+EP_W;
    if(span<=body){for(var i=n-1;i>=0;i--){var cap=i===n-1?hi:list[i+1].rx-pitch;if(list[i].rx>cap)list[i].rx=cap;}for(var j=0;j<n;j++){var floor=j?list[j-1].rx+pitch:lo;if(list[j].rx<floor)list[j].rx=floor;}}
    else{var start=snap((body-span)/2);list.forEach(function(e,k){e.rx=start+k*pitch;});}});
   var left=Math.min.apply(null,[-(d.sideL||0)].concat(d.top.concat(d.bot).map(function(e){return e.rx;}))),right=Math.max.apply(null,[d.w+(d.sideR||0)+(d.others?G*2+EP_W:0)].concat(d.top.concat(d.bot).map(function(e){return e.rx+EP_W;})));d.offset=-left;d.cellW=right-left;});
  // Horizontal placement: cells left to right, rows centered.
  // Rows start on one vertical line: the first device of every row has the same left edge
  // (owner request), so stacked devices line up.
  var widths=rowsOut.map(function(row){return row.reduce(function(w,k,i){return w+devices.get(k).cellW+(i?G*10:0);},0);}),lead=Math.max.apply(null,rowsOut.map(function(row){return devices.get(row[0]).offset;}).concat([0]));
  var maxW=Math.max.apply(null,rowsOut.map(function(row,r){return lead-devices.get(row[0]).offset+widths[r];}).concat([400]));
  // Stack members sit under the member above them (owner request: stacks read as one column),
  // even when a later row holds only the members of a taller stack.
  var LEFT=MARGIN+LEGEND_W;rowsOut.forEach(function(row,r){var x=LEFT+snap(lead-devices.get(row[0]).offset);row.forEach(function(k){var d=devices.get(k);d.cellX=x;d.x=x+d.offset;x+=d.cellW+G*10;});});
  maxW=Math.max(maxW,Math.max.apply(null,Array.from(devices.values()).map(function(d){return d.cellX+d.cellW-LEFT;})));
  // Channel sizes from the routes that use them, then vertical placement.
  var chan=rowsOut.map(function(){return 3;});chan.push(3);
  // A link that drops straight down from one row to the next (such as a stack link between members)
  // needs no track of its own in the channel between them (owner request: no wasted space).
  function termX(t){return t.dev.x+(t.slot?(t.slot.lane!=null?t.slot.lane:t.slot.ex!=null?t.slot.ex:t.slot.dx):t.dev.w/2);}
  function straight(c){if(style!=='plate'||!c.B||!c.ta||!c.tb||c.ta.shared||c.tb.shared)return false;var up=c.A.row<c.B.row?c.ta:c.tb,dn=up===c.ta?c.tb:c.ta;return Math.abs(c.A.row-c.B.row)===1&&up.side==='bottom'&&dn.side==='top'&&Math.abs(termX(up)-termX(dn))<G/2;}
  var busy=chan.map(function(){return false;}),drops=chan.map(function(){return false;});
  conns.forEach(function(c){if(c.ep!=null||c.internal)return;if(straight(c)){drops[Math.max(c.A.row,c.B.row)]=true;return;}[c.ta,c.tb].forEach(function(t){if(!t)return;var r=t.dev.row,i=t.side==='top'?r:r+1;chan[i]++;busy[i]=true;});var a=Math.min(c.A.row,c.B.row),b=Math.max(c.A.row,c.B.row);var inStack=c.B&&c.A.node.stackOf&&c.A.node.stackOf===c.B.node.stackOf;for(var r=a+1;r<=b;r++){chan[r]+=0.34;if(!inStack)busy[r]=true;}});
  // A channel crossed only by straight drops keeps one grid step between the label bands.
  chan=chan.map(function(v,i){return drops[i]&&!busy[i]?1:Math.ceil(v);});
  // A second pass may cap channels at the tracks their routes really used (owner request: no open space).
  if(view.chanCap)chan=chan.map(function(v,i){return view.chanCap[i]!=null?Math.max(1,Math.min(v,view.chanCap[i])):v;});
  var cursor=TOP+G*Math.min(chan[0],30),gaps=[{y0:TOP,y1:cursor}];
  // Trunks of shared ports need room outside the band too.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t){if(t&&t.shared){var d=t.dev,key=t.side==='top'?'trunkTop':'trunkBot';d[key]=Math.max(d[key]||0,t.k);}});});
  rowsOut.forEach(function(row,r){var ds=row.map(function(k){return devices.get(k);}),nTop=Math.max.apply(null,ds.map(function(d){return d.top.length;})),nBot=Math.max.apply(null,ds.map(function(d){return d.bot.length;})),kTop=Math.max.apply(null,ds.map(function(d){return d.trunkTop||0;})),kBot=Math.max.apply(null,ds.map(function(d){return d.trunkBot||0;}));
   var rowH=Math.max.apply(null,ds.map(function(d){return d.h;})),bt=Math.max.apply(null,ds.map(function(d){return d.bt;})),bb=Math.max.apply(null,ds.map(function(d){return d.h+d.bb;}))-rowH;
   cursor+=G*2*kTop;var topExtra=nTop?EP_H+G*(nTop+3+2*kTop):0,y=cursor+topExtra+bt,epBot=y+rowH+bb+G*(nBot+3+2*kBot),bottom=(nBot?epBot+EP_H:y+rowH+bb)+G*2*kBot;
   ds.forEach(function(d){d.y=y;d.epTopY=cursor;d.epBotY=epBot;});var gb=up9(bottom);cursor=gb+G*Math.min(chan[r+1],40);gaps.push({y0:gb,y1:cursor});});
  // Hand edits: devices and endpoints moved in the editor (grid steps, kept on the page).
  var ed=view.edits||{};
  if(ed.moves)devices.forEach(function(d){var m=ed.moves[d.key];if(!m)return;var dx=snap(m[0]),dy=snap(m[1]);if(d.x+dx<LEFT)dx=snap(LEFT-d.x);if(d.y+dy<TOP+d.bt)dy=snap(TOP+d.bt-d.y);d.x+=dx;d.cellX+=dx;d.y+=dy;d.epTopY+=dy;d.epBotY+=dy;});
  devices.forEach(function(d){d.top.concat(d.bot).forEach(function(e){e.ox=0;e.oy=0;var m=ed.eps&&ed.eps[epKey(d,e.a)];if(m){e.ox=snap(m[0]);e.oy=snap(m[1]);e.rx+=e.ox;}});});
  // Size only (to choose a row width that suits the paper).
  function portEdit(d,p){return ed.ports&&ed.ports[d.key+'|'+short(p||'')]||p;}
  function epY(d,e){return (e.side==='top'?d.epTopY:d.epBotY)+(e.oy||0);}
  var rightEdge=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max(d.cellX+d.cellW,Math.max.apply(null,[0].concat(d.top.concat(d.bot).map(function(e){return d.x+e.rx+EP_W;}))));}));maxW=Math.max(maxW,rightEdge-LEFT);
  if(view.measure){var lb=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max.apply(null,[d.y+d.h+d.bb].concat(d.top.concat(d.bot).map(function(e){return epY(d,e)+EP_H;})));}));var vl=view.vlansFor&&input.vlans&&input.vlans.get(view.vlansFor);return {w:MARGIN*2+LEGEND_W+maxW+G*16+(vl&&vl.length?320:0),h:lb+G*8};}
  // Title and legend.
  if(view.kicker)page.text(MARGIN,16,1200,14,view.kicker.toUpperCase(),{size:9.5,bold:true,align:'left',color:'#1d5b79'});
  page.text(MARGIN,32,1400,30,page.title,{size:24,bold:true,align:'left',color:'#1b3a4b'});
  if(view.subtitle)page.text(MARGIN,64,1400,16,view.subtitle,{size:11,align:'left',color:'#4a5568'});
  // Copper links and provider handoffs share the copper color: one legend entry for both.
  var legendTypes=Array.from(used).sort(function(a,b){var ka=KINDS[a]||{},kb=KINDS[b]||{};return ((LINK_MEDIA[ka.media]||{order:9}).order-(LINK_MEDIA[kb.media]||{order:9}).order)||((kb.speed||0)-(ka.speed||0));});
  var legendBottom=legendColumn(page,MARGIN,TOP,legendTypes,style==='box'?Array.from(new Set(Array.from(devices.values()).map(function(d){return d.node.role;}))):null,view,Array.from(modulesUsed.values())),legendRight=MARGIN;
  // A stack's members inside one frame, its name and member count on the frame (drawn first, behind).
  // Devices, endpoints and summaries.
  devices.forEach(function(dev){page.begin(dev.key);if(style==='box')drawBox(page,dev);else{var u=new Map();usedPorts.forEach(function(color,k){if(k.indexOf(dev.key+'|')===0)u.set(k.slice(dev.key.length+1),color);});drawPlate(page,dev,u);}page.end();
   dev.top.concat(dev.bot).forEach(function(e){var x=dev.x+e.rx,y=epY(dev,e),a=e.a;page.begin(epKey(dev,a),'ep');
    // Styled after the reference drawing: grouped access points in a green summary box, other
    // devices and provider handoffs in a pale box with a dark accent bar.
    if(a.node.group){page.rect(x,y,EP_W,EP_H,{fill:'#86d9a4',stroke:'#2f9e5b',width:1});var pre=commonPrefix(a.ports);page.text(x+4,y+11,EP_W-8,40,clip(ranges(a.ports,pre),16)+'  |  '+a.ports.length+' APs\n'+clip(a.node.model||'',22),{size:9.5,lineHeight:16,firstBold:true,color:'#123524'});page.end();return;}
    // Wireless pages (room to spare): the access point's details stacked over its icon above the
    // switch and under it below the switch, the link landing on the icon (owner's reference).
    var est=input.stencils&&input.stencils.get(a.node.key);if(view.tallAps&&a.node.role==='ap'){page.rect(x,y,EP_W,EP_H,{fill:'#ffffff',stroke:'none'});var S=AP_SCALE,IC=Math.round(48*S),top=e.side==='top',iy=top?y+EP_H-IC:y,ty=top?y+2:y+IC+6,lk=(input.links||[]).find(function(x){return x.a===dev.key&&x.b===a.node.key||x.b===dev.key&&x.a===a.node.key;})||{},mine=lk.a===dev.key,sp=speedText(Math.max(speedValue(lk.aSpeed),speedValue(lk.bSpeed))),far=short((mine?lk.bPort:lk.aPort)||'');
     if(est&&est.art){var r2=est.art.w/est.art.h,ih2=IC-4,iw2=ih2*r2;if(iw2>IC){iw2=IC;ih2=iw2/r2;}page.rect(x+EP_W/2-IC/2,iy,IC,IC,{fill:'#ffffff',stroke:'#c9d3df',width:1,radius:4});page.image(x+EP_W/2-iw2/2,iy+IC/2-ih2/2,iw2,ih2,{art:est.art,master:est.master});}
     else{page.rect(x+EP_W/2-IC/2,iy,IC,IC,{fill:'#f4f7fb',stroke:'#7a8ca8',width:1,radius:4});[8,13,18].forEach(function(h,k){page.rect(x+EP_W/2+(-9+k*7)*S,iy+(31-h)*S,4*S,h*S,{fill:'#2f9e5b',stroke:'none'});});page.rect(x+EP_W/2-6*S,iy+38*S,12*S,2*S,{fill:'#9aa9c0',stroke:'none'});}
     page.text(x,ty,EP_W,Math.round(50*S),a.node.name+'\n'+[clip(short(portEdit(dev,a.port)),16),sp].filter(Boolean).join(' · ')+'\n'+[epIP(a.node)||a.node.model||'',far].filter(Boolean).join(' · '),{size:Math.min(13,9*S),lineHeight:Math.round(16*Math.min(13/9,S)),firstBold:true,color:'#1b3a4b'});page.end();return;}
    var plain=a.node.role!=='ap';page.rect(x,y,EP_W,EP_H,{fill:plain?'#e8eef5':'#eef8f0',stroke:plain?'#c9d3df':ROLE_FILL.ap,width:1,radius:plain?0:6});if(plain)page.rect(x,y,4,EP_H,{fill:'#1d3a5c',stroke:'none'});
    if(est&&est.art){var r=est.art.w/est.art.h,ih=44,iw=ih*r;if(iw>44){iw=44;ih=iw/r;}page.image(x+5+(44-iw)/2,y+5+(44-ih)/2,iw,ih,{art:est.art,master:est.master});page.text(x+52,y+5,EP_W-56,46,clip(short(portEdit(dev,a.port)),12)+'\n'+a.node.name+'\n'+clip(epIP(a.node)||a.node.model||'',Math.max(14,Math.floor((EP_W-56)/5))),{size:8.5,lineHeight:14,firstBold:true,align:'left'});}
    else if(plain)page.text(x+12,y+9,EP_W-16,40,a.node.name+'\n'+clip(short(portEdit(dev,a.port)),9)+'  |  '+clip(epIP(a.node)||a.node.model||ROLE_LABEL[a.node.role]||'',14),{size:9,lineHeight:16,firstBold:true,align:'left',color:'#1b3a4b'});
    else page.text(x+4,y+5,EP_W-8,46,clip(short(portEdit(dev,a.port)),16)+'\n'+a.node.name+'\n'+clip(epIP(a.node)||a.node.model||ROLE_LABEL[a.node.role]||'',22),{size:9,lineHeight:14,firstBold:true});page.end();});
   // Grouped access points: a box in the access point color around the ports they use.
   (dev.eps||[]).forEach(function(a){if(!a.node.group||!a.ports||style!=='plate')return;var pts=a.ports.map(function(p){var sl=dev.slot(p||''),pos=dev.positions&&dev.positions[sl.key];return pos?[dev.x+pos.x,dev.y+pos.y]:[dev.x+sl.dx,dev.y+(sl.py!=null?sl.py:HEAD+(sl.row?51:21))];});if(!pts.length)return;
    var xs=pts.map(function(p){return p[0];}),ys=pts.map(function(p){return p[1];}),x0=Math.min.apply(null,xs)-9,x1=Math.max.apply(null,xs)+9,y0=Math.min.apply(null,ys)-11,y1=Math.max.apply(null,ys)+11;page.rect(x0,y0,x1-x0,y1-y0,{fill:'none',stroke:ROLE_FILL.ap,width:2,radius:4});});
   if(dev.others)page.text(dev.x+dev.w+G*2,dev.y+27,EP_W,18,'+'+dev.others+' other device'+(dev.others>1?'s':''),{size:10,align:'left',color:'#4a5568'});});
  // Box terminals: sorted by the far end so routes do not cross needlessly.
  if(style==='box')devices.forEach(function(dev){['top','bottom'].forEach(function(side){var list=dev.terms.filter(function(t){return t.side===side;});list.forEach(function(t){var o=t.conn.ta===t?t.conn.tb:t.conn.ta;t.order=o.dev.x+o.dev.w/2;});list.sort(function(a,b){return a.order-b.order;});var n=list.length,slots=Math.floor((dev.w-36)/18)+1;list.forEach(function(t,i){var s=n>=slots?i:Math.round((i+0.5)*slots/n-0.5);t.dx=18+18*Math.min(s,slots-1);});});});
  // Terminal geometry: the port point, the stub end outside the label band, the route
  // direction out of the stub, and the label box inside the band.
  function geo(t){if(t.shared){var b=geo(t.shared),out=b.dir===3?-1:1;return {px:b.sx,py:b.sy,sx:b.sx,sy:b.sy+out*2*G*t.k,dir:b.dir,trunk:b};}
   var d=t.dev;if(t.ep!=null){var e=d.top.concat(d.bot).find(function(x){return x.conn===t.conn;}),ex=d.x+e.rx+EP_W/2,ey=epY(d,e);return e.side==='top'?{px:ex,py:ey+EP_H,sx:ex,sy:ey+EP_H+G,dir:1}:{px:ex,py:ey,sx:ex,sy:ey-G,dir:3};}
   var x=d.x+(style==='box'?t.dx:t.slot.lane!=null?t.slot.lane:t.slot.dx),top=t.side==='top',py=style==='box'?(top?d.y:d.y+d.h):t.slot.py!=null?d.y+t.slot.py:d.y+HEAD+(top?21:51),px=style==='box'?x:d.x+t.slot.dx,lead=t.slot&&t.slot.lead!=null?t.slot.lead:top?-11:11,
    via=style!=='box'&&t.slot.gy!=null?[[px,d.y+t.slot.gy],[x,d.y+t.slot.gy]]:px!==x?[[px,py+lead],[x,py+lead]]:null;
   return {px:px,py:py,via:via,sx:x,sy:top?d.y-d.bt:d.y+d.h+d.bb,dir:top?3:1,lx:x+3,ly:top?d.y-d.bt+4:d.y+d.h+4,lalign:top?'left':'right',flat:top?d.ft:d.fb,band:top?d.bt:d.bb,top:top,dy:d.y,dh:d.h};}
  conns.forEach(function(c){if(c.ep!=null)c.tb={dev:c.A,ep:c.ep,conn:c};});
  // Router over the whole page area.
  var lastBottom=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max.apply(null,[d.y+d.h+d.bb].concat(d.top.concat(d.bot).map(function(e){return epY(d,e)+EP_H;})));}));
  var RW=MARGIN*2+LEGEND_W+maxW+G*16,RH=lastBottom+G*8,router=new Router(RW,RH);
  router.block(0,0,Math.max(legendRight,600),TOP-G);router.block(0,0,LEFT-G*3,RH);
  // Stack cables (see above): straight across the gap between neighbours, otherwise through their gap tracks
  // and along their side lane.
  var internalLines=[];conns.forEach(function(c){if(!c.internal)return;var d=c.A,a=c.ta.slot,b=c.tb.slot,pa=[d.x+a.dx,d.y+a.py],pb=[d.x+b.dx,d.y+b.py],pts;
   if(c.ring&&a.gy!=null&&b.gy!=null){var lx=c.ring.side==='left'?d.x-4-4*c.ring.k:d.x+d.w+4+4*c.ring.k,ya=d.y+a.gy,yb=d.y+b.gy;pts=[pa,[pa[0],ya],[lx,ya],[lx,yb],[pb[0],yb],pb];}
   else{var hi=(a.plate.row||0)<(b.plate.row||0)?a:b,mid=d.y+HEAD+(hi.plate.y||0)+72+(d.grid&&d.grid.gap||G)/2;pts=pa[0]===pb[0]?[pa,pb]:[pa,[pa[0],mid],[pb[0],mid],pb];}
   internalLines.push({points:pts,color:kindStyle(c.type,view).color,width:kindStyle(c.type,view).width,conn:c,routed:true,strict:true,groups:[],internal:true});});
  var zoneId=0;devices.forEach(function(d){d.zone=++zoneId;var l=d.cellX,w=d.cellW;if(d.top.length)router.reserve(l,d.epTopY+EP_H+G,w,d.y-d.bt-(d.epTopY+EP_H+G),d.zone);if(d.bot.length)router.reserve(l,d.y+d.h+d.bb,w,d.epBotY-G-(d.y+d.h+d.bb),d.zone);});
  devices.forEach(function(d){router.block(d.x-G,d.y-d.bt+G,d.w+2*G,d.h+d.bt+d.bb-2*G);d.top.forEach(function(e){router.block(d.x+e.rx-G,epY(d,e)-G,EP_W+2*G,EP_H+G);});d.bot.forEach(function(e){router.block(d.x+e.rx-G,epY(d,e),EP_W+2*G,EP_H+G);});if(d.others)router.block(d.x+d.w+G,d.y+18,EP_W+G,36);});
  // A stack link's run along the side of the stack is its own: other lines keep off it.
  devices.forEach(function(d){if(!d.grid||d.grid.chassis)return;d.terms.forEach(function(t){var sl=t.slot;if(!sl||sl.gy==null||sl.lane==null||t.shared)return;var x=d.x+sl.lane,top=t.side==='top',y0=top?d.y-d.bt+G:d.y+sl.gy,y1=top?d.y+sl.gy:d.y+d.h+d.bb-G;router.block(sl.lane<0?x-G:x,y0,G,y1-y0);});});
  // WAN circuits head the drawing (owner request): no line passes above a circuit when any other
  // route exists, and a circuit's link may cross other lines rather than detour around them.
  devices.forEach(function(d){var cs=d.top.filter(function(e){return e.a.node.role==='circuit';});if(!cs.length)return;var x0=Math.min.apply(null,cs.map(function(e){return d.x+e.rx;}))-G,x1=Math.max.apply(null,cs.map(function(e){return d.x+e.rx+EP_W;}))+G,y1=Math.max.apply(null,cs.map(function(e){return epY(d,e);}))-G;router.shun(x0,d.row?d.epTopY-G*4:0,x1-x0,y1-(d.row?d.epTopY-G*4:0));cs.forEach(function(e){router.free[e.conn.net]=1;});});
  // Lines stay out of the strip above the top row (owner request: no loops up into the page header) unless
  // no other route exists.
  // A line whose own stub starts up there (a top-row port's link) still uses the strip freely.
  var hdrY=(function(){var ds=Array.from(devices.values()),r0=Math.min.apply(null,ds.map(function(d){return d.row;})),row0=ds.filter(function(d){return d.row===r0;}),top=Math.min.apply(null,row0.map(function(d){return d.y+HEAD;})),ep=Math.min.apply(null,row0.map(function(d){return d.epTopY;}));
   if(ep-G*3>0)router.shun(0,0,RW,ep-G*3);if(top>G)router.shun(0,0,RW,top-G,2);return top-G;})();
  // A port reported with several neighbors becomes a trunk out of its stub with one
  // branch per neighbor, two grid steps apart.
  conns.forEach(function(c){if(c.internal)return;c.ga=geo(c.ta);c.gb=geo(c.tb);if(Math.min(c.ga.sy,c.gb.sy)<=hdrY)router.hdrOk[c.net]=1;[c.ga,c.gb].forEach(function(g){var v=router.at(g.sx,g.sy);if(v>=0&&!router.term[v])router.term[v]=c.net;if(g.trunk){var m=router.at(g.sx,g.sy+(g.sy>g.py?-G:G));if(m>=0&&!router.term[m])router.term[m]=c.net;}});c.len=Math.abs(c.ga.sx-c.gb.sx)+Math.abs(c.ga.sy-c.gb.sy);
   c.groups=[portGroup(c.ta),portGroup(c.tb)].filter(Boolean);});
  function portGroup(t){var o=t&&(t.shared||t);return o&&o.slot&&o.shares?o.dev.key+'|'+o.slot.key:'';}
  var lines=[],order=conns.filter(function(c){return !c.internal;}).sort(function(a,b){return (b.ep!=null)-(a.ep!=null)||a.len-b.len;});
  function routeConn(c){var s=router.at(c.ga.sx,c.ga.sy),t=router.at(c.gb.sx,c.gb.sy),tDir=(c.gb.dir+2)&3,owner=c.ep!=null?c.A.zone:0,strict=s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,false,owner):null;return {strict:strict,path:strict||(s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,true,owner):null)};}
  order.forEach(function(c){var r=routeConn(c);c.path=r.path;c.strictPath=r.strict;if(r.path)router.commit(c.net,r.path);});
  // Lines avoid crossing (owner request): each line routed first could not see the ones
  // after it, so every crossing line is routed again with all the others in place and keeps
  // the new route whenever it crosses fewer lines (owner request: a line crosses another only
  // when no route avoids it), or crosses as many with fewer bends.
  var all=order.map(function(c){return {net:c.net,get path(){return c.path;}};});
  order.forEach(function(c){if(!c.path)return;router.rebuild(all,c.net);var old=router.score(c.net,c.path);if(!old.cross)return;router.cross=CROSS_STRICT;var r=routeConn(c);router.cross=0;if(!r.path||(c.strictPath&&!r.strict))return;var now=router.score(c.net,r.path);
   // Fewer crossings, but not at any cost (owner request: no more bends than needed): a re-route may be
   // at most half as long again and add at most two bends.
   if(now.cross<old.cross&&r.path.length<=c.path.length*1.5+12&&now.bends<=old.bends+2||now.cross===old.cross&&now.bends<old.bends){c.path=r.path;c.strictPath=r.strict;}});
  router.rebuild(all,0);
  order.forEach(function(c){var path=c.path,strict=c.strictPath;
   var pts;if(path){pts=path.map(function(v){return [(v%router.C)*G,((v/router.C)|0)*G];});}else pts=[[c.ga.sx,c.ga.sy],[c.ga.sx,c.gb.sy],[c.gb.sx,c.gb.sy]];
   var points=compress([[c.ga.px,c.ga.py]].concat(c.ga.via||[],pts,c.gb.via?c.gb.via.slice().reverse():[],[[c.gb.px,c.gb.py]]));
   // A stencil's port is rarely on the 9 px routing grid: the vertical stretch into it moves
   // onto the port itself, so the line meets the port's center.
   function onPort(t,first){if(!t||t.shared||!t.slot||t.slot.ex==null||t.slot.ex===t.slot.dx)return;var x0=t.dev.x+t.slot.dx,x1=t.dev.x+t.slot.ex,list=first?points:points.slice().reverse();if(list[0][0]!==x0)return;for(var k=0;k<list.length&&list[k][0]===x0;k++)list[k]=[x1,list[k][1]];if(!first)points=list.reverse();else points=list;}
   if(style==='plate'){onPort(c.ta,true);onPort(c.tb,false);}
   lines.push({points:points,color:kindStyle(c.type,view).color,width:style==='box'&&c.aPorts.length>1?Math.max(3.5,kindStyle(c.type,view).width):kindStyle(c.type,view).width,conn:c,routed:!!path,strict:!!strict,groups:c.groups});});
  internalLines.forEach(function(l){lines.push(l);});
  // Fewest bends (owner request): a short sideways step next to a port (stub, step of one or two
  // grid units, vertical run) is removed by moving that run onto the port's column when the
  // column is free of devices and of other lines' collinear stretches.
  function overlaps(l0,x0,y0,x1,y1){return lines.some(function(l){if(l===l0)return false;for(var k=1;k<l.points.length;k++){var a=l.points[k-1],b=l.points[k];
    if(x0===x1&&a[0]===b[0]&&Math.abs(a[0]-x0)<1&&Math.min(a[1],b[1])<Math.max(y0,y1)-0.5&&Math.max(a[1],b[1])>Math.min(y0,y1)+0.5)return true;
    if(y0===y1&&a[1]===b[1]&&Math.abs(a[1]-y0)<1&&Math.min(a[0],b[0])<Math.max(x0,x1)-0.5&&Math.max(a[0],b[0])>Math.min(x0,x1)+0.5)return true;}return false;});}
  function freeColumn(x,y0,y1){for(var y=Math.min(y0,y1)+G;y<Math.max(y0,y1);y+=G){var v=router.at(x,y);if(v<0||router.blocked[v])return false;}return true;}
  function straightenEnd(l,rev){var p=rev?l.points.slice().reverse():l.points;if(p.length<5)return false;var P0=p[0],P1=p[1],P2=p[2],P3=p[3],P4=p[4];
   if(!(P0[0]===P1[0]&&P1[1]===P2[1]&&P2[0]===P3[0]&&P3[1]===P4[1]))return false;var a=P1[0],step=Math.abs(P2[0]-a);if(step===0||step>2*G)return false;
   if(!freeColumn(a,P1[1],P3[1])||overlaps(l,a,P1[1],a,P3[1])||overlaps(l,a,P3[1],P3[0],P3[1]))return false;
   var q=[P0,[a,P3[1]]].concat(p.slice(4));l.points=compress(rev?q.reverse():q);return true;}
  lines.forEach(function(l){if(l.internal)return;for(var i=0;i<3;i++){if(!straightenEnd(l,false)&&!straightenEnd(l,true))break;}});
  // Where a line crosses one drawn before it, its horizontal run hops over in a small arc.
  // Hand-drawn routes from the editor replace the computed one while both ends still meet
  // the same port points.
  lines.forEach(function(l){var c=l.conn;l.key=c.A.key+'|'+short(c.aPorts[0]||'')+'~'+(c.B?c.B.key+'|'+short(c.bPorts[0]||''):'ep:'+epKey(c.A,c.A.eps[c.ep]));var o=ed.lines&&ed.lines[l.key];
   if(o&&o.length>=2){var f=l.points[0],t=l.points[l.points.length-1];if(Math.abs(o[0][0]-f[0])<0.5&&Math.abs(o[0][1]-f[1])<0.5&&Math.abs(o[o.length-1][0]-t[0])<0.5&&Math.abs(o[o.length-1][1]-t[1])<0.5){l.points=o.map(function(p){return [p[0],p[1]];});l.edited=true;}}});
  lines.forEach(function(l,i){var out=[l.points[0]],arcs={};for(var k=1;k<l.points.length;k++){var a=l.points[k-1],b=l.points[k];if(!l.internal&&a[1]===b[1]&&Math.abs(b[0]-a[0])>2*G){var y=a[1],dir=b[0]>a[0]?1:-1,xs=[];
    // Every crossing hops, Visio style: the horizontal stretch jumps over the vertical one,
    // whichever line was drawn first, also between lines that share a bundle. A hop is a true
    // arc (an ArcTo row in Visio), and crossings closer than a hop's width share one hop.
    for(var j=0;j<lines.length;j++){if(j===i||lines[j].conn===l.conn)continue;var q=lines[j].points;for(var m=1;m<q.length;m++){var c=q[m-1],e=q[m];if(c[0]!==e[0])continue;var x=c[0];if((x-a[0])*dir>G&&(b[0]-x)*dir>G&&y>Math.min(c[1],e[1])&&y<Math.max(c[1],e[1])&&xs.indexOf(x)<0)xs.push(x);}}
    xs.sort(function(p,q){return (p-q)*dir;});var hops=[];xs.forEach(function(x){var h=hops[hops.length-1];if(h&&(x-h[1])*dir<2*HOP+3)h[1]=x;else hops.push([x,x]);});
    hops.forEach(function(h){out.push([h[0]-dir*HOP,y]);out.push([h[1]+dir*HOP,y]);arcs[out.length-1]=HOP;});}out.push(b);}
   l.drawn=out;l.arcs=Object.keys(arcs).length?arcs:null;});
  lines.forEach(function(l){var ks=kindStyle(l.conn.type,view);page.line(l.drawn,{arcs:l.arcs,color:l.color,width:l.width,dash:l.conn.dash||ks.dash,lineKey:l.key,route:l.points,lkind:l.conn.type,ltitle:[ks.label,[ks.speed,ks.cable].filter(Boolean).join(', ')].filter(Boolean).join(': ')});});
  conns.forEach(function(c){[c.ga,c.gb].forEach(function(g){if(g&&g.trunk&&Math.abs(g.sy-g.py)===2*G)page.rect(g.px-4,g.py-4,8,8,{fill:'#2d3748',stroke:'none',radius:4});});});
  // Port labels in the bands.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t,i){if(!t||t.ep!=null||t.shared||!t.label)return;var g=i?c.gb:c.ga;if(g.flat)page.text(g.lx,g.top?g.dy-19:g.dy+g.dh+3,textW(t.label,12,true)+4,16,t.label,{size:12,bold:true,align:'left',color:'#1f2937'});else page.text(g.lx,g.ly,13,(g.band||BAND)-8,t.label,{size:12,bold:true,rotate:true,align:g.lalign,color:'#1f2937'});});});
  // VLANs of the focus device to the right of everything routed.
  var vlans=view.vlansFor&&input.vlans&&input.vlans.get(view.vlansFor)||[];
  // VLANs to the right, or below in columns when that suits letter paper better.
  if(vlans.length){var list=vlans.slice(0,60).map(function(v){return 'VLAN '+v.id+(v.name?' – '+v.name:'');}).concat(vlans.length>60?['+'+(vlans.length-60)+' more']:[]),cw=Math.max(page.w,legendRight+MARGIN),ch=page.h;
   var right={w:up9(cw+G*2)+300+MARGIN,h:Math.max(ch,TOP+26+Math.min(list.length,40)*17+MARGIN)},cols=Math.max(1,Math.floor((cw-2*MARGIN)/300)),rows=Math.ceil(list.length/cols),below={w:cw,h:ch+30+rows*17+MARGIN};
   if(fitLetter(below).raw>fitLetter(right).raw){var by=up9(ch-MARGIN+G);page.text(MARGIN,by,280,20,'VLANs',{size:13,bold:true,align:'left'});for(var ci=0;ci<cols;ci++){var part=list.slice(ci*rows,(ci+1)*rows);if(part.length)page.text(MARGIN+ci*300,by+26,290,part.length*17+4,part.join('\n'),{size:11,align:'left',lineHeight:17});}}
   else{var vx=up9(cw-MARGIN+G*2),col=list.slice(0,40);page.text(vx,TOP,280,20,'VLANs',{size:13,bold:true,align:'left'});page.text(vx,TOP+26,300,Math.max(20,col.length*17+4),col.join('\n')+(list.length>40?'\n+'+(list.length-40)+' more':''),{size:11,align:'left',lineHeight:17});}}
  page.text(page.w-MARGIN-400,16,400,14,(view.company?view.company+'  /  ':'')+'NETWORK DOCUMENTATION',{size:9.5,bold:true,align:'right',color:'#1d5b79'});
  // The legend column ends at a thin rule down the page.
  page.rect(MARGIN+LEGEND_W-27,TOP-G,1,Math.max(legendBottom,page.h-MARGIN-20)-TOP,{fill:'#d5dde7',stroke:'none'});
  if(view.footer)page.text(MARGIN,page.h-MARGIN+6,Math.max(400,page.w-2*MARGIN),14,view.footer,{size:9,align:'left',color:'#4a5568'});
  page.rect(MARGIN,84,page.w-2*MARGIN,1,{fill:'#c9d3df',stroke:'none'});
  page.gaps=gaps;page.lines=lines;page.devices=Array.from(devices.values()).map(function(d){var o={key:d.key,name:d.node.name,x:d.x,y:d.y,w:d.w,h:d.h};if(d.grid)o.members=d.plates.map(function(p){return {id:String(p.member),x:d.x+p.x,y:d.y+HEAD+p.y,w:p.w,h:72};});return o;});
  // Endpoints with the x of the port they use, for the editor's alignment tools.
  page.eps=[];devices.forEach(function(d){d.top.concat(d.bot).forEach(function(e){var c=e.conn,port=c&&c.ga?c.ga.px:null;page.eps.push({key:epKey(d,e.a),dev:d.key,role:e.a.node.role,side:e.side,x:d.x+e.rx,y:epY(d,e),w:EP_W,h:EP_H,portX:port,ox:e.ox||0,oy:e.oy||0});});});
  return page;
 }
 // A page for a scope; the title says what it shows.
 // Stacks (owner request: stacks drawn as stacks, with their VSF or stacking links): a stacked switch becomes
 // one device per member, members directly beneath one another in order, each link and access point on
 // the member that has its port, the devices below the stack under its last member, and the stack
 // links between members from the configuration (VSF link 2 of a member to link 1 of the next; a ring
 // closes back to the first). A frame with the stack's name groups the members.
 // Tracks each channel's routes use: the span of their horizontal runs inside it, plus one track on each side.
 function chanCaps(pg,dense){if(!pg.gaps||!pg.lines)return null;var cut=false,cap=pg.gaps.map(function(g){var ys=[];pg.lines.forEach(function(l){for(var i=1;i<l.points.length;i++){var a=l.points[i-1],b=l.points[i];if(Math.abs(a[1]-b[1])<0.5&&Math.abs(a[0]-b[0])>0.5&&a[1]>g.y0-0.5&&a[1]<g.y1+0.5)ys.push(a[1]);}});
   var have=Math.round((g.y1-g.y0)/G),levels=ys.map(function(y){return Math.round(y);}).filter(function(y,i,all){return all.indexOf(y)===i;}).length,spanN=ys.length?Math.ceil((Math.max.apply(null,ys)-Math.min.apply(null,ys))/G)+2:1,need=ys.length?Math.min(spanN,Math.round(levels+2+(spanN-levels-2)*(1-dense))):1;if(need<have)cut=true;return need;});return cut?cap:null;}
 function diagram(input,o){
  var t0=tree(input.layout),f0=t0.byKey.get(o.focus),style0=o.style&&o.style!=='auto'?o.style:o.scope==='site'||!f0?'box':'plate';
  // Stack cables (owner request: stacks drawn as stacks with their VSF links): link 2 of each member to
  // link 1 of the next, three or more closing a ring, both ways for two members; drawn inside the stack.
  // Hardware with several profiled members and no grid (callers other than the app) is a stack all the same.
  [input.layout.all,input.layout.nodes].forEach(function(list){(list||[]).forEach(function(n){var hw=n.hw;if(!hw||hw.grid||hw.chassis||!hw.members)return;var ms=hw.members.filter(function(m){return m.profile;});if(ms.length<2)return;ms.forEach(function(m,i){m.row=i;m.col=0;});
   var tech=hw.technology||'';hw.grid={cols:1,rows:ms.length,stack:true,title:(/vsf/i.test(tech)?'VSF stack':tech&&!/^stack$/i.test(tech)?tech+' stack':'Stack')+' \u00b7 '+ms.length+' members'};});});
  if(style0!=='box'){var extra=[];input.layout.all.forEach(function(n){var hw=n.hw;if(!hw||!hw.grid||!hw.grid.stack||!hw.links||!hw.links.length)return;var ms=hw.members.filter(function(m){return m.profile;}),tech=hw.technology||'',port=function(id,lk){var p=hw.links.find(function(x){return String(x.member)===String(id)&&String(x.link)===String(lk);});return p&&p.port;},t=/vsf/i.test(tech)?'VSF':/backplane/i.test(tech)?'':tech;
    for(var i=0;i<ms.length;i++){var j=i+1;if(j===ms.length){if(ms.length<3)break;j=0;}var pa=port(ms[i].id,2),pb=port(ms[j].id,1);if(pa&&pb)extra.push({a:n.key,b:n.key,aPort:pa,bPort:pb,stack:true,tech:t});}
    if(ms.length===2){var p1=port(ms[1].id,2),p0=port(ms[0].id,1);if(p1&&p0)extra.push({a:n.key,b:n.key,aPort:p1,bPort:p0,stack:true,tech:t});}});
   if(extra.length)input=Object.assign({},input,{links:(input.links||[]).concat(extra)});}
  var s=scope(input.layout,o),t=s.tree,focus=t.byKey.get(o.focus),style=o.style&&o.style!=='auto'?o.style:o.scope==='site'||!focus?'box':'plate';
  var fname=focus&&focus.name;
  var title=o.scope==='site'||!focus?(o.title||'Site')+' - Existing Topology':fname+(o.scope==='neighbors'?' - Connections':' and below');
  var kicker=(o.title||'Site')+(o.scope==='site'||!focus?'':' / '+fname),sub=o.subtitle||(o.scope==='site'||!focus?'Devices and links from imported neighbor and monitoring data':[focus.model,(focus.ips||[])[0]].filter(Boolean).join('  |  '));
  if(o.customTitle)title=o.customTitle;if(o.customSubtitle)sub=o.customSubtitle;
  var view={company:o.company?String(o.company).toUpperCase():'',footer:o.author?'Prepared by '+o.author+(o.date?'  |  '+o.date:''):(o.date||''),title:title,kicker:kicker,subtitle:sub,rows:s.rows,context:s.context,style:style,aps:o.aps,apGroup:!!o.apGroup,others:o.others,wan:o.wan,modules:o.modules,moduleArt:o.moduleArt||null,vlansFor:o.scope==='site'||o.noVlans?null:o.focus,maxRow:o.maxRow,linkStyles:o.linkStyles,tallAps:!!o.tallAps};
  // Diagrams are meant to print on a letter sheet: try several row widths and keep the
  // one that needs the least shrinking (in either orientation).
  // Hand edits keep the arrangement they were made on.
  if(o.edits&&o.edits.maxRow&&!o.maxRow)view.maxRow=o.edits.maxRow;
  // Row width: estimated sizes (without routes) shortlist the arrangements, and the best
  // three are drawn in full; the one that prints largest on the sheet wins (routes around
  // the edge can make an estimate optimistic).
  view.edits=o.edits||null;var page=null;
  if(!view.maxRow){var cands=[],seen={};(style==='box'?[3,4,6,8,10,14]:[1,2,3,4,5,6]).forEach(function(c){var m=render(input,Object.assign({},view,{maxRow:c,measure:true})),f=fitLetter(m),k=Math.round(m.w)+'x'+Math.round(m.h);if(seen[k])return;seen[k]=true;cands.push({c:c,raw:f.raw});});
   cands.sort(function(a,b){return b.raw-a.raw||a.c-b.c;});var best=null;cands.slice(0,3).forEach(function(cd){if(best&&cd.raw<best.est*0.75)return;var pg=render(input,Object.assign({},view,{maxRow:cd.c})),raw=fitLetter(pg).raw;if(!best||raw>best.raw*1.02)best={c:cd.c,raw:raw,est:cd.raw,page:pg};});view.maxRow=best.c;page=best.page;}
  else page=render(input,view);
  // Compaction (owner request: links close together but open space around them): each channel is cut to
  // the tracks its routes used plus one on each side, and kept only when routing stays as good (no more
  // relaxed routes or hops). The caps come from the drawing without hand edits, so editing never shifts it.
  // Nor may it add bends or length (owner request: no detours to save space).
  if(style==='plate'){var bad=function(pg){var r=0,h=0,b=0,n=0;pg.lines.forEach(function(l){if(!l.strict)r++;h+=l.arcs?Object.keys(l.arcs).length:0;b+=Math.max(0,l.points.length-2);for(var i=1;i<l.points.length;i++)n+=Math.abs(l.points[i][0]-l.points[i-1][0])+Math.abs(l.points[i][1]-l.points[i-1][1]);});return [r,h,b,n];},
    plain=view.edits?render(input,Object.assign({},view,{edits:null})):page,b0=bad(plain);
   // First as many tracks as the routes have levels (lines spread out to fill a wide channel), then the span they used.
   [1,0.5,0].some(function(dense){var cap=chanCaps(plain,dense);if(!cap)return false;var tight=render(input,Object.assign({},view,{edits:null,chanCap:cap})),b1=bad(tight);if(b1[0]<=b0[0]&&b1[1]<=b0[1]&&b1[2]<=b0[2]&&b1[3]<=b0[3]){view.chanCap=cap;page=view.edits?render(input,view):tight;return true;}return false;});}
  // Every text gets a key (its group and original wording) so the editor can change it.
  var te=o.edits&&o.edits.texts||{};page.shapes.forEach(function(s){if(s.type!=='text')return;s.tkey=(s.node||'')+'|'+s.text;if(te[s.tkey]!=null)s.text=te[s.tkey];});
  fitTexts(page);
  page.scope=o;page.style=style;page.maxRow=view.maxRow;page.letter=fitLetter(page);return page;
 }
 // Paper (owner request: any page size, landscape or portrait): each page is fitted to the chosen sheet
 // with 0.35 in margins, in the orientation that needs less shrinking unless one is chosen. Letter
 // keeps content within the area letter and A4 share (11 x 8.27 in) so its pages read on either.
 // Small drawings grow on larger sheets (devices and text print bigger), up to twice their size.
 var LETTER_MARGIN=0.35*96;
 var PAPERS={fit:{name:'Fit to drawing',w:11,h:8.5,fit:true},letter:{name:'Letter',w:11,h:8.5},legal:{name:'Legal',w:14,h:8.5},tabloid:{name:'Tabloid (11 x 17)',w:17,h:11},'ansi-c':{name:'ANSI C (17 x 22)',w:22,h:17},'ansi-d':{name:'ANSI D (22 x 34)',w:34,h:22},a4:{name:'A4',w:11.69,h:8.27},a3:{name:'A3',w:16.54,h:11.69},a2:{name:'A2',w:23.39,h:16.54}};
 var PAPER={key:'letter',orient:'auto'};
 function setPaper(o){var key=o&&PAPERS[o.key]?o.key:'letter',orient=o&&/^(landscape|portrait)$/.test(o.orient)?o.orient:'auto';PAPER={key:key,orient:orient};var d=PAPERS[key],port=orient==='portrait';
  DOC_W=Math.round((port?d.h:d.w)*96);DOC_H=Math.round((port?d.w:d.h)*96);DOC_BOTTOM=DOC_H-56;return paperInfo();}
 function paperInfo(){var d=PAPERS[PAPER.key];return {key:PAPER.key,orient:PAPER.orient,name:d.name,w:d.w,h:d.h,fit:!!d.fit,maxScale:d.fit?1:Math.max(1,Math.min(2,Math.min(d.w,d.h)/8.5))};}
 function fitLetter(p){var d=PAPERS[PAPER.key],L={W:d.w*96,H:d.h*96},P={W:d.h*96,H:d.w*96},A=PAPER.key==='letter'?8.27*96:null,maxK=paperInfo().maxScale;
  // Documentation pages are drawn on the sheet itself, margins included.
  if(p.doc&&p.w<=DOC_W+0.5&&p.h<=DOC_H+0.5)return {W:DOC_W,H:DOC_H,raw:1,scale:1,landscape:DOC_W>=DOC_H,ox:0,oy:0};
  // Fit to drawing (owner request, as Visio does by default): the page is the drawing's own size at full
  // scale, so any number of devices fits on one page. raw still rates arrangements against a 17 x 11 in
  // sheet, so the most compact landscape arrangement is chosen.
  if(d.fit){var M=LETTER_MARGIN;return {W:Math.round(p.w+2*M),H:Math.round(p.h+2*M),raw:Math.min((17*96-2*M)/p.w,(11*96-2*M)/p.h),scale:1,landscape:p.w>=p.h,ox:M,oy:M,paper:d.name,fit:true};}
  function f(o,land){var W=A?Math.min(o.W,land?o.W:A):o.W,H=A?Math.min(o.H,land?A:o.H):o.H;return Math.min((W-2*LETTER_MARGIN)/p.w,(H-2*LETTER_MARGIN)/p.h);}
  var land=PAPER.orient==='landscape'?true:PAPER.orient==='portrait'?false:f(L,true)>=f(P,false),o=land?L:P,raw=f(o,land),k=Math.min(maxK,raw);return {W:o.W,H:o.H,raw:raw,scale:k,landscape:land,ox:(o.W-p.w*k)/2,oy:(o.H-p.h*k)/2,paper:d.name};}
 // A line hop: the circular arc from a to b (a horizontal chord) bowing `bow` px upward,
 // sampled for SVG; Visio writes the same arc as one ArcTo row.
 function arcPoints(a,b,bow){var L=Math.abs(b[0]-a[0]),rr=(L*L/4+bow*bow)/(2*bow),cx=(a[0]+b[0])/2,d=Math.max(0,rr-bow),cy=a[1]+d,ta=Math.atan2(-d,a[0]-cx),tb=Math.atan2(-d,b[0]-cx),out=[];
  for(var t=1;t<=8;t++){var th=ta+(tb-ta)*t/8;out.push([Math.round((cx+rr*Math.cos(th))*100)/100,Math.round((cy+rr*Math.sin(th))*100)/100]);}out[out.length-1]=[b[0],b[1]];return out;}
 function linePoints(s){if(!s.arcs)return s.points;var out=[s.points[0]];for(var i=1;i<s.points.length;i++){if(s.arcs[i])out=out.concat(arcPoints(s.points[i-1],s.points[i],s.arcs[i]));else out.push(s.points[i]);}return out;}
 // The page drawn on letter paper: every coordinate, size, line and font scaled.
 function onLetter(page){
  if(page.paper)return page;var f=fitLetter(page),k=f.scale,out=new Page(page.title);out.w=f.W;out.h=f.H;out.paper=f;
  page.shapes.forEach(function(x){var y=Object.assign({},x);
   if(y.type==='line'){y.points=x.points.map(function(p){return [Math.round((f.ox+p[0]*k)*100)/100,Math.round((f.oy+p[1]*k)*100)/100];});if(x.arcs){y.arcs={};Object.keys(x.arcs).forEach(function(i){y.arcs[i]=x.arcs[i]*k;});}}else{y.x=f.ox+x.x*k;y.y=f.oy+x.y*k;y.w=x.w*k;y.h=x.h*k;}
   ['size','lineHeight','width','radius'].forEach(function(c){if(y[c])y[c]=x[c]*k;});out.shapes.push(y);});
  return out;
 }
 // Site book: the whole site, then one downstream page for each switch with switches or
 // access points below it (a small subtree on one page; a large one one level at a time).
 function build(input){
  var map=input.layout,t=tree(map),extra=input.meta||{},pages=[diagram(input,Object.assign({scope:'site',title:input.title||'Site'},extra))];
  function isSwitch(k){var n=t.byKey.get(k);return n&&/switch|router|controller/.test(n.role);}
  function subtree(k){var out=[],stack=[k];while(stack.length){var c=stack.pop();out.push(c);(t.children.get(c)||[]).forEach(function(x){if(isSwitch(x))stack.push(x);});}return out;}
  var visited=new Set();
  function visit(k){if(visited.has(k)||pages.length>=40)return;visited.add(k);var kids=(t.children.get(k)||[]).filter(isSwitch),aps=(t.byKey.get(k).attached||[]).some(function(a){return a.role==='ap';}),tree2=subtree(k);
   if(!kids.length&&!aps)return;
   if(tree2.length<=6){pages.push(diagram(input,Object.assign({scope:'downstream',focus:k,depth:0,title:input.title},extra)));tree2.forEach(function(x){visited.add(x);});return;}
   pages.push(diagram(input,Object.assign({scope:'downstream',focus:k,depth:1,title:input.title},extra)));kids.forEach(visit);}
  map.nodes.filter(function(n){return isSwitch(n.key);}).sort(function(a,b){return a.y-b.y||a.x-b.x;}).forEach(function(n){visit(n.key);});
  return {pages:pages,linkTypes:LINK_TYPES,kinds:KINDS};
 }


 // ---------- documentation pages ----------
 // Letter pages (11 x 8.5 in) that document the site the way a hand-made network handbook
 // does: the port map (faceplates coloured by port role, and what each group of ports is
 // for), wireless connections, VLANs and routing, and trunk VLANs. Built from the
 // configurations and supplementary data in input.docs; a page is left out when there is
 // nothing for it.
 var DOC_W=1056,DOC_H=816,DM=40,DOC_BOTTOM=DOC_H-56;
 // The short number printed on a port: 1/1/41 -> 41, port3 -> 3, x3 stays x3.
 function portNumber(n){var s=String(n||'').split('/').pop();return s.replace(/^(?:port|ethernet|eth|gi|te|ge)\s*/i,'')||s;}
 var PORT_ROLES={wired:{label:'Wired data / voice',fill:'#8d9bbd'},ap:{label:'Wireless access points',fill:'#7fd1a6'},uplink:{label:'Backbone / uplink',fill:'#a9d3e6'},trunk:{label:'Trunk',fill:'#c9b6e4'},routed:{label:'Routed',fill:'#f2c38b'},access:{label:'Default access',fill:'#dfe3e8'},unused:{label:'Not configured',fill:'#f4f5f7'},disabled:{label:'Disabled',fill:'#f4f5f7'}};
 function docPage(title,sub,o){var p=new Page(title);p.doc=true;p.lines=[];p.devices=[];p.subtitle=sub||'';
  p.text(DM,22,640,14,((o.company?o.company+'  /  ':'')+(o.title||'Site')).toUpperCase(),{size:9.5,bold:true,align:'left',color:'#1d5b79'});
  p.text(DOC_W-DM-300,22,300,14,'NETWORK DOCUMENTATION',{size:9.5,bold:true,align:'right',color:'#1d5b79'});
  p.text(DM,40,900,30,title,{size:24,bold:true,align:'left',color:'#1b3a4b'});
  if(sub)p.text(DM,72,960,16,sub,{size:11,align:'left',color:'#4a5568'});
  p.rect(DM,94,DOC_W-2*DM,1,{fill:'#c9d3df',stroke:'none'});p.y=110;return p;}
 // Pages that continue when their content runs past the bottom margin.
 function Flow(title,sub,o,out){this.title=title;this.sub=sub;this.o=o;this.out=out;this.page=null;this.n=0;}
 Flow.prototype.need=function(h){if(!this.page||this.page.y+h>DOC_BOTTOM){this.page=docPage(this.title+(this.n?' (continued)':''),this.sub,this.o);this.n++;this.out.push(this.page);if(this.onPage)this.onPage(this.page);}return this.page;};
 function cellText(v){return v==null?'':typeof v==='object'?String(v.text==null?'':v.text):String(v);}
 function rowHeight(r,widths){var n=1;r.forEach(function(v,i){var t=cellText(v),per=Math.max(8,Math.floor((widths[i]-14)/5.4));t.split('\n').forEach(function(line,j){n=Math.max(n,(j?n:0)+0);});var lines=t.split('\n').reduce(function(c,line){return c+Math.max(1,Math.ceil(line.length/per));},0);n=Math.max(n,lines);});return 10+13*n;}
 function wrap(t,width){var per=Math.max(8,Math.floor((width-14)/5.4));return cellText(t).split('\n').map(function(line){var out=[],cur='';line.split(/(?<=[,;] )|(?= \| )| |(?<=-)(?=[^\s-]{3,})/).forEach(function(w){if((cur+w).length>per&&cur){out.push(cur.trim());cur=w;}else cur+=(cur&&!/[,;] $/.test(cur)&&!/-$/.test(cur)?' ':'')+w;});out.push(cur.trim());return out.join('\n');}).join('\n');}
 // A table that continues on the next page; header repeated.
 function docTable(flow,cols,rows,o){o=o||{};var w=DOC_W-2*DM,widths=cols.map(function(c){return c.w*w;}),labels=cols.map(function(c,i){return wrap(c.label,widths[i]+4);}),hh=14+12*Math.max.apply(null,labels.map(function(l){return l.split('\n').length;}));
  function head(p){p.rect(DM,p.y,w,hh,{fill:'#1b3a4b',stroke:'none'});var cx=DM;cols.forEach(function(c,i){p.text(cx+5,p.y+7,widths[i]-8,hh-8,labels[i],{size:9.5,bold:true,align:c.align||'left',color:'#ffffff',lineHeight:12});cx+=widths[i];});p.y+=hh;}
  var p=flow.need(hh+30);if(o.heading){p.text(DM,p.y,w,20,o.heading,{size:14,bold:true,align:'left',color:'#1b3a4b'});p.y+=26;}head(p);
  rows.forEach(function(r,ri){var h=rowHeight(r,widths);if(flow.page.y+h>DOC_BOTTOM){p=flow.need(DOC_H);head(p);}p=flow.page;
   if(ri%2)p.rect(DM,p.y,w,h,{fill:'#f1f4f8',stroke:'none'});var cx=DM;
   r.forEach(function(v,i){var cell=v&&typeof v==='object'?v:{text:v},t=cellText(cell),al=cols[i].align||'left';
    if(cell.chip&&t){var cw=22,x0=al==='center'?cx+widths[i]/2-cw/2:cx+7;p.rect(x0,p.y+(h-16)/2,cw,16,{fill:cell.chip,stroke:'none',radius:2});p.text(x0,p.y+(h-16)/2+2,cw,12,t,{size:9,bold:true,align:'center',color:cell.color||'#1f2937'});}
    else if(t)p.text(cx+7,p.y+5,widths[i]-10,h-6,al==='left'?wrap(t,widths[i]):t,{size:cell.size||10,bold:!!cell.bold,align:al,color:cell.color||'#1f2937',lineHeight:13});
    if(cell.bar)p.rect(cx,p.y,3,h,{fill:cell.bar,stroke:'none'});cx+=widths[i];});p.y+=h;});
  flow.page.rect(DM,flow.page.y,w,1,{fill:'#c9d3df',stroke:'none'});flow.page.y+=o.after==null?20:o.after;}
 function note(flow,text,o){o=o||{};var w=DOC_W-2*DM,t=wrap(text,w+60),h=t.split('\n').length*14+(o.box?18:4),p=flow.need(h+8);
  if(o.box)p.rect(DM,p.y,w,h,{fill:o.box,stroke:'none'});p.text(DM+(o.box?12:0),p.y+(o.box?8:0),w-(o.box?24:0),h,t,{size:10,align:'left',color:'#374151',lineHeight:14,bold:!!o.bold});p.y+=h+12;}
 // Port names to compact ranges: 1/1/2-1/1/36 -> 2-36 (with the shared prefix said once).
 function splitName(n){var m=String(n).match(/^(.*?)(\d+)$/);return m?{pre:m[1],n:Number(m[2])}:{pre:String(n),n:null};}
 function ranges(names,strip){var parts=names.map(splitName).sort(function(a,b){return a.pre.localeCompare(b.pre)||(a.n||0)-(b.n||0);}),out=[],run=null;
  parts.forEach(function(p){if(run&&p.n!=null&&run.pre===p.pre&&p.n===run.b+1){run.b=p.n;return;}if(run)out.push(run);run=p.n==null?{pre:p.pre,a:null,b:null}:{pre:p.pre,a:p.n,b:p.n};});if(run)out.push(run);
  return out.map(function(r){var pre=strip&&r.pre===strip?'':r.pre;return r.a==null?r.pre:r.a===r.b?pre+r.a:pre+r.a+'-'+r.b;}).join(', ');}
 function commonPrefix(names){var pres=names.map(function(n){return splitName(n).pre;}).filter(Boolean),counts={};pres.forEach(function(p){counts[p]=(counts[p]||0)+1;});var best=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];return best&&counts[best]>=names.length*0.6&&/\//.test(best)?best:'';}
 function vlanList(ids){return ids.length>10?ids.length+' VLANs ('+ids.slice(0,6).join(', ')+' ...)':ids.join(', ');}
 function portRole(p){if(/disabled|down by admin|shutdown/i.test(p.admin||''))return 'disabled';var nr=p.neighbor&&p.neighbor.role;if(nr==='ap')return 'ap';if(nr&&/switch|firewall|router|controller/.test(nr)||p.lag)return 'uplink';if(p.ip)return 'routed';if(p.mode==='trunk'||p.tagged&&p.tagged.length)return p.native&&p.native!=='1'&&!(p.tagged.length>6)?'wired':'trunk';if(p.native&&p.native!=='1')return 'wired';return p.native?'access':'unused';}
 function portDetail(p,role){if(role==='disabled')return 'Administratively disabled';if(role==='routed')return [p.ip,p.description].filter(Boolean).join(', ');var bits=[];if(role==='uplink'&&p.neighbor)bits.push('To '+p.neighbor.name);if(p.native)bits.push((p.tagged&&p.tagged.length?'Native VLAN ':'VLAN ')+p.native);if(p.tagged&&p.tagged.length)bits.push('tagged '+(p.tagged.length===1?'VLAN ':'')+vlanList(p.tagged));if(p.lag)bits.push(p.lag);if(!bits.length&&p.description)bits.push(p.description);return bits.join(', ')||(role==='unused'?'No VLAN or address configured':'No VLAN configured');}
 function upCount(d){var known=d.ports.filter(function(p){return p.up!=null;});return known.length?known.filter(function(p){return p.up;}).length+' of '+d.ports.length+' ports up':'';}
 function portMapPages(docs,o,out){
  var devs=docs.devices.filter(function(d){return d.ports.length&&/switch|router|firewall|controller/.test(d.role);});if(!devs.length)return;
  // Firewalls and routers each on a page of their own; switches two to a page.
  var groups=[];devs.filter(function(d){return /firewall|router/.test(d.role);}).forEach(function(d){groups.push([d]);});var sw=devs.filter(function(d){return !/firewall|router/.test(d.role);});for(var gi=0;gi<sw.length;gi+=2)groups.push(sw.slice(gi,gi+2));
  for(var start=0;start<groups.length;start++){var group=groups[start],flow=new Flow('Port map',group.map(function(d){return d.name;}).join(' and ')+': front panels, configured port roles and observed link state',o,out),used={},rowsByKey=new Map();
   // The port role legend heads every page of the port map (owner request), not only the last.
   group.forEach(function(d){d.ports.forEach(function(p){used[portRole(p)]=true;});});
   flow.onPage=function(p){var lx=DM;p.text(lx,p.y,90,16,'PORT ROLES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});lx+=96;
    Object.keys(PORT_ROLES).filter(function(r){return used[r];}).forEach(function(r){var lw=40+PORT_ROLES[r].label.length*5.6;if(lx+lw>DOC_W-DM){lx=DM+96;p.y+=20;}p.rect(lx,p.y,26,14,{fill:PORT_ROLES[r].fill,stroke:'#7a8ca8',width:0.75});p.text(lx+32,p.y,170,16,PORT_ROLES[r].label,{size:10,align:'left'});lx+=lw;});p.y+=22;
    p.text(DM,p.y,DOC_W-2*DM,14,'Filled: link up (or no link state imported). Outlined: link down.',{size:9,align:'left',color:'#4a5568'});p.y+=24;};
   group.forEach(function(d){var st=o.stencils&&o.stencils.get(d.key),dev=new Device({key:d.key,name:d.name,model:d.model,role:d.role,hw:d.hw,ips:d.ip?[d.ip]:[],stencil:st},d.ports.map(function(p){return p.name;}),[],'plate'),fills=new Map();
    d.ports.forEach(function(p){var role=portRole(p),slot=d.hw&&dev.hw&&!dev.hw.portOf(p.name)?null:dev.slot(p.name);used[role]=true;if(slot&&slot.key)fills.set(slot.key,{fill:PORT_ROLES[role].fill,up:p.up!==false,stroke:'#3d4a5c',label:portNumber(p.name)});
     var detail=portDetail(p,role),k=role+'|'+detail;if(!rowsByKey.has(k))rowsByKey.set(k,{role:role,detail:detail,ports:{}});(rowsByKey.get(k).ports[d.key]=rowsByKey.get(k).ports[d.key]||[]).push(p.name);});
    // Heading: the name, then right beside it the model (owner request: next to the switch, not at the
    // far edge), then the link count and address.
    function heading(pg,title,model,extra){pg.text(DM,pg.y,560,20,title,{size:15,bold:true,align:'left',color:'#1b3a4b'});var x=DM+textW(title,15,true)*1.15+16,rest=[model].concat(extra||[]).filter(Boolean).join('   |   ');if(rest)pg.text(x,pg.y+4,DOC_W-DM-x,16,rest,{size:10.5,bold:false,align:'left',color:'#4a5568'});}
    var grid=dev.hw&&dev.hw.chassis&&dev.hw.grid,pls=dev.plates;
    // A member's or module's ports, as on its label: "48 RJ-45 + 4 SFP+".
    function summary(i){var mem=dev.hw&&dev.hw.members&&dev.hw.members.filter(function(m){return m.profile;})[i],counts={},order=[];if(!mem)return '';mem.profile.banks.forEach(function(b){if(b.mirror)return;var f=String(b.displayForm||b.form).replace(/^RJ45$/,'RJ-45').replace(/^Shared RJ45 \/ (SFP\+?)$/,'RJ-45 / $1');if(!(f in counts)){counts[f]=0;order.push(f);}counts[f]+=b.names.length;});return order.sort(function(a,b){return counts[b]-counts[a];}).map(function(f){return counts[f]+' '+f;}).join(' + ');}
    // A chassis as it is built (owner request): the whole device with its module grid, scaled down only
    // when it is taller than the page.
    if(grid&&dev.grid&&!dev.stencil){var pg=flow.need(26+Math.min(dev.plateH,420)+24);heading(pg,d.name,[d.model,grid.title].filter(Boolean).join(' '),[upCount(d),d.ip]);pg.y+=26;
     var k=Math.min(1,(DOC_BOTTOM-pg.y-12)/dev.plateH,(DOC_W-2*DM)/dev.w),tmp=new Page(''),one=Object.create(dev);one.noLabel=true;one.x=0;one.y=-HEAD;drawPlate(tmp,one,null,fills);
     tmp.shapes.forEach(function(sh){var t=Object.assign({},sh);if(t.type==='line')t.points=sh.points.map(function(q){return [DM+q[0]*k,pg.y+q[1]*k];});else{t.x=DM+sh.x*k;t.y=pg.y+sh.y*k;t.w=sh.w*k;t.h=sh.h*k;}['size','lineHeight','width','radius'].forEach(function(c){if(t[c])t[c]=sh[c]*k;});pg.shapes.push(t);});pg.grow(DM+dev.w*k,pg.y+dev.plateH*k);
     pg.y+=dev.plateH*k+20;return;}
    // A stack (owner request: compact, like a switchport map): one heading, then each member right below
    // the last under a slim bar with its member number, model and ports.
    var chassis=dev.hw&&dev.hw.chassis;
    if(pls.length>1&&!chassis&&!dev.stencil){var models=pls.map(function(pl){return pl.model;}).filter(function(m,i,a){return m&&a.indexOf(m)===i;}).join(' / ')||d.model,pg=flow.need(26+14+72+8);heading(pg,d.name,models,[upCount(d),d.ip]);pg.y+=26;
     pls.forEach(function(pl,i){var before=flow.page;pg=flow.need(14+72+8);if(pg!==before){heading(pg,d.name+' (continued)',models,[]);pg.y+=26;}
      pg.rect(DM,pg.y,pl.w,14,{fill:'#1b3a4b',stroke:'none',radius:3});pg.text(DM+6,pg.y+2,pl.w-12,11,['Member '+pl.member,pl.model||d.model,summary(i)].filter(Boolean).join('  |  '),{size:8.5,bold:true,align:'left',color:'#ffffff'});pg.y+=15;
      var keep=pl.x,ky=pl.y;pl.x=0;pl.y=0;var one=Object.create(dev);one.noLabel=true;one.plates=[pl];one.x=DM;one.y=pg.y-HEAD;one.w=pl.w;one.grid=null;one.plateH=72;drawPlate(pg,one,null,fills);pl.x=keep;pl.y=ky;pg.y+=72+8;});
     pg.y+=10;return;}
    pls.forEach(function(pl,pi){var ph=dev.h+40,pg=flow.need(ph+14),own=pls.length>1?(chassis?'  ·  slot '+pl.member:'  ·  member '+pl.member):'';
     // Each stack member or module names its own model (members of one stack can differ).
     heading(pg,d.name+own,pls.length>1?pl.model||d.model:d.model,!pi?[upCount(d),d.ip]:[]);
     var keep=pl.x,ky=pl.y;pl.x=0;pl.y=0;var one=Object.create(dev);one.noLabel=true;one.plates=[pl];one.x=DM;one.y=pg.y+26-HEAD;one.w=pl.w;one.grid=null;drawPlate(pg,one,null,fills);pl.x=keep;pl.y=ky;pg.y+=26+72+18;});});
   (function(){var pre=commonPrefix([].concat.apply([],group.map(function(d){return d.ports.map(function(x){return x.name;});})));if(pre)note(flow,'Port numbers use the prefix '+pre+'.');})();
   var pre=commonPrefix([].concat.apply([],group.map(function(d){return d.ports.map(function(x){return x.name;});}))),order=Object.keys(PORT_ROLES);
   var rows=Array.from(rowsByKey.values()).sort(function(a,b){return order.indexOf(a.role)-order.indexOf(b.role);}).map(function(r){return [{text:PORT_ROLES[r.role].label,bold:true,bar:PORT_ROLES[r.role].fill}].concat(group.map(function(d){return r.ports[d.key]?ranges(r.ports[d.key],pre):'';}),[r.detail]);});
   var cw=group.length===1?[0.24,0.28,0.48]:[0.22,0.2,0.2,0.38];docTable(flow,[{label:'Port assignment',w:cw[0]}].concat(group.map(function(d,i){return {label:d.name+' ports',w:cw[i+1]};}),[{label:'VLANs and link details',w:cw[cw.length-1]}]),rows);}
 }
 function wirelessPages(docs,o,out,input){
  var devs=docs.devices.filter(function(d){return d.ports.some(function(p){return p.neighbor&&p.neighbor.role==='ap';});});if(!devs.length)return;
  // Each switch drawn with its access points wired to their own ports (odd ports above,
  // even ports below), as on a hand-drawn wireless page; then the table of them all.
  if(input&&input.layout){var keys=input.layout.nodes.map(function(n){return n.key;});devs.forEach(function(d){if(keys.indexOf(d.key)<0)return;try{
   var n=d.ports.filter(function(p){return p.neighbor&&p.neighbor.role==='ap';}).length,pg=diagram(input,{scope:'downstream',focus:d.key,depth:0,style:'auto',upstream:false,aps:true,tallAps:true,others:false,hidden:new Set(keys.filter(function(k){return k!==d.key;})),added:new Set(),title:o.title,edits:o.wirelessEdits&&o.wirelessEdits[d.key]||undefined,linkStyles:o.linkStyles,customTitle:'Wireless connections',customSubtitle:d.name+'  |  '+[d.model,d.ip,n+' access point'+(n===1?'':'s')].filter(Boolean).join('  /  '),company:o.company,noVlans:true});
   pg.h+=30;pg.wireless=d.key;out.push(pg);}catch(e){}});}
  var flow=new Flow('Wireless connections','Access points, the switch ports they connect to and their addresses',o,out);
  devs.forEach(function(d){var aps=d.ports.filter(function(p){return p.neighbor&&p.neighbor.role==='ap';}).sort(function(a,b){return (splitName(a.name).n||0)-(splitName(b.name).n||0);});
   docTable(flow,[{label:'Port',w:0.12},{label:'Access point',w:0.3},{label:'Model',w:0.18},{label:'Address',w:0.16},{label:'Speed',w:0.12},{label:'Link',w:0.12}],aps.map(function(p){var n=p.neighbor;return [{text:p.name,bold:true},n.name,n.model||'',n.ip||'',p.speed||'',p.up==null?'':{text:p.up?'Up':'Down',color:p.up?'#166534':'#b91c1c',bold:!p.up}];}),{heading:d.name+'  ·  '+[d.model,d.ip,aps.length+' access point'+(aps.length===1?'':'s')].filter(Boolean).join('  /  ')});});
  var slow=[];devs.forEach(function(d){d.ports.forEach(function(p){if(p.neighbor&&p.neighbor.role==='ap'&&speedValue(p.speed)&&speedValue(p.speed)<1000)slow.push(d.name+' '+p.name+' ('+p.neighbor.name+', '+p.speed+')');});});
  if(slow.length)note(flow,'Access points linked below 1 Gbps: '+slow.join('; ')+'.',{box:'#fff6e0'});}
 function routingPages(docs,o,out){
  var vlans=new Map(),ifaces=[],routes=[];docs.devices.forEach(function(d){(d.vlans||[]).forEach(function(v){var e=vlans.get(v.id)||{id:v.id,name:'',on:[],ips:[]};if(!e.name&&v.name)e.name=v.name;if(e.on.indexOf(d.name)<0)e.on.push(d.name);if(v.ip)e.ips.push(d.name+'  '+v.ip);vlans.set(v.id,e);});
   (d.addresses||[]).forEach(function(a){ifaces.push([{text:d.name,bold:true},a.iface,a.ip,a.note||'']);});(d.routes||[]).forEach(function(r){routes.push([{text:d.name,bold:true},r.dest,r.gateway,r.iface||'',r.note||'']);});});
  if(!vlans.size&&!ifaces.length&&!routes.length)return;
  var flow=new Flow('VLANs and routing','VLANs, routed interfaces and routes of '+docs.devices.map(function(d){return d.name;}).join(', '),o,out);
  if(vlans.size)docTable(flow,[{label:'VLAN',w:0.08},{label:'Name',w:0.2},{label:'Addresses (device and interface address)',w:0.4},{label:'Configured on',w:0.32}],Array.from(vlans.values()).sort(function(a,b){return Number(a.id)-Number(b.id);}).map(function(v){return [{text:v.id,bold:true},v.name,v.ips.join('\n'),v.on.join(', ')];}),{heading:'VLANs'});
  if(ifaces.length)docTable(flow,[{label:'Device',w:0.22},{label:'Interface',w:0.2},{label:'IPv4 address',w:0.2},{label:'Role or description',w:0.38}],ifaces,{heading:'Routed interfaces'});
  if(routes.length)docTable(flow,[{label:'Device',w:0.2},{label:'Destination',w:0.18},{label:'Gateway or next hop',w:0.3},{label:'Interface',w:0.14},{label:'Notes',w:0.18}],routes,{heading:'Routes and default gateways'});
  var seen=new Map(),dup=[];docs.devices.forEach(function(d){(d.addresses||[]).concat((d.vlans||[]).filter(function(v){return v.ip;}).map(function(v){return {iface:'VLAN '+v.id,ip:v.ip};})).forEach(function(a){var ip=String(a.ip).split('/')[0];if(!ip)return;var prev=seen.get(ip);if(prev&&prev.d!==d.name)dup.push(ip+' on '+prev.d+' '+prev.i+' and '+d.name+' '+a.iface);else if(!prev)seen.set(ip,{d:d.name,i:a.iface});});});
  if(dup.length)note(flow,'Repeated addresses: '+dup.join('; ')+'. Confirm whether the interfaces share a Layer 2 segment.',{box:'#fff6e0'});}
 // A device name without the words every device shares (EX-SITE-MDF-6100-1 -> MDF-6100-1).
 function shortName(name,devs){var toks=devs.map(function(d){return String(d.name).split('-');}),mine=String(name).split('-'),k=0;while(k<mine.length-3&&toks.every(function(t){return t[k]===mine[k];}))k++;return mine.slice(k).join('-');}
 function trunkPages(docs,o,out){
  var cols=[];docs.devices.forEach(function(d){var groups=new Map();d.ports.forEach(function(p){if(portRole(p)==='disabled'||!(p.tagged&&p.tagged.length))return;var sig=(p.native||'')+'|'+p.tagged.slice().sort().join(',');if(!groups.has(sig))groups.set(sig,{dev:d,native:p.native||'',tagged:p.tagged,ports:[],roles:{}});var g=groups.get(sig);g.ports.push(p.name);g.roles[portRole(p)]=true;});
   groups.forEach(function(g){var pre=commonPrefix(g.ports);g.label=g.dev.name;g.sub=(g.roles.ap?'APs ':g.roles.uplink?'Uplink ':'')+'ports '+ranges(g.ports,pre);cols.push(g);});});
  if(!cols.length)return;var colDevs=cols.map(function(c){return c.dev;}).filter(function(d,i,a){return a.indexOf(d)===i;});if(colDevs.length>1)cols.forEach(function(c){c.label=shortName(c.dev.name,colDevs);});var ids=new Set();cols.forEach(function(c){if(c.native)ids.add(c.native);c.tagged.forEach(function(t){ids.add(t);});});var names=new Map();docs.devices.forEach(function(d){(d.vlans||[]).forEach(function(v){if(v.name&&!names.has(v.id))names.set(v.id,v.name);});});
  var list=Array.from(ids).sort(function(a,b){return Number(a)-Number(b);});
  // As many port columns per page as fit at a readable width (owner request), and on each page only
  // the VLANs its columns carry.
  var per=Math.max(1,Math.floor((DOC_W-2*DM)*0.74/64)),pages=Math.ceil(cols.length/per);per=Math.ceil(cols.length/pages);
  // One flow (owner request): the next group of columns follows on the same page under its own heading
  // when it fits, instead of starting a page of its own.
  var flow=new Flow('Trunk VLANs','Native and tagged VLANs on trunk, wireless and uplink ports',o,out);
  flow.onPage=function(p){[['N','#1b3a4b','#ffffff','Native / untagged'],['T','#d6eef0','#1b3a4b','Tagged'],['-',null,'#9ca3af','Not carried']].forEach(function(k,i){var x=DM+i*190;if(k[1])p.rect(x,p.y,22,16,{fill:k[1],stroke:'none',radius:2});p.text(x,p.y+2,22,12,k[0],{size:9,bold:true,align:'center',color:k[2]});p.text(x+30,p.y+1,150,14,k[3],{size:10,align:'left'});});p.y+=30;};
  for(var c0=0;c0<cols.length;c0+=per){var part=cols.slice(c0,c0+per),cw=(1-0.26)/part.length,rows=list.filter(function(id){return part.some(function(c){return c.native===id||c.tagged.indexOf(id)>=0;});}),devs=part.map(function(c){return c.dev.name;}).filter(function(n,i,a){return a.indexOf(n)===i;});
   docTable(flow,[{label:'VLAN',w:0.07},{label:'Name',w:0.19}].concat(part.map(function(c){return {label:c.label+'\n'+c.sub,w:cw,align:'center'};})),rows.map(function(id){return [{text:id,bold:true},names.get(id)||''].concat(part.map(function(c){return c.native===id?{text:'N',chip:'#1b3a4b',color:'#ffffff'}:c.tagged.indexOf(id)>=0?{text:'T',chip:'#d6eef0',color:'#1b3a4b'}:{text:'-',color:'#9ca3af'};}));}),pages>1?{heading:devs.join(', ')+' ('+(c0/per+1)+' of '+pages+')'}:{});
   if(flow.page)flow.page.y+=18;}
 }
 function docPages(input,o){o=o||{};var docs=input.docs;if(!docs||!docs.devices||!docs.devices.length)return [];var out=[];
  var want=o.pages||{},skip=o.portMapSkip||new Set(),on=function(k){return want[k]!==false;};
  if(on('portmap'))portMapPages({devices:docs.devices.filter(function(d){return !skip.has(d.key);})},Object.assign({},o,{stencils:o.styleDrawn?null:input.stencils}),out);if(on('wireless'))wirelessPages(docs,o,out,input);if(on('routing'))routingPages(docs,o,out);if(on('trunks'))trunkPages(docs,o,out);
  out.forEach(function(p){if(p.doc){p.w=Math.max(DOC_W,p.w);p.h=Math.max(DOC_H,p.h);}});number(out,{offset:o.offset==null?1:o.offset,total:out.length+(o.offset==null?1:o.offset),footer:o.author?'Prepared by '+o.author+(o.date?'  |  '+o.date:''):(o.date||'')});out.forEach(function(p){p.letter=fitLetter(p);});return out;}
 // Page numbers and the footer across a set of pages.
 function number(pages,o){o=o||{};var n=o.total||pages.length,off=o.offset||0;pages.forEach(function(p,j){if(p.numbered)return;p.numbered=true;var i=j+off,w=p.w,h=p.h;p.rect(DM,h-44,w-2*DM,1,{fill:'#c9d3df',stroke:'none'});if(o.footer)p.text(DM,h-36,w/2,14,o.footer,{size:9,align:'left',color:'#4a5568'});p.text(w-DM-120,h-36,120,14,(i+1<10?'0':'')+(i+1)+' / '+(n<10?'0':'')+n,{size:9,bold:true,align:'right',color:'#1d5b79'});p.w=w;p.h=h;});return pages;}

 // ---------- SVG ----------
 function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function textSVG(s){var size=s.size||11,fill=s.color||'#1f2937',weight=s.bold?' font-weight="700"':'';
  if(s.rotate){var cx=s.x+s.w/2+size*0.35,y0=s.align==='right'?s.y:s.y+s.h;return '<text transform="translate('+cx+' '+y0+') rotate(-90)" font-size="'+size+'" text-anchor="'+(s.align==='right'?'end':'start')+'" fill="'+fill+'"'+weight+'>'+esc(s.text)+'</text>';}
  var lines=s.text.split('\n'),lh=s.lineHeight||size*1.3,anchor=s.align==='left'?'start':s.align==='right'?'end':'middle',x=s.align==='left'?s.x:s.align==='right'?s.x+s.w:s.x+s.w/2;
  return '<text x="'+x+'" y="'+(s.y+size)+'" font-size="'+size+'" text-anchor="'+anchor+'" fill="'+fill+'"'+weight+'>'+lines.map(function(l,i){return '<tspan x="'+x+'" dy="'+(i?lh:0)+'"'+(s.firstBold&&i===0?' font-weight="700"':'')+'>'+esc(l)+'</tspan>';}).join('')+'</text>';}
 function shapeSVG(s){
  if(s.type==='rect')return '<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="'+(s.radius||0)+'" fill="'+(s.fill||'none')+'" stroke="'+(s.stroke&&s.stroke!=='none'?s.stroke:'none')+'" stroke-width="'+(s.width||1)+'"'+(s.dash?' stroke-dasharray="6 4"':'')+(s.pkey?' data-port="'+esc(s.pkey)+'"':'')+'/>';
  if(s.type==='image')return s.art?'<svg x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" viewBox="0 0 '+s.art.w+' '+s.art.h+'" preserveAspectRatio="none" overflow="hidden">'+s.art.body+'</svg>':'';
  if(s.type==='line')return '<polyline'+(s.lkind?' data-kind="'+esc(s.lkind)+'"':'')+(s.lineKey?' data-line="'+esc(s.lineKey)+'" data-route="'+(s.route||[]).map(function(p){return p[0]+','+p[1];}).join(' ')+'"':'')+' points="'+linePoints(s).map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'"'+(s.dash?' stroke-dasharray="8 5"':'')+' stroke-linejoin="round" stroke-linecap="'+(s.dash?'butt':'round')+'"'+(s.ltitle?'><title>'+esc(s.ltitle)+'</title></polyline>':'/>');
  var t=textSVG(s);if(s.lkind)t=t.replace(/^<text /,'<text data-kind="'+esc(s.lkind)+'" ');return s.tkey?t.replace(/^<text /,'<text data-text="'+esc(s.tkey)+'" '):t;}
 // Where each port of a device sits on its stencil, as fractions of the artwork (for the
 // port point editor): every front port of the first member, by group and index.
 function stencilPorts(node,ports){var dev=new Device(node,ports||[],[],'plate');if(!dev.stencil||!dev.img)return null;var pl=dev.plates[0],out=[];
  pl.groups.forEach(function(g){if(g.rear)return;for(var i=0;i<g.count;i++){var name=g.names&&g.names[i]||'',s=dev.place(pl,g,i,name),label=g.labels?g.labels[i]:name?short(name):String((g.base||0)+(g.zero?i:i+1));
   out.push({k:g.name+'|'+i,label:label,name:name,fx:(s.ex-pl.x-G)/dev.img.w,fy:(s.py-dev.imgTop)/dev.img.h,exact:!!(dev.positions[s.key]&&dev.positions[s.key].exact)});}});
  return {items:out,ratio:dev.img.w/dev.img.h};}
 // Port anchors for a hardware pack (NetworkDiagramStudio's form): each of the device's own port
 // names with its point on the stencil as [x, y] fractions from the top left, where that point comes
 // from a mapping (hand-placed, an anchor or the stencil's connection points), not an estimate.
 function stencilAnchors(node,ports){var dev=new Device(node,ports||[],[],'plate');if(!dev.stencil||!dev.img)return {};var out={};
  (ports||[]).filter(physicalPort).forEach(function(name){var s=dev.slot(name),pos=s&&dev.positions[s.key];if(!pos||!pos.exact||!s.plate)return;var fx=(pos.x-s.plate.x-G)/dev.img.w,fy=(pos.y-dev.imgTop)/dev.img.h;if(fx>=0&&fx<=1&&fy>=0&&fy<=1)out[name]=[Math.round(fx*1e6)/1e6,Math.round(fy*1e6)/1e6];});return out;}
 // Text always fits its box (owner request): a label longer or with more lines than its box
 // grows the box (and its accent bar) to the right, and up or down away from where its link
 // meets it, so links stay attached.
 function textSize(t){var size=t.size||11,lines=String(t.text).split('\n'),lh=t.lineHeight||size*1.3,w=0;lines.forEach(function(l,i){var b=t.bold||t.firstBold&&i===0;w=Math.max(w,l.length*size*(b?0.6:0.55));});return {w:w,h:(lines.length-1)*lh+size*1.25};}
 function fitTexts(page){var groups={};page.shapes.forEach(function(s){if(!s.g)return;(groups[s.g]=groups[s.g]||[]).push(s);});
  Object.keys(groups).forEach(function(g){var list=groups[g],box=list.find(function(s){return s.type==='rect'&&s.w>20&&s.h>20;});if(!box)return;var bar=list.find(function(s){return s.type==='rect'&&s!==box&&s.w===4&&s.x===box.x;});
   list.forEach(function(t){if(t.type!=='text'||t.rotate)return;if(t.x<box.x-1||t.x>box.x+box.w||t.y<box.y-1||t.y>box.y+box.h)return;var m=textSize(t),pad=6;
    var left=t.align==='left'?t.x:t.align==='right'?t.x+t.w-m.w:t.x+t.w/2-m.w/2,right=left+m.w,needW=right-(box.x+box.w-pad);
    if(needW>0){box.w+=Math.ceil(needW);if(t.align!=='left')t.x+=0;t.w=Math.max(t.w,m.w);if(t.align==='center')t.x=box.x+(box.w-t.w)/2;}
    var needH=t.y+m.h-(box.y+box.h-pad);if(needH>0){needH=Math.ceil(needH);
     // Grow away from the link: up when a line ends on the box's bottom edge.
     var bottom=box.y+box.h,up=page.shapes.some(function(l){if(l.type!=='line')return false;var a=l.points[0],z=l.points[l.points.length-1];return [a,z].some(function(q){return Math.abs(q[1]-bottom)<2&&q[0]>=box.x-1&&q[0]<=box.x+box.w+1;});});
     if(up){box.y-=needH;list.forEach(function(x){if(x!==box&&x!==bar&&x.type==='text')x.y-=needH;});}box.h+=needH;if(bar){bar.y=box.y;bar.h=box.h;}}
    page.grow(box.x+box.w,box.y+box.h);});});}
 // Fits a device's known port groups onto a stencil's port points when their counts differ
 // (rack-ear points, a missing or merged port): the stencil's points become columns (top and
 // bottom), split into blocks at wide gaps; the device's columns take stencil columns in order,
 // each group starting where a block starts, skipping as few stencil columns as possible.
 function fitPorts(groups,cand){var banks=[];groups.forEach(function(g){if(g.rear||!g.count)return;var rows=g.mid?1:(g.rows||2);banks.push({g:g,rows:rows,ncols:rows===1?g.count:Math.ceil(g.count/2)});});if(!banks.length)return null;
  var pts=cand.slice().sort(function(a,b){return a.fx-b.fx;}),cols=[];
  var gx=[];for(var i=1;i<pts.length;i++){var d=pts[i].fx-pts[i-1].fx;if(d>0.002)gx.push(d);}gx.sort(function(a,b){return a-b;});var pitch=gx.length?gx[Math.floor(gx.length/4)]:0.02,tol=pitch*0.45;
  pts.forEach(function(p){var c=cols[cols.length-1];if(c&&p.fx-c.x<=tol){c.pts.push(p);c.x=c.pts.reduce(function(a,q){return a+q.fx;},0)/c.pts.length;}else cols.push({x:p.fx,pts:[p]});});
  cols.forEach(function(c){c.top=c.pts.filter(function(p){return !p.row;}).sort(function(a,b){return a.fy-b.fy;})[0]||null;c.bottom=c.pts.filter(function(p){return p.row;}).sort(function(a,b){return b.fy-a.fy;})[0]||null;});
  var N=banks.reduce(function(a,b){return a+b.ncols;},0);
  // Points on the rack ears or chassis edges are not ports.
  if(cols.length>N)cols=cols.filter(function(c,k){return !((k===0&&c.x<0.03)||(k===cols.length-1&&c.x>0.97));});
  var M=cols.length;if(M<N)return null;
  var cg=[];for(var k=1;k<M;k++)cg.push(cols[k].x-cols[k-1].x);var sg=cg.slice().sort(function(a,b){return a-b;}),step=sg[Math.floor(sg.length/2)]||pitch;
  // Each group takes consecutive stencil columns whose spacing follows the group's own pattern
  // (regular pitch, wider gaps between blocks of jacks); groups may skip stencil columns only
  // between them. A shifted placement breaks the pattern, so the right start wins clearly.
  banks.forEach(function(b){var g=b.g,xs=[];for(var c=0;c<b.ncols;c++)xs.push(portPos(g,b.rows===1?c:c*2).dx);var p0=g.pitch||18;b.eg=[];for(var c2=1;c2<xs.length;c2++)b.eg.push((xs[c2]-xs[c2-1])/p0);});
  // Skipping a stencil column (0.5) costs more than adding it to a cluster (0.12): points between
  // groups usually belong to one of them.
  // A group may cover more stencil columns than it has (a cage marked at both edges and its middle):
  // the run is split at its widest gaps into one cluster per column of the group.
  function clusters(s0,L,n){if(L===n){var one=[];for(var q=0;q<n;q++)one.push([s0+q]);return one;}var gs=[];for(var k=1;k<L;k++)gs.push({k:k,g:cols[s0+k].x-cols[s0+k-1].x});gs.sort(function(a,b){return b.g-a.g||a.k-b.k;});var cuts=gs.slice(0,n-1).map(function(x){return x.k;}).sort(function(a,b){return a-b;}),out=[],from0=0;cuts.concat([L]).forEach(function(c){var part=[];for(var q=from0;q<c;q++)part.push(s0+q);out.push(part);from0=c;});return out;}
  function centre(cl){return cl.reduce(function(a,k){return a+cols[k].x;},0)/cl.length;}
  function bankCost(b,cl){var c=0.12*(cl.reduce(function(a,x){return a+x.length;},0)-cl.length);for(var k=1;k<cl.length;k++){var sgap=(centre(cl[k])-centre(cl[k-1]))/step;c+=Math.min(1.5,Math.abs(sgap-b.eg[k-1]));}
   // A cluster no wider than a cage (two jacks a pitch apart are two ports, not one).
   cl.forEach(function(x){if(x.length>1){var span=cols[x[x.length-1]].x-cols[x[0]].x;if(span>step*1.5)c+=1;}});return c;}
  var B=banks.length,INF=1e9,dp=[],from=[];for(var bi=0;bi<=B;bi++){dp.push(new Array(M+1).fill(INF));from.push(new Array(M+1).fill(null));}for(var j0=0;j0<=M;j0++)dp[0][j0]=j0*0.5;
  for(var bi2=0;bi2<B;bi2++)for(var jj=0;jj<=M;jj++){var v=dp[bi2][jj];if(v>=INF)continue;var bk=banks[bi2];
   for(var st=jj;st+bk.ncols<=M;st++)for(var L=bk.ncols;L<=Math.min(3*bk.ncols,M-st);L++){var cl=clusters(st,L,bk.ncols),c3=v+(st-jj)*0.5+bankCost(bk,cl),end=st+L;if(c3<dp[bi2+1][end]){dp[bi2+1][end]=c3;from[bi2+1][end]={prev:jj,cl:cl};}}}
  var bestE=-1,bv=INF;for(var e2=0;e2<=M;e2++)if(dp[B][e2]+(M-e2)*0.5<bv){bv=dp[B][e2]+(M-e2)*0.5;bestE=e2;}if(bestE<0)return null;
  var picks=new Array(B),cur=bestE;for(var bb=B;bb>0;bb--){var f=from[bb][cur];if(!f)return null;picks[bb-1]=f.cl;cur=f.prev;}
  // One merged column per cluster: its centre, and its top and bottom points.
  var take=[],merged=[];picks.forEach(function(cl){cl.forEach(function(x){var tops=[],bots=[];x.forEach(function(k){if(cols[k].top)tops.push(cols[k].top);if(cols[k].bottom)bots.push(cols[k].bottom);});var avg=function(list){return list.length?{fx:list.reduce(function(a,p){return a+p.fx;},0)/list.length,fy:list.reduce(function(a,p){return a+p.fy;},0)/list.length}:null;};merged.push({x:centre(x),top:avg(tops),bottom:avg(bots)});take.push(merged.length-1);});});
  cols=merged;
  var out={},ys=[[],[]];cols.forEach(function(c){if(c.top)ys[0].push(c.top.fy);if(c.bottom)ys[1].push(c.bottom.fy);});var my=ys.map(function(v,r){v.sort(function(p,q){return p-q;});return v.length?v[Math.floor(v.length/2)]:r?0.65:0.35;});
  var at=0;banks.forEach(function(b){var g=b.g;for(var idx=0;idx<g.count;idx++){var c=b.rows===1?idx:Math.floor(idx/2),row=b.rows===1?0:portPos(g,idx).row,col=cols[take[at+c]],pt=row?col.bottom:col.top;
    out[g.name+'|'+idx]=pt?{fx:pt.fx,fy:pt.fy,row:row,exact:true}:{fx:col.x,fy:b.rows===1&&!col.top&&col.bottom?col.bottom.fy:my[row],row:row,exact:!!(b.rows===1&&(col.top||col.bottom))};}at+=b.ncols;});
  return out;}
 function svg(page){
  var out=[],open=0;page.shapes.forEach(function(s){if(s.g!==open){if(open)out.push('</g>');open=s.g||0;if(open)out.push(s.kind==='ep'?'<g class="diagram-ep" data-diagram-ep="'+esc(s.node)+'">':'<g class="diagram-node" data-diagram-node="'+esc(s.node)+'">');}out.push(shapeSVG(s));});if(open)out.push('</g>');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+page.w+'" height="'+page.h+'" viewBox="0 0 '+page.w+' '+page.h+'" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>'+out.join('')+'</svg>';
 }

 // ---------- VSDX / VSSX ----------
 var crcTable=null;function crc32(bytes){if(!crcTable){crcTable=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}var crc=0xffffffff;for(var i=0;i<bytes.length;i++)crc=(crc>>>8)^crcTable[(crc^bytes[i])&0xff];return (crc^0xffffffff)>>>0;}
 function zip(files){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  files.forEach(function(f){var name=enc.encode(f[0]),data=typeof f[1]==='string'?enc.encode(f[1]):f[1],crc=crc32(data),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);parts.push(new Uint8Array(h.buffer),name,data);
   var c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.push(new Uint8Array(c.buffer),name);offset+=30+name.length+data.length;});
  var size=central.reduce(function(n,p){return n+p.length;},0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  var all=parts.concat(central,[new Uint8Array(e.buffer)]),total=all.reduce(function(n,p){return n+p.length;},0),out=new Uint8Array(total),pos=0;all.forEach(function(p){out.set(p,pos);pos+=p.length;});return out;
 }
 var NS='http://schemas.microsoft.com/office/visio/2012/main',RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 function n(v){return Math.round(v*10000)/10000;}
 function cell(name,v){return '<Cell N="'+name+'" V="'+v+'"/>';}
 // Line weight: cached inches with the point unit and formula Visio recalculates from.
 function weightCell(px){var pt=Math.round(px*0.75*100000)/100000;return '<Cell N="LineWeight" V="'+(Math.round(pt/72*100000)/100000)+'" U="PT" F="'+pt+' pt"/>';}
 function charSection(s){return '<Section N="Character"><Row IX="0">'+cell('Font','Segoe UI')+cell('Color',s.color||'#1F2937')+cell('Style',s.bold?1:0)+cell('Size',n((s.size||11)*0.75/72))+'</Row></Section>';}
 // Rectangle geometry as Visio writes it: absolute MoveTo/LineTo rows tied to the shape size.
 function boxGeom(w,h){return [[0,0],[1,0],[1,1],[0,1],[0,0]].map(function(q,k){return '<Row T="'+(k?'LineTo':'MoveTo')+'" IX="'+(k+1)+'"><Cell N="X" V="'+n(q[0]*w)+'" F="Width*'+q[0]+'"/><Cell N="Y" V="'+n(q[1]*h)+'" F="Height*'+q[1]+'"/></Row>';}).join('');}
 // One shape in a coordinate frame: page height H (inches), origin offset ox/oy.
 function shapeXML(s,ids,H,ox,oy,ctx){var id=ids.next++;
  if(s.type==='image'){var mm=ctx&&s.master&&ctx.masters.get(s.master);return mm?instanceXML(s,id,ids,H,ox,oy,mm):'';}
  if(s.type==='line'){var all=linePoints(s),xs=all.map(function(p){return p[0]/96-ox;}),ys=all.map(function(p){return H-p[1]/96-oy;}),minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),w=Math.max(maxX-minX,0.01),h=Math.max(maxY-minY,0.01);
   return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(minX+w/2))+cell('PinY',n(minY+h/2))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+weightCell(s.width||2)+cell('LineColor',s.color||'#000000')+cell('LinePattern',s.dash?2:1)+cell('FillPattern',0)+cell('Rounding',n(3/96))+
    '<Section N="Geometry" IX="0">'+cell('NoFill',1)+cell('NoLine',0)+s.points.map(function(p,i){var arc=i&&s.arcs&&s.arcs[i];return '<Row T="'+(arc?'ArcTo':i?'LineTo':'MoveTo')+'" IX="'+(i+1)+'">'+cell('X',n(p[0]/96-ox-minX))+cell('Y',n(H-p[1]/96-oy-minY))+(arc?cell('A',n(VBOW*(p[0]>s.points[i-1][0]?1:-1)*arc/96)):'')+'</Row>';}).join('')+'</Section></Shape>';}
  var isText=s.type==='text',cx=(s.x+s.w/2)/96-ox,cy=H-(s.y+s.h/2)/96-oy,w=Math.max((s.rotate?s.h:s.w)/96,0.01),h=Math.max((s.rotate?s.w:s.h)/96,0.01);
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(cx))+cell('PinY',n(cy))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+cell('Angle',s.rotate?'1.5707963':0)+
   (isText?cell('LinePattern',0)+cell('FillPattern',0)+cell('VerticalAlign',s.rotate?1:0):(s.fill&&s.fill!=='none'?cell('FillForegnd',s.fill):'')+cell('FillPattern',s.fill&&s.fill!=='none'?1:0)+cell('LineColor',s.stroke&&s.stroke!=='none'?s.stroke:'#000000')+cell('LinePattern',s.stroke&&s.stroke!=='none'?(s.dash?2:1):0)+weightCell(s.width||1)+(s.radius?cell('Rounding',n(s.radius/96)):''))+
   (isText?cell('LeftMargin',0)+cell('RightMargin',0)+cell('TopMargin',0)+cell('BottomMargin',0)+charSection(s)+'<Section N="Paragraph"><Row IX="0">'+cell('HorzAlign',s.align==='left'?0:s.align==='right'?2:1)+'</Row></Section>':'')+
   '<Section N="Geometry" IX="0">'+cell('NoFill',isText?1:0)+cell('NoLine',isText?1:0)+boxGeom(w,h)+'</Section>'+(isText?'<Text><cp IX="0"/><pp IX="0"/>'+esc(s.text)+'</Text>':'')+'</Shape>';
 }
 function bounds(list){var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;list.forEach(function(s){if(s.type==='line')s.points.forEach(function(p){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});else{x0=Math.min(x0,s.x);y0=Math.min(y0,s.y);x1=Math.max(x1,s.x+s.w);y1=Math.max(y1,s.y+s.h);}});return {x:x0,y:y0,w:x1-x0,h:y1-y0};}
 // Shapes of a page; each device's shapes become one group so it moves as a unit.
 function shapesXML(shapes,H,ids,ctx){
  var out=[],i=0;while(i<shapes.length){var s=shapes[i];if(!s.g){out.push(shapeXML(s,ids,H,0,0,ctx));i++;continue;}
   var j=i;while(j<shapes.length&&shapes[j].g===s.g)j++;var kids=shapes.slice(i,j),b=bounds(kids),gx=b.x/96,gy=H-(b.y+b.h)/96,gw=Math.max(b.w/96,0.01),gh=Math.max(b.h/96,0.01),gid=ids.next++;
   out.push('<Shape ID="'+gid+'" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(gx+gw/2))+cell('PinY',n(gy+gh/2))+cell('Width',n(gw))+cell('Height',n(gh))+cell('LocPinX',n(gw/2))+cell('LocPinY',n(gh/2))+'<Shapes>'+kids.map(function(k){return shapeXML(k,ids,H,gx,gy,ctx);}).join('')+'</Shapes></Shape>');i=j;}
  return out.join('');
 }
 function pageXML(page,ctx,rels){return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<PageContents xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><Shapes>'+shapesXML(page.shapes,page.h/96,{next:1,rels:rels},ctx)+'</Shapes></PageContents>';}
 // Vendor masters: the instance of a master placed so its artwork fills the image box,
 // with an empty child for each of the master's sub-shapes (they inherit everything).
 var BOX_CELLS=['PinX','PinY','Width','Height','LocPinX','LocPinY','ImgOffsetX','ImgOffsetY','ImgWidth','ImgHeight'];
 function masterTree(xml){var root={children:[]},stack=[root],re=/<(\/?)Shape(s?)(\s[^>]*?)?(\/?)>/g,m;while((m=re.exec(xml))){if(m[2]==='s')continue;if(m[1]){stack.pop();continue;}
   var rest=xml.slice(re.lastIndex),stop=rest.search(/<Shape[\s>]|<Shapes>|<\/Shape>/),own=stop<0?rest:rest.slice(0,stop),cells={};
   BOX_CELLS.forEach(function(c){var v=own.match(new RegExp('<Cell N=["\']'+c+'["\'] V=["\']([^"\']*)["\']'));if(v)cells[c]=Number(v[1]);});
   var fd=own.match(/<ForeignData\b([^>]*)>[\s\S]*?<Rel\s+r:id=["']([^"']+)["']/);
   var node={id:(m[3].match(/\sID=["'](\d+)["']/)||[])[1],type:(m[3].match(/\sType=["'](\w+)["']/)||[])[1]||'Shape',cells:cells,foreign:fd?{attrs:fd[1],rel:fd[2]}:null,children:[]};stack[stack.length-1].children.push(node);if(!m[4])stack.push(node);}return root.children[0]||null;}
 function instanceXML(s,id,ids,H,ox,oy,mm){
  var m=mm.master,c=m.cells,k=(s.w/96)/m.w,left=s.x/96-ox,bottom=H-(s.y+s.h)/96-oy,Ox=left-m.x0*k,Oy=bottom-m.y0*k,lx=(c.LocPinX!=null?c.LocPinX:m.shapeW/2),ly=(c.LocPinY!=null?c.LocPinY:m.shapeH/2),originX=(c.PinX||0)-lx,originY=(c.PinY||0)-ly;
  var cellsXML=cell('PinX',n(Ox+lx*k))+cell('PinY',n(Oy+ly*k))+cell('Width',n(m.shapeW*k))+cell('Height',n(m.shapeH*k))+cell('LocPinX',n(lx*k))+cell('LocPinY',n(ly*k));
  if(m.oneD&&c.BeginX!=null)cellsXML+=cell('BeginX',n(Ox+(c.BeginX-originX)*k))+cell('BeginY',n(Oy+(c.BeginY-originY)*k))+cell('EndX',n(Ox+(c.EndX-originX)*k))+cell('EndY',n(Oy+(c.EndY-originY)*k));
  // Children repeat their box (scaled) and picture so viewers that do not evaluate the
  // master's formulas still draw them in place.
  function kids(list){return list.map(function(ch){var body=Object.keys(ch.cells).map(function(c){return cell(c,n(ch.cells[c]*k));}).join('');
    if(ch.foreign&&mm.media[ch.foreign.rel]&&ids.rels){var rid='rId'+(ids.rels.length+1);ids.rels.push({id:rid,target:mm.media[ch.foreign.rel]});body+='<ForeignData'+ch.foreign.attrs+'><Rel r:id="'+rid+'"/></ForeignData>';}
    return '<Shape ID="'+(ids.next++)+'" Type="'+ch.type+'" MasterShape="'+ch.id+'">'+body+(ch.children.length?'<Shapes>'+kids(ch.children)+'</Shapes>':'')+'</Shape>';}).join('');}
  var tree=mm.tree;return '<Shape ID="'+id+'" Type="'+(tree?tree.type:'Group')+'" Master="'+mm.id+'">'+cellsXML+(tree&&tree.children.length?'<Shapes>'+kids(tree.children)+'</Shapes>':'')+'</Shape>';
 }
 function mastersOf(pages){var map=new Map();pages.forEach(function(p){p.shapes.forEach(function(s){if(s.type==='image'&&s.master&&!map.has(s.master))map.set(s.master,{id:map.size+2,master:s.master,tree:masterTree(s.master.xml),media:{}});});});return map;}
 var MEDIA={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',emf:'image/x-emf',wmf:'image/x-wmf',svg:'image/svg+xml',tif:'image/tiff',tiff:'image/tiff'};
 function noStyles(x){return x.replace(/\b(LineStyle|FillStyle|TextStyle)=(["'])\d+\2/g,'$1="0"');}
 function masterParts(ctx){
  var parts=[],entries=[],rels=[],media={};
  ctx.masters.forEach(function(mm,i){var m=mm.master,file='master'+mm.id+'.xml',mrels=[];
   Object.keys(m.rels).forEach(function(rid){var r=m.rels[rid],src='visio/'+r.target.replace(/^\.\.\//,''),data=m.media[src];if(!data)return;var ext=(src.match(/\.([a-z0-9]+)$/i)||['','bin'])[1].toLowerCase(),name='stencil'+mm.id+'_'+rid.replace(/\W/g,'')+'.'+ext;media[ext]=true;mm.media[rid]=name;parts.push(['visio/media/'+name,data,null]);mrels.push('<Relationship Id="'+rid+'" Type="'+r.type+'" Target="../media/'+name+'"/>');});
   parts.push(['visio/masters/'+file,noStyles(m.xml),'application/vnd.ms-visio.master+xml']);
   if(mrels.length)parts.push(['visio/masters/_rels/'+file+'.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+mrels.join('')+'</Relationships>',null]);
   rels.push('<Relationship Id="rId'+mm.id+'" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="'+file+'"/>');
   entries.push(noStyles(m.element).replace(/^<Master\s/,'<Master ').replace(/(<Master\b[^>]*?)(\s)ID=(["'])[^"']*\3/,'$1$2ID="'+mm.id+'"').replace(/<Rel\s+r:id=(["'])[^"']+\1/,'<Rel r:id="rId'+mm.id+'"'));});
  if(!entries.length)return null;
  parts.push(['visio/masters/masters.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Masters xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve">'+entries.join('')+'</Masters>','application/vnd.ms-visio.masters+xml']);
  parts.push(['visio/masters/_rels/masters.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>',null]);
  return {parts:parts,media:Object.keys(media)};
 }
 // The minimal document part that NetworkDiagramStudio writes and Microsoft Visio opens: settings,
 // the fonts the shapes name, one default style and the document's own sheet (required).
 function documentXML(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<VisioDocument xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/><Colors><ColorEntry IX="0" RGB="#000000"/><ColorEntry IX="1" RGB="#FFFFFF"/></Colors><FaceNames><FaceName NameU="Calibri"/><FaceName NameU="Arial"/><FaceName NameU="Segoe UI"/></FaceNames><StyleSheets><StyleSheet ID="0" Name="No Style" NameU="No Style">'+cell('LinePattern',1)+cell('LineColor','#000000')+weightCell(1)+cell('FillPattern',0)+'<Section N="Character"><Row IX="0">'+cell('Font','Calibri')+cell('Size',0.125)+cell('Color','#16364A')+'</Row></Section></StyleSheet></StyleSheets><DocumentSheet NameU="TheDoc" LineStyle="0" FillStyle="0" TextStyle="0"/></VisioDocument>';
 }


 // The package as NetworkDiagramStudio writes it (Microsoft Visio opens those): content types,
 // the document relationship, the document and its parts. No docProps parts, which Visio
 // refused in our files (error 271).
 // The package as NetworkDiagramStudio writes it since its repair for Visio error 271 (Visio opens
 // those on the owner's machine): content types first, a recalculation instruction
 // (docProps/custom.xml RecalcDocument) and the drawing window settings (visio/windows.xml).
 function packageFiles(title,mainType,docRels,parts,extraDefaults,meta,firstPage){
  var files=[],stencil=/stencil/.test(mainType),fp=firstPage||{w:1056,h:816},HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var extra=[['docProps/custom.xml','application/vnd.openxmlformats-officedocument.custom-properties+xml']].concat(stencil?[]:[['visio/windows.xml','application/vnd.ms-visio.windows+xml']]);
  files.push(['[Content_Types].xml',HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+(extraDefaults||[]).map(function(e){return '<Default Extension="'+e+'" ContentType="'+(MEDIA[e]||'application/octet-stream')+'"/>';}).join('')+'<Override PartName="/visio/document.xml" ContentType="'+mainType+'"/>'+extra.map(function(e){return '<Override PartName="/'+e[0]+'" ContentType="'+e[1]+'"/>';}).join('')+parts.filter(function(p){return p[2]&&!/\.rels$/.test(p[0]);}).map(function(p){return '<Override PartName="/'+p[0]+'" ContentType="'+p[2]+'"/>';}).join('')+'</Types>']);
  files.push(['_rels/.rels',HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>']);
  files.push(['docProps/custom.xml',HEAD+'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="RecalcDocument"><vt:bool>true</vt:bool></property></Properties>']);
  files.push(['visio/document.xml',documentXML()]);
  files.push(['visio/_rels/document.xml.rels',HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+docRels+(stencil?'':'<Relationship Id="rId3" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>')+'</Relationships>']);
  if(!stencil)files.push(['visio/windows.xml',HEAD+'<Windows xmlns="'+NS+'" xmlns:r="'+RNS+'" ClientWidth="1200" ClientHeight="975"><Window ID="0" WindowType="Drawing" WindowState="268435456" WindowLeft="0" WindowTop="0" WindowWidth="1200" WindowHeight="975" ContainerType="Page" Page="0" ViewScale="0.75" ViewCenterX="'+n(fp.w/192)+'" ViewCenterY="'+n(fp.h/192)+'"><ShowRulers>1</ShowRulers><ShowGrid>0</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints></Window></Windows>']);
  parts.forEach(function(p){files.push([p[0],p[1]]);});
  return zip(files);
 }
 function vsdx(pages,title,meta){
  pages=pages.map(onLetter);
  var parts=[],rels=[],entries=[],ctx={masters:mastersOf(pages)},mp=masterParts(ctx);
  // Page names must be unique in a Visio document (at most 31 characters).
  var names={};function pageName(t){t=String(t||'Page').replace(/ \(continued\)$/,'').slice(0,26);var k=t.toLowerCase(),c=names[k]=(names[k]||0)+1;return c>1?t+' '+c:t;}
  pages.forEach(function(p,i){var prels=[];parts.push(['visio/pages/page'+(i+1)+'.xml',pageXML(p,ctx,prels),'application/vnd.ms-visio.page+xml']);
   var mrel=[],usedM=new Set(p.shapes.filter(function(x){return x.type==='image'&&x.master;}).map(function(x){return x.master;}));ctx.masters.forEach(function(mm){if(!usedM.has(mm.master))return;mrel.push('<Relationship Id="rM'+mm.id+'" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="../masters/master'+mm.id+'.xml"/>');});
   if(prels.length||mrel.length)parts.push(['visio/pages/_rels/page'+(i+1)+'.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+mrel.join('')+prels.map(function(r){return '<Relationship Id="'+r.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/'+r.target+'"/>';}).join('')+'</Relationships>',null]);rels.push('<Relationship Id="rId'+(i+1)+'" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page'+(i+1)+'.xml"/>');
   var name=esc(pageName(p.title));entries.push('<Page ID="'+i+'" NameU="'+name+'" IsCustomNameU="1" Name="'+name+'" IsCustomName="1" ViewScale="0.75" ViewCenterX="'+n(p.w/192)+'" ViewCenterY="'+n(p.h/192)+'"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PageWidth',n(p.w/96))+cell('PageHeight',n(p.h/96))+cell('PageScale',1)+cell('DrawingScale',1)+cell('DrawingSizeType',0)+cell('DrawingScaleType',0)+cell('LineJumpCode',4)+cell('LineJumpStyle',1)+cell('LineToLineX',0.14583)+cell('LineToLineY',0.14583)+cell('LineJumpFactorX',0.5)+cell('LineJumpFactorY',0.5)+'</PageSheet><Rel r:id="rId'+(i+1)+'"/></Page>');});
  parts.push(['visio/pages/pages.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Pages xmlns="'+NS+'" xmlns:r="'+RNS+'">'+entries.join('')+'</Pages>','application/vnd.ms-visio.pages+xml']);
  parts.push(['visio/pages/_rels/pages.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>','application/vnd.openxmlformats-package.relationships+xml']);
  return packageFiles(title||'Network diagram','application/vnd.ms-visio.drawing.main+xml','<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>'+(mp?'<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/>':''),parts.concat(mp?mp.parts:[]),mp?mp.media:[],meta,pages[0]);
 }
 // Faceplates of every catalog model (and generic sizes) as plain-shape pages.
 function stencilPages(){
  var list=CATALOG.map(function(c){return {name:c.label,model:c.label,cat:c};}).concat([8,12,24,48].map(function(k){return {name:'Generic '+k+'-port switch',model:'',ports:k};}));
  return list.map(function(item){var ports=[];var main=item.cat?item.cat.main:item.ports;for(var i=1;i<=main;i++)ports.push(String(i));var dev=new Device({key:item.name,name:item.name,model:'',cat:item.cat,role:/sonicwall|forti/i.test(item.name)?'firewall':/controller/i.test(item.name)?'controller':'switch',ips:[]},ports.map(function(p){return 'Port '+p;}),[],'plate');
   dev.x=0;dev.y=0;var page=new Page(item.name);page.begin(item.name);drawPlate(page,dev,null);page.end();page.w=dev.w;page.h=dev.h;return page;});
 }
 // The catalog as one drawing: every faceplate as a grouped plain-shape device with its
 // model name, to copy into diagrams or drag into a stencil of your own in Visio.
 function library(){
  var plates=stencilPages(),pages=[],per=6;
  for(var start=0;start<plates.length;start+=per){var page=new Page('Device library '+(pages.length+1)),y=TOP;
   page.text(MARGIN,16,800,14,'CONFIG INSPECTOR',{size:9.5,bold:true,align:'left',color:'#1d5b79'});page.text(MARGIN,32,900,30,'Device library',{size:24,bold:true,align:'left',color:'#1b3a4b'});
   page.text(MARGIN,64,900,16,'Faceplates of the built-in device catalog. Each device is one group of plain shapes: copy it into a diagram or drag it into a stencil.',{size:11,align:'left',color:'#4a5568'});
   plates.slice(start,start+per).forEach(function(p){var x=MARGIN,top=y;page.text(x,top,p.w,16,p.title,{size:11,bold:true,align:'left',color:'#1b3a4b'});
    page.begin(p.title);p.shapes.forEach(function(s){var t=Object.assign({},s);delete t.g;delete t.node;if(t.type==='line')t.points=t.points.map(function(q){return [q[0]+x,q[1]+top+22];});else{t.x+=x;t.y+=top+22;}page.push(t);page.grow(t.x+t.w||0,t.y+t.h||0);});page.end();y=top+22+p.h+36;});
   page.rect(MARGIN,84,page.w-2*MARGIN,1,{fill:'#c9d3df',stroke:'none'});pages.push(page);}
  return pages;
 }
 root.SWDiagram={setPaper:setPaper,paperInfo:paperInfo,PAPERS:PAPERS,fitPaper:fitLetter,stencilAnchors:stencilAnchors,moduleFor:moduleFor,MODULES:MODULES,autoModule:autoModule,build:build,diagram:diagram,scope:scope,tree:tree,render:render,svg:svg,vsdx:vsdx,library:library,fitLetter:fitLetter,onLetter:onLetter,stencilPages:stencilPages,linkType:linkType,parsePort:parsePort,physicalPort:physicalPort,catalogFor:catalogFor,_Device:Device,stencilPorts:stencilPorts,kinds:KINDS,kindStyle:kindStyle,linkKind:linkKind,shortPort:short,docPages:docPages,number:number,CATALOG:CATALOG,LINK_TYPES:LINK_TYPES,GRID:G};
 if(typeof module==='object'&&module.exports)module.exports=root.SWDiagram;
})(typeof globalThis!=='undefined'?globalThis:this);
