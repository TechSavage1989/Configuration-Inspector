const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{boot}=require('./harness.cjs');
const {ctx,load}=boot(),C=ctx.SWCore;let checks=0;
function eq(value,expected,message){checks++;assert.deepEqual(JSON.parse(JSON.stringify(value)),JSON.parse(JSON.stringify(expected)),message);}
function ok(value,message){checks++;assert.ok(value,message);}
function record(name,value,options={}){
 return {id:options.id||name,name,scope:options.scope||'global',category:options.category||'interfaces',family:options.family||'interface',summary:{description:value,status:'Enabled'},fields:[{key:'description',base:'description',value},{key:'status',base:'status',value:'Enabled'}],...options};
}
function model(records,vendor='cisco'){return {meta:{vendorId:vendor,filename:'example-'+vendor+'.conf'},records,entries:records.flatMap(r=>r.fields),scopeParents:{}};}
const options={includeUnchanged:true,includeValues:true};
let left=model([record('Same','same'),record('Modified','old'),record('Removed','left only')]);
let right=model([record('Same','same'),record('Modified','new'),record('Added','right only')]);
const source=JSON.stringify([left,right]);
let result=C.compareRecords(left,right,true,options);
eq(result.items.map(item=>item.kind),['Unchanged','Changed','Removed','Added'],'all four object states');
eq(result.unchanged,1);eq(result.ambiguous,0);eq(JSON.stringify([left,right]),source,'comparison never mutates either source');
let changed=result.items.find(item=>item.kind==='Changed');
eq(changed.summaryChanges.map(row=>row.key),['description']);eq(changed.fieldChanges.map(row=>row.key),['description']);
eq(changed.summaryRows.map(row=>[row.key,row.kind,row.before,row.after]),[['description','Changed','old','new'],['status','Unchanged','Enabled','Enabled']]);
const added=result.items.find(item=>item.kind==='Added'),removed=result.items.find(item=>item.kind==='Removed');
ok(added.summaryRows.every(row=>row.kind==='Added'&&row.before===''),'added properties have absent left side');
ok(added.fieldRows.every(row=>row.kind==='Added'&&row.before===''),'added original fields are available');
ok(removed.summaryRows.every(row=>row.kind==='Removed'&&row.after===''),'removed properties have absent right side');
ok(removed.fieldRows.every(row=>row.kind==='Removed'&&row.after===''),'removed original fields are available');
eq(C.compareRecords(left,right,true).items.map(item=>item.kind),['Changed','Removed','Added'],'legacy default excludes unchanged');
ok(!Object.hasOwn(C.compareRecords(left,right,true).items[0],'fieldRows'),'legacy default does not build all-value tables');

let duplicatesLeft=model([record('Duplicate','a',{id:'left-a'}),record('Duplicate','b',{id:'left-b'})]);
let duplicatesRight=model([record('Duplicate','b',{id:'right-b'}),record('Duplicate','a',{id:'right-a'})]);
result=C.compareRecords(duplicatesLeft,duplicatesRight,true,options);
eq(result.items.map(item=>[item.before.id,item.after.id,item.kind,item.ambiguous]),[['left-a','right-a','Unchanged',false],['left-b','right-b','Unchanged',false]],'identical duplicate contents match safely despite order');
eq(result.unchanged,2);eq(result.ambiguous,0);
duplicatesRight=model([record('Duplicate','b',{id:'right-b'}),record('Duplicate','different',{id:'right-new'})]);
result=C.compareRecords(duplicatesLeft,duplicatesRight,true,options);
eq(result.items.map(item=>item.kind),['Unchanged','Removed','Added']);eq(result.ambiguous,2);
ok(result.items.filter(item=>item.kind!=='Unchanged').every(item=>item.ambiguous),'unmatched duplicates remain separate instead of guessed as changed');
eq(result.items.find(item=>item.kind==='Unchanged').before.id,'left-b');
result=C.compareRecords(model([record('Repeated','same'),record('Repeated','same',{id:'second'})]),model([record('Repeated','same')]),true,options);
eq(result.unchanged,1);eq(result.items.map(item=>item.kind),['Unchanged','Removed'],'duplicate matching consumes each right record once');

