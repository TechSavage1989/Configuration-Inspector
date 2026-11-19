(function(root){'use strict';
 // Site map layout: infrastructure devices (firewalls, routers, switches) are placed
 // in tiers by distance from the edge (firewalls first, otherwise the most connected
 // device). Access points and endpoints are summarized on the device they connect
 // to, unless they are requested as their own nodes. Pure layout; the app draws it.
 var NODE_W=196,NODE_H=70,GAP_X=26,GAP_Y=92,SMALL_W=150,SMALL_H=44,MAX_ROW=9,PAD=24;
 var ROLE_ORDER={firewall:0,router:1,switch:2,controller:3,ap:4,endpoint:5};
 function role(d){
  var t=String(d.type||'').toLowerCase(),text=(d.name+' '+(d.model||'')+' '+(d.platform||'')).toLowerCase();
  if(d.vendorRole)return d.vendorRole;
  if(/^circuit$/.test(t))return 'circuit';
  if(/firewall|security appliance|utm/.test(t))return 'firewall';
  if(/router/.test(t))return 'router';
  if(/switch|stack/.test(t))return 'switch';
  if(/controller/.test(t))return 'controller';
  if(/access point/.test(t))return 'ap';
  if(t)return 'endpoint';
  if(d.generic)return 'endpoint';
  if(/fortigate|sonicwall|\bnsa\b|\btz ?\d|palo ?alto|\bpa-\d|firepower|\basa\b|sophos|\bxgs?\b|firewall|\bfw\b|fw\d/.test(text))return 'firewall';
  if(/phone|printer|camera|\bups\b|idrac|ilo\b/.test(text))return 'endpoint';
  if(/\bap\b|ap-\d|air-c?ap|access point|wap/.test(text))return 'ap';
  if(/switch|\bsw\d*\b|sw\d|core|\bidf|\bmdf|stack|catalyst|c9\d{3}|ws-c|\b(?:2930|3650|3750|3560|6100|6200|6300|9200|9300|9500)\b|nexus|arista|aruba|procurve/.test(text))return 'switch';
  if(/router|isr|asr\d|\brtr\b|mikrotik/.test(text))return 'router';
  return d.hasPorts?'switch':'endpoint';
 }
 function infra(r){return r==='firewall'||r==='router'||r==='switch'||r==='controller';}
 function layout(devices,links,options){
  options=options||{};var showAccess=!!options.showAccess;
  var nodes=new Map();devices.forEach(function(d){if(!nodes.has(d.key))nodes.set(d.key,Object.assign({},d,{role:role(d),links:[],attached:[]}));});
  var edges=new Map();
  links.forEach(function(l){var a=nodes.get(l.a),b=nodes.get(l.b);if(!a||!b||a===b)return;a.links.push(l);b.links.push(l);});
  nodes.forEach(function(n){n.shown=infra(n.role)||showAccess&&n.role==='ap'||n.open>=0;});
  // Attach hidden nodes to the shown device they connect to.
  links.forEach(function(l){var a=nodes.get(l.a),b=nodes.get(l.b);if(!a||!b)return;if(a.shown&&!b.shown)a.attached.push({key:b.key,name:b.name,role:b.role,type:b.type,port:l.aPort,remotePort:l.bPort});else if(b.shown&&!a.shown)b.attached.push({key:a.key,name:a.name,role:a.role,type:a.type,port:l.bPort,remotePort:l.aPort});});
  // Cables between two devices are one link only when they are aggregated (options.groupOf names the LAG);
  // every other cable is its own link with its own port tags (owner request).
  links.forEach(function(l,li){var a=nodes.get(l.a),b=nodes.get(l.b);if(!a||!b||!a.shown||!b.shown||a===b)return;var grp=options.groupOf?options.groupOf(l):'',key=[a.key,b.key].sort().join('\u0000')+'\u0000'+(grp||'#'+li);if(!edges.has(key))edges.set(key,{a:a.key<b.key?a.key:b.key,b:a.key<b.key?b.key:a.key,ports:[],group:grp||'',idx:edges.size});var e=edges.get(key);e.ports.push(a.key===e.a?{a:l.aPort,b:l.bPort,source:l.source}:{a:l.bPort,b:l.aPort,source:l.source});});
  var shown=Array.from(nodes.values()).filter(function(n){return n.shown;}),adj=new Map(shown.map(function(n){return [n.key,[]];}));
  edges.forEach(function(e){if(adj.get(e.a).indexOf(e.b)<0){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}});
  // Tiers per connected component, breadth-first from the edge of the network.
  var depth=new Map(),component=new Map(),comps=[];
  shown.slice().sort(function(x,y){return ROLE_ORDER[x.role]-ROLE_ORDER[y.role]||adj.get(y.key).length-adj.get(x.key).length||x.name.localeCompare(y.name);}).forEach(function(start){
   if(depth.has(start.key)||!adj.get(start.key).length)return;
   var members=[],queue=[start.key],seed=start;
   // Prefer firewalls, then the most connected device, as the top of the component.
   var seen=new Set([start.key]);for(var i=0;i<queue.length;i++){members.push(queue[i]);adj.get(queue[i]).forEach(function(k){if(!seen.has(k)){seen.add(k);queue.push(k);}});}
   var tops=members.map(function(k){return nodes.get(k);}).filter(function(n){return n.role==='firewall';});
   if(!tops.length){var best=members.map(function(k){return nodes.get(k);}).sort(function(x,y){return ROLE_ORDER[x.role]-ROLE_ORDER[y.role]||adj.get(y.key).length-adj.get(x.key).length;})[0];tops=[best];}
   var q=tops.map(function(n){depth.set(n.key,0);return n.key;});for(var j=0;j<q.length;j++){adj.get(q[j]).forEach(function(k){if(!depth.has(k)){depth.set(k,depth.get(q[j])+1);q.push(k);}});}
   members.forEach(function(k){component.set(k,comps.length);});comps.push(members);
  });
  var isolated=shown.filter(function(n){return !depth.has(n.key);});
  // Place each component's tiers in rows; wide tiers wrap.
  var placed=new Map(),y=PAD,width=0;
  comps.sort(function(a,b){return b.length-a.length;}).forEach(function(members){
   var tiers=[];members.forEach(function(k){var d=depth.get(k);(tiers[d]=tiers[d]||[]).push(k);});
   tiers.forEach(function(tier,t){
    if(t>0)tier.sort(function(a,b){return bary(a)-bary(b)||nodes.get(a).name.localeCompare(nodes.get(b).name);});
    else tier.sort(function(a,b){return adj.get(b).length-adj.get(a).length||nodes.get(a).name.localeCompare(nodes.get(b).name);});
    for(var r=0;r<tier.length;r+=MAX_ROW){var row=tier.slice(r,r+MAX_ROW);row.forEach(function(k,i){var n=nodes.get(k),w=n.role==='ap'?SMALL_W:NODE_W,h=n.role==='ap'?SMALL_H:NODE_H;placed.set(k,{x:PAD+i*(NODE_W+GAP_X)+(NODE_W-w)/2,y:y,w:w,h:h,tier:t});width=Math.max(width,PAD*2+row.length*(NODE_W+GAP_X)-GAP_X);});y+=NODE_H+GAP_Y;}
   });
   y+=24;
  });
  function bary(k){var ps=adj.get(k).map(function(o){return placed.get(o);}).filter(Boolean);return ps.length?ps.reduce(function(s,p){return s+p.x;},0)/ps.length:1e9;}
  // Center each row under the widest one.
  var rows=new Map();placed.forEach(function(p,k){(rows.get(p.y)||rows.set(p.y,[]).get(p.y)).push(p);});
  rows.forEach(function(list){var right=Math.max.apply(null,list.map(function(p){return p.x+p.w;})),left=Math.min.apply(null,list.map(function(p){return p.x;})),shift=Math.max(0,(width-(right-left))/2-left);list.forEach(function(p){p.x+=shift;});});
  if(isolated.length){y+=8;var isoTop=y;isolated.sort(function(a,b){return ROLE_ORDER[a.role]-ROLE_ORDER[b.role]||a.name.localeCompare(b.name);}).forEach(function(n,i){var col=i%MAX_ROW,row=Math.floor(i/MAX_ROW);placed.set(n.key,{x:PAD+col*(NODE_W+GAP_X),y:isoTop+row*(NODE_H+26),w:NODE_W,h:NODE_H,isolated:true});width=Math.max(width,PAD*2+Math.min(isolated.length,MAX_ROW)*(NODE_W+GAP_X)-GAP_X);});y=isoTop+Math.ceil(isolated.length/MAX_ROW)*(NODE_H+26);}
  // Links: every cable bundle between two devices ends in a port tag on each device's edge (the
  // ports on that device), joined by a right-angled line. Tags sit side by side in the order of
  // the far devices; horizontal runs between two rows each get their own level, so nothing
  // overlaps a tag or another line. Rows move apart by what their levels need.
  var TAB_H=20,LV=10,short=options.short||function(p){return String(p||'');};
  function tabText(list){var seen=[];list.forEach(function(p){p=short(p)||'?';if(/^some\b/i.test(p))p='?';if(p.length>14)p=p.slice(0,13)+'…';if(seen.indexOf(p)<0)seen.push(p);});if(seen.length===1&&seen[0]==='?'&&list.length>1)return '? ×'+list.length;return seen.length>2?seen[0]+' +'+(seen.length-1):seen.join(', ');}
  function tabW(t){return Math.max(28,Math.round(t.length*6.6)+10);}
  var ys=[];placed.forEach(function(p){if(ys.indexOf(p.y)<0)ys.push(p.y);});ys.sort(function(a,b){return a-b;});
  var rowOf=new Map();placed.forEach(function(p,k){rowOf.set(k,ys.indexOf(p.y));});
  var elist=Array.from(edges.values()),tabsOf=new Map();
  function addTab(k,side,e,end,far){var m=tabsOf.get(k)||tabsOf.set(k,{top:[],bottom:[]}).get(k);var t={key:k,side:side,e:e,end:end,far:far,text:tabText(e.ports.map(function(p){return p[end];}))};t.w=tabW(t.text);m[side].push(t);return t;}
  function cx(k){var p=placed.get(k);return p.x+p.w/2;}
  elist.forEach(function(e){var ra=rowOf.get(e.a),rb=rowOf.get(e.b);
   if(ra===rb){e.same=true;e.up=cx(e.a)<=cx(e.b)?'a':'b';e.ta=addTab(e.a,'bottom',e,'a',e.b);e.tb=addTab(e.b,'bottom',e,'b',e.a);}
   else{e.up=ra<rb?'a':'b';e.ta=addTab(e.a,ra<rb?'bottom':'top',e,'a',e.b);e.tb=addTab(e.b,ra<rb?'top':'bottom',e,'b',e.a);}});
  function spread(list,p,want){var gap=6,room=p.w+8;function total(){return list.reduce(function(s,t){return s+t.w;},0)+gap*(list.length-1);}
   // Too many tags for the device's edge: cable counts, then the end of each name (the part that tells
   // ports apart), then narrow tags; the full names stay in each tag's tooltip.
   if(total()>room)list.forEach(function(t){if(t.e.ports.length>1){t.text='×'+t.e.ports.length;t.w=tabW(t.text);}});
   if(total()>room)list.forEach(function(t){if(t.text.length>6){t.text='…'+t.text.slice(-5);t.w=tabW(t.text);}});
   if(total()>room){gap=3;var each=Math.max(8,Math.floor((room-gap*(list.length-1))/list.length));list.forEach(function(t){if(t.w>each){t.w=each;if(each<tabW(t.text))t.text=each>=22&&t.text.length>2?t.text.slice(-1):'';}});}
   var lo=p.x+6,hi=p.x+p.w-6;if(total()>hi-lo){lo=p.x+p.w/2-total()/2;hi=lo+total();}
   var x=lo;list.forEach(function(t,i){var w=want?want(t):null,left=w==null?null:w-t.w/2;t.x=Math.max(x,left==null?x:left);x=t.x+t.w+gap;});
   // Pull back from the right edge, keeping the order.
   var maxR=hi;for(var i=list.length-1;i>=0;i--){var t=list[i];if(t.x+t.w>maxR)t.x=maxR-t.w;maxR=t.x-gap;}
   if(!want){var used=list.length?list[list.length-1].x+list[list.length-1].w-list[0].x:0,shift=(p.x+p.w/2)-(list.length?list[0].x+used/2:0);list.forEach(function(t){t.x+=shift;});}
   list.forEach(function(t){t.cx=Math.round(t.x+t.w/2);t.x=t.cx-t.w/2;});}
  // Bottom tags first (centred, in the order of the far devices), then top tags as near as they
  // can get to straight under the tag they join.
  tabsOf.forEach(function(m,k){m.bottom.sort(function(a,b){return cx(a.far)-cx(b.far)||a.far.localeCompare(b.far)||a.e.idx-b.e.idx;});spread(m.bottom,placed.get(k),null);});
  tabsOf.forEach(function(m,k){function other(t){return t.e.ta===t?t.e.tb:t.e.ta;}m.top.sort(function(a,b){return other(a).cx-other(b).cx||a.far.localeCompare(b.far)||a.e.idx-b.e.idx;});var p=placed.get(k);spread(m.top,p,function(t){var x=other(t).cx;return x>=p.x+t.w/2+6&&x<=p.x+p.w-t.w/2-6?x:m.top.length===1?p.x+p.w/2:x;});});
  // Horizontal runs by the gap under each row.
  var segs=ys.map(function(){return [];}),usedX=[];
  function clearX(want,r1,r2){var c=[want];for(var d=10;d<1600;d+=10){c.push(want-d);c.push(want+d);}
   for(var i=0;i<c.length;i++){var x=c[i],ok=usedX.every(function(u){return Math.abs(u-x)>=8;});if(!ok)continue;placed.forEach(function(p,k){var r=rowOf.get(k);if(r>r1&&r<r2&&x>p.x-10&&x<p.x+p.w+10)ok=false;});if(ok){usedX.push(x);return x;}}return want;}
  elist.forEach(function(e){var up=e.up==='a'?e.ta:e.tb,dn=e.up==='a'?e.tb:e.ta,r1=rowOf.get(up.key),r2=rowOf.get(dn.key);e.runs=[];
   if(e.same){e.runs.push({g:r1,x1:up.cx,x2:dn.cx});}
   else if(r2===r1+1){if(up.cx!==dn.cx)e.runs.push({g:r1,x1:up.cx,x2:dn.cx});}
   else{var gx=clearX(Math.round((up.cx+dn.cx)/2),r1,r2);e.gx=gx;if(gx!==up.cx)e.runs.push({g:r1,x1:up.cx,x2:gx});if(gx!==dn.cx)e.runs.push({g:r2-1,x1:gx,x2:dn.cx});}
   e.runs.forEach(function(s){s.e=e;segs[s.g].push(s);});});
  var levels=segs.map(function(list){var rows=[];
   list.sort(function(a,b){var la=a.x2<a.x1,lb=b.x2<b.x1;if(la!==lb)return la?-1:1;return la?a.x2-b.x2:b.x2-a.x2;});
   list.forEach(function(s){var lo=Math.min(s.x1,s.x2)-8,hi=Math.max(s.x1,s.x2)+8;for(var i=0;;i++){var row=rows[i]||(rows[i]=[]);if(row.every(function(o){return hi<o[0]||lo>o[1];})){row.push([lo,hi]);s.level=i;break;}}});return rows.length;});
  // Row positions: each gap as tall as its tags and levels need.
  var top=ys.slice(),shiftY=0;
  for(var gi=0;gi<ys.length;gi++){top[gi]=ys[gi]+shiftY;var orig=(gi+1<ys.length?ys[gi+1]:y)-ys[gi]-NODE_H,need=segs[gi].length||elist.some(function(e){var a=rowOf.get(e.a),b=rowOf.get(e.b);return Math.min(a,b)<=gi&&Math.max(a,b)>gi;})?TAB_H*2+28+Math.max(0,levels[gi]-1)*LV:36;
   shiftY+=need+Math.max(0,orig-GAP_Y)-orig;}
  placed.forEach(function(p,k){p.y=top[rowOf.get(k)]+(p.y-ys[rowOf.get(k)]);});y+=shiftY;
  function levelY(g,level){return top[g]+NODE_H+TAB_H+14+level*LV;}
  tabsOf.forEach(function(m,k){var p=placed.get(k);m.bottom.forEach(function(t){t.y=p.y+p.h;t.out=t.y+TAB_H;});m.top.forEach(function(t){t.y=p.y-TAB_H;t.out=t.y;});});
  elist.forEach(function(e){var up=e.up==='a'?e.ta:e.tb,dn=e.up==='a'?e.tb:e.ta,pts=[[up.cx,up.out]];
   e.runs.forEach(function(s){var ly=levelY(s.g,s.level);pts.push([s.x1,ly]);pts.push([s.x2,ly]);});pts.push([dn.cx,dn.out]);
   e.route=pts.filter(function(q,i){return !i||q[0]!==pts[i-1][0]||q[1]!==pts[i-1][1];});
   e.tabs={a:{x:e.ta.x,y:e.ta.y,w:e.ta.w,h:TAB_H,text:e.ta.text},b:{x:e.tb.x,y:e.tb.y,w:e.tb.w,h:TAB_H,text:e.tb.text}};
   width=Math.max(width,PAD+Math.max.apply(null,pts.map(function(q){return q[0];})));
   delete e.ta;delete e.tb;delete e.runs;});
  return {
   width:Math.max(width,320),height:y+PAD,isolatedTop:isolated.length?placed.get(isolated[0].key).y:null,
   nodes:shown.map(function(n){var p=placed.get(n.key);return Object.assign({},n,{x:p.x,y:p.y,w:p.w,h:p.h,isolated:!!p.isolated,degree:adj.get(n.key).length});}),
   edges:Array.from(edges.values()),
   all:Array.from(nodes.values())
  };
 }
 root.SWSiteMap={layout:layout,role:role,infra:infra};
 if(typeof module==='object'&&module.exports)module.exports=root.SWSiteMap;
})(typeof globalThis!=='undefined'?globalThis:this);
