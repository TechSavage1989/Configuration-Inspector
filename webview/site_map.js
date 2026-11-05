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
  links.forEach(function(l){var a=nodes.get(l.a),b=nodes.get(l.b);if(!a||!b||!a.shown||!b.shown||a===b)return;var key=[a.key,b.key].sort().join('\u0000');if(!edges.has(key))edges.set(key,{a:a.key<b.key?a.key:b.key,b:a.key<b.key?b.key:a.key,ports:[]});var e=edges.get(key);e.ports.push(a.key===e.a?{a:l.aPort,b:l.bPort,source:l.source}:{a:l.bPort,b:l.aPort,source:l.source});});
  var shown=Array.from(nodes.values()).filter(function(n){return n.shown;}),adj=new Map(shown.map(function(n){return [n.key,[]];}));
  edges.forEach(function(e){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);});
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