result=C.compareRecords(model([record('Port','same')],'cisco'),model([record('Port','same')],'fortigate'),true,options);
eq(result.items.map(item=>item.kind),['Removed','Added'],'cross-vendor objects never match by name alone');
result=C.compareRecords(model([record('Port','same',{scope:'context-a'})]),model([record('Port','same',{scope:'context-b'})]),true,options);
eq(result.items.map(item=>item.kind),['Removed','Added'],'different contexts never match');
result=C.compareRecords(model([record('Port','same')]),model([record('Port','same',{family:'vlan'})]),true,options);
eq(result.items.map(item=>item.kind),['Removed','Added'],'different object types never match');
result=C.compareRecords(model([record('Old name','same')]),model([record('New name','same')]),true,options);
eq(result.items.map(item=>item.kind),['Removed','Added'],'renames are not inferred');

function secretRecord(value){return record('Example authentication','same',{summary:{description:'same',password:value},fields:[{key:'password',base:'password',value},{key:'description',base:'description',value:'same'}]});}
const privateLeft=model([secretRecord('TEST_SECRET_ONLY_BEFORE')]),privateRight=model([secretRecord('TEST_SECRET_ONLY_AFTER')]);
result=C.compareRecords(privateLeft,privateRight,true,options);changed=result.items[0];
eq(changed.kind,'Changed','secret-only changes remain Changed');
eq(changed.summaryChanges.map(row=>[row.kind,row.before,row.after]),[['Changed','[REDACTED]','[REDACTED]']]);
eq(changed.fieldChanges.map(row=>[row.kind,row.before,row.after]),[['Changed','[REDACTED]','[REDACTED]']]);
ok(!JSON.stringify([changed.summaryRows,changed.fieldRows]).includes('TEST_SECRET_ONLY'),'all-value rows retain masking');
eq(C.compareRecords(privateLeft,privateRight,false,options).items[0].fieldChanges[0].before,'TEST_SECRET_ONLY_BEFORE','explicit unmask returns original value');
const repeatBefore=record('Repeated original keys','same',{fields:[{key:'member',base:'member',value:'first'},{key:'member',base:'member',value:'second'}]});
const repeatAfter=record('Repeated original keys','same',{fields:[{key:'member',base:'member',value:'second'},{key:'member',base:'member',value:'first'}]});
changed=C.compareRecords(model([repeatBefore]),model([repeatAfter]),true,options).items[0];
eq(changed.kind,'Changed');eq(changed.fieldRows[0].before,'first\nsecond');eq(changed.fieldRows[0].after,'second\nfirst','original repeated-key order stays significant');
const unknownBefore=record('Unknown source','same',{fields:[{key:'line[10]/command',base:'unrecognized-command',value:'example unsupported old'}]});
const unknownAfter=record('Unknown source','same',{fields:[{key:'line[90]/command',base:'unrecognized-command',value:'example unsupported new'}]});
changed=C.compareRecords(model([unknownBefore]),model([unknownAfter]),true,options).items[0];
eq(changed.kind,'Changed');eq(changed.fieldChanges[0].before,'example unsupported old','unsupported source values remain available');

