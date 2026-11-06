(function(root){'use strict';
 // Network diagrams from the site map data, in the style of a building switching
 // diagram: an overview page plus one page per distribution switch, with switches
 // drawn as faceplates, colored links by type, port labels, access points, VLANs and a
 // legend. Pages are plain shape lists rendered to SVG or written as a Visio .vsdx.
 var LINK_TYPES={
  fiber:{label:'10 Gbps+ fiber / uplink',color:'#1ba1e2'},
  copper:{label:'1 Gbps copper',color:'#f5c242'},
  wap:{label:'Access point copper',color:'#22b14c'},
  other:{label:'Other / speed not reported',color:'#8a94a6'}
 };
 var ROLE_FILL={firewall:'#c0504d',router:'#e6a23c',switch:'#4f81bd',controller:'#6b62d9',ap:'#22b14c',endpoint:'#8a94a6'};
 var ROLE_LABEL={firewall:'Firewall',router:'Router',switch:'Switch',controller:'Controller',ap:'Access point',endpoint:'Device'};
 function speedValue(s){var m=String(s||'').match(/([\d.]+)\s*([GM])/i);if(!m)return 0;return Number(m[1])*(m[2].toUpperCase()==='G'?1000:1);}
 function linkType(l,aRole,bRole){
  if(aRole==='ap'||bRole==='ap')return 'wap';
  var ports=(l.aPort||'')+' '+(l.bPort||''),speed=Math.max(speedValue(l.aSpeed),speedValue(l.bSpeed));
  if(speed>=10000||/\b(?:te|ten|tw|twe|twenty|fo|forty|hu|hundred|xe|et)\s*\d|tengig|twentyfive|forty|hundred|sfp|\b1\/1\/(?:49|5\d)\b/i.test(ports))return 'fiber';
  if(speed>=100||/gigabit|\bgi\s*\d|\bfa\s*\d|fastethernet|\beth\d|port\d/i.test(ports))return 'copper';
  return 'other';
 }
 function short(p){return String(p||'').replace(/^TwentyFiveGigE/i,'Twe').replace(/^TenGigabitEthernet/i,'Te').replace(/^GigabitEthernet/i,'Gi').replace(/^FastEthernet/i,'Fa').replace(/^FortyGigabitEthernet/i,'Fo').replace(/^HundredGigE/i,'Hu').replace(/^Port-channel/i,'Po');}
 // ---------- page builders ----------
 function Page(title){this.title=title;this.shapes=[];this.w=0;this.h=0;}
 Page.prototype.rect=function(x,y,w,h,o){this.shapes.push(Object.assign({type:'rect',x:x,y:y,w:w,h:h},o||{}));this.grow(x+w,y+h);return this;};
 Page.prototype.text=function(x,y,w,h,text,o){this.shapes.push(Object.assign({type:'text',x:x,y:y,w:w,h:h,text:String(text)},o||{}));this.grow(x+w,y+h);return this;};
 Page.prototype.line=function(points,o){this.shapes.push(Object.assign({type:'line',points:points},o||{}));var self=this;points.forEach(function(p){self.grow(p[0],p[1]);});return this;};
 Page.prototype.grow=function(x,y){this.w=Math.max(this.w,x+40);this.h=Math.max(this.h,y+40);};
 function legend(page,x,y,types){
  page.text(x,y,220,20,'Legend',{size:13,bold:true,align:'left'});
  types.forEach(function(t,i){var yy=y+30+i*28;page.line([[x,yy+8],[x+46,yy+8]],{color:LINK_TYPES[t].color,width:5});page.text(x+56,yy-2,190,20,LINK_TYPES[t].label,{size:11,align:'left'});});
  return y+30+types.length*28;
 }
 function faceplate(page,x,y,w,h,node){
  page.rect(x,y,w,h,{fill:'#dfe7f3',stroke:'#3d5a80',width:1.5,radius:4});
  page.rect(x+10,y+10,46,h-20,{fill:ROLE_FILL[node.role]||'#4f81bd',stroke:'none'});
  var ports=Math.max(8,Math.min(22,Math.floor((w-220)/18)));
  for(var r=0;r<2;r++)for(var i=0;i<ports;i++)page.rect(x+70+i*18,y+12+r*(h/2-8),13,h/2-18,{fill:'#ffffff',stroke:'#7a8ca8',width:0.75});
  return {count:ports,at:function(idx){var col=Math.floor(idx/2)%ports,row=idx%2;return [x+70+col*18+6.5,row?y+h-12:y+12];}};
 }
 function clip(t,n){t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t;}
 function endpointBox(page,x,y,node){page.rect(x,y,132,48,{fill:'#eef3f9',stroke:'#9aa9bd',width:1,radius:8});page.text(x+4,y+7,124,36,clip(node.model||ROLE_LABEL[node.role]||'Device',22)+'\n'+clip(node.name,22),{size:9.5,bold:true,lineHeight:14});}
 function portIndex(port,count){var m=String(port||'').match(/(\d+)\s*$/);var n=m?Number(m[1]):1;return Math.max(0,(n-1)%(count*2));}
 // Overview: devices by tier, links with port labels.
 function overviewPage(data,title){
  var page=new Page(title+' - Existing Topology'),map=data.layout,byKey=new Map(map.nodes.map(function(n){return [n.key,n];}));
  var X=60,Y=110;page.text(40,30,700,34,page.title,{size:22,bold:true,align:'left'});
  var used=new Set();
  map.edges.forEach(function(e){var a=byKey.get(e.a),b=byKey.get(e.b);if(!a||!b)return;var top=a.y<=b.y?a:b,bottom=top===a?b:a;var p=e.ports[0]||{},type=linkType({aPort:p.a,bPort:p.b},a.role,b.role);used.add(type);
   var x1=X+top.x+top.w/2,y1=Y+top.y+top.h,x2=X+bottom.x+bottom.w/2,y2=Y+bottom.y,mid=y1+(y2-y1)/2;
   page.line(Math.abs(top.y-bottom.y)<2?[[X+a.x+a.w,Y+a.y+a.h/2],[X+b.x,Y+b.y+b.h/2]]:[[x1,y1],[x1,mid],[x2,mid],[x2,y2]],{color:LINK_TYPES[type].color,width:e.ports.length>1?4:2.5});
   var ports=e.ports.map(function(q){return top===a?[short(q.a),short(q.b)]:[short(q.b),short(q.a)];});
   page.text(x1+4,y1+2,120,14,ports.map(function(q){return q[0];}).filter(Boolean).slice(0,2).join(', '),{size:8,align:'left',color:'#4a5568'});
   page.text(x2+4,y2-16,120,14,ports.map(function(q){return q[1];}).filter(Boolean).slice(0,2).join(', '),{size:8,align:'left',color:'#4a5568'});});
  map.nodes.forEach(function(n){var x=X+n.x,y=Y+n.y;page.rect(x,y,n.w,n.h,{fill:'#ffffff',stroke:ROLE_FILL[n.role]||'#4f81bd',width:1.5,radius:6});page.rect(x,y,6,n.h,{fill:ROLE_FILL[n.role]||'#4f81bd',stroke:'none'});
   var extra=[n.attached.filter(function(a){return a.role==='ap';}).length,n.attached.filter(function(a){return a.role!=='ap';}).length];
   page.text(x+12,y+6,n.w-18,n.h-10,n.name+'\n'+[n.model||ROLE_LABEL[n.role],(n.ips||[])[0]].filter(Boolean).join(' · ')+(extra[0]||extra[1]?'\n'+[extra[0]?extra[0]+' AP'+(extra[0]>1?'s':''):'',extra[1]?extra[1]+' device'+(extra[1]>1?'s':''):''].filter(Boolean).join(' · '):''),{size:9,align:'left',firstBold:true});});
  legend(page,Math.max(page.w,800)-20,110,Array.from(used));
  var roles=Array.from(new Set(map.nodes.map(function(n){return n.role;})));var ry=110+30+used.size*28+20;page.text(Math.max(page.w,800)-260,ry,220,18,'Devices',{size:13,bold:true,align:'left'});roles.forEach(function(r,i){page.rect(Math.max(page.w,800)-260,ry+26+i*24,36,16,{fill:ROLE_FILL[r],stroke:'none'});page.text(Math.max(page.w,800)-214,ry+24+i*24,180,18,ROLE_LABEL[r],{size:11,align:'left'});});
  return page;
 }
 // Building page: upstream device, the switch and everything below it, attached APs.
 function buildingPage(data,rootKey,parentKey,depthLimit){
  var nodes=data.nodes,root=nodes.get(rootKey),parent=parentKey?nodes.get(parentKey):null,page=new Page(root.name);
  var chain=[],seen=new Set([rootKey].concat(parentKey?[parentKey]:[]));chain.push(root);
  var depth=new Map([[rootKey,0]]);for(var i=0;i<chain.length;i++){if(depthLimit!=null&&depth.get(chain[i].key)>=depthLimit)continue;(data.children.get(chain[i].key)||[]).forEach(function(k){var node=nodes.get(k);if(!seen.has(k)&&node&&/switch|router|controller/.test(node.role)){seen.add(k);depth.set(k,depth.get(chain[i].key)+1);chain.push(node);}});}
  var LEFT=40,SW_X=300,SW_W=560,SW_H=74,GAP=118,top=parent?250:120,used=new Set(),routeX=SW_X+SW_W+30;
  page.text(LEFT,28,560,36,root.name,{size:24,bold:true,align:'left'});
  var legendBottom=legend(page,LEFT,90,['fiber','copper','wap','other']);
  var pos=new Map();
  if(parent){var px=SW_X+SW_W/2-170,py=120;page.text(px,py-26,340,18,(parent.ips||[])[0]||'',{size:12,bold:true});page.rect(px,py,340,72,{fill:'#ffffff',stroke:'#3d5a80',width:1.5,radius:4});page.rect(px+12,py+14,52,44,{fill:ROLE_FILL[parent.role]||'#4f81bd',stroke:'none'});page.text(px+76,py+14,256,48,clip(parent.name,34)+'\n'+clip(parent.model||ROLE_LABEL[parent.role],40),{size:11,align:'left',firstBold:true,lineHeight:18});pos.set(parent.key,{x:px,y:py,w:340,h:72});}
  var plates=new Map();chain.forEach(function(n,i){var y=top+i*(SW_H+GAP);page.text(SW_X,y-24,300,18,(n.ips||[])[0]||'',{size:12,bold:true,align:'left'});plates.set(n.key,faceplate(page,SW_X,y,SW_W,SW_H,n));page.text(SW_X,y+SW_H+8,SW_W,22,n.name,{size:15,bold:true});page.text(SW_X,y+SW_H+30,SW_W,16,n.model||ROLE_LABEL[n.role],{size:11,color:'#4a5568'});pos.set(n.key,{x:SW_X,y:y,w:SW_W,h:SW_H});});
  // Links between devices on this page.
  var lane=0,pairs=new Map(),exits=new Map();data.links.forEach(function(l){var A=pos.get(l.a),B=pos.get(l.b);if(!A||!B)return;var upper=A.y<=B.y?A:B,lower=upper===A?B:A,upPort=upper===A?l.aPort:l.bPort,lowPort=upper===A?l.bPort:l.aPort,type=linkType(l,nodes.get(l.a).role,nodes.get(l.b).role);used.add(type);
   var color=LINK_TYPES[type].color,pk=[l.a,l.b].sort().join('~'),k=pairs.get(pk)||0;pairs.set(pk,k+1);
   if(parent&&(upper===pos.get(parent.key))){var x=upper.x+upper.w/2+k*14,y1=upper.y+upper.h,y2=lower.y,bx=lower.x+lower.w*0.42+k*14,my=y1+(y2-y1)/2+k*8;page.line([[x,y1],[x,my],[bx,my],[bx,y2+8]],{color:color,width:5});page.text(x+8,y1+4+k*15,220,16,short(upPort),{size:11,align:'left'});page.text(bx+8,y2-20-k*15,200,16,short(lowPort),{size:11,align:'left'});return;}
   var off=routeX+lane*16;lane++;var ui=exits.get(upper)||0,li=exits.get(lower)||0;exits.set(upper,ui+1);exits.set(lower,li+1);var y1=upper.y+10+(ui%5)*13,y2=lower.y+10+(li%5)*13;page.line([[upper.x+upper.w-24,y1],[off,y1],[off,y2],[lower.x+lower.w-24,y2]],{color:color,width:4});page.text(upper.x+upper.w-134,y1-7,104,14,short(upPort),{size:10,align:'right'});page.text(lower.x+lower.w-134,y2-7,104,14,short(lowPort),{size:10,align:'right'});});
  // Access points and named devices to the left of their switch, each cabled into its
  // port on the faceplate; unidentified devices are summarized.
  var ay=Math.max(legendBottom+24,top-10),lanes=0;chain.forEach(function(n){var p=pos.get(n.key),plate=plates.get(n.key),all=data.attached.get(n.key)||[],named=all.filter(function(a){return !a.node.generic;}),list=named.slice(0,10),others=all.length-list.length;
   var y0=Math.max(ay,p.y-30);list.forEach(function(a,j){var ex=LEFT,ey=y0+j*58;endpointBox(page,ex,ey,a.node);var type=a.node.role==='ap'?'wap':linkType({aPort:a.port},n.role,a.node.role);used.add(type);var lx=SW_X-24-(lanes%8)*9,pt=plate.at(portIndex(a.port,plate.count)),py2=pt[1]<p.y+p.h/2?p.y-8-(j%4)*5:p.y+p.h+30+(j%4)*5;lanes++;
    page.line([[ex+132,ey+24],[lx,ey+24],[lx,py2],[pt[0],py2],[pt[0],pt[1]]],{color:LINK_TYPES[type].color,width:3.5});});
   if(list.length)ay=y0+list.length*58+6;if(others>0){page.text(LEFT,Math.max(ay,y0),250,16,'+'+others+' other device'+(others>1?'s':'')+' on '+clip(n.name,24),{size:10,align:'left',color:'#4a5568'});ay=Math.max(ay,y0)+24;}});
  // VLANs on the right.
  var vlans=data.vlans.get(rootKey)||[];if(vlans.length){var vx=routeX+lane*16+40;page.text(vx,90,260,20,'VLANs',{size:13,bold:true,align:'left'});page.text(vx,116,280,Math.max(20,vlans.length*18),vlans.slice(0,40).map(function(v){return 'VLAN '+v.id+(v.name?' – '+v.name:'');}).join('\n')+(vlans.length>40?'\n+'+(vlans.length-40)+' more':''),{size:11,bold:true,align:'left',lineHeight:18});}
  return page;
 }
 function build(input){
  var map=input.layout,nodes=new Map(map.all.map(function(n){return [n.key,n];})),pages=[overviewPage(input,input.title||'Site')];
  // Tree from the overview tiers: parent is the neighbor in the tier above.
  var shown=map.nodes,byKey=new Map(shown.map(function(n){return [n.key,n];})),children=new Map(),parentOf=new Map(),adj=new Map();
  map.edges.forEach(function(e){(adj.get(e.a)||adj.set(e.a,[]).get(e.a)).push(e.b);(adj.get(e.b)||adj.set(e.b,[]).get(e.b)).push(e.a);});
  shown.slice().sort(function(a,b){return a.y-b.y||a.x-b.x;}).forEach(function(n){var ups=(adj.get(n.key)||[]).map(function(k){return byKey.get(k);}).filter(function(m){return m&&m.y<n.y-1;}).sort(function(a,b){return b.y-a.y;});if(ups[0]){parentOf.set(n.key,ups[0].key);(children.get(ups[0].key)||children.set(ups[0].key,[]).get(ups[0].key)).push(n.key);}});
  var attached=new Map();shown.forEach(function(n){attached.set(n.key,n.attached.map(function(a){return {node:nodes.get(a.key)||{name:a.name,role:a.role},port:a.port};}).sort(function(a,b){return (a.node.role==='ap'?0:1)-(b.node.role==='ap'?0:1)||String(a.port).localeCompare(String(b.port),undefined,{numeric:true});}));});
  var data={nodes:nodes,children:children,attached:attached,links:input.links,vlans:input.vlans||new Map(),layout:map};
  // One page per switch that has switches or access points below it. A small subtree
  // (a building) goes on one page; a large one (a core) shows the switch with its direct
  // neighbors below and continues with one page per child.
  function isSwitch(k){var n=byKey.get(k);return n&&/switch|router|controller/.test(n.role);}
  function subtree(k){var out=[],stack=[k];while(stack.length){var c=stack.pop();out.push(c);(children.get(c)||[]).forEach(function(x){if(isSwitch(x))stack.push(x);});}return out;}
  var visited=new Set();
  function visit(k){if(visited.has(k)||pages.length>=40)return;visited.add(k);var kids=(children.get(k)||[]).filter(isSwitch),aps=(attached.get(k)||[]).some(function(a){return a.node.role==='ap';}),tree=subtree(k);
   if(!kids.length&&!aps)return;
   if(tree.length<=8){pages.push(buildingPage(data,k,parentOf.get(k),null));tree.forEach(function(x){visited.add(x);});return;}
   pages.push(buildingPage(data,k,parentOf.get(k),1));kids.forEach(visit);}
  shown.filter(function(n){return isSwitch(n.key);}).sort(function(a,b){return a.y-b.y||a.x-b.x;}).forEach(function(n){visit(n.key);});
  return {pages:pages,linkTypes:LINK_TYPES};
 }
 // ---------- SVG ----------
 function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function textSVG(s){var lines=s.text.split('\n'),size=s.size||11,lh=s.lineHeight||size*1.3,anchor=s.align==='left'?'start':s.align==='right'?'end':'middle',x=s.align==='left'?s.x:s.align==='right'?s.x+s.w:s.x+s.w/2;
  return '<text x="'+x+'" y="'+(s.y+size)+'" font-size="'+size+'" text-anchor="'+anchor+'" fill="'+(s.color||'#1f2937')+'"'+(s.bold?' font-weight="700"':'')+'>'+lines.map(function(l,i){return '<tspan x="'+x+'" dy="'+(i?lh:0)+'"'+(s.firstBold&&i===0?' font-weight="700"':'')+'>'+esc(l)+'</tspan>';}).join('')+'</text>';}
 function svg(page){
  var body=page.shapes.map(function(s){
   if(s.type==='rect')return '<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="'+(s.radius||0)+'" fill="'+(s.fill||'none')+'" stroke="'+(s.stroke&&s.stroke!=='none'?s.stroke:'none')+'" stroke-width="'+(s.width||1)+'"/>';
   if(s.type==='line')return '<polyline points="'+s.points.map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.width||2)+'" stroke-linejoin="round" stroke-linecap="round"/>';
   return textSVG(s);}).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+page.w+'" height="'+page.h+'" viewBox="0 0 '+page.w+' '+page.h+'" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>'+body+'</svg>';
 }
 // ---------- VSDX ----------
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
 function pageXML(page){
  var H=page.h/96,id=1,out=[];
  function charSection(s){return '<Section N="Character"><Row IX="0">'+cell('Font','1')+cell('Color',s.color||'#1F2937')+cell('Style',s.bold?1:0)+cell('Size',n((s.size||11)*0.75/72))+'</Row></Section>';}
  page.shapes.forEach(function(s){
   if(s.type==='line'){var xs=s.points.map(function(p){return p[0]/96;}),ys=s.points.map(function(p){return H-p[1]/96;}),minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),w=Math.max(maxX-minX,0.01),h=Math.max(maxY-minY,0.01);
    out.push('<Shape ID="'+(id++)+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(minX+w/2))+cell('PinY',n(minY+h/2))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+cell('LineWeight',n((s.width||2)/96))+cell('LineColor',s.color||'#000000')+cell('LinePattern',1)+cell('FillPattern',0)+
     '<Section N="Geometry" IX="0">'+cell('NoFill',1)+cell('NoLine',0)+s.points.map(function(p,i){return '<Row T="'+(i?'LineTo':'MoveTo')+'" IX="'+(i+1)+'">'+cell('X',n(p[0]/96-minX))+cell('Y',n(H-p[1]/96-minY))+'</Row>';}).join('')+'</Section></Shape>');return;}
   var x=s.x/96,y=H-(s.y+s.h)/96,w=Math.max(s.w/96,0.01),h=Math.max(s.h/96,0.01),isText=s.type==='text';
   out.push('<Shape ID="'+(id++)+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PinX',n(x+w/2))+cell('PinY',n(y+h/2))+cell('Width',n(w))+cell('Height',n(h))+cell('LocPinX',n(w/2))+cell('LocPinY',n(h/2))+
    (isText?cell('LinePattern',0)+cell('FillPattern',0)+cell('VerticalAlign',0):cell('FillForegnd',s.fill||'#FFFFFF')+cell('FillPattern',s.fill&&s.fill!=='none'?1:0)+cell('LineColor',s.stroke&&s.stroke!=='none'?s.stroke:'#000000')+cell('LinePattern',s.stroke&&s.stroke!=='none'?1:0)+cell('LineWeight',n((s.width||1)/96))+(s.radius?cell('Rounding',n(s.radius/96)):''))+
    (isText?charSection(s)+'<Section N="Paragraph"><Row IX="0">'+cell('HorzAlign',s.align==='left'?0:s.align==='right'?2:1)+'</Row></Section>'+cell('LeftMargin',0)+cell('RightMargin',0)+cell('TopMargin',0)+cell('BottomMargin',0):'')+
    '<Section N="Geometry" IX="0">'+cell('NoFill',isText?1:0)+cell('NoLine',isText?1:0)+'<Row T="RelMoveTo" IX="1">'+cell('X',0)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="2">'+cell('X',1)+cell('Y',0)+'</Row><Row T="RelLineTo" IX="3">'+cell('X',1)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="4">'+cell('X',0)+cell('Y',1)+'</Row><Row T="RelLineTo" IX="5">'+cell('X',0)+cell('Y',0)+'</Row></Section>'+
    (isText?'<Text>'+esc(s.text).replace(/\n/g,'\n')+'</Text>':'')+'</Shape>');});
  return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<PageContents xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><Shapes>'+out.join('')+'</Shapes></PageContents>';
 }
 function vsdx(pages,title){
  var files=[],pageRels=[],pageEntries=[];
  pages.forEach(function(p,i){files.push(['visio/pages/page'+(i+1)+'.xml',pageXML(p)]);pageRels.push('<Relationship Id="rId'+(i+1)+'" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page'+(i+1)+'.xml"/>');
   pageEntries.push('<Page ID="'+i+'" NameU="'+esc(p.title).slice(0,31)+'" Name="'+esc(p.title).slice(0,31)+'" ViewScale="-1" ViewCenterX="0" ViewCenterY="0"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PageWidth',n(p.w/96))+cell('PageHeight',n(p.h/96))+cell('PageScale',1)+cell('DrawingScale',1)+cell('DrawingSizeType',0)+cell('DrawingScaleType',0)+cell('PrintPageOrientation',p.w>p.h?2:1)+'</PageSheet><Rel r:id="rId'+(i+1)+'"/></Page>');});
  var types='<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>'+pages.map(function(p,i){return '<Override PartName="/visio/pages/page'+(i+1)+'.xml" ContentType="application/vnd.ms-visio.page+xml"/>';}).join('')+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
  var doc='<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<VisioDocument xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0">'+cell('GlueSettings',9)+cell('SnapSettings',65847)+'</DocumentSettings><Colors><ColorEntry IX="0" RGB="#000000"/><ColorEntry IX="1" RGB="#FFFFFF"/></Colors><FaceNames><FaceName NameU="Calibri" UnicodeRanges="-536859905 -1073732485 9 0" CharSets="536871423 0" Panos="2 15 5 2 2 2 4 3 2 4" Flags="325"/><FaceName NameU="Segoe UI" UnicodeRanges="-469750017 -1073683329 9 0" CharSets="536871423 0" Panos="2 11 5 2 4 2 4 2 2 3" Flags="325"/></FaceNames><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style">'+
   cell('EnableLineProps',1)+cell('EnableFillProps',1)+cell('EnableTextProps',1)+cell('HideForApply',0)+cell('LineWeight',0.01041666666666667)+cell('LineColor','#000000')+cell('LinePattern',1)+cell('Rounding',0)+cell('EndArrowSize',2)+cell('BeginArrow',0)+cell('EndArrow',0)+cell('LineCap',0)+cell('BeginArrowSize',2)+cell('LineColorTrans',0)+cell('CompoundType',0)+cell('FillForegnd','#FFFFFF')+cell('FillBkgnd','#000000')+cell('FillPattern',1)+cell('ShdwForegnd','#000000')+cell('ShdwPattern',0)+cell('FillForegndTrans',0)+cell('FillBkgndTrans',0)+cell('ShdwForegndTrans',0)+cell('ShapeShdwType',0)+cell('ShapeShdwOffsetX',0)+cell('ShapeShdwOffsetY',0)+cell('ShapeShdwObliqueAngle',0)+cell('ShapeShdwScaleFactor',1)+cell('ShapeShdwBlur',0)+cell('ShapeShdwShow',0)+cell('LeftMargin',0.05555555555555555)+cell('RightMargin',0.05555555555555555)+cell('TopMargin',0.05555555555555555)+cell('BottomMargin',0.05555555555555555)+cell('VerticalAlign',1)+cell('TextBkgnd',0)+cell('DefaultTabStop',0.5)+cell('TextDirection',0)+cell('TextBkgndTrans',0)+cell('LockTextEdit',0)+cell('LockVtxEdit',0)+cell('ObjType',0)+
   '<Section N="Character"><Row IX="0">'+cell('Font',1)+cell('Color','#000000')+cell('Style',0)+cell('Case',0)+cell('Pos',0)+cell('FontScale',1)+cell('Size',0.1666666666666667)+cell('DblUnderline',0)+cell('Overline',0)+cell('Strikethru',0)+cell('DoubleStrikethrough',0)+cell('Letterspace',0)+cell('ColorTrans',0)+cell('AsianFont',0)+cell('ComplexScriptFont',0)+cell('ComplexScriptSize',-1)+cell('LangID','en-US')+'</Row></Section><Section N="Paragraph"><Row IX="0">'+cell('IndFirst',0)+cell('IndLeft',0)+cell('IndRight',0)+cell('SpLine',-1.2)+cell('SpBefore',0)+cell('SpAfter',0)+cell('HorzAlign',1)+cell('Bullet',0)+cell('BulletStr','')+cell('BulletFont',0)+cell('BulletFontSize',-1)+cell('TextPosAfterBullet',0)+cell('Flags',0)+'</Row></Section></StyleSheet></StyleSheets></VisioDocument>';
  files.push(['[Content_Types].xml',types]);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>']);
  files.push(['docProps/app.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Config Inspector</Application><Template></Template></Properties>']);
  files.push(['docProps/core.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+esc(title||'Network diagram')+'</dc:title><dc:creator>Config Inspector</dc:creator></cp:coreProperties>']);
  files.push(['visio/document.xml',doc]);
  files.push(['visio/_rels/document.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/></Relationships>']);
  files.push(['visio/pages/pages.xml','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Pages xmlns="'+NS+'" xmlns:r="'+RNS+'" xml:space="preserve">'+pageEntries.join('')+'</Pages>']);
  files.push(['visio/pages/_rels/pages.xml.rels','<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+pageRels.join('')+'</Relationships>']);
  return zip(files);
 }
 root.SWDiagram={build:build,svg:svg,vsdx:vsdx,linkType:linkType,LINK_TYPES:LINK_TYPES};
 if(typeof module==='object'&&module.exports)module.exports=root.SWDiagram;
})(typeof globalThis!=='undefined'?globalThis:this);
