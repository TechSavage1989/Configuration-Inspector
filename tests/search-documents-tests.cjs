const assert=require('node:assert/strict'),{boot}=require('./harness.cjs'),S=require('../webview/search_documents.js');
const {ctx,load}=boot(),C=ctx.SWCore,I=ctx.SWImporters;let checks=0;
function ok(value,message){checks++;assert(value,message);}
function eq(value,expected,message){checks++;assert.deepEqual(JSON.parse(JSON.stringify(value)),JSON.parse(JSON.stringify(expected)),message);}
function options(extra={}){return {core:C,importers:I,hidden:true,...extra};}
async function main(){
 const names=['features-sonic.txt','network-forti.conf','network-cisco.conf','network-junos.conf','network-meraki.json','network-palo.xml','network-sophos.xml','mikrotik.rsc','fundamentals-aos.conf'];
 const vendors=new Set();
 for(const filename of names){
  const model=load('tests/fixtures/'+filename),before=JSON.stringify(model),sections=I.configurationSections(model),source=I.configurationText(model,true),findings=C.analyzeConfiguration(model).findings;
  const result=await S.build(model,options({sections,sourceText:source,findings,recordFacts:r=>ctx.SWFeatures.facts(r)}));vendors.add(model.meta.vendorId);
  const docs=result.documents,fields=docs.filter(d=>d.sourceKind==='field'),objects=docs.filter(d=>d.sourceKind==='object'),native=docs.filter(d=>d.sourceKind==='section'),raw=docs.filter(d=>d.sourceKind==='source');
  eq(fields.length,model.entries.length,filename+' includes every original field');
  eq(objects.length,model.records.length,filename+' includes every parsed projection');
  eq(native.length,sections.length,filename+' includes real native headings');
  eq(docs.filter(d=>d.sourceKind==='finding').length,findings.length,filename+' includes all configuration findings');
  ok(fields.every((d,i)=>d.entryIndex===i&&d.destinations[0].entryIndex===i),filename+' stable original-entry navigation');
  ok(objects.every((d,i)=>d.destinations[0].recordId===model.records[i].id||d.destinations[0].recordIndex===i),filename+' object destinations retain identity');
  eq(new Set(docs.map(d=>d.id)).size,docs.length,filename+' no duplicate document IDs');
  ok(!fields.some(d=>d.destinations.some(t=>t.kind==='source')),filename+' no inferred raw provenance from ordinals');
  eq(raw.length,source.length?source.split(/\r\n|\r|\n/).length-Number(/[\r\n]$/.test(source)):0,filename+' all safe source lines included');
  ok(raw.every((d,i)=>d.destinations[0].lineStart===i+1),filename+' source navigation follows displayed line order');
  eq(result.coverage.countUnit,'representations',filename+' honest representation counting');
  eq(JSON.stringify(model),before,filename+' indexing is read-only');
 }
 eq(vendors.size,9,'nine actual vendor families covered');

 const shared={key:'interface/description',base:'description',value:'needle needle',recordId:'r1',sourceLineStart:2,sourceLineEnd:2},duplicate={...shared,value:'another needle'},secret={key:'password',base:'password',value:'NEVER_EXPORT_SEARCH_SECRET',recordId:'r1'};
 const model={meta:{vendorId:'test'},entries:[shared,duplicate,secret],records:[{id:'r1',name:'needle interface',category:'interfaces',scope:'blue',fields:[shared,duplicate,secret],summary:{description:'needle needle',copied:'NEVER_EXPORT_SEARCH_SECRET',password:'UNKNOWN_SUMMARY_SECRET'}},{id:'r2',name:'needle projection',category:'vlans',scope:'red',fields:[shared],summary:{vlan:'42'}}]};
 const sections=[{id:'blue|interfaces',name:'Native needle interfaces',scope:'blue',fields:[shared,duplicate,secret],recordIds:['r1']}];
 const finding={id:'f1',title:'needle finding',kind:'Issue',scope:'blue',recordIds:['r1'],detail:'copied NEVER_EXPORT_SEARCH_SECRET',evidence:['needle evidence'],resolution:['Keep NEVER_EXPORT_SEARCH_SECRET private'],sourceEvidence:[{key:'password',value:'UNKNOWN_EVIDENCE_SECRET'}]};
 const buildOptions=options({sourceText:'hostname example\r\nneedle needle\r\nunsupported ARCHIVE_ONLY_SENTINEL\r\n',sections,findings:[finding],sourceLinePreserved:true,recordFacts:r=>[{label:'Description',value:r.name},{label:'Password',value:'UNKNOWN_FACT_SECRET'}]});
 let result=await S.build(model,buildOptions),docs=result.documents;
 eq(result.coverage.fields,3,'shared projection never duplicates an original field');
 eq(docs.filter(d=>d.sourceKind==='field').length,3,'duplicate keys still retain separate original entries');
 eq(docs.find(d=>d.id==='field:0').destinations.map(t=>t.kind),['field','object','object','section','source'],'verified alternate destinations retain all referring objects');
 eq(docs.find(d=>d.id==='field:1').destinations[0].entryIndex,1,'repeated key keeps correct entry index');
 eq(docs.find(d=>d.id==='field:0').destinations.at(-1),{kind:'source',lineStart:2,lineEnd:2},'only actual line metadata grants source alternative');
 ok(docs.some(d=>d.sourceKind==='source'&&d.text==='unsupported ARCHIVE_ONLY_SENTINEL'),'raw-only unsupported line is searchable without parsed record');
 ok(docs.filter(d=>d.sourceKind==='section').some(d=>d.text.includes('another needle')),'section-only scope searches actual native field content, not only heading');
 eq(docs.find(d=>d.sourceKind==='section').destinations[0].sectionId,sections[0].id,'native content match opens the actual enclosing section');
 ok(docs.find(d=>d.sourceKind==='finding').configurationDerived,'findings explicitly marked as derived');
 ok(!JSON.stringify(result).includes('NEVER_EXPORT_SEARCH_SECRET'),'known secret absent from docs, notes, metadata and findings');
 ok(!JSON.stringify(result).includes('UNKNOWN_SUMMARY_SECRET'),'sensitive derived property masked by key');
 ok(!JSON.stringify(result).includes('UNKNOWN_EVIDENCE_SECRET'),'sensitive evidence key/value pair masked');
 ok(!JSON.stringify(result).includes('UNKNOWN_FACT_SECRET'),'sensitive friendly fact label masked');
 eq(docs.filter(d=>d.sourceKind==='object').map(d=>d.context),['blue','red'],'contexts remain distinct');
 ok(result.notes.some(n=>n.includes('not unique')),'overlapping representations explicitly documented');
 result=await S.build(model,{...buildOptions,hidden:false});
 ok(JSON.stringify(result).includes('NEVER_EXPORT_SEARCH_SECRET'),'explicitly revealed mode includes values');
 ok(JSON.stringify(result).includes('UNKNOWN_FACT_SECRET'),'explicitly revealed facts remain searchable');
 result=await S.build(model,{...buildOptions,sourceLinePreserved:false});
 ok(!result.documents.filter(d=>d.sourceKind!=='source').some(d=>d.destinations.some(t=>t.kind==='source')),'normalized source never receives fabricated original-line links');

 const commandModel=C.parse('hostname example\nusername admin password 0 SEARCH_COMMAND_SECRET\ninterface GigabitEthernet1/0/1\n description SEARCH_COMMAND_SECRET\n exit\n',{filename:'example.conf'});
 result=await S.build(commandModel,options({recordFacts:()=>[{label:'Copied note',value:'SEARCH_COMMAND_SECRET'}]}));
 ok(!JSON.stringify(result).includes('SEARCH_COMMAND_SECRET'),'CLI token secret cannot leak through innocent derived label or non-secret description');
 const routerModel=C.parse('/system identity\nset name=example\n/user\nadd name=operator password="SEARCH_ROUTER_SECRET"\n/interface bridge\nadd name=SEARCH_ROUTER_SECRET\n',{filename:'example.rsc'});
 result=await S.build(routerModel,options());
 ok(!JSON.stringify(result).includes('SEARCH_ROUTER_SECRET'),'quoted assignment secret removed from source, object names and paths');
 commandModel.records[0].summary.copied='search_command_secret';result=await S.build(commandModel,options());ok(!JSON.stringify(result).toLowerCase().includes('search_command_secret'),'case-changed derived copies cannot reveal a hidden value through case-insensitive search');

 const headerModel={entries:[{key:'headers[0]/name',base:'name',value:'Authorization'},{key:'headers[0]/value',base:'value',value:'SEARCH_HEADER_SECRET'}],records:[{id:'SEARCH_HEADER_SECRET',name:'SEARCH_HEADER_SECRET',scope:'SEARCH_HEADER_SECRET',category:'system',fields:[],summary:{comment:'SEARCH_HEADER_SECRET'}}]};
 result=await S.build(headerModel,options({sourceText:'[REDACTED]',sections:[{id:'SEARCH_HEADER_SECRET',name:'SEARCH_HEADER_SECRET',fields:[]}],findings:[{id:'SEARCH_HEADER_SECRET',title:'Copied SEARCH_HEADER_SECRET'}]}));
 ok(!JSON.stringify(result).includes('SEARCH_HEADER_SECRET'),'name/value credential pairs and all navigation metadata are safe');
 eq(result.documents.find(d=>d.sourceKind==='object').destinations[0],{kind:'object',recordIndex:0,recordId:''},'unsafe record IDs use original numeric identity');
 eq(result.documents.find(d=>d.sourceKind==='section').destinations[0].sectionIndex,0,'unsafe native section ID retains numeric identity');
 eq(result.documents.find(d=>d.sourceKind==='finding').destinations[0].findingIndex,0,'unsafe finding ID retains numeric identity');
 const encodedSecret='SEARCH_SECRET / + test',encodedModel={entries:[{key:'password',base:'password',value:encodedSecret},{key:'description',base:'description',value:encodeURIComponent(encodedSecret)}],records:[]};
 result=await S.build(encodedModel,options({sourceText:'',sections:[]}));ok(!JSON.stringify(result).includes(encodeURIComponent(encodedSecret)),'encoded copies of known secret also masked');
 const unicodeSecret='SEARCH_SECRET_\ud800',unicodeModel={entries:[{key:'password',base:'password',value:unicodeSecret}],records:[]};result=await S.build(unicodeModel,options({sourceText:'',sections:[]}));eq(result.documents[0].text,'password\n[REDACTED]','malformed Unicode secret safely masks without URI-encoding error');
 const budget={entries:[{key:'certificate-data',base:'certificate-data',value:'X'.repeat(40000)},{key:'description',base:'description',value:'PUBLIC_VALUE'}],records:[]};
 result=await S.build(budget,options({sourceText:'PUBLIC_VALUE',sections:[]}));eq(result.coverage.conservativeMasking,true,'pathological credential length has bounded fail-closed masking');
 eq(result.documents.length,3,'bounded masking does not drop destination documents');ok(!JSON.stringify(result).includes('PUBLIC_VALUE'),'budget fallback never leaks through unclassified copied text');ok(result.notes.some(n=>n.includes('bounded index budget')),'conservative fallback clearly disclosed');
 const badSpan={...shared,sourceLineStart:0,sourceLineEnd:9999};result=await S.build({entries:[badSpan],records:[]},options({sourceText:'line',sourceLinePreserved:true,sections:[]}));ok(!result.documents[0].destinations.some(d=>d.kind==='source'),'invalid or out-of-range provenance never used');
 const projected={entries:[shared],records:[{id:'projection',name:'Mapped',sourceFieldKeys:[shared.key],fields:[],summary:{}}]};result=await S.build(projected,options({sourceText:'',sections:[]}));ok(result.documents[0].destinations.some(d=>d.kind==='object'&&d.recordId==='projection'),'explicit sourceFieldKeys retain verified projection destination');

 const noSource=await S.build({entries:[],records:[]},options({importers:null}));
 eq(noSource.documents,[],'empty model has no invented data');eq(noSource.coverage.sourceAvailable,false,'missing raw source disclosed');
 const empty=await S.build({entries:[],records:[]},options({sourceText:''}));eq(empty.coverage.sourceLines,0,'empty source has zero lines');
 const types=await S.build({entries:[],records:[]},options({sourceText:'a\rb\r\nc\n'}));eq(types.documents.map(d=>d.text),['a','b','c'],'CR CRLF and LF have correct displayed line numbering');
 const html=await S.build({entries:[{key:'<script>',value:'<img src=x onerror=alert(1)>',base:'text'}],records:[]},options({sections:[],sourceText:''}));
 eq(html.documents[0].text,'<script>\n<img src=x onerror=alert(1)>','documents are plain text, not generated markup');

 const ac=new AbortController();ac.abort();let aborted=false;try{await S.build(model,{...buildOptions,signal:ac.signal});}catch(e){aborted=e.name==='AbortError';}ok(aborted,'already cancelled build stops without returning partial index');
 const large={entries:Array.from({length:1800},(_,i)=>({key:'field'+i,base:'field',value:'needle '+i})),records:[]},controller=new AbortController();let progress=0;
 try{await S.build(large,options({sections:[],sourceText:'',chunkSize:20,signal:controller.signal,onProgress(){progress++;controller.abort();}}));assert.fail('cancelled build must reject');}catch(e){eq(e.name,'AbortError','chunk cancellation rejects whole index');}eq(progress,1,'cancellation stops progress updates');
 const phases=new Set();result=await S.build(large,options({sections:[],sourceText:'',chunkSize:200,onProgress:p=>phases.add(p.phase)}));eq(result.documents.length,1800,'chunked build never drops entries');ok(phases.has('masking')&&phases.has('fields')&&phases.has('complete'),'progress reports safe phase/count information');
 console.log(checks+' search document coverage and redaction checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