// Add test-only access to the existing UI closure in memory, without changing
// production exports or the shared harness. Render real HTML with real helpers.
const html=fs.readFileSync('webview/index.html','utf8');
let ui=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('var C=window.SWCore'));
ui=ui.slice(0,ui.indexOf("  document.addEventListener('click'"));
vm.runInContext(ui+'\nwindow.objectAudit={state,objectComparisonResult,recordComparisonPage,comparisonCard};})();',ctx);
const audit=ctx.objectAudit,state=audit.state;
Object.assign(state,{model:left,comparison:right,hideSensitive:true,query:'',filter:'all-items',scope:'',compareCategory:'all',page:1,pageSize:40});
result=audit.objectComparisonResult();eq(result.items.length,4);ok(audit.objectComparisonResult()===result,'stable models reuse comparison result');
let rendered=audit.recordComparisonPage();
eq([...rendered.matchAll(/data-object-kind="([^"]+)"/g)].map(match=>match[1]),['Unchanged','Changed','Removed','Added']);
ok(rendered.includes('Left · current')&&rendered.includes('Right · comparison'),'explicit side labels in rendered values');
ok(rendered.includes('[Absent]')&&rendered.includes('[Not present]'),'added and removed cards expose absent sides');
for(const kind of ['Added','Changed','Removed','Unchanged']){
 state.filter=kind;rendered=audit.recordComparisonPage();eq([...rendered.matchAll(/data-object-kind="([^"]+)"/g)].map(match=>match[1]),[kind],kind+' filter renders only that state');
}
state.filter='all';eq([...audit.recordComparisonPage().matchAll(/data-object-kind="([^"]+)"/g)].map(match=>match[1]),['Changed','Removed','Added'],'All changes excludes unchanged');
state.filter='all-items';state.query='right only';rendered=audit.recordComparisonPage();eq([...rendered.matchAll(/data-object-kind="([^"]+)"/g)].map(match=>match[1]),['Added'],'search includes displayed source values');
state.query='';state.compareCategory='dns';ok(!audit.recordComparisonPage().includes('data-object-kind='),'category filter hides other categories');state.compareCategory='all';
state.scope='context-a';ok(!audit.recordComparisonPage().includes('data-object-kind='),'scope filter hides unrelated contexts');state.scope='';
Object.assign(state,{model:privateLeft,comparison:privateRight,filter:'all-items'});
const masked=audit.objectComparisonResult();eq(masked.items[0].kind,'Changed');
rendered=audit.recordComparisonPage();ok(!rendered.includes('TEST_SECRET_ONLY'),'rendered masked table/copy attributes contain no raw test secret');ok(rendered.includes('[REDACTED]'));
state.query='TEST_SECRET_ONLY';ok(!audit.recordComparisonPage().includes('data-object-kind='),'hidden secrets are not searchable through displayed tables');state.query='';
state.hideSensitive=false;const visible=audit.objectComparisonResult();ok(masked!==visible,'masking changes invalidate result cache');ok(audit.recordComparisonPage().includes('TEST_SECRET_ONLY_BEFORE'));
state.comparison=model([secretRecord('TEST_SECRET_ONLY_NEW')]);ok(audit.objectComparisonResult()!==visible,'right source replacement invalidates result cache');
const unsafe=record('<img src=x onerror=alert(1)>','<script>example</script>');
rendered=audit.comparisonCard(C.compareRecords(model([]),model([unsafe]),true,options).items[0]);
ok(!rendered.includes('<img src=')&&!rendered.includes('<script>'),'object names and values escaped');ok(rendered.includes('&lt;img')&&rendered.includes('&lt;script&gt;'));
const manyFields=record('Many original settings','same',{fields:Array.from({length:205},(_,i)=>({key:'example-'+i,base:'example-'+i,value:String(i)}))});
rendered=audit.comparisonCard(C.compareRecords(model([]),model([manyFields]),true,options).items[0]);
ok(rendered.includes('Showing the first 200 of 205 settings'),'large object rendering limit is explicit');ok(rendered.includes('View item details'),'all source remains reachable through details');

// Real public fixture smoke: identical parsed objects expose complete unchanged
// objects without altering their imported field values or record ownership.
for(const fixture of ['features-cisco.conf','features-forti.conf','features-junos.conf']){
 const parsed=load('tests/fixtures/'+fixture),snapshot=JSON.stringify(parsed);
 const same=C.compareRecords(parsed,parsed,true,options);
 eq(same.unchanged,parsed.records.length,fixture+' unchanged count includes every parsed record');
 ok(same.items.every(item=>item.kind==='Unchanged'&&!item.ambiguous),fixture+' exact duplicates stay unchanged');
 eq(JSON.stringify(parsed),snapshot,fixture+' source retention');
}
console.log(checks+' side-by-side object comparison checks passed');
