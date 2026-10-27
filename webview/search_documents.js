(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWSearchDocuments=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var MASK='[REDACTED]';
 function text(value){return value===undefined||value===null?'':String(value);}
 function cancelled(signal){if(signal&&signal.aborted){var error=new Error('Search indexing cancelled.');error.name='AbortError';throw error;}}
 function decode(value){try{return decodeURIComponent(value);}catch(e){return value;}}
 function encode(value){try{return encodeURIComponent(value);}catch(e){return value;}}
 function unquote(value){return value.replace(/^(["'])([\s\S]*)\1$/,'$2').replace(/\\(["'\\])/g,'$1');}
 // A literal multi-pattern matcher avoids interpolating secrets into executable
 // regexes and avoids scanning every document once for every secret value.
 function redactor(patterns){
  var nodes=[{next:new Map(),fail:0,length:0}],queue=[];
  patterns.forEach(function(pattern){if(!pattern||pattern===MASK)return;var at=0;for(var i=0;i<pattern.length;i++){var ch=pattern[i].toLowerCase(),next=nodes[at].next.get(ch);if(next===undefined){next=nodes.length;nodes[at].next.set(ch,next);nodes.push({next:new Map(),fail:0,length:0});}at=next;}nodes[at].length=Math.max(nodes[at].length,pattern.length);});
  nodes[0].next.forEach(function(next){queue.push(next);});
  for(var q=0;q<queue.length;q++){var parent=queue[q];nodes[parent].next.forEach(function(next,ch){var failure=nodes[parent].fail;while(failure&&!nodes[failure].next.has(ch))failure=nodes[failure].fail;var found=nodes[failure].next.get(ch);nodes[next].fail=found===undefined?0:found;nodes[next].length=Math.max(nodes[next].length,nodes[nodes[next].fail].length);queue.push(next);});}
  return function(value){value=text(value);var at=0,ranges=[];for(var i=0;i<value.length;i++){var ch=value[i].toLowerCase();while(at&&!nodes[at].next.has(ch))at=nodes[at].fail;at=nodes[at].next.get(ch)||0;var length=nodes[at].length;if(length){var start=i-length+1,end=i+1,last=ranges[ranges.length-1];while(last&&start<=last[1]){start=Math.min(start,last[0]);ranges.pop();last=ranges[ranges.length-1];}ranges.push([start,end]);}}if(!ranges.length)return value;var out='',end=0;ranges.forEach(function(range){out+=value.slice(end,range[0])+MASK;end=range[1];});return out+value.slice(end);};
 }
 async function build(model,options){
  options=options||{};model=model||{};
  var C=options.core;if(!C||typeof C.secretKey!=='function'||typeof C.redactValue!=='function')throw new Error('Search indexing requires the configuration redaction helpers.');
  var hidden=options.hidden!==false,entries=model.entries||[],records=model.records||[],I=options.importers,documents=[],notes=[],signal=options.signal;
  var chunk=Math.max(1,Math.min(2000,Number(options.chunkSize)||300)),work=0,phase='masking',patterns=new Set(),patternCharacters=0,maskBudget=false,namedSecretPaths=new Set();
  async function checkpoint(force){cancelled(signal);if(force||++work%chunk===0){if(options.onProgress)options.onProgress({phase:phase,completed:work,documents:documents.length});await new Promise(function(resolve){setTimeout(resolve,0);});cancelled(signal);}}
  function sensitive(entry){return C.secretKey(entry.key)||C.secretKey(entry.base)||/command|statement|line/i.test(text(entry.base))&&C.secretKey(entry.value)||/^(?:value|values)$/i.test(text(entry.base))&&namedSecretPaths.has(text(entry.key).replace(/\/[^/]+$/,''));}
  function pattern(value){if(!value||value===MASK||maskBudget||patterns.has(value))return;if(value.length>32768||patternCharacters+value.length>131072){maskBudget=true;patterns.clear();return;}patterns.add(value);patternCharacters+=value.length;}
  function addSecret(value){value=text(value).trim();if(!value||value===MASK||maskBudget)return;pattern(value);pattern(unquote(value));pattern(decode(unquote(value)));pattern(encode(unquote(value)));pattern(JSON.stringify(unquote(value)).slice(1,-1));if(C.escapeHTML)pattern(C.escapeHTML(unquote(value)));value.split(/\r\n|\n|\r/).forEach(function(line){if(line.trim())pattern(line.trim());});}
  // Some importers retain complete commands as a secret entry. Protect both the
  // command and its credential tokens, so a derived summary cannot re-expose it.
  function collectSecret(entry){
   var value=text(entry.value);addSecret(value);
   var tokens=value.match(/(?:[^\s"']+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')+/g)||[],after=false;
   tokens.forEach(function(token){var equal=token.indexOf('='),key=equal<0?token:token.slice(0,equal);if(equal>=0&&C.secretKey(key)){addSecret(token.slice(equal+1));return;}if(after)addSecret(token);if(C.secretKey(key))after=true;});
   if(/^(?:ENC|encrypted|hashed)\s+/i.test(value))addSecret(value.replace(/^\S+\s+/,''));
  }
  cancelled(signal);
  for(var ni=0;ni<entries.length;ni++){var named=entries[ni];if(hidden&&/^(?:name|key|header)$/i.test(text(named.base))&&C.secretKey(named.value))namedSecretPaths.add(text(named.key).replace(/\/[^/]+$/,''));await checkpoint();}
  for(var ei=0;ei<entries.length;ei++){if(hidden&&sensitive(entries[ei]))collectSecret(entries[ei]);await checkpoint();}
  // Credential/certificate-sized pathological inputs must not allocate an
  // unbounded trie or silently bypass masking. Retain every destination, but
  // fail closed for text and disclose this conservative indexing limitation.
  var scrub=hidden?(maskBudget?function(value){return text(value)?MASK:'';}:redactor(patterns)):text;
  function safe(value,key){return scrub(C.redactValue(key||'',text(value),hidden));}
  function exact(value){value=text(value);return safe(value)===value?value:'';}
  function categoryLabel(id){return safe(options.categoryLabel?options.categoryLabel(id):(C.CATEGORIES||[]).find(function(c){return c.id===id;})?.label||id);}
  var recordIndices=new Map(records.map(function(r,index){return [r.id,index];})),entryIndices=new Map(),entriesByKey=new Map(),owners=new Map(),entrySections=new Map();
  entries.forEach(function(entry,index){if(!entryIndices.has(entry))entryIndices.set(entry,[]);entryIndices.get(entry).push(index);if(!entriesByKey.has(entry.key))entriesByKey.set(entry.key,[]);entriesByKey.get(entry.key).push(entry);});
  function objectDestination(index){var r=records[index];return {kind:'object',recordIndex:index,recordId:exact(r.id)};}
  function addOwner(entry,index){(entryIndices.get(entry)||[]).forEach(function(eindex){var list=owners.get(eindex)||[];if(!list.includes(index))list.push(index);owners.set(eindex,list);});}
  phase='locations';
  for(var ri=0;ri<records.length;ri++){var record=records[ri];(record.fields||[]).forEach(function(entry){addOwner(entry,ri);});(record.sourceFieldKeys||[]).forEach(function(key){(entriesByKey.get(key)||[]).forEach(function(entry){addOwner(entry,ri);});});await checkpoint();}
  var sections=options.sections!==undefined?options.sections:I&&I.configurationSections&&model.meta?I.configurationSections(model):[],findings=options.findings||[];
  if(findings.findings)findings=findings.findings;
  function sectionDestination(index){return {kind:'section',sectionIndex:index,sectionId:exact(sections[index].id)};}
  for(var si=0;si<sections.length;si++){(sections[si].fields||[]).forEach(function(entry){(entryIndices.get(entry)||[]).forEach(function(index){var list=entrySections.get(index)||[];if(!list.includes(si))list.push(si);entrySections.set(index,list);});});await checkpoint();}
  var sourceText=options.sourceText;
  if(sourceText===undefined&&I&&I.configurationText&&model.meta)sourceText=I.configurationText(model,hidden);
  if(sourceText&&typeof sourceText==='object')sourceText=sourceText.text;
  var hasSource=typeof sourceText==='string',lines=hasSource&&sourceText.length?sourceText.split(/\r\n|\r|\n/):[];
  if(lines.length&&/[\r\n]$/.test(sourceText))lines.pop();
  function sourceDestination(entry){var start=entry.sourceLineStart,end=entry.sourceLineEnd;if(options.sourceLinePreserved===true&&Number.isInteger(start)&&Number.isInteger(end)&&start>0&&end>=start&&end<=lines.length)return {kind:'source',lineStart:start,lineEnd:end};return null;}
  function destinationsForField(index){var entry=entries[index],list=[{kind:'field',entryIndex:index,key:exact(entry.key),recordId:exact(entry.recordId)}],ids=owners.get(index)||[];var owner=recordIndices.get(entry.recordId);if(owner!==undefined&&!ids.includes(owner))ids=ids.concat(owner);ids.forEach(function(rindex){list.push(objectDestination(rindex));});(entrySections.get(index)||[]).forEach(function(index){list.push(sectionDestination(index));});var raw=sourceDestination(entry);if(raw)list.push(raw);return list;}
  function entryText(entry){return safe(entry.key)+'\n'+(hidden&&sensitive(entry)&&entry.value!==''?MASK:safe(entry.value,entry.key));}
  function base(kind,index,record){var cat=record&&record.category||'',name=record?safe(options.recordLabel?options.recordLabel(record):record.name):'';return {id:kind+':'+index,sourceKind:kind,source:({field:'Original field',object:'Parsed object',section:'Native section',finding:'Configuration-derived finding',source:'Displayed configuration source'})[kind],category:safe(cat),categoryLabel:categoryLabel(cat),context:safe(record&&record.scope||''),objectId:record?exact(record.id):'',objectName:name,path:'',text:'',destinations:[]};}
  function fieldsText(value,prefix,seen){
   if(value===undefined||value===null)return [];
   if(typeof value!=='object')return [safe(prefix)+': '+safe(value,prefix)];
   var namedKey=value.label||value.key||value.header||value.name;if(typeof namedKey==='string'&&Object.hasOwn(value,'value'))return [safe(namedKey)+': '+safe(value.value,namedKey)];
   seen=seen||new Set();if(seen.has(value))return [];seen.add(value);var out=[];
   Object.keys(value).forEach(function(key){var label=prefix?prefix+' / '+key:key,v=value[key];if(hidden&&C.secretKey(label)){out.push(safe(label)+': '+(v===''?'':MASK));return;}if(key==='featureData'&&typeof v==='string'){try{v=JSON.parse(v);}catch(e){}}
    // Feature facts encode the sensitive key in `label`, not in `value`.
    if(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.label==='string'&&Object.hasOwn(v,'value')){out.push(safe(v.label)+': '+safe(v.value,v.label));return;}
    out=out.concat(fieldsText(v,label,seen));});seen.delete(value);return out;
  }
  phase='fields';
  for(ei=0;ei<entries.length;ei++){var entry=entries[ei],ownerIndex=recordIndices.get(entry.recordId),ownerRecord=ownerIndex===undefined?null:records[ownerIndex],doc=base('field',ei,ownerRecord);doc.entryIndex=ei;doc.path=safe(entry.key);doc.text=entryText(entry);doc.destinations=destinationsForField(ei);if(!ownerRecord){doc.category=safe(entry.category||'');doc.categoryLabel=categoryLabel(entry.category||'');doc.context=safe(entry.scope||'');}documents.push(doc);await checkpoint();}
  phase='objects';
  for(ri=0;ri<records.length;ri++){record=records[ri];doc=base('object',ri,record);doc.recordIndex=ri;doc.path=safe(record.family||'');var parts=[doc.objectName,safe(record.name),safe(record.family)].concat(fieldsText(record.summary||{},''),fieldsText(record.properties||{},''));
   if(options.recordFacts){var facts=options.recordFacts(record);if(facts&&!Array.isArray(facts)&&facts.facts)facts=facts.facts;if(Array.isArray(facts))facts.forEach(function(fact){parts.push(safe(fact.label)+': '+safe(fact.value,fact.label));});}
   doc.text=Array.from(new Set(parts.filter(Boolean))).join('\n');doc.destinations=[objectDestination(ri)];var spans=new Set();(record.fields||[]).forEach(function(entry){var span=sourceDestination(entry);if(span&&!spans.has(span.lineStart+':'+span.lineEnd)){spans.add(span.lineStart+':'+span.lineEnd);doc.destinations.push(span);}});documents.push(doc);await checkpoint();}
  phase='sections';
  for(si=0;si<sections.length;si++){var section=sections[si];doc=base('section',si);doc.path=safe(section.name);doc.context=safe(section.scope||'');var sectionParts=[safe(section.name)],sectionFields=Array.from(new Set(section.fields||[]));for(var sf=0;sf<sectionFields.length;sf++){sectionParts.push(entryText(sectionFields[sf]));await checkpoint();}doc.text=sectionParts.join('\n');doc.destinations=[sectionDestination(si)];documents.push(doc);await checkpoint();}
  phase='findings';
  for(var fi=0;fi<findings.length;fi++){var finding=findings[fi];doc=base('finding',fi);doc.configurationDerived=true;doc.context=safe(finding.scope||'');doc.category='findings';doc.categoryLabel='Configuration review';doc.path=safe(finding.title);doc.text=['title','kind','severity','area','detail','impact','evidence','sourceEvidence','locations','resolution','verification'].flatMap(function(key){return fieldsText(finding[key],key);}).join('\n');doc.destinations=[{kind:'finding',findingIndex:fi,findingId:exact(finding.id)}];(finding.recordIds||[]).forEach(function(id){var index=recordIndices.get(id);if(index!==undefined)doc.destinations.push(objectDestination(index));});documents.push(doc);await checkpoint();}
  phase='source';
  for(var li=0;li<lines.length;li++){doc=base('source',li);doc.lineStart=li+1;doc.lineEnd=li+1;doc.path='Line '+(li+1);doc.text=safe(lines[li]);doc.destinations=[{kind:'source',lineStart:li+1,lineEnd:li+1}];documents.push(doc);await checkpoint();}
  notes.push('Counts describe searchable representations, not unique underlying source occurrences. Shared original fields are indexed once per original entry; parsed summaries, native section contents and displayed source are separate representations.');
  notes.push('Source line numbers refer to the displayed configuration text. Normalized or masked exports may differ from the original file; source links are not inferred from field order.');
  if(hidden)notes.push('Sensitive values are masked before matching, including known secret values reused in derived text. Conservative masking can also hide identical non-secret text.');
  if(maskBudget)notes.push('Sensitive-value masking exceeded its bounded index budget. Search text is conservatively masked; all navigation destinations remain indexed.');
  if(!hasSource)notes.push('Displayed configuration source was unavailable; no source text was inferred from record summaries.');
  var coverage={fields:entries.length,objects:records.length,sections:sections.length,findings:findings.length,sourceLines:lines.length,totalDocuments:documents.length,hidden:hidden,conservativeMasking:maskBudget,sourceAvailable:hasSource,sourceLinePreserved:options.sourceLinePreserved===true,countUnit:'representations'};
  phase='complete';await checkpoint(true);return {documents:documents,notes:notes,coverage:coverage};
 }
 return {build:build};
});
