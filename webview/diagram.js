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
 var G=9,BAND=54,BEND=20,CROSS=30,CROSS_STRICT=400,TOP=126,EP_W=126,EP_H=54,EP_PITCH=153,MARGIN=36;
 function speedValue(s){var m=String(s||'').match(/([\d.]+)\s*([GM])/i);if(!m)return 0;return Number(m[1])*(m[2].toUpperCase()==='G'?1000:1);}
 function linkType(l,aRole,bRole){if(aRole==='circuit'||bRole==='circuit')return 'wan';
  if(aRole==='ap'||bRole==='ap')return 'wap';
  var ports=(l.aPort||'')+' '+(l.bPort||''),speed=Math.max(speedValue(l.aSpeed),speedValue(l.bSpeed));
  if(speed>=10000||/\b(?:te|ten|tw|twe|twenty|fo|forty|hu|hundred|xe|et)\s*\d|tengig|twentyfive|forty|hundred|sfp|\b1\/1\/(?:49|5\d)\b/i.test(ports))return 'fiber';
  if(speed>=100||/gigabit|\bgi\s*\d|\bfa\s*\d|fastethernet|\beth\d|port\d/i.test(ports))return 'copper';
  return 'other';
 }
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
   var label=i===0?216:117,w=up9(gx-27+9+18+label);
   self.plates.push({member:mem.n,x:x,w:w,groups:groups,labelX:w-label+9,first:i===0});x+=w+27;});
  this.w=x-27;this.h=72;this.stencilPlate(node);
 }
 // Faceplates from verified hardware profiles (hardware.js): each bank keeps its connector,
 // rows, order and side, so ports sit where they are on the device.
 Device.prototype.fromProfile=function(hw){
  var self=this,x=0;this.plates=[];this.hw=hw;
  hw.members.filter(function(m){return m.profile;}).slice(0,8).forEach(function(mem,i){
   var gx=81,col=0,groups=[],banks=mem.profile.banks.filter(function(b){return !b.mirror;}),front=banks.filter(function(b){return b.side!=='rear';}),rear=banks.filter(function(b){return b.side==='rear';});
   front.concat(rear).forEach(function(b){var bi=mem.profile.banks.indexOf(b),f=formOf(b.displayForm||b.form),rows=b.rows||2,g={name:'b'+bi,bank:bi,count:b.names.length,rows:rows,rowOffset:b.rowOffset||0,names:b.names,labels:b.names.map(portLabel),form:f,fiber:f==='sfp'||f==='qsfp',pitch:f==='qsfp'?27:18,per:rows===2&&b.names.length>=24?12:b.names.length,rear:b.side==='rear',title:b.label};
    g.x=gx;g.col=col;col+=Math.ceil(g.count/rows)+1;gx+=groupWidth(g)+27;groups.push(g);});
   var label=i===0?216:117,w=up9(gx-27+9+18+label);
   self.plates.push({member:mem.id,x:x,w:w,groups:groups,labelX:w-label+9,first:i===0,title:mem.profile.title});x+=w+27;});
  this.w=x-27;this.h=72;
 };
 Device.prototype.stencilPlate=function(node){
  var x;
  // A vendor stencil replaces the drawn faceplate: its artwork per stack member, with
  // ports at the stencil's connection points when they fit the port counts.
  var st=node.stencil;if(st&&st.art){var a=st.art,ratio=a.w/a.h,iw=ratio>2.5?720:Math.min(162,a.w),ih=iw/ratio;if(ih>126){ih=126;iw=ih*ratio;}
   var gs=this.plates[0].groups;if(this.hw){var big=gs.filter(function(g){return !g.rear;}).sort(function(a,b){return b.count-a.count;});if(big[0])big[0].role='main';var upr=big.find(function(g){return g!==big[0]&&g.fiber;});if(upr)upr.role='up';}
   var main=gs.find(function(g){return (g.role||g.name)==='main';}),upg=gs.find(function(g){return (g.role||g.name)==='up';});
   this.stencil=st;this.img={w:Math.round(iw*100)/100,h:Math.round(ih*100)/100};this.h=Math.max(54,up9(ih+G));this.imgTop=(this.h-this.img.h)/2;this.map=st.layout?st.layout(main?main.count:0,upg?upg.count:0):null;
   // Known port groups: each group on its own run of the stencil's ports (front groups only).
   if(this.hw&&st.banks){var bm=st.banks(gs.map(function(g){return g.rear?0:g.count;}));if(bm){this.bankMap={};gs.forEach(function(g,i){if(bm[i])this.bankMap[g.name]=bm[i];},this);}}
   x=0;this.plates.forEach(function(pl,i){pl.stencil=true;pl.x=x;pl.labelX=up9(iw+G*2);pl.w=pl.labelX+(i===0?216:117);x+=pl.w+27;});this.w=x-27;this.positions={};}
 }
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
 Device.prototype.place=function(plate,g,idx,portName){
  var p={name:portName},pp=portPos(g,idx),col=g.col+Math.floor(idx/(g.rows===1?1:2)),row=pp.row,key=plate.member+'|'+g.name+'|'+idx;
  if(plate.stencil){var list=this.bankMap?this.bankMap[g.name]:this.map&&((g.role||g.name)==='main'?this.map.main:(g.role||g.name)==='up'?this.map.up:null),own=this.stencil&&this.stencil.points&&this.stencil.points[g.name+'|'+idx],pos=own?{fx:own[0],fy:own[1],row:own[1]>0.5?1:0}:list&&list[idx],img=this.img,dx,py;
   // Port points placed by hand on this stencil (by port group and index, for every member) come first.
   if(pos){dx=plate.x+G+pos.fx*img.w;py=this.imgTop+pos.fy*img.h;row=pos.row;}
   // A known group the stencil has no ports for: where it sits on the drawn faceplate,
   // across the middle 80% of the artwork.
   else if(this.hw){var gs2=plate.groups.filter(function(x){return !x.rear&&x.count;}),first=gs2[0],last=gs2[gs2.length-1],x0=first?first.x:81,x1=last?last.x+groupWidth(last):x0+1;dx=plate.x+G+img.w*(0.1+0.8*(pp.dx-x0)/Math.max(1,x1-x0));py=row?this.imgTop+img.h:this.imgTop;}
   else{var cols=plate.groups.reduce(function(c,x){return Math.max(c,x.col+Math.ceil(x.count/2));},1);dx=plate.x+G+(col+0.5)/cols*img.w;py=row?this.imgTop+img.h:this.imgTop;}
   var ex=dx;dx=snap(dx);this.positions[key]={x:ex,y:py,exact:!!pos};
   return {key:key,plate:plate,dx:dx,ex:ex,py:py,row:row,fiber:g.fiber,number:'',name:p.name};}
  return {key:key,plate:plate,dx:plate.x+pp.dx,row:row,fiber:g.fiber,py:g.mid?36:null,number:g.labels?g.labels[idx]:g.name==='other'?'':String((g.base||0)+(g.zero?idx:idx+1)),name:p.name};
 };
 Device.prototype.fit=function(){if(this.style!=='box')return;var top=this.terms.filter(function(t){return t.side==='top';}).length,bottom=this.terms.length-top;this.w=Math.max(198,up9(36+18*Math.max(top,bottom)));};
 function drawPlate(page,dev,used,fills){
  var node=dev.node,x0=dev.x,y=dev.y;
  if(dev.stencil){dev.plates.forEach(function(pl){var x=x0+pl.x;
    page.rect(x,y,pl.w,dev.h,{fill:'#f4f7fb',stroke:'#c9d3df',width:1,radius:4});page.image(x+G,y+dev.imgTop,dev.img.w,dev.img.h,{art:dev.stencil.art,master:dev.stencil.master});
    var lx=x+pl.labelX,lw=pl.w-pl.labelX-8,ty=y+Math.max(4,(dev.h-58)/2);
    if(pl.first)page.text(lx,ty,lw,58,clip(node.name,30)+'\n'+clip(node.model||dev.stencil.master.name||'',34)+'\n'+((node.ips||[])[0]||''),{size:10.5,align:'left',firstBold:true,lineHeight:17});else page.text(lx,y+dev.h/2-9,lw,18,'Member '+pl.member,{size:10.5,bold:true,align:'left'});});
   // Linked ports: a ring in the link color on the stencil.
   if(used)used.forEach(function(color,key){var p=dev.positions[key];if(p)page.rect(x0+p.x-6,y+p.y-6,12,12,{fill:'none',stroke:color,width:2,radius:6,pkey:dev.portKeys&&dev.portKeys[key]});});
   // Port roles on a stencil (port map pages, as in the reference drawing): a numbered square
   // over each port in the role color, sized to the port pitch; outlined only when down.
   if(fills){var all=[];fills.forEach(function(fl,key){var p=dev.positions[key];if(p)all.push({p:p,fl:fl});});
    all.forEach(function(a){var dx=1e9,dy=1e9;all.forEach(function(b){if(b===a)return;var ex=Math.abs(b.p.x-a.p.x),ey=Math.abs(b.p.y-a.p.y);if(ey<4&&ex>2)dx=Math.min(dx,ex);if(ex<4&&ey>2)dy=Math.min(dy,ey);});
     var w=Math.max(9,Math.min(24,dx<1e9?dx*0.8:14)),hh=Math.max(9,Math.min(w*0.95,dy<1e9?dy*0.7:w*0.95)),fl=a.fl,down=!fl.up;
     page.rect(x0+a.p.x-w/2,y+a.p.y-hh/2,w,hh,{fill:down?'#ffffff':fl.fill,stroke:down?(fl.fill==='#f4f5f7'?'#b6bfcc':fl.fill):'#3d4a5c',width:down?1.5:0.75});
     if(fl.label)page.text(x0+a.p.x-w/2,y+a.p.y-hh/2+(hh-Math.min(9,hh*0.62))/2-1,w,hh,fl.label,{size:Math.min(9,hh*0.62,w/(Math.max(2,fl.label.length)*0.62)),bold:true,color:'#1f2937'});});}
   return;}
  dev.plates.forEach(function(pl){var x=x0+pl.x;
   page.rect(x,y,pl.w,72,{fill:'#dfe7f3',stroke:'#3d5a80',width:1.5,radius:4});page.rect(x+10,y+10,44,52,{fill:ROLE_FILL[node.role]||'#4f81bd',stroke:'none'});
   pl.groups.forEach(function(g){for(var i=0;i<g.count;i++){var pp=portPos(g,i),row=pp.row,cx=x+pp.dx,cy=y+(g.mid?36:row?51:21),key=pl.member+'|'+g.name+'|'+i,u=used&&used.get(key),label=g.labels?g.labels[i]:g.name==='other'?'':String((g.base||0)+(g.zero?i:i+1));
    var fl=fills&&fills.get(key);drawPort(page,g.form||(g.fiber?'sfp':'rj45'),cx,cy,row,u,fl);
    if(label)page.text(cx-9,cy-4.5,18,9,label,{size:label.length>2?5:6.5,bold:!!(fl&&fl.up),color:(g.form==='sfp'||g.form==='qsfp'||!g.form&&g.fiber)&&!u&&!fl?'#ffffff':'#1f2937'});}});
   var lx=x+pl.labelX,lw=pl.w-pl.labelX-8;
   if(pl.first)page.text(lx,y+8,lw,58,clip(node.name,30)+'\n'+clip(node.model||ROLE_LABEL[node.role]||'',34)+'\n'+((node.ips||[])[0]||''),{size:10.5,align:'left',firstBold:true,lineHeight:17});
   else page.text(lx,y+26,lw,18,'Member '+pl.member,{size:10.5,bold:true,align:'left'});});
 }
 // Port shapes in real proportions: an RJ45 jack (11.7 x 13.5 mm) with its latch notch on
 // the outer edge (top row up, bottom row down), an SFP cage (13.7 x 8.6 mm) and a QSFP cage
 // (18.4 x 8.5 mm), at the 18 px column pitch of a 14.5 mm port spacing.
 function drawPort(page,form,cx,cy,row,u,fl){var line=u||(fl?fl.stroke||'#3d4a5c':'#7a8ca8'),w=u?1.6:fl?1:0.75,fill=fl?fl.up?fl.fill:'#ffffff':null;
  if(form==='sfp'||form==='qsfp'){var cw=form==='qsfp'?22:15,ch=10;page.rect(cx-cw/2,cy-ch/2,cw,ch,{fill:fill||(u?'#ffffff':'#5b6b82'),stroke:fl?line:u?u:'#3d4a5c',width:fl&&!fl.up?1.6:w});return;}
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
 function legendColumn(page,x,y,types,roles){
  page.text(x,y,LEGEND_W-36,14,'CONNECTION TYPES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});y+=30;
  types.forEach(function(t){page.line([[x,y+7],[x+30,y+7]],{color:LINK_TYPES[t].color,width:2.5,dash:LINK_TYPES[t].dash});page.text(x+40,y,LEGEND_W-80,16,LINK_TYPES[t].label,{size:10,align:'left'});y+=27;});
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
 function Router(w,h){this.C=Math.ceil(w/G)+1;this.R=Math.ceil(h/G)+1;var n=this.C*this.R;this.blocked=new Uint8Array(n);this.node=new Int32Array(n);this.term=new Int32Array(n);this.zone=new Int32Array(n);this.hUse=new Int32Array(n);this.vUse=new Int32Array(n);this.g=new Float64Array(n*4);this.prev=new Int32Array(n*4);this.seen=new Int32Array(n*4);this.done=new Int32Array(n*4);this.gen=0;}
 Router.prototype.at=function(x,y){var c=Math.round(x/G),r=Math.round(y/G);if(c<0||r<0||c>=this.C||r>=this.R)return -1;return r*this.C+c;};
 // Block every grid node inside the rectangle (edges included).
 Router.prototype.block=function(x,y,w,h){var c0=Math.max(0,Math.ceil(x/G)),c1=Math.min(this.C-1,Math.floor((x+w)/G)),r0=Math.max(0,Math.ceil(y/G)),r1=Math.min(this.R-1,Math.floor((y+h)/G));for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++)this.blocked[r*this.C+c]=1;};
 // A zone (an endpoint corridor) costs extra for routes that do not belong to it.
 Router.prototype.reserve=function(x,y,w,h,owner){var c0=Math.max(0,Math.ceil(x/G)),c1=Math.min(this.C-1,Math.floor((x+w)/G)),r0=Math.max(0,Math.ceil(y/G)),r1=Math.min(this.R-1,Math.floor((y+h)/G));for(var r=r0;r<=r1;r++)for(var c=c0;c<=c1;c++)this.zone[r*this.C+c]=owner;};
 Router.prototype.route=function(net,s,sDir,t,tDir,relaxed,owner){
  var C=this.C,R=this.R,g=this.g,prev=this.prev,seen=this.seen,done=this.done,gen=++this.gen,heap=new Heap(),tc=t%C,tr=(t/C)|0;
  function h(v){return Math.abs(v%C-tc)+Math.abs(((v/C)|0)-tr);}
  var st=s*4+sDir;g[st]=0;seen[st]=gen;prev[st]=-1;heap.push(h(s),st);var limit=C*R*4;
  while(heap.k.length&&limit-->0){var cur=heap.pop();if(done[cur]===gen)continue;done[cur]=gen;var v=cur>>2,d=cur&3,gc=g[cur];
   if(v===t){var path=[],x=cur;while(x>=0){var nv=x>>2;if(path[path.length-1]!==nv)path.push(nv);x=prev[x];}path.reverse();return path;}
   var occ=this.node[v]&&this.node[v]!==net&&v!==s,vc=v%C,vr=(v/C)|0;
   for(var nd=0;nd<4;nd++){if(nd===((d+2)&3))continue;var turn=nd!==d;if(occ&&turn&&!relaxed)continue;
    var cx=vc+DX[nd],cy=vr+DY[nd];if(cx<0||cy<0||cx>=C||cy>=R)continue;var u=cy*C+cx;
    if(u!==t&&(this.blocked[u]||this.term[u]&&this.term[u]!==net))continue;
    var e=Math.min(u,v),usedBy=nd===0||nd===2?this.hUse[e]:this.vUse[e],cost=1;
    if(usedBy&&usedBy!==net){if(!relaxed)continue;cost+=80;}
    if(occ&&turn)cost+=40;if(this.zone[u]&&this.zone[u]!==owner)cost+=4;if(turn)cost+=BEND;if(this.node[u]&&this.node[u]!==net)cost+=this.cross||CROSS;if(u===t&&nd!==tDir)cost+=BEND;
    var ns=u*4+nd,ng=gc+cost;if(seen[ns]!==gen||ng<g[ns]){seen[ns]=gen;g[ns]=ng;prev[ns]=cur;heap.push(ng+h(u),ns);}}}
  return null;
 };
 // Occupancy rebuilt from every committed path but one (for re-routing that one).
 Router.prototype.rebuild=function(paths,skip){this.node.fill(0);this.hUse.fill(0);this.vUse.fill(0);var self=this;paths.forEach(function(p){if(p.net!==skip&&p.path)self.commit(p.net,p.path);});};
 // Crossings (cells of another net) and bends of a path, for comparing two routes.
 Router.prototype.score=function(net,path){var x=0,b=0,C=this.C;for(var i=1;i<path.length-1;i++){if(this.node[path[i]]&&this.node[path[i]]!==net)x++;var d1=path[i]-path[i-1],d2=path[i+1]-path[i];if(d1!==d2)b++;}return {cross:x,bends:b};};
 Router.prototype.commit=function(net,path){for(var i=0;i<path.length;i++){var v=path[i];if(!this.node[v])this.node[v]=net;if(i){var u=path[i-1],e=Math.min(u,v);if(Math.abs(u-v)===1)this.hUse[e]=this.hUse[e]||net;else this.vUse[e]=this.vUse[e]||net;}}};
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
 function render(input,view){
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
  // Connections: one per physical link on faceplates, one per device pair on boxes.
  var conns=[],seenLinks=new Set();
  (input.links||[]).forEach(function(l){var A=devices.get(l.a),B=devices.get(l.b);if(!A||!B||A===B)return;var key=[l.a+'|'+short(l.aPort),l.b+'|'+short(l.bPort)].sort().join('~');if(seenLinks.has(key))return;seenLinks.add(key);
   var type=linkType(l,A.node.role,B.node.role),dash=slowLink(l);
   if(style==='box'){var pk=[l.a,l.b].sort().join('~'),c=conns.find(function(x){return x.pair===pk;});if(c){c.aPorts.push(l.a===c.A.key?l.aPort:l.bPort);c.bPorts.push(l.a===c.A.key?l.bPort:l.aPort);if(type==='fiber')c.type=type;return;}conns.push({pair:pk,A:A,B:B,aPorts:[l.aPort],bPorts:[l.bPort],type:type,dash:dash});return;}
   conns.push({A:A,B:B,aPorts:[l.aPort],bPorts:[l.bPort],type:type,dash:dash});});
  devices.forEach(function(dev){dev.eps.forEach(function(a,j){var l=(input.links||[]).find(function(x){return x.a===dev.key&&x.b===a.node.key&&short(x.aPort)===short(a.port)||x.b===dev.key&&x.a===a.node.key&&short(x.bPort)===short(a.port);})||{aPort:a.port};conns.push({A:dev,ep:j,aPorts:[a.port],bPorts:[],type:a.node.role==='ap'?'wap':linkType(l,dev.node.role,a.node.role),dash:slowLink(l)});});});
  conns.forEach(function(c){used.add(c.type);if(c.dash)used.add('slow');});
  // Terminals on faceplates come from the port slot; boxes get a side per direction.
  var usedPorts=new Map();
  conns.forEach(function(c,i){c.net=i+1;
   if(style==='plate'){c.ta=termPlate(c.A,c.aPorts[0],c);if(c.B)c.tb=termPlate(c.B,c.bPorts[0],c);}
   else{var sideA=c.A.row<c.B.row?'bottom':c.A.row>c.B.row?'top':'bottom',sideB=c.B.row<c.A.row?'bottom':c.B.row>c.A.row?'top':'bottom';c.ta={dev:c.A,side:sideA,label:portList(c.aPorts),conn:c};c.tb={dev:c.B,side:sideB,label:portList(c.bPorts),conn:c};c.A.terms.push(c.ta);c.B.terms.push(c.tb);}});
  function portList(list){var s=list.filter(Boolean).map(short);return s.length?clip(s[0],10)+(s.length>1?' +'+(s.length-1):''):'';}
  function termPlate(dev,port,c){var po=view.edits&&view.edits.ports&&view.edits.ports[dev.key+'|'+short(port||'')];if(po){port=po;}var s=dev.slot(port||'');
   // A port's link point moved by hand (a stencil whose marks miss its ports).
   var pp=view.edits&&view.edits.portPos&&view.edits.portPos[dev.key+'|'+short(port||'')];if(pp&&style==='plate'){s=Object.assign({},s);var ex=(s.ex!=null?s.ex:s.dx)+pp[0];s.ex=ex;s.dx=snap(ex);s.py=(s.py!=null?s.py:s.row?51:21)+pp[1];if(dev.positions&&dev.positions[s.key])dev.positions[s.key]={x:ex,y:s.py,exact:true};}var t={dev:dev,slot:s,side:s.row?'bottom':'top',label:clip(short(port),10),conn:c};(dev.portKeys=dev.portKeys||{})[s.key]=dev.portKeys[s.key]||dev.key+'|'+short(port||'');var prior=dev.terms.find(function(x){return x.slot.key===s.key;});if(prior){t.shared=prior;prior.shares=(prior.shares||0)+1;t.k=prior.shares;t.label='';}else{dev.terms.push(t);usedPorts.set(dev.key+'|'+s.key,LINK_TYPES[c.type].color);}return t;}
  devices.forEach(function(dev){(dev.eps||[]).forEach(function(a){(a.ports||[]).forEach(function(p){if(style!=='plate')return;var sl=dev.slot(p||'');if(!usedPorts.has(dev.key+'|'+sl.key))usedPorts.set(dev.key+'|'+sl.key,LINK_TYPES.wap.color);});});});
  devices.forEach(function(dev){dev.fit();});
  // Endpoints sit above their switch when cabled to a top-row port and below it for a
  // bottom-row port, each near its port.
  devices.forEach(function(d){d.top=[];d.bot=[];});
  conns.forEach(function(c){if(c.ep==null)return;var t=c.ta.shared||c.ta,e={conn:c,a:c.A.eps[c.ep],dx:t.slot.dx,side:c.ta.side};(e.side==='top'?c.A.top:c.A.bot).push(e);});
  devices.forEach(function(d){[d.top,d.bot].forEach(function(list){var x=null;list.sort(function(p,q){return p.dx-q.dx;}).forEach(function(e){var ideal=snap(e.dx-EP_W/2);x=x==null?ideal:Math.max(ideal,x+EP_PITCH);e.rx=x;});});
   var left=Math.min.apply(null,[0].concat(d.top.concat(d.bot).map(function(e){return e.rx;}))),right=Math.max.apply(null,[d.w+(d.others?G*2+EP_W:0)].concat(d.top.concat(d.bot).map(function(e){return e.rx+EP_W;})));d.offset=-left;d.cellW=right-left;});
  // Horizontal placement: cells left to right, rows centered.
  // Rows start on one vertical line: the first device of every row has the same left edge
  // (owner request), so stacked devices line up.
  var widths=rowsOut.map(function(row){return row.reduce(function(w,k,i){return w+devices.get(k).cellW+(i?G*10:0);},0);}),lead=Math.max.apply(null,rowsOut.map(function(row){return devices.get(row[0]).offset;}).concat([0]));
  var maxW=Math.max.apply(null,rowsOut.map(function(row,r){return lead-devices.get(row[0]).offset+widths[r];}).concat([400]));
  var LEFT=MARGIN+LEGEND_W;rowsOut.forEach(function(row,r){var x=LEFT+snap(lead-devices.get(row[0]).offset);row.forEach(function(k){var d=devices.get(k);d.cellX=x;d.x=x+d.offset;x+=d.cellW+G*10;});});
  // Channel sizes from the routes that use them, then vertical placement.
  var chan=rowsOut.map(function(){return 3;});chan.push(3);
  conns.forEach(function(c){if(c.ep!=null)return;[c.ta,c.tb].forEach(function(t){if(!t)return;var r=t.dev.row;chan[t.side==='top'?r:r+1]++;});var a=Math.min(c.A.row,c.B.row),b=Math.max(c.A.row,c.B.row);for(var r=a+1;r<=b;r++)chan[r]+=0.34;});chan=chan.map(Math.ceil);
  var cursor=TOP+G*Math.min(chan[0],30);
  // Trunks of shared ports need room outside the band too.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t){if(t&&t.shared){var d=t.dev,key=t.side==='top'?'trunkTop':'trunkBot';d[key]=Math.max(d[key]||0,t.k);}});});
  rowsOut.forEach(function(row,r){var ds=row.map(function(k){return devices.get(k);}),nTop=Math.max.apply(null,ds.map(function(d){return d.top.length;})),nBot=Math.max.apply(null,ds.map(function(d){return d.bot.length;})),kTop=Math.max.apply(null,ds.map(function(d){return d.trunkTop||0;})),kBot=Math.max.apply(null,ds.map(function(d){return d.trunkBot||0;}));
   var rowH=Math.max.apply(null,ds.map(function(d){return d.h;}));
   cursor+=G*2*kTop;var topExtra=nTop?EP_H+G*(nTop+3+2*kTop):0,y=cursor+topExtra+BAND,epBot=y+rowH+BAND+G*(nBot+3+2*kBot),bottom=(nBot?epBot+EP_H:y+rowH+BAND)+G*2*kBot;
   ds.forEach(function(d){d.y=y;d.epTopY=cursor;d.epBotY=epBot;});cursor=up9(bottom)+G*Math.min(chan[r+1],40);});
  // Hand edits: devices and endpoints moved in the editor (grid steps, kept on the page).
  var ed=view.edits||{};
  if(ed.moves)devices.forEach(function(d){var m=ed.moves[d.key];if(!m)return;var dx=snap(m[0]),dy=snap(m[1]);if(d.x+dx<LEFT)dx=snap(LEFT-d.x);if(d.y+dy<TOP+BAND)dy=snap(TOP+BAND-d.y);d.x+=dx;d.cellX+=dx;d.y+=dy;d.epTopY+=dy;d.epBotY+=dy;});
  devices.forEach(function(d){d.top.concat(d.bot).forEach(function(e){e.ox=0;e.oy=0;var m=ed.eps&&ed.eps[epKey(d,e.a)];if(m){e.ox=snap(m[0]);e.oy=snap(m[1]);e.rx+=e.ox;}});});
  // Size only (to choose a row width that suits the paper).
  function portEdit(d,p){return ed.ports&&ed.ports[d.key+'|'+short(p||'')]||p;}
  function epY(d,e){return (e.side==='top'?d.epTopY:d.epBotY)+(e.oy||0);}
  var rightEdge=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max(d.cellX+d.cellW,Math.max.apply(null,[0].concat(d.top.concat(d.bot).map(function(e){return d.x+e.rx+EP_W;}))));}));maxW=Math.max(maxW,rightEdge-LEFT);
  if(view.measure){var lb=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max.apply(null,[d.y+d.h+BAND].concat(d.top.concat(d.bot).map(function(e){return epY(d,e)+EP_H;})));}));var vl=view.vlansFor&&input.vlans&&input.vlans.get(view.vlansFor);return {w:MARGIN*2+LEGEND_W+maxW+G*16+(vl&&vl.length?320:0),h:lb+G*8};}
  // Title and legend.
  if(view.kicker)page.text(MARGIN,16,1200,14,view.kicker.toUpperCase(),{size:9.5,bold:true,align:'left',color:'#1d5b79'});
  page.text(MARGIN,32,1400,30,page.title,{size:24,bold:true,align:'left',color:'#1b3a4b'});
  if(view.subtitle)page.text(MARGIN,64,1400,16,view.subtitle,{size:11,align:'left',color:'#4a5568'});
  // Copper links and provider handoffs share the copper color: one legend entry for both.
  var legendTypes=['fiber','copper','wap','wan','other','slow'].filter(function(t){return used.has(t);});if(legendTypes.indexOf('copper')>=0&&legendTypes.indexOf('wan')>=0)legendTypes=legendTypes.filter(function(t){return t!=='wan';});
  var legendBottom=legendColumn(page,MARGIN,TOP,legendTypes,style==='box'?Array.from(new Set(Array.from(devices.values()).map(function(d){return d.node.role;}))):null),legendRight=MARGIN;
  // Devices, endpoints and summaries.
  devices.forEach(function(dev){page.begin(dev.key);if(style==='box')drawBox(page,dev);else{var u=new Map();usedPorts.forEach(function(color,k){if(k.indexOf(dev.key+'|')===0)u.set(k.slice(dev.key.length+1),color);});drawPlate(page,dev,u);}page.end();
   dev.top.concat(dev.bot).forEach(function(e){var x=dev.x+e.rx,y=epY(dev,e),a=e.a;page.begin(epKey(dev,a),'ep');
    // Styled after the reference drawing: grouped access points in a green summary box, other
    // devices and provider handoffs in a pale box with a dark accent bar.
    if(a.node.group){page.rect(x,y,EP_W,EP_H,{fill:'#86d9a4',stroke:'#2f9e5b',width:1});var pre=commonPrefix(a.ports);page.text(x+4,y+11,EP_W-8,40,clip(ranges(a.ports,pre),16)+'  |  '+a.ports.length+' APs\n'+clip(a.node.model||'',22),{size:9.5,lineHeight:16,firstBold:true,color:'#123524'});page.end();return;}
    var plain=a.node.role!=='ap';page.rect(x,y,EP_W,EP_H,{fill:plain?'#e8eef5':'#eef8f0',stroke:plain?'#c9d3df':ROLE_FILL.ap,width:1,radius:plain?0:6});if(plain)page.rect(x,y,4,EP_H,{fill:'#1d3a5c',stroke:'none'});var est=input.stencils&&input.stencils.get(a.node.key);
    if(est&&est.art){var r=est.art.w/est.art.h,ih=44,iw=ih*r;if(iw>44){iw=44;ih=iw/r;}page.image(x+5+(44-iw)/2,y+5+(44-ih)/2,iw,ih,{art:est.art,master:est.master});page.text(x+52,y+5,EP_W-56,46,clip(short(portEdit(dev,a.port)),12)+'\n'+clip(a.node.name,13)+'\n'+clip(epIP(a.node)||a.node.model||'',14),{size:8.5,lineHeight:14,firstBold:true,align:'left'});}
    else if(plain)page.text(x+12,y+9,EP_W-16,40,clip(a.node.name,19)+'\n'+clip(short(portEdit(dev,a.port)),9)+'  |  '+clip(epIP(a.node)||a.node.model||ROLE_LABEL[a.node.role]||'',14),{size:9,lineHeight:16,firstBold:true,align:'left',color:'#1b3a4b'});
    else page.text(x+4,y+5,EP_W-8,46,clip(short(portEdit(dev,a.port)),16)+'\n'+clip(a.node.name,20)+'\n'+clip(epIP(a.node)||a.node.model||ROLE_LABEL[a.node.role]||'',22),{size:9,lineHeight:14,firstBold:true});page.end();});
   // Grouped access points: a box in the access point color around the ports they use.
   (dev.eps||[]).forEach(function(a){if(!a.node.group||!a.ports||style!=='plate')return;var pts=a.ports.map(function(p){var sl=dev.slot(p||''),pos=dev.positions&&dev.positions[sl.key];return pos?[dev.x+pos.x,dev.y+pos.y]:[dev.x+sl.dx,dev.y+(sl.py!=null?sl.py:sl.row?51:21)];});if(!pts.length)return;
    var xs=pts.map(function(p){return p[0];}),ys=pts.map(function(p){return p[1];}),x0=Math.min.apply(null,xs)-9,x1=Math.max.apply(null,xs)+9,y0=Math.min.apply(null,ys)-11,y1=Math.max.apply(null,ys)+11;page.rect(x0,y0,x1-x0,y1-y0,{fill:'none',stroke:ROLE_FILL.ap,width:2,radius:4});});
   if(dev.others)page.text(dev.x+dev.w+G*2,dev.y+27,EP_W,18,'+'+dev.others+' other device'+(dev.others>1?'s':''),{size:10,align:'left',color:'#4a5568'});});
  // Box terminals: sorted by the far end so routes do not cross needlessly.
  if(style==='box')devices.forEach(function(dev){['top','bottom'].forEach(function(side){var list=dev.terms.filter(function(t){return t.side===side;});list.forEach(function(t){var o=t.conn.ta===t?t.conn.tb:t.conn.ta;t.order=o.dev.x+o.dev.w/2;});list.sort(function(a,b){return a.order-b.order;});var n=list.length,slots=Math.floor((dev.w-36)/18)+1;list.forEach(function(t,i){var s=n>=slots?i:Math.round((i+0.5)*slots/n-0.5);t.dx=18+18*Math.min(s,slots-1);});});});
  // Terminal geometry: the port point, the stub end outside the label band, the route
  // direction out of the stub, and the label box inside the band.
  function geo(t){if(t.shared){var b=geo(t.shared),out=b.dir===3?-1:1;return {px:b.sx,py:b.sy,sx:b.sx,sy:b.sy+out*2*G*t.k,dir:b.dir,trunk:b};}
   var d=t.dev;if(t.ep!=null){var e=d.top.concat(d.bot).find(function(x){return x.conn===t.conn;}),ex=d.x+e.rx+EP_W/2,ey=epY(d,e);return e.side==='top'?{px:ex,py:ey+EP_H,sx:ex,sy:ey+EP_H+G,dir:1}:{px:ex,py:ey,sx:ex,sy:ey-G,dir:3};}
   var x=d.x+(style==='box'?t.dx:t.slot.dx),top=t.side==='top',py=style==='box'?(top?d.y:d.y+d.h):t.slot.py!=null?d.y+t.slot.py:d.y+(top?21:51);
   return {px:x,py:py,sx:x,sy:top?d.y-BAND:d.y+d.h+BAND,dir:top?3:1,lx:x+3,ly:top?d.y-BAND+4:d.y+d.h+4,lalign:top?'left':'right'};}
  conns.forEach(function(c){if(c.ep!=null)c.tb={dev:c.A,ep:c.ep,conn:c};});
  // Router over the whole page area.
  var lastBottom=Math.max.apply(null,Array.from(devices.values()).map(function(d){return Math.max.apply(null,[d.y+d.h+BAND].concat(d.top.concat(d.bot).map(function(e){return epY(d,e)+EP_H;})));}));
  var RW=MARGIN*2+LEGEND_W+maxW+G*16,RH=lastBottom+G*8,router=new Router(RW,RH);
  router.block(0,0,Math.max(legendRight,600),TOP-G);router.block(0,0,LEFT-G*3,RH);
  var zoneId=0;devices.forEach(function(d){d.zone=++zoneId;var l=d.cellX,w=d.cellW;if(d.top.length)router.reserve(l,d.epTopY+EP_H+G,w,d.y-BAND-(d.epTopY+EP_H+G),d.zone);if(d.bot.length)router.reserve(l,d.y+d.h+BAND,w,d.epBotY-G-(d.y+d.h+BAND),d.zone);});
  devices.forEach(function(d){router.block(d.x-G,d.y-BAND+G,d.w+2*G,d.h+2*BAND-2*G);d.top.forEach(function(e){router.block(d.x+e.rx-G,epY(d,e)-G,EP_W+2*G,EP_H+G);});d.bot.forEach(function(e){router.block(d.x+e.rx-G,epY(d,e),EP_W+2*G,EP_H+G);});if(d.others)router.block(d.x+d.w+G,d.y+18,EP_W+G,36);});
  // A port reported with several neighbors becomes a trunk out of its stub with one
  // branch per neighbor, two grid steps apart.
  conns.forEach(function(c){c.ga=geo(c.ta);c.gb=geo(c.tb);[c.ga,c.gb].forEach(function(g){var v=router.at(g.sx,g.sy);if(v>=0&&!router.term[v])router.term[v]=c.net;if(g.trunk){var m=router.at(g.sx,g.sy+(g.sy>g.py?-G:G));if(m>=0&&!router.term[m])router.term[m]=c.net;}});c.len=Math.abs(c.ga.sx-c.gb.sx)+Math.abs(c.ga.sy-c.gb.sy);
   c.groups=[portGroup(c.ta),portGroup(c.tb)].filter(Boolean);});
  function portGroup(t){var o=t&&(t.shared||t);return o&&o.slot&&o.shares?o.dev.key+'|'+o.slot.key:'';}
  var lines=[],order=conns.slice().sort(function(a,b){return (b.ep!=null)-(a.ep!=null)||a.len-b.len;});
  function routeConn(c){var s=router.at(c.ga.sx,c.ga.sy),t=router.at(c.gb.sx,c.gb.sy),tDir=(c.gb.dir+2)&3,owner=c.ep!=null?c.A.zone:0,strict=s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,false,owner):null;return {strict:strict,path:strict||(s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,true,owner):null)};}
  order.forEach(function(c){var r=routeConn(c);c.path=r.path;c.strictPath=r.strict;if(r.path)router.commit(c.net,r.path);});
  // Lines avoid crossing (owner request): each line routed first could not see the ones
  // after it, so every crossing line is routed again with all the others in place and keeps
  // the new route whenever it crosses fewer lines (owner request: a line crosses another only
  // when no route avoids it), or crosses as many with fewer bends.
  var all=order.map(function(c){return {net:c.net,get path(){return c.path;}};});
  order.forEach(function(c){if(!c.path)return;router.rebuild(all,c.net);var old=router.score(c.net,c.path);if(!old.cross)return;router.cross=CROSS_STRICT;var r=routeConn(c);router.cross=0;if(!r.path||(c.strictPath&&!r.strict))return;var now=router.score(c.net,r.path);
   if(now.cross<old.cross||now.cross===old.cross&&now.bends<old.bends){c.path=r.path;c.strictPath=r.strict;}});
  router.rebuild(all,0);
  order.forEach(function(c){var path=c.path,strict=c.strictPath;
   var pts;if(path){pts=path.map(function(v){return [(v%router.C)*G,((v/router.C)|0)*G];});}else pts=[[c.ga.sx,c.ga.sy],[c.ga.sx,c.gb.sy],[c.gb.sx,c.gb.sy]];
   var points=compress([[c.ga.px,c.ga.py]].concat(pts,[[c.gb.px,c.gb.py]]));
   // A stencil's port is rarely on the 9 px routing grid: the vertical stretch into it moves
   // onto the port itself, so the line meets the port's center.
   function onPort(t,first){if(!t||t.shared||!t.slot||t.slot.ex==null||t.slot.ex===t.slot.dx)return;var x0=t.dev.x+t.slot.dx,x1=t.dev.x+t.slot.ex,list=first?points:points.slice().reverse();if(list[0][0]!==x0)return;for(var k=0;k<list.length&&list[k][0]===x0;k++)list[k]=[x1,list[k][1]];if(!first)points=list.reverse();else points=list;}
   if(style==='plate'){onPort(c.ta,true);onPort(c.tb,false);}
   lines.push({points:points,color:LINK_TYPES[c.type].color,width:c.type==='fiber'?2.5:style==='box'&&c.aPorts.length>1?3.5:2,conn:c,routed:!!path,strict:!!strict,groups:c.groups});});
  // Where a line crosses one drawn before it, its horizontal run hops over in a small arc.
  // Hand-drawn routes from the editor replace the computed one while both ends still meet
  // the same port points.
  lines.forEach(function(l){var c=l.conn;l.key=c.A.key+'|'+short(c.aPorts[0]||'')+'~'+(c.B?c.B.key+'|'+short(c.bPorts[0]||''):'ep:'+epKey(c.A,c.A.eps[c.ep]));var o=ed.lines&&ed.lines[l.key];
   if(o&&o.length>=2){var f=l.points[0],t=l.points[l.points.length-1];if(Math.abs(o[0][0]-f[0])<0.5&&Math.abs(o[0][1]-f[1])<0.5&&Math.abs(o[o.length-1][0]-t[0])<0.5&&Math.abs(o[o.length-1][1]-t[1])<0.5){l.points=o.map(function(p){return [p[0],p[1]];});l.edited=true;}}});
  lines.forEach(function(l,i){var out=[l.points[0]];for(var k=1;k<l.points.length;k++){var a=l.points[k-1],b=l.points[k];if(a[1]===b[1]&&Math.abs(b[0]-a[0])>2*G){var y=a[1],dir=b[0]>a[0]?1:-1,xs=[];
    // Every crossing hops, Visio style: the horizontal stretch jumps over the vertical one,
    // whichever line was drawn first, also between lines that share a bundle.
    for(var j=0;j<lines.length;j++){if(j===i||lines[j].conn===l.conn)continue;var q=lines[j].points;for(var m=1;m<q.length;m++){var c=q[m-1],e=q[m];if(c[0]!==e[0])continue;var x=c[0];if((x-a[0])*dir>G&&(b[0]-x)*dir>G&&y>Math.min(c[1],e[1])&&y<Math.max(c[1],e[1])&&xs.indexOf(x)<0)xs.push(x);}}
    xs.sort(function(p,q){return (p-q)*dir;}).forEach(function(x){for(var t=0;t<=6;t++){var ang=Math.PI*t/6;out.push([Math.round((x-dir*5*Math.cos(ang))*100)/100,Math.round((y-5*Math.sin(ang))*100)/100]);}});}out.push(b);}
   l.drawn=out;});
  lines.forEach(function(l){page.line(l.drawn,{color:l.color,width:l.width,dash:l.conn.dash,lineKey:l.key,route:l.points});});
  conns.forEach(function(c){[c.ga,c.gb].forEach(function(g){if(g&&g.trunk&&Math.abs(g.sy-g.py)===2*G)page.rect(g.px-4,g.py-4,8,8,{fill:'#2d3748',stroke:'none',radius:4});});});
  // Port labels in the bands.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t,i){if(!t||t.ep!=null||t.shared||!t.label)return;var g=i?c.gb:c.ga;page.text(g.lx,g.ly,10,BAND-8,t.label,{size:8,rotate:true,align:g.lalign,color:'#2d3748'});});});
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
  page.lines=lines;page.devices=Array.from(devices.values()).map(function(d){return {key:d.key,name:d.node.name,x:d.x,y:d.y,w:d.w,h:d.h};});
  // Endpoints with the x of the port they use, for the editor's alignment tools.
  page.eps=[];devices.forEach(function(d){d.top.concat(d.bot).forEach(function(e){var c=e.conn,port=c&&c.ga?c.ga.px:null;page.eps.push({key:epKey(d,e.a),x:d.x+e.rx,y:epY(d,e),w:EP_W,h:EP_H,portX:port,ox:e.ox||0,oy:e.oy||0});});});
  return page;
 }
 // A page for a scope; the title says what it shows.
 function diagram(input,o){
  var s=scope(input.layout,o),t=s.tree,focus=t.byKey.get(o.focus),style=o.style&&o.style!=='auto'?o.style:o.scope==='site'||!focus?'box':'plate';
  var title=o.scope==='site'||!focus?(o.title||'Site')+' - Existing Topology':focus.name+(o.scope==='neighbors'?' - Connections':' and below');
  var kicker=(o.title||'Site')+(o.scope==='site'||!focus?'':' / '+focus.name),sub=o.subtitle||(o.scope==='site'||!focus?'Devices and links from imported neighbor and monitoring data':[focus.model,(focus.ips||[])[0]].filter(Boolean).join('  |  '));
  if(o.customTitle)title=o.customTitle;if(o.customSubtitle)sub=o.customSubtitle;
  var view={company:o.company?String(o.company).toUpperCase():'',footer:o.author?'Prepared by '+o.author+(o.date?'  |  '+o.date:''):(o.date||''),title:title,kicker:kicker,subtitle:sub,rows:s.rows,context:s.context,style:style,aps:o.aps,apGroup:!!o.apGroup,others:o.others,wan:o.wan,vlansFor:o.scope==='site'||o.noVlans?null:o.focus,maxRow:o.maxRow};
  // Diagrams are meant to print on a letter sheet: try several row widths and keep the
  // one that needs the least shrinking (in either orientation).
  // Hand edits keep the arrangement they were made on.
  if(o.edits&&o.edits.maxRow&&!o.maxRow)view.maxRow=o.edits.maxRow;
  if(!view.maxRow){var best=null;(style==='box'?[3,4,6,8,10,14]:[1,2,3,4,5,6]).forEach(function(c){var m=render(input,Object.assign({},view,{maxRow:c,measure:true})),f=fitLetter(m);if(!best||f.raw>best.raw*1.02)best={c:c,raw:f.raw};});view.maxRow=best.c;}
  view.edits=o.edits||null;var page=render(input,view);
  // Every text gets a key (its group and original wording) so the editor can change it.
  var te=o.edits&&o.edits.texts||{};page.shapes.forEach(function(s){if(s.type!=='text')return;s.tkey=(s.node||'')+'|'+s.text;if(te[s.tkey]!=null)s.text=te[s.tkey];});
  page.scope=o;page.style=style;page.maxRow=view.maxRow;page.letter=fitLetter(page);return page;
 }
 // Letter paper (11 x 8.5 in at 96 px per inch) with 0.35 in margins: the orientation
 // that needs less shrinking, the scale (never above 1) and the offsets that center it.
 var LETTER_MARGIN=0.35*96;
 function fitLetter(p){var L={W:11*96,H:8.5*96},P={W:8.5*96,H:11*96};
  // Documentation pages are drawn on the sheet itself, margins included.
  if(p.doc&&p.w<=L.W+0.5&&p.h<=L.H+0.5)return {W:L.W,H:L.H,raw:1,scale:1,landscape:true,ox:0,oy:0};function f(o){return Math.min((o.W-2*LETTER_MARGIN)/p.w,(o.H-2*LETTER_MARGIN)/p.h);}
  var land=f(L)>=f(P),o=land?L:P,raw=f(o),k=Math.min(1,raw);return {W:o.W,H:o.H,raw:raw,scale:k,landscape:land,ox:(o.W-p.w*k)/2,oy:(o.H-p.h*k)/2};}
 // The page drawn on letter paper: every coordinate, size, line and font scaled.
 function onLetter(page){
  if(page.paper)return page;var f=fitLetter(page),k=f.scale,out=new Page(page.title);out.w=f.W;out.h=f.H;out.paper=f;
  page.shapes.forEach(function(x){var y=Object.assign({},x);
   if(y.type==='line')y.points=x.points.map(function(p){return [Math.round((f.ox+p[0]*k)*100)/100,Math.round((f.oy+p[1]*k)*100)/100];});else{y.x=f.ox+x.x*k;y.y=f.oy+x.y*k;y.w=x.w*k;y.h=x.h*k;}
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
  return {pages:pages,linkTypes:LINK_TYPES};
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
 Flow.prototype.need=function(h){if(!this.page||this.page.y+h>DOC_BOTTOM){this.page=docPage(this.title+(this.n?' (continued)':''),this.sub,this.o);this.n++;this.out.push(this.page);}return this.page;};
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
   group.forEach(function(d){var st=o.stencils&&o.stencils.get(d.key),dev=new Device({key:d.key,name:d.name,model:d.model,role:d.role,hw:d.hw,ips:d.ip?[d.ip]:[],stencil:st},d.ports.map(function(p){return p.name;}),[],'plate'),fills=new Map();
    d.ports.forEach(function(p){var role=portRole(p),slot=d.hw&&dev.hw&&!dev.hw.portOf(p.name)?null:dev.slot(p.name);used[role]=true;if(slot&&slot.key)fills.set(slot.key,{fill:PORT_ROLES[role].fill,up:p.up!==false,stroke:'#3d4a5c',label:portNumber(p.name)});
     var detail=portDetail(p,role),k=role+'|'+detail;if(!rowsByKey.has(k))rowsByKey.set(k,{role:role,detail:detail,ports:{}});(rowsByKey.get(k).ports[d.key]=rowsByKey.get(k).ports[d.key]||[]).push(p.name);});
    dev.plates.forEach(function(pl){var ph=dev.h+40,pg=flow.need(ph+14);pg.text(DM,pg.y,560,20,d.name+(dev.plates.length>1?'  ·  member '+pl.member:''),{size:15,bold:true,align:'left',color:'#1b3a4b'});pg.text(DM+420,pg.y+3,DOC_W-2*DM-420,16,[d.model,upCount(d),d.ip].filter(Boolean).join('   |   '),{size:10,align:'right',color:'#4a5568'});
     var keep=pl.x;pl.x=0;var one=Object.create(dev);one.plates=[pl];one.x=DM;one.y=pg.y+26;one.w=pl.w;drawPlate(pg,one,null,fills);pl.x=keep;pg.y+=26+dev.h+18;});});
   var p=flow.need(40),lx=DM;p.text(lx,p.y,90,16,'PORT ROLES',{size:9.5,bold:true,align:'left',color:'#1d5b79'});lx+=96;
   Object.keys(PORT_ROLES).filter(function(r){return used[r];}).forEach(function(r){p.rect(lx,p.y,26,14,{fill:PORT_ROLES[r].fill,stroke:'#7a8ca8',width:0.75});p.text(lx+32,p.y,170,16,PORT_ROLES[r].label,{size:10,align:'left'});lx+=40+PORT_ROLES[r].label.length*5.6;});p.y+=24;
   note(flow,'A filled port means the link is up (or no link state was imported); an outlined port means down.'+(function(){var pre=commonPrefix([].concat.apply([],group.map(function(d){return d.ports.map(function(x){return x.name;});})));return pre?' Port numbers use the prefix '+pre+'.':'';})());
   var pre=commonPrefix([].concat.apply([],group.map(function(d){return d.ports.map(function(x){return x.name;});}))),order=Object.keys(PORT_ROLES);
   var rows=Array.from(rowsByKey.values()).sort(function(a,b){return order.indexOf(a.role)-order.indexOf(b.role);}).map(function(r){return [{text:PORT_ROLES[r.role].label,bold:true,bar:PORT_ROLES[r.role].fill}].concat(group.map(function(d){return r.ports[d.key]?ranges(r.ports[d.key],pre):'';}),[r.detail]);});
   var cw=group.length===1?[0.24,0.28,0.48]:[0.22,0.2,0.2,0.38];docTable(flow,[{label:'Port assignment',w:cw[0]}].concat(group.map(function(d,i){return {label:d.name+' ports',w:cw[i+1]};}),[{label:'VLANs and link details',w:cw[cw.length-1]}]),rows);}
 }
 function wirelessPages(docs,o,out,input){
  var devs=docs.devices.filter(function(d){return d.ports.some(function(p){return p.neighbor&&p.neighbor.role==='ap';});});if(!devs.length)return;
  // Each switch drawn with its access points wired to their own ports (odd ports above,
  // even ports below), as on a hand-drawn wireless page; then the table of them all.
  if(input&&input.layout){var keys=input.layout.nodes.map(function(n){return n.key;});devs.forEach(function(d){if(keys.indexOf(d.key)<0)return;try{
   var n=d.ports.filter(function(p){return p.neighbor&&p.neighbor.role==='ap';}).length,pg=diagram(input,{scope:'downstream',focus:d.key,depth:0,style:'auto',upstream:false,aps:true,others:false,hidden:new Set(keys.filter(function(k){return k!==d.key;})),added:new Set(),title:o.title,customTitle:'Wireless connections',customSubtitle:d.name+'  |  '+[d.model,d.ip,n+' access point'+(n===1?'':'s')].filter(Boolean).join('  /  '),company:o.company,noVlans:true});
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
  for(var c0=0;c0<cols.length;c0+=7){var part=cols.slice(c0,c0+7),flow=new Flow('Trunk VLANs','Native and tagged VLANs on trunk, wireless and uplink ports'+(cols.length>7?' ('+(c0/7+1)+' of '+Math.ceil(cols.length/7)+')':''),o,out),cw=(1-0.3)/part.length;
   var p=flow.need(40);[['N','#1b3a4b','#ffffff','Native / untagged'],['T','#d6eef0','#1b3a4b','Tagged'],['-',null,'#9ca3af','Not carried']].forEach(function(k,i){var x=DM+i*190;if(k[1])p.rect(x,p.y,22,16,{fill:k[1],stroke:'none',radius:2});p.text(x,p.y+2,22,12,k[0],{size:9,bold:true,align:'center',color:k[2]});p.text(x+30,p.y+1,150,14,k[3],{size:10,align:'left'});});p.y+=30;
   docTable(flow,[{label:'VLAN',w:0.08},{label:'Name',w:0.22}].concat(part.map(function(c){return {label:c.label+'\n'+c.sub,w:cw,align:'center'};})),list.map(function(id){return [{text:id,bold:true},names.get(id)||''].concat(part.map(function(c){return c.native===id?{text:'N',chip:'#1b3a4b',color:'#ffffff'}:c.tagged.indexOf(id)>=0?{text:'T',chip:'#d6eef0',color:'#1b3a4b'}:{text:'-',color:'#9ca3af'};}));}),{});}
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
  if(s.type==='rect')return '<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="'+(s.radius||0)+'" fill="'+(s.fill||'none')+'" stroke="'+(s.stroke&&s.stroke!=='none'?s.stroke:'none')+'" stroke-width="'+(s.width||1)+'"'+(s.pkey?' data-port="'+esc(s.pkey)+'"':'')+'/>';
  if(s.type==='image')return s.art?'<svg x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" viewBox="0 0 '+s.art.w+' '+s.art.h+'" preserveAspectRatio="none" overflow="hidden">'+s.art.body+'</svg>':'';
  if(s.type==='line')return '<polyline'+(s.lineKey?' data-line="'+esc(s.lineKey)+'" data-route="'+(s.route||[]).map(function(p){return p[0]+','+p[1];}).join(' ')+'"':'')+' points="'+s.points.map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'"'+(s.dash?' stroke-dasharray="8 5"':'')+' stroke-linejoin="round" stroke-linecap="'+(s.dash?'butt':'round')+'"/>';
  var t=textSVG(s);return s.tkey?t.replace(/^<text /,'<text data-text="'+esc(s.tkey)+'" '):t;}
 // Where each port of a device sits on its stencil, as fractions of the artwork (for the
 // port point editor): every front port of the first member, by group and index.
 function stencilPorts(node,ports){var dev=new Device(node,ports||[],[],'plate');if(!dev.stencil||!dev.img)return null;var pl=dev.plates[0],out=[];
  pl.groups.forEach(function(g){if(g.rear)return;for(var i=0;i<g.count;i++){var name=g.names&&g.names[i]||'',s=dev.place(pl,g,i,name),label=g.labels?g.labels[i]:name?short(name):String((g.base||0)+(g.zero?i:i+1));
   out.push({k:g.name+'|'+i,label:label,name:name,fx:(s.ex-pl.x-G)/dev.img.w,fy:(s.py-dev.imgTop)/dev.img.h,exact:!!(dev.positions[s.key]&&dev.positions[s.key].exact)});}});
  return {items:out,ratio:dev.img.w/dev.img.h};}
 function svg(page){
  var out=[],open=0;page.shapes.forEach(function(s){if(s.g!==open){if(open)out.push('</g>');open=s.g||0;if(open)out.push(s.kind==='ep'?'<g class="diagram-ep" data-diagram-ep="'+esc(s.node)+'">':'<g class="diagram-node" data-diagram-node="'+esc(s.node)+'">');}out.push(shapeSVG(s));});if(open)out.push('</g>');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+page.w+'" height="'+page.h+'" viewBox="0 0 '+page.w+' '+page.h+'" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>'+out.join('')+'</svg>';
 }

 // ---------- VSDX / VSSX ----------
 var crcTable=null;function crc32(bytes){if(!crcTable){crcTable=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}var crc=0xffffffff;for(var i=0;i<bytes.length;i++)crc=(crc>>>8)^crcTable[(crc^bytes[i])&0xff];return (crc^0xffffffff)>>>0;}
 function zip(files){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  files.forEach(function(f){var name=enc.encode(f[0]),data=typeof f[1]==='string'?enc.encode(f[1]):f[1],crc=crc32(data),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);parts.push(new Uint8Array(h.buffer),name,data);
   var c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.push(new Uint8Array(c.buffer),name);offset+=30+name.length+data.length;});
  var size=central.reduce(function(n,p){return n+p.length;},0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  var all=parts.concat(central,[new Uint8Array(e.buffer)]),total=all.reduce(function(n,p){return n+p.length;},0),out=new Uint8Array(total),pos=0;all.forEach(function(p){out.set(p,pos);pos+=p.length;});return out;
 }
 var NS='http://schemas.microsoft.com/office/visio/2012/main',RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 function n(v){return Math.round(v*10000)/10000;}
 function cell(name,v){return '<Cell N="'+name+'" V="'+v+'"/>';}
 function charSection(s){return '<Section N="Character"><Row IX="0">'+cell('Font','Segoe UI')+cell('Color',s.color||'#1F2937')+cell('Style',s.bold?1:0)+cell('Size',n((s.size||11)*0.75/72))+'</Row></Section>';}
 var BOX_GEOM='<Row T="RelMoveTo" IX="1">'+cell('X',0)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="2">'+cell('X',1)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="3">'+cell('X',1)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="4">'+cell('X',0)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="5">'+cell('X',0)+cell('Y',0)+'</Row>';
 // One shape in a coordinate frame: page height H (inches), origin offset ox/oy.
 function shapeXML(s,ids,H,ox,oy,ctx){var id=ids.next++;
  if(s.type==='image'){var mm=ctx&&s.master&&ctx.masters.get(s.master);return mm?instanceXML(s,id,ids,H,ox,oy,mm):'';}
  if(s.type==='line'){var xs=s.points.map(function(p){return p[0]/96-ox;}),ys=s.points.map(function(p){return H-p[1]/96-oy;}),minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),w=Math.max(maxX-minX,0.01),h=Math.max(maxY-minY,0.01);
   return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(minX+w/2))+cell('PinY',n(minY+h/2))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+cell('LineWeight',n((s.width||2)/96))+cell('LineColor',s.color||'#000000')+cell('LinePattern',s.dash?2:1)+cell('FillPattern',0)+cell('Rounding',n(3/96))+
    '<Section N="Geometry" IX="0">'+cell('NoFill',1)+cell('NoLine',0)+s.points.map(function(p,i){return '<Row T="'+(i?'LineTo':'MoveTo')+'" IX="'+(i+1)+'">'+cell('X',n(p[0]/96-ox-minX))+cell('Y',n(H-p[1]/96-oy-minY))+'</Row>';}).join('')+'</Section></Shape>';}
  var isText=s.type==='text',cx=(s.x+s.w/2)/96-ox,cy=H-(s.y+s.h/2)/96-oy,w=Math.max((s.rotate?s.h:s.w)/96,0.01),h=Math.max((s.rotate?s.w:s.h)/96,0.01);
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(cx))+cell('PinY',n(cy))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+(s.rotate?cell('Angle','1.5707963'):'')+
   (isText?cell('LinePattern',0)+cell('FillPattern',0)+cell('VerticalAlign',s.rotate?1:0):(s.fill&&s.fill!=='none'?cell('FillForegnd',s.fill):'')+cell('FillPattern',s.fill&&s.fill!=='none'?1:0)+cell('LineColor',s.stroke&&s.stroke!=='none'?s.stroke:'#000000')+cell('LinePattern',s.stroke&&s.stroke!=='none'?1:0)+cell('LineWeight',n((s.width||1)/96))+(s.radius?cell('Rounding',n(s.radius/96)):''))+
   (isText?cell('LeftMargin',0)+cell('RightMargin',0)+cell('TopMargin',0)+cell('BottomMargin',0)+charSection(s)+'<Section N="Paragraph"><Row IX="0">'+cell('HorzAlign',s.align==='left'?0:s.align==='right'?2:1)+'</Row></Section>':'')+
   '<Section N="Geometry" IX="0">'+cell('NoFill',isText?1:0)+cell('NoLine',isText?1:0)+BOX_GEOM+'</Section>'+(isText?'<Text>'+esc(s.text)+'</Text>':'')+'</Shape>';
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
   entries.push(noStyles(m.element).replace(/^<Master\s/,'<Master ').replace(/(<Master\b[^>]*?)(\s)ID=(["'])\d+\3/,'$1$2ID="'+mm.id+'"').replace(/<Rel\s+r:id=(["'])[^"']+\1/,'<Rel r:id="rId'+mm.id+'"'));});
  if(!entries.length)return null;
  parts.push(['visio/masters/masters.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Masters xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve">'+entries.join('')+'</Masters>','application/vnd.ms-visio.masters+xml']);
  parts.push(['visio/masters/_rels/masters.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>',null]);
  return {parts:parts,media:Object.keys(media)};
 }
 function documentXML(){
  return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<VisioDocument xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><ProtectStyles>0</ProtectStyles><ProtectShapes>0</ProtectShapes><ProtectMasters>0</ProtectMasters><ProtectBkgnds>0</ProtectBkgnds></DocumentSettings><Colors><ColorEntry IX="0" RGB="#000000"/><ColorEntry IX="1" RGB="#FFFFFF"/></Colors><FaceNames><FaceName NameU="Calibri" UnicodeRanges="-536859905 -1073732485 9 0" CharSets="536871423 0" Panose="2 15 5 2 2 2 4 3 2 4" Flags="325"/><FaceName NameU="Segoe UI" UnicodeRanges="-469750017 -1073683329 9 0" CharSets="536871423 0" Panose="2 11 5 2 4 2 4 2 2 3" Flags="325"/></FaceNames><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style">'+
   cell('EnableLineProps',1)+cell('EnableFillProps',1)+cell('EnableTextProps',1)+cell('HideForApply',0)+cell('LineWeight',0.01041666666666667)+cell('LineColor','#000000')+cell('LinePattern',1)+cell('Rounding',0)+cell('EndArrowSize',2)+cell('BeginArrow',0)+cell('EndArrow',0)+cell('LineCap',0)+cell('BeginArrowSize',2)+cell('LineColorTrans',0)+cell('CompoundType',0)+cell('FillForegnd','#FFFFFF')+cell('FillBkgnd','#000000')+cell('FillPattern',1)+cell('ShdwForegnd','#000000')+cell('ShdwPattern',0)+cell('FillForegndTrans',0)+cell('FillBkgndTrans',0)+cell('ShdwForegndTrans',0)+cell('ShapeShdwType',0)+cell('ShapeShdwOffsetX',0)+cell('ShapeShdwOffsetY',0)+cell('ShapeShdwObliqueAngle',0)+cell('ShapeShdwScaleFactor',1)+cell('ShapeShdwBlur',0)+cell('ShapeShdwShow',0)+cell('LeftMargin',0.05555555555555555)+cell('RightMargin',0.05555555555555555)+cell('TopMargin',0.05555555555555555)+cell('BottomMargin',0.05555555555555555)+cell('VerticalAlign',1)+cell('TextBkgnd',0)+cell('DefaultTabStop',0.5)+cell('TextDirection',0)+cell('TextBkgndTrans',0)+cell('LockTextEdit',0)+cell('LockVtxEdit',0)+cell('ObjType',0)+
   '<Section N="Character"><Row IX="0">'+cell('Font','Calibri')+cell('Color','#000000')+cell('Style',0)+cell('Case',0)+cell('Pos',0)+cell('FontScale',1)+cell('Size',0.1666666666666667)+cell('DblUnderline',0)+cell('Overline',0)+cell('Strikethru',0)+cell('DoubleStrikethrough',0)+cell('Letterspace',0)+cell('ColorTrans',0)+cell('AsianFont',0)+cell('ComplexScriptFont',0)+cell('ComplexScriptSize',-1)+cell('LangID','en-US')+'</Row></Section><Section N="Paragraph"><Row IX="0">'+cell('IndFirst',0)+cell('IndLeft',0)+cell('IndRight',0)+cell('SpLine',-1.2)+cell('SpBefore',0)+cell('SpAfter',0)+cell('HorzAlign',1)+cell('Bullet',0)+cell('BulletStr','')+cell('BulletFont',0)+cell('BulletFontSize',-1)+cell('TextPosAfterBullet',0)+cell('Flags',0)+'</Row></Section></StyleSheet></StyleSheets></VisioDocument>';
 }
 function packageFiles(title,mainType,docRels,parts,extraDefaults,meta){meta=meta||{};
  var files=[];
  files.push(['[Content_Types].xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="'+mainType+'"/>'+(extraDefaults||[]).map(function(e){return '<Default Extension="'+e+'" ContentType="'+(MEDIA[e]||'application/octet-stream')+'"/>';}).join('')+parts.filter(function(p){return p[2]&&!/\.rels$/.test(p[0]);}).map(function(p){return '<Override PartName="/'+p[0]+'" ContentType="'+p[2]+'"/>';}).join('')+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>']);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>']);
  files.push(['docProps/app.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Template/>'+(meta.company?'<Company>'+esc(meta.company)+'</Company>':'')+'<Application>Config Inspector</Application></Properties>']);
  files.push(['docProps/core.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+esc(title)+'</dc:title>'+(meta.subject?'<dc:subject>'+esc(meta.subject)+'</dc:subject>':'')+'<dc:creator>'+esc(meta.creator||'Config Inspector')+'</dc:creator></cp:coreProperties>']);
  files.push(['visio/document.xml',documentXML()]);
  files.push(['visio/_rels/document.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+docRels+'</Relationships>']);
  parts.forEach(function(p){files.push([p[0],p[1]]);});
  return zip(files);
 }
 function vsdx(pages,title,meta){
  pages=pages.map(onLetter);
  var parts=[],rels=[],entries=[],ctx={masters:mastersOf(pages)},mp=masterParts(ctx);
  // Page names must be unique in a Visio document (at most 31 characters).
  var names={};function pageName(t){t=String(t||'Page').replace(/ \(continued\)$/,'').slice(0,26);var k=t.toLowerCase(),c=names[k]=(names[k]||0)+1;return c>1?t+' '+c:t;}
  pages.forEach(function(p,i){var prels=[];parts.push(['visio/pages/page'+(i+1)+'.xml',pageXML(p,ctx,prels),'application/vnd.ms-visio.page+xml']);
   var mrel=[];ctx.masters.forEach(function(mm){mrel.push('<Relationship Id="rM'+mm.id+'" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="../masters/master'+mm.id+'.xml"/>');});
   if(prels.length||mrel.length)parts.push(['visio/pages/_rels/page'+(i+1)+'.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+mrel.join('')+prels.map(function(r){return '<Relationship Id="'+r.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/'+r.target+'"/>';}).join('')+'</Relationships>',null]);rels.push('<Relationship Id="rId'+(i+1)+'" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page'+(i+1)+'.xml"/>');
   var name=esc(pageName(p.title));entries.push('<Page ID="'+i+'" NameU="'+name+'" Name="'+name+'" ViewScale="-1" ViewCenterX="0" ViewCenterY="0"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PageWidth',n(p.w/96))+cell('PageHeight',n(p.h/96))+cell('PageScale',1)+cell('DrawingScale',1)+cell('DrawingSizeType',0)+cell('DrawingScaleType',0)+cell('PrintPageOrientation',p.w>p.h?2:1)+'</PageSheet><Rel r:id="rId'+(i+1)+'"/></Page>');});
  parts.push(['visio/pages/pages.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Pages xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve">'+entries.join('')+'</Pages>','application/vnd.ms-visio.pages+xml']);
  parts.push(['visio/pages/_rels/pages.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>','application/vnd.openxmlformats-package.relationships+xml']);
  return packageFiles(title||'Network diagram','application/vnd.ms-visio.drawing.main+xml','<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>'+(mp?'<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/>':''),parts.concat(mp?mp.parts:[]),mp?mp.media:[],meta);
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
 root.SWDiagram={build:build,diagram:diagram,scope:scope,tree:tree,render:render,svg:svg,vsdx:vsdx,library:library,fitLetter:fitLetter,onLetter:onLetter,stencilPages:stencilPages,linkType:linkType,parsePort:parsePort,physicalPort:physicalPort,catalogFor:catalogFor,_Device:Device,stencilPorts:stencilPorts,shortPort:short,docPages:docPages,number:number,CATALOG:CATALOG,LINK_TYPES:LINK_TYPES,GRID:G};
 if(typeof module==='object'&&module.exports)module.exports=root.SWDiagram;
})(typeof globalThis!=='undefined'?globalThis:this);
