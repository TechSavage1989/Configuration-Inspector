(function(root){'use strict';
 // Network diagrams from the site map data. A diagram shows a chosen part of the
 // network (a device and what is below it, a device and its neighbors, or the whole
 // site). Switches are drawn as faceplates with numbered ports sized from the device's
 // own interfaces or a built-in model catalog; links are colored by type and routed on
 // a grid so they reach port centers from above (top row) or below (bottom row), go
 // around devices and never run on top of each other. Pages are plain shape lists
 // rendered to SVG or written as a Visio .vsdx; the catalog also exports as a library.
 var LINK_TYPES={
  fiber:{label:'10 Gbps+ fiber / uplink',color:'#1ba1e2'},
  copper:{label:'1 Gbps copper',color:'#e0a92e'},
  slow:{label:'100 Mbps or slower (dashed)',color:'#8a94a6',dash:true},
  wap:{label:'Access point copper',color:'#22b14c'},
  other:{label:'Other / speed not reported',color:'#8a94a6'}
 };
 var ROLE_FILL={firewall:'#c0504d',router:'#e6a23c',switch:'#4f81bd',controller:'#6b62d9',ap:'#22b14c',endpoint:'#8a94a6'};
 var ROLE_LABEL={firewall:'Firewall',router:'Router',switch:'Switch',controller:'Controller',ap:'Access point',endpoint:'Device'};
 var G=9,BAND=54,BEND=6,CROSS=2,TOP=126,EP_W=126,EP_H=54,EP_PITCH=153,MARGIN=36;
 function speedValue(s){var m=String(s||'').match(/([\d.]+)\s*([GM])/i);if(!m)return 0;return Number(m[1])*(m[2].toUpperCase()==='G'?1000:1);}
 function linkType(l,aRole,bRole){
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
  {re:/WS-C3750X-24/i,label:'Cisco Catalyst 3750-X 24',main:24,up:4},{re:/WS-C3750X-48/i,label:'Cisco Catalyst 3750-X 48',main:48,up:4},
  {re:/WS-C3560E-24/i,label:'Cisco Catalyst 3560-E 24',main:24,up:2},{re:/WS-C3560E-48/i,label:'Cisco Catalyst 3560-E 48',main:48,up:2},
  {re:/WS-C3560X-24/i,label:'Cisco Catalyst 3560-X 24',main:24,up:4},{re:/WS-C3560X-48/i,label:'Cisco Catalyst 3560-X 48',main:48,up:4},
  {re:/WS-C3650-24/i,label:'Cisco Catalyst 3650 24',main:24,up:4},{re:/WS-C3650-48/i,label:'Cisco Catalyst 3650 48',main:48,up:4},
  {re:/WS-C3850-24/i,label:'Cisco Catalyst 3850 24',main:24,up:4},{re:/WS-C3850-48/i,label:'Cisco Catalyst 3850 48',main:48,up:4},
  {re:/WS-C2960X?-24/i,label:'Cisco Catalyst 2960 24',main:24,up:4},{re:/WS-C2960X?-48/i,label:'Cisco Catalyst 2960 48',main:48,up:4},
  {re:/C9200L?-24/i,label:'Cisco Catalyst 9200 24',main:24,up:4},{re:/C9200L?-48/i,label:'Cisco Catalyst 9200 48',main:48,up:4},
  {re:/C9300L?-24/i,label:'Cisco Catalyst 9300 24',main:24,up:4},{re:/C9300L?-48/i,label:'Cisco Catalyst 9300 48',main:48,up:4},
  {re:/C9500-16X/i,label:'Cisco Catalyst 9500-16X',main:16,up:0,fiber:true},{re:/C9500-24Y4C/i,label:'Cisco Catalyst 9500-24Y4C',main:24,up:4,fiber:true},
  {re:/C9500-40X/i,label:'Cisco Catalyst 9500-40X',main:40,up:0,fiber:true},{re:/C9500-48Y4C/i,label:'Cisco Catalyst 9500-48Y4C',main:48,up:4,fiber:true},
  {re:/AIR-CT5508/i,label:'Cisco 5508 Wireless Controller',main:8,up:0,fiber:true},
  {re:/JL675A|JL676A/i,label:'Aruba 6100 48G 4SFP+',main:48,up:4},{re:/JL677A|JL678A/i,label:'Aruba 6100 24G 4SFP+',main:24,up:4},{re:/JL679A/i,label:'Aruba 6100 12G 2SFP+',main:12,up:2},
  {re:/JL253A/i,label:'Aruba 2930F 24G 4SFP+',main:24,up:4},{re:/JL256A/i,label:'Aruba 2930F 48G PoE+ 4SFP+',main:48,up:4},{re:/JL258A/i,label:'Aruba 2930F 8G PoE+ 2SFP+',main:8,up:2},
  {re:/J9775A/i,label:'HPE 2530-48G',main:48,up:4},{re:/J9776A/i,label:'HPE 2530-24G',main:24,up:4},
  {re:/MS2[25]0-24/i,label:'Meraki MS 24-port',main:24,up:4},{re:/MS2[25]0-48/i,label:'Meraki MS 48-port',main:48,up:4},
  {re:/TZ\s*600/i,label:'SonicWall TZ600',main:10,up:0}
 ];
 function catalogFor(model){model=String(model||'');for(var i=0;i<CATALOG.length;i++)if(CATALOG[i].re.test(model))return CATALOG[i];return null;}
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
  this.node=node;this.key=node.key;this.style=style;this.terms=[];this.cat=node.cat||catalogFor(node.model);
  if(style==='box'){this.w=198;this.h=72;return;}
  var cat=this.cat,members=new Map();
  function memberOf(k){if(!members.has(k))members.set(k,{n:k,groups:new Map(),other:[]});return members.get(k);}
  var parsed=(inventory||[]).filter(physicalPort).concat(linkPorts||[]).map(parsePort);
  if(!parsed.some(function(p){return p.group==='main';})){var counts={};parsed.forEach(function(p){if(p.group!=='other'&&p.group!=='up')counts[p.group]=(counts[p.group]||0)+1;});var best=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];if(best){this.promote=best;parsed.forEach(function(p){if(p.group===best)p.group='main';});}}
  if(!parsed.some(function(p){return p.group!=='other';}))memberOf(1);
  // Without a catalog entry, 25-28 or 49-52 ports on a 24- or 48-port board are the
  // uplink (SFP) ports, as on most access switches.
  if(!cat){var top=0;parsed.forEach(function(p){if(p.group==='main'&&!p.single)top=Math.max(top,p.n);});if(top>48&&top<=52)cat=this.cat={main:48,up:4};else if(top>24&&top<=28)cat=this.cat={main:24,up:4};}
  var zero={};parsed.forEach(function(p){if(p.single&&p.n===0)zero[p.member+'|'+p.group]=true;});
  parsed.forEach(function(p){var mem=memberOf(p.member);if(p.group==='other'){if(p.name&&mem.other.indexOf(p.name)<0)mem.other.push(p.name);return;}
   var n=p.n+(zero[p.member+'|'+p.group]?1:0);if(p.group==='main'&&cat&&n>cat.main&&cat.up){p.group='up';n-=cat.main;}
   var g=mem.groups.get(p.group)||{name:p.group,max:0,fiber:p.group==='up'||!!(cat&&cat.fiber&&p.group==='main'),zero:!!zero[p.member+'|'+p.group]};g.max=Math.max(g.max,n);if(p.fiber&&p.group!=='main')g.fiber=true;mem.groups.set(p.group,g);});
  var self=this,x=0;this.plates=[];
  Array.from(members.values()).sort(function(a,b){return a.n-b.n;}).slice(0,8).forEach(function(mem,i){
   var main=mem.groups.get('main')||{name:'main',max:0,fiber:!!(cat&&cat.fiber)};main.count=cat?Math.max(cat.main,main.max):main.max?sizeFor(main.max):mem.groups.size>1||mem.other.length?0:8;mem.groups.set('main',main);
   if(cat&&cat.up){var up=mem.groups.get('up')||{name:'up',max:0,fiber:true};up.count=Math.max(cat.up,up.max);mem.groups.set('up',up);}
   var order=['main','up'].concat(Array.from(mem.groups.keys()).filter(function(k){return k!=='main'&&k!=='up';}).sort());
   var col=0,groups=[];order.forEach(function(k){var g=mem.groups.get(k);if(!g)return;if(g.count==null)g.count=g.max+g.max%2;if(!g.count)return;g.col=col;col+=Math.ceil(g.count/2)+1;groups.push(g);});
   if(mem.other.length){groups.push({name:'other',count:mem.other.length,col:col,names:mem.other,fiber:false});col+=Math.ceil(mem.other.length/2)+1;}
   var label=i===0?216:117,w=up9(81+18*(Math.max(col,2)-2)+27+label);
   self.plates.push({member:mem.n,x:x,w:w,groups:groups,labelX:w-label+9,first:i===0});x+=w+27;});
  this.w=x-27;this.h=72;
 }
 // The port slot for a port name: plate, column center and row (0 top, 1 bottom).
 Device.prototype.slot=function(name){
  var p=parsePort(name),cat=this.cat,plate=this.plates.find(function(pl){return pl.member===p.member;})||this.plates[0];
  if(this.promote&&p.group===this.promote)p.group='main';
  if(p.group==='main'&&cat&&cat.up&&p.n>cat.main){p.group='up';p.n-=cat.main;}
  var g=plate.groups.find(function(x){return x.name===p.group;}),idx;
  if(!g||p.group==='other'){g=plate.groups.find(function(x){return x.name==='other';});if(!g){g={name:'other',count:0,col:plate.groups.reduce(function(c,x){return Math.max(c,x.col+Math.ceil(x.count/2)+1);},0),names:[]};plate.groups.push(g);}
   idx=g.names.indexOf(p.name);if(idx<0){g.names.push(p.name);g.count=g.names.length;idx=g.names.length-1;}}
  else{idx=p.n+(g.zero?1:0)-1;idx=Math.max(0,idx)%Math.max(2,g.count+g.count%2);}
  var col=g.col+Math.floor(idx/2),row=idx%2;
  return {key:plate.member+'|'+g.name+'|'+idx,plate:plate,dx:plate.x+81+18*col,row:row,fiber:g.fiber,number:g.name==='other'?'':String(g.zero?idx:idx+1),name:p.name};
 };
 Device.prototype.fit=function(){if(this.style!=='box')return;var top=this.terms.filter(function(t){return t.side==='top';}).length,bottom=this.terms.length-top;this.w=Math.max(198,up9(36+18*Math.max(top,bottom)));};
 function drawPlate(page,dev,used){
  var node=dev.node,x0=dev.x,y=dev.y;
  dev.plates.forEach(function(pl){var x=x0+pl.x;
   page.rect(x,y,pl.w,72,{fill:'#dfe7f3',stroke:'#3d5a80',width:1.5,radius:4});page.rect(x+10,y+10,44,52,{fill:ROLE_FILL[node.role]||'#4f81bd',stroke:'none'});
   pl.groups.forEach(function(g){for(var i=0;i<g.count;i++){var col=g.col+Math.floor(i/2),row=i%2,cx=x+81+18*col,cy=y+(row?51:21),key=pl.member+'|'+g.name+'|'+i,u=used&&used.get(key),label=g.name==='other'?'':String(g.zero?i:i+1);
    if(g.fiber)page.rect(cx-7,cy-7,14,14,{fill:u?'#ffffff':'#5b6b82',stroke:u?u:'#3d4a5c',width:u?1.6:0.75});else page.rect(cx-6.5,cy-10,13,20,{fill:'#ffffff',stroke:u||'#7a8ca8',width:u?1.6:0.75});
    if(label)page.text(cx-9,cy-4.5,18,9,label,{size:6.5,color:g.fiber&&!u?'#ffffff':'#4a5568'});}});
   var lx=x+pl.labelX,lw=pl.w-pl.labelX-8;
   if(pl.first)page.text(lx,y+8,lw,58,clip(node.name,30)+'\n'+clip(node.model||ROLE_LABEL[node.role]||'',34)+'\n'+((node.ips||[])[0]||''),{size:10.5,align:'left',firstBold:true,lineHeight:17});
   else page.text(lx,y+26,lw,18,'Member '+pl.member,{size:10.5,bold:true,align:'left'});});
 }
 function drawBox(page,dev){var n=dev.node,x=dev.x,y=dev.y,extra=[(n.attached||[]).filter(function(a){return a.role==='ap';}).length,(n.attached||[]).filter(function(a){return a.role!=='ap';}).length];
  page.rect(x,y,dev.w,dev.h,{fill:'#ffffff',stroke:ROLE_FILL[n.role]||'#4f81bd',width:1.5,radius:6});page.rect(x,y,6,dev.h,{fill:ROLE_FILL[n.role]||'#4f81bd',stroke:'none'});
  page.text(x+14,y+8,dev.w-20,dev.h-12,clip(n.name,34)+'\n'+clip([n.model||ROLE_LABEL[n.role],(n.ips||[])[0]].filter(Boolean).join(' · '),40)+(extra[0]||extra[1]?'\n'+[extra[0]?extra[0]+' AP'+(extra[0]>1?'s':''):'',extra[1]?extra[1]+' device'+(extra[1]>1?'s':''):''].filter(Boolean).join(' · '):''),{size:10,align:'left',firstBold:true,lineHeight:16});}

 // ---------- pages ----------
 function Page(title){this.title=title;this.shapes=[];this.w=0;this.h=0;this.groupId=0;this.cur=null;}
 Page.prototype.push=function(s){if(this.cur){s.g=this.cur.id;s.node=this.cur.node;}this.shapes.push(s);return this;};
 Page.prototype.rect=function(x,y,w,h,o){this.grow(x+w,y+h);return this.push(Object.assign({type:'rect',x:x,y:y,w:w,h:h},o||{}));};
 Page.prototype.text=function(x,y,w,h,text,o){this.grow(x+w,y+h);return this.push(Object.assign({type:'text',x:x,y:y,w:w,h:h,text:String(text)},o||{}));};
 Page.prototype.line=function(points,o){var self=this;points.forEach(function(p){self.grow(p[0],p[1]);});return this.push(Object.assign({type:'line',points:points},o||{}));};
 Page.prototype.grow=function(x,y){this.w=Math.max(this.w,x+MARGIN);this.h=Math.max(this.h,y+MARGIN);};
 Page.prototype.begin=function(node){this.cur={id:++this.groupId,node:node};};
 Page.prototype.end=function(){this.cur=null;};
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
    if(occ&&turn)cost+=40;if(this.zone[u]&&this.zone[u]!==owner)cost+=4;if(turn)cost+=BEND;if(this.node[u]&&this.node[u]!==net)cost+=CROSS;if(u===t&&nd!==tDir)cost+=BEND;
    var ns=u*4+nd,ng=gc+cost;if(seen[ns]!==gen||ng<g[ns]){seen[ns]=gen;g[ns]=ng;prev[ns]=cur;heap.push(ng+h(u),ns);}}}
  return null;
 };
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

 // ---------- render ----------
 // input: {layout, links, vlans: Map, ports: Map key -> [port names]}
 // view: {title, rows (from scope), style 'plate' | 'box', aps, others, vlansFor, maxRow}
 function render(input,view){
  var layout=input.layout,all=new Map(layout.all.map(function(n){return [n.key,n];})),shownByKey=new Map(layout.nodes.map(function(n){return [n.key,n];})),style=view.style==='box'?'box':'plate';
  var page=new Page(view.title||'Network diagram'),devices=new Map(),rowsOut=[],used=new Set();
  var maxRow=view.maxRow||(style==='box'?10:3);
  view.rows.forEach(function(row){for(var i=0;i<row.length;i+=maxRow)rowsOut.push(row.slice(i,i+maxRow));});
  rowsOut.forEach(function(row,r){row.forEach(function(k){var n=Object.assign({},shownByKey.get(k)||all.get(k));var ports=[];(input.links||[]).forEach(function(l){if(l.a===k)ports.push(l.aPort);if(l.b===k)ports.push(l.bPort);});(n.attached||[]).forEach(function(a){ports.push(a.port);});var dev=new Device(n,input.ports&&input.ports.get(k)||[],ports,style);dev.row=r;devices.set(k,dev);});});
  // Endpoints (access points and named devices) beside their switch on faceplate pages.
  var ipCount={};devices.forEach(function(dev){(dev.node.attached||[]).forEach(function(a){var n=all.get(a.key),ip=n&&(n.ips||[])[0];if(ip)ipCount[ip]=(ipCount[ip]||0)+1;});});
  function epIP(n){var ip=(n.ips||[])[0];return ip&&ipCount[ip]<3?ip:'';}
  devices.forEach(function(dev){dev.eps=[];dev.others=0;if(style==='box'||view.context&&view.context.has(dev.key))return;var list=(dev.node.attached||[]).map(function(a){return {node:all.get(a.key)||{name:a.name,role:a.role,key:a.key},port:a.port};}).filter(function(a){return a.node.role==='ap'?view.aps!==false:view.others!==false;});
   var named=list.filter(function(a){return !a.node.generic;}).sort(function(a,b){return (a.node.role==='ap'?0:1)-(b.node.role==='ap'?0:1)||String(a.port).localeCompare(String(b.port),undefined,{numeric:true});});dev.eps=named.slice(0,12);dev.others=list.length-dev.eps.length;});
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
  function termPlate(dev,port,c){var s=dev.slot(port||'');var t={dev:dev,slot:s,side:s.row?'bottom':'top',label:clip(short(port),10),conn:c};var prior=dev.terms.find(function(x){return x.slot.key===s.key;});if(prior){t.shared=prior;prior.shares=(prior.shares||0)+1;t.k=prior.shares;t.label='';}else{dev.terms.push(t);usedPorts.set(dev.key+'|'+s.key,LINK_TYPES[c.type].color);}return t;}
  devices.forEach(function(dev){dev.fit();});
  // Endpoints sit above their switch when cabled to a top-row port and below it for a
  // bottom-row port, each near its port.
  devices.forEach(function(d){d.top=[];d.bot=[];});
  conns.forEach(function(c){if(c.ep==null)return;var t=c.ta.shared||c.ta,e={conn:c,a:c.A.eps[c.ep],dx:t.slot.dx,side:c.ta.side};(e.side==='top'?c.A.top:c.A.bot).push(e);});
  devices.forEach(function(d){[d.top,d.bot].forEach(function(list){var x=null;list.sort(function(p,q){return p.dx-q.dx;}).forEach(function(e){var ideal=snap(e.dx-EP_W/2);x=x==null?ideal:Math.max(ideal,x+EP_PITCH);e.rx=x;});});
   var left=Math.min.apply(null,[0].concat(d.top.concat(d.bot).map(function(e){return e.rx;}))),right=Math.max.apply(null,[d.w+(d.others?G*2+EP_W:0)].concat(d.top.concat(d.bot).map(function(e){return e.rx+EP_W;})));d.offset=-left;d.cellW=right-left;});
  // Horizontal placement: cells left to right, rows centered.
  var widths=rowsOut.map(function(row){return row.reduce(function(w,k,i){return w+devices.get(k).cellW+(i?G*10:0);},0);}),maxW=Math.max.apply(null,widths.concat([400]));
  rowsOut.forEach(function(row,r){var x=MARGIN+snap((maxW-widths[r])/2);row.forEach(function(k){var d=devices.get(k);d.cellX=x;d.x=x+d.offset;x+=d.cellW+G*10;});});
  // Channel sizes from the routes that use them, then vertical placement.
  var chan=rowsOut.map(function(){return 3;});chan.push(3);
  conns.forEach(function(c){if(c.ep!=null)return;[c.ta,c.tb].forEach(function(t){if(!t)return;var r=t.dev.row;chan[t.side==='top'?r:r+1]++;});var a=Math.min(c.A.row,c.B.row),b=Math.max(c.A.row,c.B.row);for(var r=a+1;r<=b;r++)chan[r]+=0.34;});chan=chan.map(Math.ceil);
  var cursor=TOP+G*Math.min(chan[0],30);
  // Trunks of shared ports need room outside the band too.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t){if(t&&t.shared){var d=t.dev,key=t.side==='top'?'trunkTop':'trunkBot';d[key]=Math.max(d[key]||0,t.k);}});});
  rowsOut.forEach(function(row,r){var ds=row.map(function(k){return devices.get(k);}),nTop=Math.max.apply(null,ds.map(function(d){return d.top.length;})),nBot=Math.max.apply(null,ds.map(function(d){return d.bot.length;})),kTop=Math.max.apply(null,ds.map(function(d){return d.trunkTop||0;})),kBot=Math.max.apply(null,ds.map(function(d){return d.trunkBot||0;}));
   cursor+=G*2*kTop;var topExtra=nTop?EP_H+G*(nTop+3+2*kTop):0,y=cursor+topExtra+BAND,epBot=y+72+BAND+G*(nBot+3+2*kBot),bottom=(nBot?epBot+EP_H:y+72+BAND)+G*2*kBot;
   ds.forEach(function(d){d.y=y;d.epTopY=cursor;d.epBotY=epBot;});cursor=up9(bottom)+G*Math.min(chan[r+1],40);});
  // Title and legend.
  if(view.kicker)page.text(MARGIN,16,1200,14,view.kicker.toUpperCase(),{size:9.5,bold:true,align:'left',color:'#1d5b79'});
  page.text(MARGIN,32,1400,30,page.title,{size:24,bold:true,align:'left',color:'#1b3a4b'});
  if(view.subtitle)page.text(MARGIN,64,1400,16,view.subtitle,{size:11,align:'left',color:'#4a5568'});
  var legendRight=legendRow(page,MARGIN,94,['fiber','copper','wap','other','slow'].filter(function(t){return used.has(t);}),style==='box'?Array.from(new Set(Array.from(devices.values()).map(function(d){return d.node.role;}))):null);
  // Devices, endpoints and summaries.
  devices.forEach(function(dev){page.begin(dev.key);if(style==='box')drawBox(page,dev);else{var u=new Map();usedPorts.forEach(function(color,k){if(k.indexOf(dev.key+'|')===0)u.set(k.slice(dev.key.length+1),color);});drawPlate(page,dev,u);}page.end();
   dev.top.concat(dev.bot).forEach(function(e){var x=dev.x+e.rx,y=e.side==='top'?dev.epTopY:dev.epBotY,a=e.a;page.begin(a.node.key||'');page.rect(x,y,EP_W,EP_H,{fill:a.node.role==='ap'?'#eef8f0':'#eef3f9',stroke:a.node.role==='ap'?ROLE_FILL.ap:'#9aa9bd',width:1,radius:6});page.text(x+4,y+5,EP_W-8,46,clip(short(a.port),16)+'\n'+clip(a.node.name,20)+'\n'+clip(epIP(a.node)||a.node.model||ROLE_LABEL[a.node.role]||'',22),{size:9,lineHeight:14,firstBold:true});page.end();});
   if(dev.others)page.text(dev.x+dev.w+G*2,dev.y+27,EP_W,18,'+'+dev.others+' other device'+(dev.others>1?'s':''),{size:10,align:'left',color:'#4a5568'});});
  // Box terminals: sorted by the far end so routes do not cross needlessly.
  if(style==='box')devices.forEach(function(dev){['top','bottom'].forEach(function(side){var list=dev.terms.filter(function(t){return t.side===side;});list.forEach(function(t){var o=t.conn.ta===t?t.conn.tb:t.conn.ta;t.order=o.dev.x+o.dev.w/2;});list.sort(function(a,b){return a.order-b.order;});var n=list.length,slots=Math.floor((dev.w-36)/18)+1;list.forEach(function(t,i){var s=n>=slots?i:Math.round((i+0.5)*slots/n-0.5);t.dx=18+18*Math.min(s,slots-1);});});});
  // Terminal geometry: the port point, the stub end outside the label band, the route
  // direction out of the stub, and the label box inside the band.
  function geo(t){if(t.shared){var b=geo(t.shared),out=b.dir===3?-1:1;return {px:b.sx,py:b.sy,sx:b.sx,sy:b.sy+out*2*G*t.k,dir:b.dir,trunk:b};}
   var d=t.dev;if(t.ep!=null){var e=d.top.concat(d.bot).find(function(x){return x.conn===t.conn;}),ex=d.x+e.rx+EP_W/2;return e.side==='top'?{px:ex,py:d.epTopY+EP_H,sx:ex,sy:d.epTopY+EP_H+G,dir:1}:{px:ex,py:d.epBotY,sx:ex,sy:d.epBotY-G,dir:3};}
   var x=d.x+(style==='box'?t.dx:t.slot.dx),top=t.side==='top',py=style==='box'?(top?d.y:d.y+d.h):d.y+(top?21:51);
   return {px:x,py:py,sx:x,sy:top?d.y-BAND:d.y+d.h+BAND,dir:top?3:1,lx:x+3,ly:top?d.y-BAND+4:d.y+d.h+4,lalign:top?'left':'right'};}
  conns.forEach(function(c){if(c.ep!=null)c.tb={dev:c.A,ep:c.ep,conn:c};});
  // Router over the whole page area.
  var lastBottom=Math.max.apply(null,Array.from(devices.values()).map(function(d){return d.bot.length?d.epBotY+EP_H:d.y+d.h+BAND;}));
  var RW=MARGIN*2+maxW+G*16,RH=lastBottom+G*8,router=new Router(RW,RH);
  router.block(0,0,Math.max(legendRight,600),TOP-G);
  var zoneId=0;devices.forEach(function(d){d.zone=++zoneId;var l=d.cellX,w=d.cellW;if(d.top.length)router.reserve(l,d.epTopY+EP_H+G,w,d.y-BAND-(d.epTopY+EP_H+G),d.zone);if(d.bot.length)router.reserve(l,d.y+d.h+BAND,w,d.epBotY-G-(d.y+d.h+BAND),d.zone);});
  devices.forEach(function(d){router.block(d.x-G,d.y-BAND+G,d.w+2*G,d.h+2*BAND-2*G);d.top.forEach(function(e){router.block(d.x+e.rx-G,d.epTopY-G,EP_W+2*G,EP_H+G);});d.bot.forEach(function(e){router.block(d.x+e.rx-G,d.epBotY,EP_W+2*G,EP_H+G);});if(d.others)router.block(d.x+d.w+G,d.y+18,EP_W+G,36);});
  // A port reported with several neighbors becomes a trunk out of its stub with one
  // branch per neighbor, two grid steps apart.
  conns.forEach(function(c){c.ga=geo(c.ta);c.gb=geo(c.tb);[c.ga,c.gb].forEach(function(g){var v=router.at(g.sx,g.sy);if(v>=0&&!router.term[v])router.term[v]=c.net;if(g.trunk){var m=router.at(g.sx,g.sy+(g.sy>g.py?-G:G));if(m>=0&&!router.term[m])router.term[m]=c.net;}});c.len=Math.abs(c.ga.sx-c.gb.sx)+Math.abs(c.ga.sy-c.gb.sy);
   c.groups=[portGroup(c.ta),portGroup(c.tb)].filter(Boolean);});
  function portGroup(t){var o=t&&(t.shared||t);return o&&o.slot&&o.shares?o.dev.key+'|'+o.slot.key:'';}
  var lines=[];conns.slice().sort(function(a,b){return (b.ep!=null)-(a.ep!=null)||a.len-b.len;}).forEach(function(c){
   var s=router.at(c.ga.sx,c.ga.sy),t=router.at(c.gb.sx,c.gb.sy),tDir=(c.gb.dir+2)&3;
   var owner=c.ep!=null?c.A.zone:0,strict=s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,false,owner):null,path=strict||(s>=0&&t>=0?router.route(c.net,s,c.ga.dir,t,tDir,true,owner):null);
   var pts;if(path){router.commit(c.net,path);pts=path.map(function(v){return [(v%router.C)*G,((v/router.C)|0)*G];});}else pts=[[c.ga.sx,c.ga.sy],[c.ga.sx,c.gb.sy],[c.gb.sx,c.gb.sy]];
   var points=compress([[c.ga.px,c.ga.py]].concat(pts,[[c.gb.px,c.gb.py]]));
   lines.push({points:points,color:LINK_TYPES[c.type].color,width:c.type==='fiber'?3.5:style==='box'&&c.aPorts.length>1?4.5:3,conn:c,routed:!!path,strict:!!strict,groups:c.groups});});
  // Where a line crosses one drawn before it, its horizontal run hops over in a small arc.
  lines.forEach(function(l,i){var out=[l.points[0]];for(var k=1;k<l.points.length;k++){var a=l.points[k-1],b=l.points[k];if(a[1]===b[1]&&Math.abs(b[0]-a[0])>2*G){var y=a[1],dir=b[0]>a[0]?1:-1,xs=[];
    for(var j=0;j<i;j++){var q=lines[j].points;for(var m=1;m<q.length;m++){var c=q[m-1],e=q[m];if(c[0]!==e[0])continue;var x=c[0];if((x-a[0])*dir>G&&(b[0]-x)*dir>G&&y>Math.min(c[1],e[1])&&y<Math.max(c[1],e[1])&&xs.indexOf(x)<0)xs.push(x);}}
    xs.sort(function(p,q){return (p-q)*dir;}).forEach(function(x){for(var t=0;t<=6;t++){var ang=Math.PI*t/6;out.push([Math.round((x-dir*5*Math.cos(ang))*100)/100,Math.round((y-5*Math.sin(ang))*100)/100]);}});}out.push(b);}
   l.drawn=out;});
  lines.forEach(function(l){page.line(l.drawn,{color:l.color,width:l.width,dash:l.conn.dash});});
  conns.forEach(function(c){[c.ga,c.gb].forEach(function(g){if(g&&g.trunk&&Math.abs(g.sy-g.py)===2*G)page.rect(g.px-4,g.py-4,8,8,{fill:'#2d3748',stroke:'none',radius:4});});});
  // Port labels in the bands.
  conns.forEach(function(c){[c.ta,c.tb].forEach(function(t,i){if(!t||t.ep!=null||t.shared||!t.label)return;var g=i?c.gb:c.ga;page.text(g.lx,g.ly,10,BAND-8,t.label,{size:8,rotate:true,align:g.lalign,color:'#2d3748'});});});
  // VLANs of the focus device to the right of everything routed.
  var vlans=view.vlansFor&&input.vlans&&input.vlans.get(view.vlansFor)||[];
  if(vlans.length){var vx=up9(Math.max(page.w-MARGIN,legendRight)+G*2);page.text(vx,TOP,280,20,'VLANs',{size:13,bold:true,align:'left'});page.text(vx,TOP+26,300,Math.max(20,Math.min(vlans.length,40)*17+17),vlans.slice(0,40).map(function(v){return 'VLAN '+v.id+(v.name?' – '+v.name:'');}).join('\n')+(vlans.length>40?'\n+'+(vlans.length-40)+' more':''),{size:11,align:'left',lineHeight:17});}
  page.text(page.w-MARGIN-300,16,300,14,'NETWORK DOCUMENTATION',{size:9.5,bold:true,align:'right',color:'#1d5b79'});
  page.rect(MARGIN,84,page.w-2*MARGIN,1,{fill:'#c9d3df',stroke:'none'});
  page.lines=lines;page.devices=Array.from(devices.values()).map(function(d){return {key:d.key,name:d.node.name,x:d.x,y:d.y,w:d.w,h:d.h};});
  return page;
 }
 // A page for a scope; the title says what it shows.
 function diagram(input,o){
  var s=scope(input.layout,o),t=s.tree,focus=t.byKey.get(o.focus),style=o.style&&o.style!=='auto'?o.style:o.scope==='site'||!focus?'box':'plate';
  var title=o.scope==='site'||!focus?(o.title||'Site')+' - Existing Topology':focus.name+(o.scope==='neighbors'?' - Connections':' and below');
  var kicker=(o.title||'Site')+(o.scope==='site'||!focus?'':' / '+focus.name),sub=o.subtitle||(o.scope==='site'||!focus?'Devices and links from imported neighbor and monitoring data':[focus.model,(focus.ips||[])[0]].filter(Boolean).join('  |  '));
  var page=render(input,{title:title,kicker:kicker,subtitle:sub,rows:s.rows,context:s.context,style:style,aps:o.aps,others:o.others,vlansFor:o.scope==='site'?null:o.focus,maxRow:o.maxRow});
  page.scope=o;return page;
 }
 // Site book: the whole site, then one downstream page for each switch with switches or
 // access points below it (a small subtree on one page; a large one one level at a time).
 function build(input){
  var map=input.layout,t=tree(map),pages=[diagram(input,{scope:'site',title:input.title||'Site'})];
  function isSwitch(k){var n=t.byKey.get(k);return n&&/switch|router|controller/.test(n.role);}
  function subtree(k){var out=[],stack=[k];while(stack.length){var c=stack.pop();out.push(c);(t.children.get(c)||[]).forEach(function(x){if(isSwitch(x))stack.push(x);});}return out;}
  var visited=new Set();
  function visit(k){if(visited.has(k)||pages.length>=40)return;visited.add(k);var kids=(t.children.get(k)||[]).filter(isSwitch),aps=(t.byKey.get(k).attached||[]).some(function(a){return a.role==='ap';}),tree2=subtree(k);
   if(!kids.length&&!aps)return;
   if(tree2.length<=6){pages.push(diagram(input,{scope:'downstream',focus:k,depth:0}));tree2.forEach(function(x){visited.add(x);});return;}
   pages.push(diagram(input,{scope:'downstream',focus:k,depth:1}));kids.forEach(visit);}
  map.nodes.filter(function(n){return isSwitch(n.key);}).sort(function(a,b){return a.y-b.y||a.x-b.x;}).forEach(function(n){visit(n.key);});
  return {pages:pages,linkTypes:LINK_TYPES};
 }

 // ---------- SVG ----------
 function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function textSVG(s){var size=s.size||11,fill=s.color||'#1f2937',weight=s.bold?' font-weight="700"':'';
  if(s.rotate){var cx=s.x+s.w/2+size*0.35,y0=s.align==='right'?s.y:s.y+s.h;return '<text transform="translate('+cx+' '+y0+') rotate(-90)" font-size="'+size+'" text-anchor="'+(s.align==='right'?'end':'start')+'" fill="'+fill+'"'+weight+'>'+esc(s.text)+'</text>';}
  var lines=s.text.split('\n'),lh=s.lineHeight||size*1.3,anchor=s.align==='left'?'start':s.align==='right'?'end':'middle',x=s.align==='left'?s.x:s.align==='right'?s.x+s.w:s.x+s.w/2;
  return '<text x="'+x+'" y="'+(s.y+size)+'" font-size="'+size+'" text-anchor="'+anchor+'" fill="'+fill+'"'+weight+'>'+lines.map(function(l,i){return '<tspan x="'+x+'" dy="'+(i?lh:0)+'"'+(s.firstBold&&i===0?' font-weight="700"':'')+'>'+esc(l)+'</tspan>';}).join('')+'</text>';}
 function shapeSVG(s){
  if(s.type==='rect')return '<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="'+(s.radius||0)+'" fill="'+(s.fill||'none')+'" stroke="'+(s.stroke&&s.stroke!=='none'?s.stroke:'none')+'" stroke-width="'+(s.width||1)+'"/>';
  if(s.type==='line')return '<polyline points="'+s.points.map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'"'+(s.dash?' stroke-dasharray="8 5"':'')+' stroke-linejoin="round" stroke-linecap="'+(s.dash?'butt':'round')+'"/>';
  return textSVG(s);}
 function svg(page){
  var out=[],open=0;page.shapes.forEach(function(s){if(s.g!==open){if(open)out.push('</g>');open=s.g||0;if(open)out.push('<g class="diagram-node" data-diagram-node="'+esc(s.node)+'">');}out.push(shapeSVG(s));});if(open)out.push('</g>');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+page.w+'" height="'+page.h+'" viewBox="0 0 '+page.w+' '+page.h+'" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>'+out.join('')+'</svg>';
 }

 // ---------- VSDX / VSSX ----------
 var crcTable=null;function crc32(bytes){if(!crcTable){crcTable=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}var crc=0xffffffff;for(var i=0;i<bytes.length;i++)crc=(crc>>>8)^crcTable[(crc^bytes[i])&0xff];return (crc^0xffffffff)>>>0;}
 function zip(files){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  files.forEach(function(f){var name=enc.encode(f[0]),data=enc.encode(f[1]),crc=crc32(data),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);parts.push(new Uint8Array(h.buffer),name,data);
   var c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.push(new Uint8Array(c.buffer),name);offset+=30+name.length+data.length;});
  var size=central.reduce(function(n,p){return n+p.length;},0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  var all=parts.concat(central,[new Uint8Array(e.buffer)]),total=all.reduce(function(n,p){return n+p.length;},0),out=new Uint8Array(total),pos=0;all.forEach(function(p){out.set(p,pos);pos+=p.length;});return out;
 }
 var NS='http://schemas.microsoft.com/office/visio/2012/main',RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 function n(v){return Math.round(v*10000)/10000;}
 function cell(name,v){return '<Cell N="'+name+'" V="'+v+'"/>';}
 function charSection(s){return '<Section N="Character"><Row IX="0">'+cell('Font','1')+cell('Color',s.color||'#1F2937')+cell('Style',s.bold?1:0)+cell('Size',n((s.size||11)*0.75/72))+'</Row></Section>';}
 var BOX_GEOM='<Row T="RelMoveTo" IX="1">'+cell('X',0)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="2">'+cell('X',1)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="3">'+cell('X',1)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="4">'+cell('X',0)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="5">'+cell('X',0)+cell('Y',0)+'</Row>';
 // One shape in a coordinate frame: page height H (inches), origin offset ox/oy.
 function shapeXML(s,id,H,ox,oy){
  if(s.type==='line'){var xs=s.points.map(function(p){return p[0]/96-ox;}),ys=s.points.map(function(p){return H-p[1]/96-oy;}),minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),w=Math.max(maxX-minX,0.01),h=Math.max(maxY-minY,0.01);
   return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(minX+w/2))+cell('PinY',n(minY+h/2))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+cell('LineWeight',n((s.width||2)/96))+cell('LineColor',s.color||'#000000')+cell('LinePattern',s.dash?2:1)+cell('FillPattern',0)+cell('Rounding',n(3/96))+
    '<Section N="Geometry" IX="0">'+cell('NoFill',1)+cell('NoLine',0)+s.points.map(function(p,i){return '<Row T="'+(i?'LineTo':'MoveTo')+'" IX="'+(i+1)+'">'+cell('X',n(p[0]/96-ox-minX))+cell('Y',n(H-p[1]/96-oy-minY))+'</Row>';}).join('')+'</Section></Shape>';}
  var isText=s.type==='text',cx=(s.x+s.w/2)/96-ox,cy=H-(s.y+s.h/2)/96-oy,w=Math.max((s.rotate?s.h:s.w)/96,0.01),h=Math.max((s.rotate?s.w:s.h)/96,0.01);
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(cx))+cell('PinY',n(cy))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+(s.rotate?cell('Angle','1.5707963'):'')+
   (isText?cell('LinePattern',0)+cell('FillPattern',0)+cell('VerticalAlign',s.rotate?1:0):cell('FillForegnd',s.fill||'#FFFFFF')+cell('FillPattern',s.fill&&s.fill!=='none'?1:0)+cell('LineColor',s.stroke&&s.stroke!=='none'?s.stroke:'#000000')+cell('LinePattern',s.stroke&&s.stroke!=='none'?1:0)+cell('LineWeight',n((s.width||1)/96))+(s.radius?cell('Rounding',n(s.radius/96)):''))+
   (isText?charSection(s)+'<Section N="Paragraph"><Row IX="0">'+cell('HorzAlign',s.align==='left'?0:s.align==='right'?2:1)+'</Row></Section>'+cell('LeftMargin',0)+cell('RightMargin',0)+cell('TopMargin',0)+cell('BottomMargin',0):'')+
   '<Section N="Geometry" IX="0">'+cell('NoFill',isText?1:0)+cell('NoLine',isText?1:0)+BOX_GEOM+'</Section>'+(isText?'<Text>'+esc(s.text)+'</Text>':'')+'</Shape>';
 }
 function bounds(list){var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;list.forEach(function(s){if(s.type==='line')s.points.forEach(function(p){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});else{x0=Math.min(x0,s.x);y0=Math.min(y0,s.y);x1=Math.max(x1,s.x+s.w);y1=Math.max(y1,s.y+s.h);}});return {x:x0,y:y0,w:x1-x0,h:y1-y0};}
 // Shapes of a page; each device's shapes become one group so it moves as a unit.
 function shapesXML(shapes,H,ids){
  var out=[],i=0;while(i<shapes.length){var s=shapes[i];if(!s.g){out.push(shapeXML(s,ids.next++,H,0,0));i++;continue;}
   var j=i;while(j<shapes.length&&shapes[j].g===s.g)j++;var kids=shapes.slice(i,j),b=bounds(kids),gx=b.x/96,gy=H-(b.y+b.h)/96,gw=Math.max(b.w/96,0.01),gh=Math.max(b.h/96,0.01),gid=ids.next++;
   out.push('<Shape ID="'+gid+'" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(gx+gw/2))+cell('PinY',n(gy+gh/2))+cell('Width',n(gw))+cell('Height',n(gh))+cell('LocPinX',n(gw/2))+cell('LocPinY',n(gh/2))+'<Shapes>'+kids.map(function(k){return shapeXML(k,ids.next++,H,gx,gy);}).join('')+'</Shapes></Shape>');i=j;}
  return out.join('');
 }
 function pageXML(page){return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<PageContents xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><Shapes>'+shapesXML(page.shapes,page.h/96,{next:1})+'</Shapes></PageContents>';}
 function documentXML(){
  return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<VisioDocument xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0">'+cell('GlueSettings',9)+cell('SnapSettings',65847)+'</DocumentSettings><Colors><ColorEntry IX="0" RGB="#000000"/><ColorEntry IX="1" RGB="#FFFFFF"/></Colors><FaceNames><FaceName NameU="Calibri" UnicodeRanges="-536859905 -1073732485 9 0" CharSets="536871423 0" Panos="2 15 5 2 2 2 4 3 2 4" Flags="325"/><FaceName NameU="Segoe UI" UnicodeRanges="-469750017 -1073683329 9 0" CharSets="536871423 0" Panos="2 11 5 2 4 2 4 2 2 3" Flags="325"/></FaceNames><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style">'+
   cell('EnableLineProps',1)+cell('EnableFillProps',1)+cell('EnableTextProps',1)+cell('HideForApply',0)+cell('LineWeight',0.01041666666666667)+cell('LineColor','#000000')+cell('LinePattern',1)+cell('Rounding',0)+cell('EndArrowSize',2)+cell('BeginArrow',0)+cell('EndArrow',0)+cell('LineCap',0)+cell('BeginArrowSize',2)+cell('LineColorTrans',0)+cell('CompoundType',0)+cell('FillForegnd','#FFFFFF')+cell('FillBkgnd','#000000')+cell('FillPattern',1)+cell('ShdwForegnd','#000000')+cell('ShdwPattern',0)+cell('FillForegndTrans',0)+cell('FillBkgndTrans',0)+cell('ShdwForegndTrans',0)+cell('ShapeShdwType',0)+cell('ShapeShdwOffsetX',0)+cell('ShapeShdwOffsetY',0)+cell('ShapeShdwObliqueAngle',0)+cell('ShapeShdwScaleFactor',1)+cell('ShapeShdwBlur',0)+cell('ShapeShdwShow',0)+cell('LeftMargin',0.05555555555555555)+cell('RightMargin',0.05555555555555555)+cell('TopMargin',0.05555555555555555)+cell('BottomMargin',0.05555555555555555)+cell('VerticalAlign',1)+cell('TextBkgnd',0)+cell('DefaultTabStop',0.5)+cell('TextDirection',0)+cell('TextBkgndTrans',0)+cell('LockTextEdit',0)+cell('LockVtxEdit',0)+cell('ObjType',0)+
   '<Section N="Character"><Row IX="0">'+cell('Font',1)+cell('Color','#000000')+cell('Style',0)+cell('Case',0)+cell('Pos',0)+cell('FontScale',1)+cell('Size',0.1666666666666667)+cell('DblUnderline',0)+cell('Overline',0)+cell('Strikethru',0)+cell('DoubleStrikethrough',0)+cell('Letterspace',0)+cell('ColorTrans',0)+cell('AsianFont',0)+cell('ComplexScriptFont',0)+cell('ComplexScriptSize',-1)+cell('LangID','en-US')+'</Row></Section><Section N="Paragraph"><Row IX="0">'+cell('IndFirst',0)+cell('IndLeft',0)+cell('IndRight',0)+cell('SpLine',-1.2)+cell('SpBefore',0)+cell('SpAfter',0)+cell('HorzAlign',1)+cell('Bullet',0)+cell('BulletStr','')+cell('BulletFont',0)+cell('BulletFontSize',-1)+cell('TextPosAfterBullet',0)+cell('Flags',0)+'</Row></Section></StyleSheet></StyleSheets></VisioDocument>';
 }
 function packageFiles(title,mainType,docRels,parts){
  var files=[];
  files.push(['[Content_Types].xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="'+mainType+'"/>'+parts.filter(function(p){return !/\.rels$/.test(p[0]);}).map(function(p){return '<Override PartName="/'+p[0]+'" ContentType="'+p[2]+'"/>';}).join('')+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>']);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>']);
  files.push(['docProps/app.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Config Inspector</Application><Template></Template></Properties>']);
  files.push(['docProps/core.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+esc(title)+'</dc:title><dc:creator>Config Inspector</dc:creator></cp:coreProperties>']);
  files.push(['visio/document.xml',documentXML()]);
  files.push(['visio/_rels/document.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+docRels+'</Relationships>']);
  parts.forEach(function(p){files.push([p[0],p[1]]);});
  return zip(files);
 }
 function vsdx(pages,title){
  var parts=[],rels=[],entries=[];
  pages.forEach(function(p,i){parts.push(['visio/pages/page'+(i+1)+'.xml',pageXML(p),'application/vnd.ms-visio.page+xml']);rels.push('<Relationship Id="rId'+(i+1)+'" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page'+(i+1)+'.xml"/>');
   var name=esc(String(p.title).slice(0,31));entries.push('<Page ID="'+i+'" NameU="'+name+'" Name="'+name+'" ViewScale="-1" ViewCenterX="0" ViewCenterY="0"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PageWidth',n(p.w/96))+cell('PageHeight',n(p.h/96))+cell('PageScale',1)+cell('DrawingScale',1)+cell('DrawingSizeType',0)+cell('DrawingScaleType',0)+cell('PrintPageOrientation',p.w>p.h?2:1)+'</PageSheet><Rel r:id="rId'+(i+1)+'"/></Page>');});
  parts.push(['visio/pages/pages.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Pages xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve">'+entries.join('')+'</Pages>','application/vnd.ms-visio.pages+xml']);
  parts.push(['visio/pages/_rels/pages.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>','application/vnd.openxmlformats-package.relationships+xml']);
  return packageFiles(title||'Network diagram','application/vnd.ms-visio.drawing.main+xml','<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>',parts);
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
  var plates=stencilPages(),page=new Page('Device library'),colW=Math.max.apply(null,plates.map(function(p){return p.w;}))+72,y=[TOP,TOP];
  page.text(MARGIN,16,800,14,'CONFIG INSPECTOR',{size:9.5,bold:true,align:'left',color:'#1d5b79'});page.text(MARGIN,32,1200,30,'Device library',{size:24,bold:true,align:'left',color:'#1b3a4b'});
  page.text(MARGIN,64,1600,16,'Faceplates of the built-in device catalog and generic switches. Each device is one group of plain shapes: copy it into a diagram or drag it into a stencil.',{size:11,align:'left',color:'#4a5568'});
  plates.forEach(function(p,i){var c=i%2,x=MARGIN+c*colW,top=y[c];page.text(x,top,p.w,16,p.title,{size:11,bold:true,align:'left',color:'#1b3a4b'});
   page.begin(p.title);p.shapes.forEach(function(s){var t=Object.assign({},s);delete t.g;delete t.node;if(t.type==='line')t.points=t.points.map(function(q){return [q[0]+x,q[1]+top+22];});else{t.x+=x;t.y+=top+22;}page.push(t);page.grow(t.x+t.w||0,t.y+t.h||0);});page.end();y[c]=top+22+p.h+36;});
  page.rect(MARGIN,84,page.w-2*MARGIN,1,{fill:'#c9d3df',stroke:'none'});
  return page;
 }
 root.SWDiagram={build:build,diagram:diagram,scope:scope,tree:tree,render:render,svg:svg,vsdx:vsdx,library:library,stencilPages:stencilPages,linkType:linkType,parsePort:parsePort,physicalPort:physicalPort,catalogFor:catalogFor,CATALOG:CATALOG,LINK_TYPES:LINK_TYPES,GRID:G};
 if(typeof module==='object'&&module.exports)module.exports=root.SWDiagram;
})(typeof globalThis!=='undefined'?globalThis:this);
