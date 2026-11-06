(function(root){'use strict';
 // Vendor Visio stencils for network diagrams. Reads the masters of a .vssx stencil (or
 // a .vsdx/.vstx that contains them), renders their artwork for the preview (PNG, JPEG,
 // BMP or EMF), matches masters to devices by part number or model, and maps a master's
 // connection points to front-panel ports. Stencils are the user's own files: nothing
 // here is bundled with the app.
 var MAX_FILE=60*1024*1024;
 function u16(b,o){return b[o]|(b[o+1]<<8);}
 function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
 async function inflateRaw(data){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot read compressed Visio files.');
  var stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
 }
 async function unzip(bytes){
  var end=-1;for(var i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(bytes,i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('The file is not a Visio stencil or drawing (.vssx, .vsdx, .vstx).');
  var count=u16(bytes,end+10),offset=u32(bytes,end+16),files={},decoder=new TextDecoder('utf-8');
  for(var n=0;n<count;n++){if(u32(bytes,offset)!==0x02014b50)break;
   var method=u16(bytes,offset+10),size=u32(bytes,offset+20),nameLen=u16(bytes,offset+28),extra=u16(bytes,offset+30),comment=u16(bytes,offset+32),local=u32(bytes,offset+42);
   var name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLen));offset+=46+nameLen+extra+comment;
   if(!/^visio\/(masters\/|media\/|document\.xml|_rels\/document)/.test(name))continue;
   var start=local+30+u16(bytes,local+26)+u16(bytes,local+28),data=bytes.subarray(start,start+size);
   files[name]=method===0?data.slice():method===8?await inflateRaw(data):null;}
  return files;
 }
 function text(b){return new TextDecoder('utf-8').decode(b);}
 function unescapeXML(s){return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,function(_,x){return String.fromCodePoint(parseInt(x,16));}).replace(/&#(\d+);/g,function(_,d){return String.fromCodePoint(Number(d));}).replace(/&amp;/g,'&');}
 function attr(tag,name){var m=tag.match(new RegExp('\\s'+name+'=(?:"([^"]*)"|\'([^\']*)\')'));return m?unescapeXML(m[1]!=null?m[1]:m[2]):'';}
 function cellOf(xml,name){var m=xml.match(new RegExp('<Cell N=["\']'+name+'["\'] V=["\']([^"\']*)["\']'));return m?Number(m[1]):null;}
 // The opening tag and own cells of the first shape, without its sub-shapes.
 function topShape(xml){var i=xml.indexOf('<Shape ');if(i<0)return null;var j=xml.indexOf('<Shapes>',i+6),k=xml.indexOf('</Shape>',i);var stop=j>=0&&(k<0||j<k)?j:k;return {tag:xml.slice(i,xml.indexOf('>',i)+1),body:xml.slice(i,stop<0?xml.length:stop)};}
 function propertyRows(xml){var out={},re=/<Row N=["'](\w+)["']>\s*<Cell N=["']Value["'] V=["']([^"']*)["']/g,m;while((m=re.exec(xml)))if(!(m[1] in out))out[m[1]]=unescapeXML(m[2]);return out;}
 function connections(body){var sec=body.match(/<Section N=["']Connection["']>([\s\S]*?)<\/Section>/);if(!sec)return [];var out=[],re=/<Row T=["']Connection["'][^>]*>([\s\S]*?)<\/Row>/g,m;while((m=re.exec(sec[1]))){var x=cellOf(m[1],'X'),y=cellOf(m[1],'Y');if(x!=null&&y!=null)out.push({x:x,y:y});}return out;}
 function relsOf(xml){var out={},re=/<Relationship\s[^>]*>/g,m;while((m=re.exec(xml)))out[attr(m[0],'Id')]={type:attr(m[0],'Type'),target:attr(m[0],'Target')};return out;}
 function extOf(path){return (String(path).match(/\.([a-z0-9]+)$/i)||['',''])[1].toLowerCase();}
 // Foreign (picture) shapes of a master with their place in the master's frame (inches,
 // y up) and the media part they show.
 function pictures(xml,rels,files){
  var out=[],top=topShape(xml);if(!top)return out;
  var re=/<Shape\s[^>]*Type=["']Foreign["'][^>]*>([\s\S]*?)<\/Shape>/g,m;
  while((m=re.exec(xml))){var body=m[1],rel=body.match(/<ForeignData[^>]*>[\s\S]*?<Rel\s+r:id=["']([^"']+)["']/);if(!rel)continue;var r=rels[rel[1]];if(!r)continue;
   var path='visio/'+r.target.replace(/^\.\.\//,''),data=files[path];if(!data)continue;
   var w=cellOf(body,'Width'),h=cellOf(body,'Height'),px=cellOf(body,'PinX'),py=cellOf(body,'PinY'),lx=cellOf(body,'LocPinX'),ly=cellOf(body,'LocPinY');
   if(w==null||h==null)continue;out.push({x:(px==null?w/2:px)-(lx==null?w/2:lx),y:(py==null?h/2:py)-(ly==null?h/2:ly),w:w,h:h,ext:extOf(path),data:data,path:path});}
  return out;
 }
 // The drawn extent of a master: its pictures (and connection points), which for a 1-D
 // shape can be much taller than the shape itself.
 function frameOf(w,h,pics,conns){
  var x0=0,y0=0,x1=w,y1=h;if(pics.length){x0=Infinity;y0=Infinity;x1=-Infinity;y1=-Infinity;pics.forEach(function(p){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x+p.w);y1=Math.max(y1,p.y+p.h);});}
  return {x:x0,y:y0,w:Math.max(0.01,x1-x0),h:Math.max(0.01,y1-y0)};
 }
 // Reads a stencil or drawing and returns its masters.
 async function read(bytes,fileName){
  if(bytes.length>MAX_FILE)throw new Error('The stencil is too large to open.');
  // Visio 2003-2010 stencils (.vss) are binary compound files, not packages.
  if(bytes[0]===0xd0&&bytes[1]===0xcf&&bytes[2]===0x11&&bytes[3]===0xe0){var e=new Error((fileName||'This file')+' is an older Visio stencil (.vss).');e.legacy=true;throw e;}
  var files=await unzip(bytes),list=files['visio/masters/masters.xml'];
  if(!list)throw new Error((fileName||'This file')+' contains no master shapes. Choose a Visio stencil (.vssx) or a drawing made with the stencil.');
  var mastersXML=text(list),rels=relsOf(files['visio/masters/_rels/masters.xml.rels']?text(files['visio/masters/_rels/masters.xml.rels']):''),masters=[];
  var docXML=files['visio/document.xml']?text(files['visio/document.xml']):'';
  var re=/<Master\s[\s\S]*?<\/Master>/g,m;
  while((m=re.exec(mastersXML))){var el=m[0],tag=el.slice(0,el.indexOf('>')+1),rel=(el.match(/<Rel\s+r:id=["']([^"']+)["']/)||[])[1],r=rel&&rels[rel];if(!r)continue;
   var path='visio/masters/'+r.target.replace(/^.*\//,''),raw=files[path];if(!raw)continue;var xml=text(raw),top=topShape(xml);if(!top)continue;
   var name=attr(tag,'NameU')||attr(tag,'Name'),mrels=files['visio/masters/_rels/'+path.replace(/^.*\//,'')+'.rels'],relMap=mrels?relsOf(text(mrels)):{};
   if(/^dynamic connector$/i.test(name)||attr(tag,'Hidden')==='1')continue;
   var props=propertyRows(top.body),w=cellOf(top.body,'Width'),h=cellOf(top.body,'Height');if(!(w>0)||!(h>0))continue;
   var media={};Object.keys(relMap).forEach(function(id){var t='visio/'+relMap[id].target.replace(/^\.\.\//,'');if(files[t])media[t]=files[t];});
   var pics=pictures(xml,relMap,files),conns=connections(top.body),frame=frameOf(w,h,pics,conns);
   var cells={};['PinX','PinY','LocPinX','LocPinY','BeginX','BeginY','EndX','EndY'].forEach(function(c){var v=cellOf(top.body,c);if(v!=null)cells[c]=v;});
   masters.push({cells:cells,type:attr(top.tag,'Type')||'Shape',file:fileName||'stencil',id:attr(tag,'ID'),name:name,element:el,xml:xml,rels:relMap,media:media,props:props,part:props.PartNumber||'',product:props.ProductNumber||props.ProductDescription||'',manufacturer:props.Manufacturer||'',shapeW:w,shapeH:h,w:frame.w,h:frame.h,x0:frame.x,y0:frame.y,oneD:/<Cell N=["']BeginX["']/.test(top.body),connections:conns.map(function(c){return {x:c.x-frame.x,y:c.y-frame.y};}),pictures:pics.map(function(p){return Object.assign({},p,{x:p.x-frame.x,y:p.y-frame.y});})});}
  return {file:fileName||'stencil',masters:masters,styles:docXML.match(/<StyleSheets>[\s\S]*?<\/StyleSheets>/)?docXML.match(/<StyleSheets>[\s\S]*?<\/StyleSheets>/)[0]:''};
 }

 // ---------- matching ----------
 function norm(s){return String(s||'').toLowerCase().replace(/fortigate/g,'fg').replace(/fortiswitch/g,'fs').replace(/fortiap/g,'fap').replace(/catalyst/g,'').replace(/[^a-z0-9]/g,'');}
 function tokens(s){return (String(s||'').match(/[A-Za-z]{0,4}[-_ ]?\d{2,5}[A-Za-z0-9-]*/g)||[]).map(norm).filter(function(t){return t.length>=3&&/\d/.test(t);});}
 // A master name like "FG-12xG" stands for a family: x matches a digit.
 function familyRE(name){var n=norm(name.replace(/\(.*?\)/g,''));if(!/\dx|x\d/.test(n))return null;try{return new RegExp(n.replace(/(\d)x/g,'$1\\d').replace(/x(\d)/g,'\\d$1'));}catch(e){return null;}}
 function score(node,master){
  var model=String(node.model||''),parts=node.parts||[],hay=norm(model+' '+parts.join(' ')+' '+(node.name||'')),best=0,mn=norm(master.name);
  if(master.part&&norm(master.part).length>=4&&hay.indexOf(norm(master.part))>=0)best=100;
  parts.forEach(function(p){var k=norm(p);if(k.length>=4&&(mn.indexOf(k)>=0||norm(master.product).indexOf(k)>=0))best=Math.max(best,95);});
  tokens(model).concat(parts.map(norm)).forEach(function(t){if(t.length<4)return;if(mn.indexOf(t)>=0||norm(master.product).indexOf(t)>=0)best=Math.max(best,60+Math.min(30,t.length*2));});
  var fam=familyRE(master.name);if(fam&&fam.test(norm(model)))best=Math.max(best,75);
  // Same series, other generation (FG-120F for a FortiGate-120G): a weak match.
  // A bare series number (HP 6100 for an Aruba 6100 master) is a weak match too.
  (String(model).match(/(?:^|\D)(\d{4})(?!\d)/g)||[]).forEach(function(t){var d=t.replace(/\D/g,'');if(new RegExp('(^|\\D)'+d+'(\\D|$)').test(master.name))best=Math.max(best,60);});
  var nm=norm(model),re=/(\d{3,5})/g,m;while((m=re.exec(nm))){for(var k=3;k>=2;k--){var core=nm.slice(Math.max(0,m.index-k),m.index)+m[1];if(/^[a-z]{2}/.test(core)&&mn.indexOf(core)>=0){best=Math.max(best,61);break;}}}
  if(best&&node.role==='ap'&&/back|rear/i.test(master.name))best+=3;
  if(best&&/front/i.test(master.name)&&node.role!=='ap')best+=2;
  return best;
 }
 function match(node,masters){var best=null,top=0;(masters||[]).forEach(function(m){var s=score(node,m);if(s>top){top=s;best=m;}});return top>=60?best:null;}

 // ---------- ports from connection points ----------
 // Vendor network stencils carry a connection point on each port. Points are grouped
 // into two rows; points closer than about half the port pitch belong to one port; a
 // wide gap starts a new port block. Ports are numbered column by column, top row
 // first. The mapping is used only when the blocks add up to the device's port counts.
 function ports(master){
  var pts=master.connections||[];if(pts.length<4)return null;
  var ys=pts.map(function(p){return p.y;}).sort(function(a,b){return a-b;}),tol=master.h*0.02,rowsY=[];
  ys.forEach(function(y){var r=rowsY.find(function(x){return Math.abs(x.y-y)<=tol;});if(r){r.n++;r.sum+=y;r.y=r.sum/r.n;}else rowsY.push({y:y,n:1,sum:y});});
  rowsY.sort(function(a,b){return b.n-a.n;});if(rowsY.length<2||rowsY[1].n<2)return null;
  var top=rowsY[0].y>rowsY[1].y?rowsY[0]:rowsY[1],bottom=top===rowsY[0]?rowsY[1]:rowsY[0];
  function rowPoints(r){return pts.filter(function(p){return Math.abs(p.y-r.y)<=tol;}).sort(function(a,b){return a.x-b.x;});}
  var tp=rowPoints(top),bp=rowPoints(bottom),deltas=[];
  [tp,bp].forEach(function(row){for(var i=1;i<row.length;i++){var d=row[i].x-row[i-1].x;if(d>master.w*0.002)deltas.push(d);}});
  if(!deltas.length)return null;deltas.sort(function(a,b){return a-b;});var counts={};deltas.forEach(function(d){var k=Math.round(d*100);counts[k]=(counts[k]||0)+1;});
  var pitch=Number(Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]||b-a;})[0])/100;
  // Runs of close points are split where the gap is clearly wider than the run's usual
  // gap: a cage drawn with three points next to another has gaps 0.28, 0.28, 0.32 ...
  function merge(row){var out=[],run=[row[0]];
   function flush(){var gaps=[];for(var i=1;i<run.length;i++)gaps.push(run[i].x-run[i-1].x);var mean=gaps.length?gaps.reduce(function(a,b){return a+b;},0)/gaps.length:0,cur=[run[0]];
    for(var k=1;k<run.length;k++){if(gaps[k-1]>mean*1.07){out.push(cur);cur=[];}cur.push(run[k]);}out.push(cur);run=[];}
   for(var i=1;i<row.length;i++){if(row[i].x-row[i-1].x<pitch*0.6)run.push(row[i]);else{flush();run=[row[i]];}}if(run.length)flush();
   return out.map(function(g){return {x:g.reduce(function(a,p){return a+p.x;},0)/g.length,y:g.reduce(function(a,p){return a+p.y;},0)/g.length};});}
  var T=merge(tp),B=merge(bp),cols=[];
  T.forEach(function(p){cols.push({x:p.x,top:p,bottom:null});});
  B.forEach(function(p){var c=cols.filter(function(c){return !c.bottom&&Math.abs(c.x-p.x)<pitch*0.6;}).sort(function(a,b){return Math.abs(a.x-p.x)-Math.abs(b.x-p.x);})[0];if(c)c.bottom=p;else cols.push({x:p.x,top:null,bottom:p});});
  cols.sort(function(a,b){return a.x-b.x;});
  var blocks=[];cols.forEach(function(c,i){if(!i||c.x-cols[i-1].x>pitch*1.6)blocks.push([]);blocks[blocks.length-1].push(c);});
  return blocks.map(function(b){var list=[];b.forEach(function(c){if(c.top)list.push({x:c.x,y:c.top.y,row:0});if(c.bottom)list.push({x:c.x,y:c.bottom.y,row:1});});return list;});
 }
 // Port positions for a device with `main` front ports and `up` uplink ports: a run of
 // neighboring blocks that holds exactly the main ports, and the other blocks (in
 // order) for the uplinks. Positions are fractions of the master's width and height,
 // measured from its top left.
 function layout(master,main,up){
  var blocks=ports(master);if(!blocks||!main)return null;var sizes=blocks.map(function(b){return b.length;});
  for(var i=0;i<blocks.length;i++){var sum=0;for(var j=i;j<blocks.length;j++){sum+=sizes[j];if(sum===main){var rest=[];blocks.forEach(function(b,k){if(k<i||k>j)rest=rest.concat(b);});if(up&&rest.length<up)break;
    var mainPorts=[].concat.apply([],blocks.slice(i,j+1));function frac(p){return {fx:p.x/master.w,fy:1-p.y/master.h,row:p.row};}
    return {main:mainPorts.map(frac),up:rest.slice(0,up||0).map(frac)};}if(sum>main)break;}}
  // When only some ports are known (from links), the smallest run of blocks that holds
  // them, if the remaining blocks hold the uplinks.
  var best=null;for(var a=0;a<blocks.length;a++){var total=0;for(var b=a;b<blocks.length;b++){total+=sizes[b];if(total>=main){var others=sizes.reduce(function(n,v,k){return k<a||k>b?n+v:n;},0);if(others>=(up||0)&&(!best||total<best.total))best={a:a,b:b,total:total};break;}}}
  if(best){var mp=[].concat.apply([],blocks.slice(best.a,best.b+1)),rs=[];blocks.forEach(function(bl,k){if(k<best.a||k>best.b)rs=rs.concat(bl);});var f=function(p){return {fx:p.x/master.w,fy:1-p.y/master.h,row:p.row};};return {main:mp.map(f),up:rs.slice(0,up||0).map(f),partial:true};}
  return null;
 }

 // ---------- artwork ----------
 function base64(bytes){var s='';for(var i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return typeof btoa==='function'?btoa(s):Buffer.from(bytes).toString('base64');}
 var MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',svg:'image/svg+xml'};
 // SVG markup (a group in the master's frame, 96 px per inch, y down) for a master's
 // pictures, or null when none can be shown.
 function artwork(master){
  if(master._art!==undefined)return master._art;
  var W=master.w*96,H=master.h*96,parts=[];
  master.pictures.forEach(function(p){var x=p.x*96,y=(master.h-p.y-p.h)*96,w=p.w*96,h=p.h*96;
   if(MIME[p.ext])parts.push('<image x="'+r2(x)+'" y="'+r2(y)+'" width="'+r2(w)+'" height="'+r2(h)+'" preserveAspectRatio="none" href="data:'+MIME[p.ext]+';base64,'+base64(p.data)+'"/>');
   else if(p.ext==='emf'){var e=emf(p.data);if(e)parts.push('<svg x="'+r2(x)+'" y="'+r2(y)+'" width="'+r2(w)+'" height="'+r2(h)+'" viewBox="'+e.viewBox+'" preserveAspectRatio="none" overflow="hidden">'+e.body+'</svg>');}});
  master._art=parts.length?{w:W,h:H,body:parts.join('')}:null;return master._art;
 }
 function r2(v){return Math.round(v*100)/100;}

 // ---------- EMF ----------
 // A renderer for the GDI records network stencils use: paths, polygons, lines,
 // rectangles, ellipses, bitmaps and text, with world and window/viewport transforms.
 // EMF+ comments are skipped; their GDI fallback records are drawn.
 function emf(bytes){
  try{return emfSVG(bytes);}catch(e){return null;}
 }
 function emfSVG(b){
  var dv=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<88||dv.getUint32(0,true)!==1||dv.getUint32(40,true)!==0x464D4520)return null;
  function i32(o){return dv.getInt32(o,true);}function u(o){return dv.getUint32(o,true);}function i16(o){return dv.getInt16(o,true);}function f32(o){return dv.getFloat32(o,true);}
  var bounds=[i32(8),i32(12),i32(16),i32(20)],out=[],objects={},stack=[];
  var st={xf:[1,0,0,1,0,0],wo:[0,0],we:null,vo:[0,0],ve:null,pen:{color:'#000',width:1,none:false},brush:{color:'#fff',none:false},font:{size:12,weight:400,italic:false,face:'Arial'},textColor:'#000',align:0,fill:'evenodd',pos:[0,0],bk:1};
  function clone(s){return JSON.parse(JSON.stringify(s));}
  function color(o){return '#'+[dv.getUint8(o),dv.getUint8(o+1),dv.getUint8(o+2)].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
  function mul(a,c){return [a[0]*c[0]+a[1]*c[2],a[0]*c[1]+a[1]*c[3],a[2]*c[0]+a[3]*c[2],a[2]*c[1]+a[3]*c[3],a[4]*c[0]+a[5]*c[2]+c[4],a[4]*c[1]+a[5]*c[3]+c[5]];}
  function pt(x,y){var m=st.xf,X=x*m[0]+y*m[2]+m[4],Y=x*m[1]+y*m[3]+m[5];if(st.we&&st.ve){X=(X-st.wo[0])*st.ve[0]/st.we[0]+st.vo[0];Y=(Y-st.wo[1])*st.ve[1]/st.we[1]+st.vo[1];}else{X+=st.vo[0]-st.wo[0];Y+=st.vo[1]-st.wo[1];}return [r2(X),r2(Y)];}
  function scale(){var m=st.xf,s=Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]))||1;if(st.we&&st.ve)s*=Math.abs(st.ve[0]/st.we[0]);return s;}
  var path=null;
  function add(cmd){if(path!==null)path.push(cmd);return path!==null;}
  function paint(d,fill,stroke){var p=st.pen,br=st.brush,f=fill&&!br.none?br.color:'none',s=stroke&&!p.none?p.color:'none';if(f==='none'&&s==='none')return;out.push('<path d="'+d+'" fill="'+f+'"'+(f!=='none'?' fill-rule="'+st.fill+'"':'')+' stroke="'+s+'"'+(s!=='none'?' stroke-width="'+r2(Math.max(0.5,p.width*scale()))+'"':'')+'/>');}
  function poly(o,n,is16,close,fill,stroke,move){var d=[],sz=is16?4:8;for(var k=0;k<n;k++){var x=is16?i16(o+k*sz):i32(o+k*sz),y=is16?i16(o+k*sz+2):i32(o+k*sz+4),p=pt(x,y);d.push((k===0&&move!==false?'M':'L')+p[0]+' '+p[1]);}if(!n)return;var s=d.join('')+(close?'Z':'');if(!add(s))paint(s,fill,stroke);}
  function bez(o,n,is16,from){var d=[],sz=is16?4:8;for(var k=0;k+2<n+(from?0:0);k+=3){var ps=[0,1,2].map(function(j){var q=o+(k+j)*sz;return pt(is16?i16(q):i32(q),is16?i16(q+2):i32(q+4));});d.push('C'+ps.map(function(p){return p[0]+' '+p[1];}).join(' '));}return d.join('');}
  function stockObject(i){var k=i&0x7fffffff;if(k<=5)st.brush={color:['#ffffff','#c0c0c0','#808080','#404040','#000000','none'][k],none:k===5};else if(k<=8)st.pen={color:k===6?'#ffffff':'#000000',width:1,none:k===8};}
  var o=0,guard=0;
  while(o+8<=b.length&&guard++<200000){var type=u(o),size=u(o+4);if(size<8||o+size>b.length)break;var r=o;
   switch(type){
    case 9:st.we=[i32(r+8),i32(r+12)];break;case 10:st.wo=[i32(r+8),i32(r+12)];break;case 11:st.ve=[i32(r+8),i32(r+12)];break;case 12:st.vo=[i32(r+8),i32(r+12)];break;
    case 19:st.fill=u(r+8)===2?'nonzero':'evenodd';break;case 22:st.align=u(r+8);break;case 24:st.textColor=color(r+8);break;case 18:st.bk=u(r+8);break;
    case 33:stack.push(clone(st));break;
    case 34:{var rel=i32(r+8),k=rel<0?stack.length+rel:rel-1;if(k>=0&&k<stack.length){st=stack[k];stack.length=k;}break;}
    case 35:st.xf=[f32(r+8),f32(r+12),f32(r+16),f32(r+20),f32(r+24),f32(r+28)];break;
    case 36:{var x=[f32(r+8),f32(r+12),f32(r+16),f32(r+20),f32(r+24),f32(r+28)],mode=u(r+32);st.xf=mode===1?[1,0,0,1,0,0]:mode===2?mul(x,st.xf):mode===3?mul(st.xf,x):x;break;}
    case 37:{var ih=u(r+8);if(ih&0x80000000)stockObject(ih);else{var ob=objects[ih];if(ob){if(ob.kind==='pen')st.pen=ob.v;else if(ob.kind==='brush')st.brush=ob.v;else if(ob.kind==='font')st.font=ob.v;}}break;}
    case 38:objects[u(r+8)]={kind:'pen',v:{color:color(r+24),width:Math.max(1,i32(r+16)),none:(u(r+12)&15)===5}};break;
    case 95:objects[u(r+8)]={kind:'pen',v:{color:color(r+40),width:Math.max(1,u(r+32)),none:(u(r+28)&15)===5}};break;
    case 39:objects[u(r+8)]={kind:'brush',v:{color:color(r+16),none:u(r+12)===1}};break;
    case 82:{var face='';for(var c=0;c<32;c++){var ch=u16(b,r+40+c*2);if(!ch)break;face+=String.fromCharCode(ch);}objects[u(r+8)]={kind:'font',v:{size:Math.abs(i32(r+12))||12,esc:i32(r+20)/10,weight:i32(r+28)||400,italic:!!b[r+32],face:face||'Arial'}};break;}
    case 40:delete objects[u(r+8)];break;
    case 27:st.pos=[i32(r+8),i32(r+12)];add('M'+pt(st.pos[0],st.pos[1]).join(' '));break;
    case 54:{var a=pt(st.pos[0],st.pos[1]),e=pt(i32(r+8),i32(r+12));st.pos=[i32(r+8),i32(r+12)];if(!add('L'+e.join(' ')))paint('M'+a.join(' ')+'L'+e.join(' '),false,true);break;}
    case 59:path=[];break;case 60:break;case 61:add('Z');break;
    case 62:case 63:case 64:if(path&&path.length){var dd=path.join('');path=null;paint(dd,type!==64,type!==62);}else path=null;break;
    case 3:case 86:poly(r+28,u(r+24),type===86,true,true,true);break;
    case 4:case 87:poly(r+28,u(r+24),type===87,false,false,true);break;
    case 6:case 89:poly(r+28,u(r+24),type===89,false,false,true,false);break;
    case 2:case 85:{var n=u(r+24),is=type===85,p0=pt(is?i16(r+28):i32(r+28),is?i16(r+30):i32(r+32)),s='M'+p0.join(' ')+bez(r+28+(is?4:8),n-1,is);if(!add(s))paint(s,false,true);break;}
    case 5:case 88:{var s2=bez(r+28,u(r+24),type===88);if(!add(s2))paint('M'+pt(st.pos[0],st.pos[1]).join(' ')+s2,false,true);break;}
    case 7:case 8:case 90:case 91:{var np=u(r+24),is16=type>=90,cnt=[],base=r+32,acc='';for(var q=0;q<np;q++)cnt.push(u(base+q*4));var po=base+np*4,sz=is16?4:8;
      cnt.forEach(function(nn){for(var k=0;k<nn;k++){var x=is16?i16(po+k*sz):i32(po+k*sz),y=is16?i16(po+k*sz+2):i32(po+k*sz+4),p=pt(x,y);acc+=(k?'L':'M')+p[0]+' '+p[1];}if(type===8||type===91)acc+='Z';po+=nn*sz;});
      if(!add(acc))paint(acc,type===8||type===91,true);break;}
    case 42:case 43:case 44:{var L=i32(r+8),T=i32(r+12),R=i32(r+16),B=i32(r+20),p1=pt(L,T),p2=pt(R,B),x0=Math.min(p1[0],p2[0]),y0=Math.min(p1[1],p2[1]),w=Math.abs(p2[0]-p1[0]),h=Math.abs(p2[1]-p1[1]),d;
      if(type===42)d='M'+(x0)+' '+(y0+h/2)+'a'+w/2+' '+h/2+' 0 1 0 '+w+' 0a'+w/2+' '+h/2+' 0 1 0 '+(-w)+' 0Z';else d='M'+x0+' '+y0+'h'+w+'v'+h+'h'+(-w)+'Z';if(!add(d))paint(d,true,true);break;}
    case 81:{var xd=i32(r+24),yd=i32(r+28),offBmi=u(r+48),cbBmi=u(r+52),offBits=u(r+56),cbBits=u(r+60),cxd=i32(r+72),cyd=i32(r+76);
      if(cbBmi>=40&&offBmi+cbBmi<=size&&offBits+cbBits<=size){var href=dib(b.subarray(r+offBmi,r+offBmi+cbBmi),b.subarray(r+offBits,r+offBits+cbBits));if(href){var q1=pt(xd,yd),q2=pt(xd+cxd,yd+cyd);out.push('<image x="'+Math.min(q1[0],q2[0])+'" y="'+Math.min(q1[1],q2[1])+'" width="'+r2(Math.abs(q2[0]-q1[0]))+'" height="'+r2(Math.abs(q2[1]-q1[1]))+'" preserveAspectRatio="none" href="'+href+'"/>');}}break;}
    case 84:{var rx=i32(r+36),ry=i32(r+40),nc=u(r+44),os=u(r+48),str='';for(var t=0;t<nc&&os+t*2+1<size;t++)str+=String.fromCharCode(u16(b,r+os+t*2));str=str.replace(/[\u0000-\u001f]/g,'');if(!str.trim())break;
      var tp=pt(rx,ry),fs=r2(st.font.size*scale()),al=st.align,anchor=(al&6)===6?'middle':(al&2)?'end':'start',base2=(al&24)===24?'':(al&8)?' dominant-baseline="text-after-edge"':' dominant-baseline="text-before-edge"';
      out.push('<text x="'+tp[0]+'" y="'+tp[1]+'" font-size="'+fs+'" font-family="'+esc(st.font.face)+', Arial, sans-serif"'+(st.font.weight>=600?' font-weight="700"':'')+(st.font.italic?' font-style="italic"':'')+' fill="'+st.textColor+'" text-anchor="'+anchor+'"'+base2+(st.font.esc?' transform="rotate('+r2(-st.font.esc*(st.we&&st.ve&&st.ve[1]/st.we[1]<0?-1:1))+' '+tp[0]+' '+tp[1]+')"':'')+'>'+esc(str)+'</text>');break;}
    case 14:o=b.length;continue;
   }
   o+=size;}
  if(!out.length)return null;
  return {viewBox:bounds[0]+' '+bounds[1]+' '+Math.max(1,bounds[2]-bounds[0]+1)+' '+Math.max(1,bounds[3]-bounds[1]+1),body:out.join('')};
 }
 function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 // A device-independent bitmap as an image URL: JPEG and PNG pass through; others become
 // a BMP file.
 function dib(bmi,bits){
  var compression=u32(bmi,16);if(compression===4)return 'data:image/jpeg;base64,'+base64(bits);if(compression===5)return 'data:image/png;base64,'+base64(bits);
  var file=new Uint8Array(14+bmi.length+bits.length),dv=new DataView(file.buffer);file[0]=0x42;file[1]=0x4d;dv.setUint32(2,file.length,true);dv.setUint32(10,14+bmi.length,true);file.set(bmi,14);file.set(bits,14+bmi.length);
  return 'data:image/bmp;base64,'+base64(file);
 }
 root.SWStencils={read:read,match:match,score:score,ports:ports,layout:layout,artwork:artwork,emf:emf,unzip:unzip};
 if(typeof module==='object'&&module.exports)module.exports=root.SWStencils;
})(typeof globalThis!=='undefined'?globalThis:this);
