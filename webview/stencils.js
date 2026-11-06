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
  if(bytes[0]===0xd0&&bytes[1]===0xcf&&bytes[2]===0x11&&bytes[3]===0xe0)return readVSS(bytes,fileName);
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
   masters.push({cells:cells,type:attr(top.tag,'Type')||'Shape',file:fileName||'stencil',id:attr(tag,'ID'),name:name,element:el,xml:xml,rels:relMap,media:media,props:props,part:props.PartNumber||props.NetZoomMfgProdNo||'',product:props.ProductNumber||props.ProductDescription||props.NetZoomMfgDesc||'',manufacturer:props.Manufacturer||'',shapeW:w,shapeH:h,w:frame.w,h:frame.h,x0:frame.x,y0:frame.y,oneD:/<Cell N=["']BeginX["']/.test(top.body),connections:conns.map(function(c){return {x:c.x-frame.x,y:c.y-frame.y};}),pictures:pics.map(function(p){return Object.assign({},p,{x:p.x-frame.x,y:p.y-frame.y});})});}
  return {file:fileName||'stencil',masters:masters,styles:docXML.match(/<StyleSheets>[\s\S]*?<\/StyleSheets>/)?docXML.match(/<StyleSheets>[\s\S]*?<\/StyleSheets>/)[0]:''};
 }

 // ---------- matching ----------
 function norm(s){return String(s||'').toLowerCase().replace(/fortigate/g,'fg').replace(/fortiswitch/g,'fs').replace(/fortiap/g,'fap').replace(/catalyst/g,'').replace(/[^a-z0-9]/g,'');}
 function tokens(s){var raw=(String(s||'').match(/[A-Za-z]{0,4}[-_ ]?\d{2,5}[A-Za-z0-9-]*/g)||[]).map(norm),normal=norm(s).match(/[a-z]{0,3}\d{2,5}[a-z0-9]*/g)||[];return raw.concat(normal).filter(function(t,i,a){return t.length>=3&&/\d/.test(t)&&a.indexOf(t)===i;});}
 // A master name like "FG-12xG" stands for a family: x matches a digit.
 function familyRE(name){var n=norm(name.replace(/\(.*?\)/g,''));if(!/\dx|x\d/.test(n))return null;try{return new RegExp(n.replace(/(\d)x/g,'$1\\d').replace(/x(\d)/g,'\\d$1'));}catch(e){return null;}}
 function score(node,master){
  var model=String(node.model||''),parts=node.parts||[],hay=norm(model+' '+parts.join(' ')+' '+(node.name||'')),best=0,mn=norm(master.name);
  if(master.part&&norm(master.part).length>=4&&hay.indexOf(norm(master.part))>=0)best=100;
  parts.forEach(function(p){var k=norm(p);if(k.length>=4&&(mn.indexOf(k)>=0||norm(master.product).indexOf(k)>=0))best=Math.max(best,95);});
  tokens(model).concat(parts.map(norm)).forEach(function(t){if(t.length<4)return;if(mn.indexOf(t)>=0||norm(master.product).indexOf(t)>=0)best=Math.max(best,60+Math.min(30,t.length*2));});
  var fam=familyRE(master.name),pfam=master.part?familyRE(master.part):null;if(fam&&fam.test(norm(model))||pfam&&pfam.test(norm(model)))best=Math.max(best,75);
  // Same series, other generation (FG-120F for a FortiGate-120G): a weak match.
  // A bare series number (HP 6100 for an Aruba 6100 master) is a weak match too.
  (String(model).match(/(?:^|\D)(\d{4})(?!\d)/g)||[]).forEach(function(t){var d=t.replace(/\D/g,'');if(new RegExp('(^|\\D)'+d+'(\\D|$)').test(master.name))best=Math.max(best,60);});
  // The number must end where the master's number ends (FG-120 is not FG-1200D).
  var nm=norm(model),re=/(\d{2,5})/g,m;while((m=re.exec(nm))){var gen=(nm.charAt(m.index+m[1].length).match(/[a-z]/)||[''])[0];for(var k=3;k>=2;k--){var letters=nm.slice(Math.max(0,m.index-k),m.index);if(!/^[a-z]{2,3}$/.test(letters))continue;var hit=new RegExp(letters+'(?:/[a-z]{2,4})?[^a-z0-9]*(?:\\d+/)?'+m[1]+'(?!\\d)(?:/\\d+)?([a-z]?)','i').exec(master.name);if(hit){if(!(gen&&hit[1]&&hit[1].toLowerCase()!==gen))best=Math.max(best,61);break;}}}
  // Another generation of the same series (FG-120/121F for a FortiGate-120G) has other
  // ports: never matched automatically.
  // The product number and description outrank the shape name, which vendors sometimes
  // leave from an older model (a 120G shape named FG-120/121F).
  var ident=master.props&&(master.props.NetZoomMfgProdNo||master.props.PartNumber)?master.part+' '+(master.product||''):master.name+' '+(master.part||'');
  if(best&&generationDiffers(model+' '+parts.join(' '),ident))return 0;
  // The front of the device: rear views only when nothing else matches.
  if(best&&/\b(?:back|rear)\b/i.test(master.name))best-=5;
  if(best&&/\bfront\b/i.test(master.name))best+=2;
  // Side, edge and mounting views are never the device's face. Access points are round or
  // square seen face-on, so a long thin shape is a side view even when its name says nothing.
  if(best&&/\b(?:side|edge|profile|angled?|isometric|bracket|mount(?:ing)?)\b/i.test(master.name))best-=8;
  if(best&&node.role==='ap'){var ar=master.w&&master.h?master.w/master.h:1;if(ar>2||ar<0.5)best-=6;if(/\b(?:top|face)\b/i.test(master.name))best+=2;}
  return best;
 }
 function generationDiffers(model,name){var gens={},re=/(\d{2,5})([A-Za-z])?(?![A-Za-z0-9])/g,m,found=false;model=norm(model).replace(/(\d)([a-z])(?=[a-z]{2,})/g,'$1$2 ');
  String(model).replace(/(\d{2,5})([a-z])(?![0-9])/g,function(_,n,l){gens[n]=l;return _;});
  String(name).replace(/(\d{2,5})(?:\/(\d{2,5}))?([A-Za-z])?(?![A-Za-z0-9])/g,function(_,a,b,l){[a,b].forEach(function(n){if(n&&gens[n]&&l&&l.toLowerCase()!==gens[n])found=true;});return _;});
  return found;}
 // A quick filter before scoring: a shape can only match when one of its model numbers
 // (FG-12xG gives 12) starts or is started by one of the device's (120). Libraries of
 // thousands of shapes are scored only where it can matter.
 var runsOf=typeof WeakMap==='function'?new WeakMap():null;
 function masterRuns(m){var r=runsOf&&runsOf.get(m);if(r)return r;r=(String(m.name||'')+' '+(m.part||'')+' '+(m.product||'')).match(/\d{2,}/g)||[];r=r.filter(function(x,i,a){return a.indexOf(x)===i;});if(runsOf)runsOf.set(m,r);return r;}
 function mayMatch(runs,m){var mr=masterRuns(m);if(!mr.length||!runs.length)return true;for(var i=0;i<mr.length;i++)for(var j=0;j<runs.length;j++)if(runs[j].indexOf(mr[i])===0||mr[i].indexOf(runs[j])===0)return true;return false;}
 function match(node,masters){var best=null,top=0,runs=(String(node.model||'')+' '+(node.parts||[]).join(' ')+' '+(node.name||'')).match(/\d{2,}/g)||[];
  (masters||[]).forEach(function(m){if(!mayMatch(runs,m))return;var s=score(node,m);if(s>top){top=s;best=m;}});return top>=60?best:null;}

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
 // Ports of a stencil for a device whose port groups are known. Vendor shapes differ in
 // how they mark ports: one point per RJ45 jack, but often two per SFP cage (its left and
 // right edges), and cages lower than the jacks. Points are split into an upper and a lower
 // row at the middle of the shape's port rows; along a row, a run of evenly sized pairs
 // that nearly touch is a run of cages; console and USB points without a partner row are
 // left out. Ports are numbered column by column, upper row first.
 function edgePorts(master){
  var pts=(master.connections||[]).filter(function(p){return p.x>=0&&p.x<=master.w&&p.y>=0&&p.y<=master.h;});if(pts.length<4)return null;
  var tol=master.h*0.04,levels=[];pts.slice().sort(function(a,b){return a.y-b.y;}).forEach(function(p){var l=levels.find(function(x){return Math.abs(x.y-p.y)<=tol;});if(l){l.pts.push(p);l.y=l.pts.reduce(function(a,q){return a+q.y;},0)/l.pts.length;}else levels.push({y:p.y,pts:[p]});});
  levels=levels.filter(function(l){return l.pts.length>=2;});if(levels.length<2)return null;
  var ys=levels.map(function(l){return l.y;}),mid=(Math.max.apply(null,ys)+Math.min.apply(null,ys))/2,upper=[],lower=[];
  levels.forEach(function(l){l.pts.sort(function(a,b){return a.x-b.x;});(l.y>mid?upper:lower).push.apply(l.y>mid?upper:lower,l.pts);});
  var gaps=[];[upper,lower].forEach(function(r){r.sort(function(a,b){return a.x-b.x;});for(var i=1;i<r.length;i++){var d=r[i].x-r[i-1].x;if(d>master.w*0.004)gaps.push(Math.round(d/master.w*400)/400);}});if(!gaps.length)return null;
  var cnt={};gaps.forEach(function(g){cnt[g]=(cnt[g]||0)+1;});var P=Number(Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]||a-b;})[0])*master.w;
  function row(list){var out=[],seg=[list[0]];function flush(){var n=seg.length,paired=false;
     if(n>=4&&n%2===0){var w=[],inner=[];for(var i=0;i<n;i+=2){w.push(seg[i+1].x-seg[i].x);if(i)inner.push(seg[i].x-seg[i-1].x);}var wmin=Math.min.apply(null,w),wmax=Math.max.apply(null,w);paired=wmin>0&&wmax/wmin<1.3&&inner.every(function(g){return g<0.6*wmin;});}
     if(paired)for(var k=0;k<n;k+=2)out.push({x:(seg[k].x+seg[k+1].x)/2,y:(seg[k].y+seg[k+1].y)/2});
     else seg.forEach(function(p){var last=out[out.length-1];if(last&&p.x-last.x<P*0.25){last.x=(last.x+p.x)/2;}else out.push({x:p.x,y:p.y});});seg=[];}
   for(var i=1;i<list.length;i++){if(list[i].x-list[i-1].x>P*1.5){flush();}seg.push(list[i]);}flush();return out;}
  if(!upper.length||!lower.length)return null;
  // Each level of points on its own (cages sit lower than jacks), then the levels of a side together.
  function side(isUpper){var out=[];levels.filter(function(l){return (l.y>mid)===isUpper;}).forEach(function(l){out=out.concat(row(l.pts));});return out.sort(function(a,b){return a.x-b.x;});}
  var U=side(true),L=side(false),cols=[];
  U.forEach(function(p){cols.push({x:p.x,top:p,bottom:null});});
  L.forEach(function(p){var c=cols.filter(function(c){return !c.bottom&&Math.abs(c.x-p.x)<P*0.6;}).sort(function(a,b){return Math.abs(a.x-p.x)-Math.abs(b.x-p.x);})[0];if(c)c.bottom=p;else cols.push({x:p.x,top:null,bottom:p});});
  var full=cols.filter(function(c){return c.top&&c.bottom;}).length;if(full*2>cols.length)cols=cols.filter(function(c){return c.top&&c.bottom;});
  cols.sort(function(a,b){return a.x-b.x;});var list=[];cols.forEach(function(c){if(c.top)list.push({x:c.x,y:c.top.y,row:0});if(c.bottom)list.push({x:c.x,y:c.bottom.y,row:1});});return list;
 }
 // Each known port group (left to right) takes the next ports of the stencil, as long as
 // the stencil has them; a group past its last port gets null.
 function bankLayout(master,counts){
  var list=edgePorts(master);if(!list||!counts||!counts.length)return null;var at=0,found=0;
  // Only when the stencil's ports are exactly the device's: any extra or missing port would
  // shift every port after it (a 6100 shape read with extra points put port 41 on 35).
  if(list.length!==counts.reduce(function(a,b){return a+(b||0);},0))return null;
  function frac(p){return {fx:p.x/master.w,fy:1-p.y/master.h,row:p.row};}
  var out=counts.map(function(c){if(!c)return null;if(at+c>list.length)return null;var part=list.slice(at,at+c);at+=c;found++;return part.map(frac);});
  return found?out:null;
 }
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
  var W=master.w*96,H=master.h*96,parts=[],partial=false;
  master.pictures.forEach(function(p){var x=p.x*96,y=(master.h-p.y-p.h)*96,w=p.w*96,h=p.h*96;
   if(MIME[p.ext])parts.push('<image x="'+r2(x)+'" y="'+r2(y)+'" width="'+r2(w)+'" height="'+r2(h)+'" preserveAspectRatio="none" href="data:'+MIME[p.ext]+';base64,'+base64(p.data)+'"/>');
   else if(p.ext==='emf'){var e=emf(p.data);if(e&&e.partial)partial=true;if(!e)partial=true;if(e)parts.push('<svg x="'+r2(x)+'" y="'+r2(y)+'" width="'+r2(w)+'" height="'+r2(h)+'" viewBox="'+e.viewBox+'" preserveAspectRatio="none" overflow="hidden">'+e.body+'</svg>');}});
  master._art=parts.length?{w:W,h:H,body:parts.join(''),partial:partial}:null;return master._art;
 }
 function r2(v){return Math.round(v*100)/100;}

 // ---------- EMF ----------
 // A renderer for the GDI records network stencils use: paths, polygons, lines,
 // rectangles, ellipses, bitmaps and text, with world and window/viewport transforms.
 // EMF+ comments are skipped; their GDI fallback records are drawn.
 function emf(bytes){
  try{return emfSVG(bytes);}catch(e){return null;}
 }
 var emfSeq=0;
 function emfSVG(b){
  var dv=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<88||dv.getUint32(0,true)!==1||dv.getUint32(40,true)!==0x464D4520)return null;
  function i32(o){return dv.getInt32(o,true);}function u(o){return dv.getUint32(o,true);}function i16(o){return dv.getInt16(o,true);}function f32(o){return dv.getFloat32(o,true);}
  var bounds=[i32(8),i32(12),i32(16),i32(20)],out=[],objects={},stack=[],clipN=0,tag='e'+(++emfSeq)+'c';
  // Drawing is clipped to the clip path in force (SelectClipPath, IntersectClipRect); pictures
  // made of clipped bitmap pieces otherwise draw every piece as a full rectangle.
  function emit(x){out.push(st.clip?'<g clip-path="url(#'+st.clip+')">'+x+'</g>':x);}
  function setClip(d,mode){var id=tag+(++clipN),prev=st.clip;out.push('<clipPath id="'+id+'"'+(prev&&mode===1?' clip-path="url(#'+prev+')"':'')+'><path d="'+d+'"/></clipPath>');st.clip=id;}
  var st={clip:null,xf:[1,0,0,1,0,0],wo:[0,0],we:null,vo:[0,0],ve:null,pen:{color:'#000',width:1,none:false},brush:{color:'#fff',none:false},font:{size:12,weight:400,italic:false,face:'Arial'},textColor:'#000',align:0,fill:'evenodd',pos:[0,0],bk:1};
  function clone(s){return JSON.parse(JSON.stringify(s));}
  function color(o){return '#'+[dv.getUint8(o),dv.getUint8(o+1),dv.getUint8(o+2)].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
  function mul(a,c){return [a[0]*c[0]+a[1]*c[2],a[0]*c[1]+a[1]*c[3],a[2]*c[0]+a[3]*c[2],a[2]*c[1]+a[3]*c[3],a[4]*c[0]+a[5]*c[2]+c[4],a[4]*c[1]+a[5]*c[3]+c[5]];}
  function pt(x,y){var m=st.xf,X=x*m[0]+y*m[2]+m[4],Y=x*m[1]+y*m[3]+m[5];if(st.we&&st.ve){X=(X-st.wo[0])*st.ve[0]/st.we[0]+st.vo[0];Y=(Y-st.wo[1])*st.ve[1]/st.we[1]+st.vo[1];}else{X+=st.vo[0]-st.wo[0];Y+=st.vo[1]-st.wo[1];}return [r2(X),r2(Y)];}
  function scale(){var m=st.xf,s=Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]))||1;if(st.we&&st.ve)s*=Math.abs(st.ve[0]/st.we[0]);return s;}
  var path=null;
  function add(cmd){if(path!==null)path.push(cmd);return path!==null;}
  function paint(d,fill,stroke){var p=st.pen,br=st.brush,f=fill&&!br.none?br.color:'none',s=stroke&&!p.none?p.color:'none';if(f==='none'&&s==='none')return;emit('<path d="'+d+'" fill="'+f+'"'+(f!=='none'?' fill-rule="'+st.fill+'"':'')+' stroke="'+s+'"'+(s!=='none'?' stroke-width="'+r2(Math.max(0.5,p.width*scale()))+'"':'')+'/>');}
  function poly(o,n,is16,close,fill,stroke,move){var d=[],sz=is16?4:8;for(var k=0;k<n;k++){var x=is16?i16(o+k*sz):i32(o+k*sz),y=is16?i16(o+k*sz+2):i32(o+k*sz+4),p=pt(x,y);d.push((k===0&&move!==false?'M':'L')+p[0]+' '+p[1]);}if(!n)return;var s=d.join('')+(close?'Z':'');if(!add(s))paint(s,fill,stroke);}
  function bez(o,n,is16,from){var d=[],sz=is16?4:8;for(var k=0;k+2<n+(from?0:0);k+=3){var ps=[0,1,2].map(function(j){var q=o+(k+j)*sz;return pt(is16?i16(q):i32(q),is16?i16(q+2):i32(q+4));});d.push('C'+ps.map(function(p){return p[0]+' '+p[1];}).join(' '));}return d.join('');}
  function stockObject(i){var k=i&0x7fffffff;if(k<=5)st.brush={color:['#ffffff','#c0c0c0','#808080','#404040','#000000','none'][k],none:k===5};else if(k<=8)st.pen={color:k===6?'#ffffff':'#000000',width:1,none:k===8};}
  var o=0,guard=0,unsupported=0,emfPlus=false,emfPlusOnly=false;
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
    case 67:{var mode=u(r+8);if(path&&path.length){setClip(path.join(''),mode);}path=null;break;}
    case 75:{var cb=u(r+8),rm=u(r+12);if(!cb&&rm===5)st.clip=null;break;}
    case 30:{var c1=pt(i32(r+8),i32(r+12)),c2=pt(i32(r+16),i32(r+20));setClip('M'+Math.min(c1[0],c2[0])+' '+Math.min(c1[1],c2[1])+'H'+Math.max(c1[0],c2[0])+'V'+Math.max(c1[1],c2[1])+'H'+Math.min(c1[0],c2[0])+'Z',1);break;}
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
      if(cbBmi>=40&&offBmi+cbBmi<=size&&offBits+cbBits<=size){var href=dib(b.subarray(r+offBmi,r+offBmi+cbBmi),b.subarray(r+offBits,r+offBits+cbBits));if(href){var q1=pt(xd,yd),q2=pt(xd+cxd,yd+cyd);emit('<image x="'+Math.min(q1[0],q2[0])+'" y="'+Math.min(q1[1],q2[1])+'" width="'+r2(Math.abs(q2[0]-q1[0]))+'" height="'+r2(Math.abs(q2[1]-q1[1]))+'" preserveAspectRatio="none" href="'+href+'"/>');}}break;}
    case 84:{var rx=i32(r+36),ry=i32(r+40),nc=u(r+44),os=u(r+48),str='';for(var t=0;t<nc&&os+t*2+1<size;t++)str+=String.fromCharCode(u16(b,r+os+t*2));str=str.replace(/[\u0000-\u001f]/g,'');if(!str.trim())break;
      var tp=pt(rx,ry),fs=r2(st.font.size*scale()),al=st.align,anchor=(al&6)===6?'middle':(al&2)?'end':'start',base2=(al&24)===24?'':(al&8)?' dominant-baseline="text-after-edge"':' dominant-baseline="text-before-edge"';
      emit('<text x="'+tp[0]+'" y="'+tp[1]+'" font-size="'+fs+'" font-family="'+esc(st.font.face)+', Arial, sans-serif"'+(st.font.weight>=600?' font-weight="700"':'')+(st.font.italic?' font-style="italic"':'')+' fill="'+st.textColor+'" text-anchor="'+anchor+'"'+base2+(st.font.esc?' transform="rotate('+r2(-st.font.esc*(st.we&&st.ve&&st.ve[1]/st.we[1]<0?-1:1))+' '+tp[0]+' '+tp[1]+')"':'')+'>'+esc(str)+'</text>');break;}
    // Other bitmap operations: BitBlt, StretchBlt, TransparentBlt, AlphaBlend (a rectangle
    // without a bitmap is a brush fill) and SetDIBitsToDevice.
    case 76:case 77:case 114:case 116:{var bx=i32(r+24),by=i32(r+28),bw=i32(r+32),bh=i32(r+36),oB=u(r+84),cB=u(r+88),oBits=u(r+92),cBits=u(r+96);
      if(cB>=40&&oB+cB<=size&&oBits+cBits<=size){var hr=dib(b.subarray(r+oB,r+oB+cB),b.subarray(r+oBits,r+oBits+cBits));if(hr){var a1=pt(bx,by),a2=pt(bx+bw,by+bh);emit('<image x="'+Math.min(a1[0],a2[0])+'" y="'+Math.min(a1[1],a2[1])+'" width="'+r2(Math.abs(a2[0]-a1[0]))+'" height="'+r2(Math.abs(a2[1]-a1[1]))+'" preserveAspectRatio="none" href="'+hr+'"/>');}else unsupported++;}
      // Without a bitmap only the brush raster operations paint (PATCOPY, WHITENESS,
      // BLACKNESS); others, such as the no-op Visio writes at the end, draw nothing.
      else if(!cB&&type===76&&[0x00F00021,0x00FF0062,0x00000042].indexOf(u(r+40))>=0){var rop=u(r+40),c1=pt(bx,by),c2=pt(bx+bw,by+bh);var fillC=rop===0x00FF0062?'#ffffff':rop===0x00000042?'#000000':st.brush.none?null:st.brush.color;if(fillC)emit('<rect x="'+Math.min(c1[0],c2[0])+'" y="'+Math.min(c1[1],c2[1])+'" width="'+r2(Math.abs(c2[0]-c1[0]))+'" height="'+r2(Math.abs(c2[1]-c1[1]))+'" fill="'+fillC+'"/>');}break;}
    case 80:{var sx=i32(r+24),sy=i32(r+28),scx=i32(r+40),scy=i32(r+44),oB2=u(r+48),cB2=u(r+52),oBt=u(r+56),cBt=u(r+60);if(cB2>=40&&oB2+cB2<=size&&oBt+cBt<=size){var h2=dib(b.subarray(r+oB2,r+oB2+cB2),b.subarray(r+oBt,r+oBt+cBt));if(h2){var e1=pt(sx,sy),e2=pt(sx+scx,sy+scy);emit('<image x="'+Math.min(e1[0],e2[0])+'" y="'+Math.min(e1[1],e2[1])+'" width="'+r2(Math.abs(e2[0]-e1[0]))+'" height="'+r2(Math.abs(e2[1]-e1[1]))+'" preserveAspectRatio="none" href="'+h2+'"/>');}else unsupported++;}break;}
    // Not drawn here: gradient fills, region fills and masked or parallelogram blits; and
    // an EMF+ only picture (its GDI records are only a stub). The artwork is then marked
    // partial and not used automatically.
    case 71:case 72:case 74:case 78:case 79:case 118:unsupported++;break;
    case 70:{if(size>=20&&u(r+12)===0x2B464D45&&dv.getUint16(r+16,true)===0x4001){var flags=u(r+28+4);emfPlus=true;if(!(dv.getUint16(r+18,true)&1))emfPlusOnly=true;}break;}
    case 14:o=b.length;continue;
   }
   o+=size;}
  if(!out.length)return null;
  return {partial:unsupported>0||emfPlusOnly,viewBox:bounds[0]+' '+bounds[1]+' '+Math.max(1,bounds[2]-bounds[0]+1)+' '+Math.max(1,bounds[3]-bounds[1]+1),body:out.join('')};
 }
 function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 // A device-independent bitmap as an image URL: JPEG and PNG pass through; others become
 // a BMP file.
 function dib(bmi,bits){
  var compression=u32(bmi,16);if(compression===4)return 'data:image/jpeg;base64,'+base64(bits);if(compression===5)return 'data:image/png;base64,'+base64(bits);
  var file=new Uint8Array(14+bmi.length+bits.length),dv=new DataView(file.buffer);file[0]=0x42;file[1]=0x4d;dv.setUint32(2,file.length,true);dv.setUint32(10,14+bmi.length,true);file.set(bmi,14);file.set(bits,14+bmi.length);
  return 'data:image/bmp;base64,'+base64(file);
 }

 // ---------- Visio 2003-2010 stencils (.vss) ----------
 // An OLE compound file whose "VisioDocument" stream holds pointer-linked streams (some
 // LZ77-compressed) and typed chunks. Each stencil page (a master) has shapes with a
 // transform, connection points and pictures (EMF, WMF or bitmaps). The format notes come
 // from the open source libvisio project's reader.
 function cfbStream(b,wanted){
  var ss=1<<u16(b,30),fat=[],difat=[],i,v,sec=function(n){return 512+n*ss;};
  if(ss!==512&&ss!==4096)throw new Error('The stencil file is damaged.');
  for(i=0;i<109;i++){v=u32(b,76+i*4);if(v<0xfffffffa)difat.push(v);}
  var d=u32(b,68);for(var k=0;k<u32(b,72)&&d<0xfffffffa&&sec(d)+ss<=b.length;k++){for(i=0;i<ss/4-1;i++){v=u32(b,sec(d)+i*4);if(v<0xfffffffa)difat.push(v);}d=u32(b,sec(d)+ss-4);}
  difat.forEach(function(x){for(var j=0;j<ss/4;j++)fat.push(u32(b,sec(x)+j*4));});
  function read(start,size){var out=new Uint8Array(size),pos=0,n=start,guard=0;while(n<0xfffffffa&&pos<size&&guard++<1e7){var at=sec(n),len=Math.min(ss,size-pos);if(at+len>b.length)break;out.set(b.subarray(at,at+len),pos);pos+=len;n=fat[n];}return out;}
  var dir=read(u32(b,48),ss*256);
  for(var o=0;o+128<=dir.length;o+=128){var nl=u16(dir,o+64);if(nl<2||nl>64)continue;var name='';for(i=0;i<nl/2-1;i++)name+=String.fromCharCode(u16(dir,o+i*2));if(name===wanted&&dir[o+66]===2){var size=u32(dir,o+120);if(size<u32(b,56))throw new Error('The stencil file is damaged.');return read(u32(dir,o+116),size);}}
  return null;
 }
 function lz(t){var out=new Uint8Array(Math.max(16,t.length*8)),n=0,buf=new Uint8Array(4096),pos=0,o=0;
  function put(x){if(n>=out.length){var bigger=new Uint8Array(out.length*2);bigger.set(out);out=bigger;}out[n++]=x;}
  while(o<t.length){var flag=t[o++];if(o>t.length-1)break;for(var bit=0,mask=1;bit<8&&o<t.length;bit++,mask<<=1){
   if(flag&mask){buf[pos&4095]=t[o++];put(buf[pos&4095]);pos++;}
   else{if(o>t.length-2)break;var a1=t[o++],a2=t[o++],len=(a2&15)+3,p=((a2&0xf0)<<4)|a1;p=p>4078?p-4078:p+18;for(var j=0;j<len;j++){buf[(pos+j)&4095]=buf[(p+j)&4095];put(buf[(pos+j)&4095]);}pos+=len;}}}
  return out.subarray(0,n);}
 function f64(b,o){return o+8<=b.length?new DataView(b.buffer,b.byteOffset+o,8).getFloat64(0,true):0;}
 var CHUNK_TRAILER8=[0x71,0x70,0x6b,0x6a,0x69,0x66,0x65,0x2c],CHUNK_TRAILER4=[0x64,0x65,0x66,0x69,0x6a,0x6b,0x6f,0x71,0x92,0xa9,0xb4,0xb6,0xb9,0xc7],CHUNK_NONE=[0x1f,0xc9,0x2d,0xd1];
 function eachChunk(d,cb){var o=0;while(o<d.length){while(o<d.length&&!d[o])o++;if(o+19>d.length)break;var type=u32(d,o),list=u32(d,o+8),len=u32(d,o+12),level=u16(d,o+16),unk=d[o+18],tr=0;
   if(list!==0||CHUNK_TRAILER8.indexOf(type)>=0)tr+=8;if(list!==0||(level===2&&unk===0x55)||(level===2&&unk===0x54&&type===0xaa)||(level===3&&unk!==0x50&&unk!==0x54))tr+=4;
   if(CHUNK_TRAILER4.indexOf(type)>=0&&tr!==12&&tr!==4)tr+=4;if(CHUNK_NONE.indexOf(type)>=0)tr=0;var start=o+19;if(len>d.length-start)break;cb(type,d.subarray(start,start+len));o=start+len+tr;}}
 function readVSS(bytes,fileName){
  var V=cfbStream(bytes,'VisioDocument');if(!V||V.length<0x40)throw new Error((fileName||'This file')+' is not a Visio stencil.');
  if(V[0x1a]<11){var old=new Error((fileName||'This file')+' was saved by Visio 2002 or earlier.');old.legacy=true;throw old;}
  function ptr(d,o){return {type:u32(d,o),offset:u32(d,o+8),length:u32(d,o+12),format:u16(d,o+16)};}
  var strings={},pageNames=null,pages={},seen=new Set(),budget=200000;
  function shapeOf(page,id){return page.shapes[id]||(page.shapes[id]={id:id,parent:0,conns:[],pics:[]});}
  function chunk(page,shape,type,d){
   if(type===0x47||type===0x48||type===0x4e){if(d.length>=14)shape.parent=u32(d,10);shape.kind=type;}
   else if(type===0x9b)shape.xf={pinX:f64(d,1),pinY:f64(d,10),w:f64(d,19),h:f64(d,28),locX:f64(d,37),locY:f64(d,46)};
   else if(type===0x99)shape.conns.push({x:f64(d,1),y:f64(d,10)});
   else if(type===0x98){var ft=u16(d,36),map=u16(d,38);shape.ftype={x:f64(d,1),y:f64(d,10),w:f64(d,19),h:f64(d,28),type:map===8?4:ft,format:d.length>=53?u32(d,49):0};}
   else if(type===0x0c)shape.data=d;}
  function walk(p,ctx){if(budget--<=0||p.offset+p.length>V.length)return;var raw=V.subarray(p.offset,p.offset+p.length),comp=(p.format&2)===2,d=comp?lz(raw):raw,shift=comp?4:0,kind=p.format>>4;
   var c=Object.assign({},ctx);
   if(p.type===0x1d)c.stencils=true;else if(p.type===0x1e&&ctx.stencils){c.page=pages[p.idx]||(pages[p.idx]={idx:p.idx,shapes:{}});c.shape=null;}
   else if(c.page&&(p.type===0x47||p.type===0x48||p.type===0x4e))c.shape=shapeOf(c.page,p.idx);
   if(p.type===0x33&&d.length>shift+4){var str='';for(var o=shift+4;o+1<d.length;o+=2){var ch=u16(d,o);if(!ch)break;str+=String.fromCharCode(ch);}strings[p.idx]=str;}
   if(p.type===0xc9&&ctx.stencilsList){var cnt=u32(d,shift),m={};for(var r=0,q=shift+4;r<cnt&&q+13<=d.length;r++,q+=13)m[u32(d,q+8)]=u32(d,q);pageNames=m;}
   if(kind===4||kind===5||kind===0){if(c.shape&&d.length>shift)chunk(c.page,c.shape,p.type,d.subarray(shift));}
   else if((kind===0xd||kind===0xc||kind===8)&&c.shape)eachChunk(d,function(t,cd){chunk(c.page,c.shape,t,cd);});
   if(kind===5&&p.type!==0x16&&!seen.has(p.offset)){seen.add(p.offset);var off=u32(d,shift);if(off+shift+8>d.length)return;var count=u32(d,off+shift),at=off+shift+8;
    for(var i=0;i<count&&at+18<=d.length;i++,at+=18){var x=ptr(d,at);x.idx=i;if(x.type)walk(x,Object.assign({},c,{stencilsList:p.type===0x1d}));}}}
  walk(ptr(V,0x24),{});
  var masters=[],media=0;
  Object.keys(pages).forEach(function(k){var page=pages[k],name=pageNames&&strings[pageNames[k]]||'Master '+k,shapes=page.shapes,top=Object.values(shapes).find(function(x){return x.parent===0&&x.xf;});
   if(!top||/^dynamic connector$/i.test(name))return;
   function origin(sh){var x=0,y=0,guard=0;while(sh&&sh!==top&&guard++<20){if(!sh.xf)return null;x+=sh.xf.pinX-sh.xf.locX;y+=sh.xf.pinY-sh.xf.locY;sh=shapes[sh.parent];}return sh===top?{x:x,y:y}:null;}
   var pics=[];Object.values(shapes).forEach(function(sh){if(!sh.data||!sh.ftype)return;var o=sh===top?{x:0,y:0}:origin(sh);if(!o)return;var f=sh.ftype,ext=picture(sh.data,f.type,f.format);if(!ext)return;
    pics.push({x:o.x+f.x,y:o.y+f.y,w:f.w||(sh.xf&&sh.xf.w),h:f.h||(sh.xf&&sh.xf.h),ext:ext.ext,data:ext.data});});
   var w=top.xf.w,h=top.xf.h,frame=frameOf(w,h,pics,top.conns),id=String(masters.length+2),rels={},mfiles={},picXML=pics.map(function(pc,i){var rid='rId'+(i+1),path='visio/media/vss'+(++media)+'.'+pc.ext;rels[rid]={type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',target:'../media/vss'+media+'.'+pc.ext};mfiles[path]=pc.data;var x=pc.x-frame.x,y=pc.y-frame.y;
     return '<Shape ID="'+(i+6)+'" Type="Foreign" LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PinX',x+pc.w/2)+xc('PinY',y+pc.h/2)+xc('Width',pc.w)+xc('Height',pc.h)+xc('LocPinX',pc.w/2)+xc('LocPinY',pc.h/2)+xc('ImgOffsetX',0)+xc('ImgOffsetY',0)+xc('ImgWidth',pc.w)+xc('ImgHeight',pc.h)+'<ForeignData ForeignType="'+(pc.ext==='emf'?'EnhMetaFile':pc.ext==='wmf'?'MetaFile':'Bitmap')+'"'+(/^(png|jpg|gif|tif)$/.test(pc.ext)?' CompressionType="'+{png:'PNG',jpg:'JPEG',gif:'GIF',tif:'TIFF'}[pc.ext]+'"':'')+'><Rel r:id="'+rid+'"/></ForeignData></Shape>';}).join('');
   var conns=top.conns.map(function(c){return {x:c.x-frame.x,y:c.y-frame.y};}),fw=frame.w,fh=frame.h;
   var xml='<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Shapes><Shape ID="5" NameU="'+escX(name)+'" Name="'+escX(name)+'" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PinX',fw/2)+xc('PinY',fh/2)+xc('Width',fw)+xc('Height',fh)+xc('LocPinX',fw/2)+xc('LocPinY',fh/2)+
    (conns.length?'<Section N="Connection">'+conns.map(function(c,i){return '<Row T="Connection" IX="'+i+'">'+xc('X',c.x)+xc('Y',c.y)+'</Row>';}).join('')+'</Section>':'')+(picXML?'<Shapes>'+picXML+'</Shapes>':'')+'</Shape></Shapes></MasterContents>';
   var element='<Master ID="'+id+'" NameU="'+escX(name)+'" Name="'+escX(name)+'" IconSize="1" AlignName="2" MatchByName="0" IconUpdate="1" PatternFlags="0" Hidden="0" MasterType="2"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PageWidth',fw)+xc('PageHeight',fh)+'</PageSheet><Rel r:id="rId1"/></Master>';
   var part=((name.match(/^([A-Z0-9][A-Z0-9-]{3,14})(?=[\s/(]|$)/)||[])[1]||'');if(!/\d/.test(part))part='';
   masters.push({cells:{PinX:fw/2,PinY:fh/2,LocPinX:fw/2,LocPinY:fh/2},type:'Group',file:fileName||'stencil',id:id,name:name,element:element,xml:xml,rels:rels,media:mfiles,props:{},part:part,product:'',manufacturer:'',shapeW:fw,shapeH:fh,w:fw,h:fh,x0:0,y0:0,oneD:false,connections:conns,
    pictures:pics.map(function(pc){return {x:pc.x-frame.x,y:pc.y-frame.y,w:pc.w,h:pc.h,ext:pc.ext,data:pc.data};})});});
  if(!masters.length)throw new Error((fileName||'This file')+' contains no master shapes.');
  return {file:fileName||'stencil',masters:masters,styles:'',legacy:true};
 }
 function xc(n,v){return '<Cell N="'+n+'" V="'+(Math.round(v*1e6)/1e6)+'"/>';}
 function escX(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 // A foreign data blob as a picture: EMF/WMF metafiles and bitmaps (a raw DIB gets a
 // BMP file header).
 function picture(d,type,format){
  if(type===0||type===4){if(d.length>0x2c&&d[0x28]===0x20&&d[0x29]===0x45&&d[0x2a]===0x4d&&d[0x2b]===0x46)return {ext:'emf',data:d};return {ext:'wmf',data:d};}
  if(type===1){var ext={1:'jpg',2:'gif',3:'tif',4:'png'}[format];if(ext)return {ext:ext,data:d};
   if(d.length<40)return null;var head=u32(d,0),bits=u16(d,14),colors=u32(d,32)||(bits<=8?1<<bits:0),offset=14+head+colors*4+((u32(d,16)===3&&head===40)?12:0),file=new Uint8Array(14+d.length);
   file[0]=0x42;file[1]=0x4d;var dv=new DataView(file.buffer);dv.setUint32(2,file.length,true);dv.setUint32(10,offset,true);file.set(d,14);return {ext:'bmp',data:file};}
  return null;
 }
 root.SWStencils={bankLayout:bankLayout,edgePorts:edgePorts,read:read,match:match,score:score,ports:ports,layout:layout,artwork:artwork,emf:emf,unzip:unzip};
 if(typeof module==='object'&&module.exports)module.exports=root.SWStencils;
})(typeof globalThis!=='undefined'?globalThis:this);
