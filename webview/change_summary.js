(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWChangeSummary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Plain-language change list from an object comparison result (SWCore.compareRecords).
 // Values come from the comparison, which the caller runs with sensitive values masked.
 function text(v){return v===undefined||v===null?'':String(v);}
 function short(v,limit){v=text(v).replace(/\s+/g,' ').trim();limit=limit||70;return v.length>limit?v.slice(0,limit-1)+'…':v;}
 function quote(v){v=short(v);return v===''?'(none)':/^[\w./:,@-]+$/.test(v)&&v.length<=24?v:'"'+v+'"';}
 function plural(n,one,many){return n+' '+(n===1?one:many||one+'s');}
 // Comma-separated lists (ports, VLAN lists) are described as additions and removals.
 function listChange(before,after){
  before=text(before);after=text(after);if(!/,/.test(before+after))return '';
  function items(v){return v.split(/\s*,\s*/).map(function(x){return x.trim();}).filter(Boolean);}
  var a=items(before),b=items(after);if(a.length<1||b.length<1)return '';
  var added=b.filter(function(x){return a.indexOf(x)<0;}),removed=a.filter(function(x){return b.indexOf(x)<0;});
  function show(list){return list.length>6?list.slice(0,6).join(', ')+' and '+(list.length-6)+' more':list.join(', ');}
  if(!added.length&&!removed.length)return 'order changed';
  return [added.length?'added '+show(added):'',removed.length?'removed '+show(removed):''].filter(Boolean).join(', ');
 }
 function build(result,options){
  options=options||{};
  var label=options.label||function(k){return k;},category=options.categoryLabel||function(c){return c;},items=(result&&result.items||[]).filter(function(i){return i.kind!=='Unchanged';}),limit=options.perObject||6;
  var counts={Added:0,Removed:0,Changed:0};items.forEach(function(i){if(counts[i.kind]!==undefined)counts[i.kind]++;});
  // Renames pair a removed and an added item. Record ids can repeat across the two sides,
  // so the paired comparison items themselves are tracked.
  var renamed=new Set(),renames=0,groups=new Map();
  function name(r){var n=text(r&&(r.name||r.id));return r&&r.category==='vlans'&&/^\d+$/.test(n)?'VLAN '+n:n;}
  function where(r){return r&&r.scope&&r.scope!=='global'?' ['+r.scope+']':'';}
  function add(cat,line){if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(line);}
  items.forEach(function(i){
   var r=i.after||i.before,cat=r&&r.category||'other';
   if(i.possibleRename&&i.kind==='Removed'){var partner=items.find(function(x){return x.kind==='Added'&&x.possibleRename&&x.after&&x.after.id===i.possibleRename.id&&x.possibleRename.id===i.before.id;});renamed.add(i);if(partner)renamed.add(partner);renames++;add(cat,'Possible rename: '+name(i.before)+' → '+i.possibleRename.to+where(r)+' (identical settings apart from the name; listed separately in the comparison).');}
  });
  items.forEach(function(i){
   var r=i.after||i.before,cat=r&&r.category||'other';if(renamed.has(i))return;
   if(i.kind==='Added'||i.kind==='Removed'){var desc=r.summary&&(r.summary.comment||r.summary.description||r.summary.vlanName)?' ('+quote(r.summary.comment||r.summary.description||r.summary.vlanName)+')':'';add(cat,i.kind+' '+name(r)+where(r)+desc+(i.ambiguous?' — duplicate name, not matched automatically':'')+'.');return;}
   var changes=(i.summaryChanges||[]).filter(function(c){return !/^(?:fields|family|featureData)$/.test(c.key);}),parts=changes.slice(0,limit).map(function(c){return label(c.key)+': '+(c.kind==='Added'||!text(c.before).trim()?'set to '+quote(c.after):c.kind==='Removed'?'removed (was '+quote(c.before)+')':!text(c.after).trim()?'cleared (was '+quote(c.before)+')':listChange(c.before,c.after)||quote(c.before)+' → '+quote(c.after));});
   if(changes.length>limit)parts.push('and '+plural(changes.length-limit,'more property','more properties'));
   var fields=(i.fieldChanges||[]).length;
   if(!parts.length)parts.push(fields?plural(fields,'original setting')+' changed':'settings changed');
   else if(fields&&!changes.length)parts.push(plural(fields,'original setting')+' changed');
   add(cat,'Changed '+name(r)+where(r)+': '+parts.join('; ')+'.');
  });
  var left=options.left||{},right=options.right||{},lines=[];
  lines.push('Configuration changes: '+(text(left.name)||'Left configuration')+' → '+(text(right.name)||'Right configuration'));
  if(left.filename||right.filename)lines.push('Files: '+(text(left.filename)||'—')+' → '+(text(right.filename)||'—'));
  lines.push(['Generated '+(options.date||new Date()).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}),options.appVersion?'Config Inspector '+options.appVersion:'',options.masked===false?'Sensitive values included':'Sensitive values masked'].filter(Boolean).join(' · '));
  lines.push('');
  if(!items.length){lines.push('No object changes were found.');}
  else{
   lines.push('Summary: '+[plural(counts.Changed,'object')+' changed',counts.Added+' added',counts.Removed+' removed'].join(', ')+(renames?'; '+plural(renames,'possible rename')+' noted':'')+'.');
   groups.forEach(function(rows,cat){lines.push('');lines.push(category(cat));rows.forEach(function(row){lines.push('- '+row);});});
  }
  if(result&&result.ambiguous)lines.push('','Note: '+plural(result.ambiguous,'object')+' with duplicate names were not matched automatically.');
  lines.push('','Based on saved configuration exports, not live device state. Review the comparison for exact values before making changes.');
  return {text:lines.join('\n'),counts:counts,renames:renames};
 }
 return {build:build};
});
