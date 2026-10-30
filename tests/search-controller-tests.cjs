const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Search=require('../webview/global_search.js');
const source=fs.readFileSync('webview/index.html','utf8');let checks=0;
function eq(actual,expected,message){checks++;assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),message);}
function ok(value,message){checks++;assert.ok(value,message);}
function functionSource(name){
 const pattern=new RegExp('^  (?:async )?function '+name+'\\(','m'),found=pattern.exec(source);assert.ok(found,name+' exists');
 const start=found.index,next=/\n  (?:async )?function \w+\(/.exec(source.slice(start+found[0].length));
 assert.ok(next,name+' has a bounded next declaration');return source.slice(start,start+found[0].length+next.index);
}
function lineContaining(text){const line=source.split('\n').find(line=>line.includes(text));assert.ok(line,text+' exists');return line;}
function setup(){
 const panels=[{scrollTop:235,scrollLeft:17},{scrollTop:420,scrollLeft:33}],calls=[],rendered=[],destinations=[];
 let resultClicks=0;
 const state={model:{meta:{filename:'Example.conf'}},hideSensitive:true,view:'compare',query:'old local query',filter:'Changed',page:3,pageSize:100,sortKey:'name',sortDir:-1,scope:'context-a',ipVersionFilter:'IPv4',nativeSection:'saved-section',nativeSourceOpen:false,rawQuery:'old raw',rawPage:4,rawWrap:false,findingsQuery:'old finding',findingsSeverity:'High',findingsArea:'system',findingsKind:'attention',findingsLimit:80,categoryTabs:{interfaces:'physical'},collapsedInterfaces:new Set(['old-parent']),searchCollapsedInterfaces:new Set(['old-search-parent']),unusedSections:new Set(['table:interfaces']),hiddenGlanceSections:new Set(['hardware:global|1:fixed']),showUnassigned:false,ruleFrom:'left',ruleTo:'right',technicalOpen:false,sourceOpen:false};
 const el={global:{value:'',disabled:false},drawer:{open:false,close(){this.open=false;}},sidebar:{classList:{remove(){}}},content:{scrollTop:81,querySelectorAll(){return panels;},querySelector(selector){return selector==='[data-gs-open]'?{click(){resultClicks++;}}:null;}}};
 const window={scrollY:45,scrollTo(x,y){this.scrollY=typeof x==='object'?x.top:y;},SWGlobalSearch:{parseQuery:Search.parseQuery,search(documents,parsed,options,controls){return new Promise(resolve=>calls.push({documents,parsed,controls,resolve}));}}};
 const ctx={state,el,window,Set,Map,AbortController,clearTimeout,setTimeout,globalTimer:undefined,C:{},document:{getElementById(){return {focus(){}};}},categoryInfo:id=>['interfaces','routes','policies'].includes(id)?{id}:null,availableTabs:()=>[{id:'physical'}],render(){rendered.push(state.view);},preserveInput(callback){callback();},globalSearchDestination(index,destination){destinations.push([index,destination]);}};
 vm.createContext(ctx);
 for(const name of ['searchSnapshot','restoreSearchSnapshot','invalidateGlobalSearch','globalSearchSession','filterGlobalResults','renderGlobalSearch','startGlobalSearch','exitGlobalSearch','view'])vm.runInContext(functionSource(name),ctx);
 vm.runInContext('function targetStep(t){'+lineContaining("if(t.hasAttribute('data-gs-target-step'))")+'}',ctx);
 vm.runInContext('function searchEnter(event){'+lineContaining("if(event.key==='Enter'&&event.target===el.global&&state.model)")+'}',ctx);
 function ready(){const session=ctx.globalSearchSession();session.indexReady=true;session.documents=[{id:'example',text:'value'}];return session;}
 return {ctx,state,el,window,panels,calls,rendered,destinations,ready,resultClicks:()=>resultClicks};
}
function found(id){return {results:[{id,category:'interfaces',context:'global',sourceKind:'field',matches:[{start:0,end:1,term:'x'}]}]};}
async function settle(){await Promise.resolve();await Promise.resolve();}
(async()=>{
 let env=setup(),{ctx,state,el,window,panels}=env,s=env.ready();
 const snapshot=s.savedView;
 eq(snapshot.view,'compare');eq(snapshot.query,'old local query');eq(snapshot.panelScroll,[{top:235,left:17},{top:420,left:33}]);
 state.categoryTabs.interfaces='changed';state.collapsedInterfaces.add('new-parent');state.hiddenGlanceSections.add('glance:global:Other interfaces');
 eq(snapshot.categoryTabs.interfaces,'physical','snapshot clones subsection selection');ok(!snapshot.hiddenGlanceSections.has('glance:global:Other interfaces'),'snapshot clones glance visibility choices');ok(!snapshot.collapsedInterfaces.has('new-parent'),'snapshot clones interface collapse set');
 Object.assign(state,{view:'raw',query:'',filter:'all',page:1,pageSize:40,scope:'',sortKey:'',rawQuery:'',rawPage:1,technicalOpen:true});
 panels.forEach(panel=>{panel.scrollTop=0;panel.scrollLeft=0;});el.content.scrollTop=0;window.scrollY=0;el.drawer.open=true;s.target={kind:'field'};s.abort=new AbortController();state.globalQuery='search term';el.global.value='search term';const generation=s.generation;
 ctx.exitGlobalSearch();
 eq(state.view,'compare','exit restores prior comparison view');eq(Array.from(state.hiddenGlanceSections),['hardware:global|1:fixed'],'return restores glance visibility choices');eq(state.query,'old local query');eq(state.filter,'Changed');eq(state.page,3);eq(state.pageSize,100);eq(state.scope,'context-a');eq(state.sortKey,'name');eq(state.rawQuery,'old raw');eq(state.rawPage,4);eq(state.technicalOpen,false);eq(state.categoryTabs.interfaces,'physical');
 eq(el.content.scrollTop,81);eq(window.scrollY,45);eq(panels.map(panel=>[panel.scrollTop,panel.scrollLeft]),[[235,17],[420,33]],'comparison pane scroll positions restored');ok(!el.drawer.open);ok(s.abort.signal.aborted);eq(s.generation,generation+1);eq(s.savedView,null);eq(s.target,null);eq(el.global.value,'');
 const renders=env.rendered.length;ctx.exitGlobalSearch();ctx.exitGlobalSearch();eq(env.rendered.length,renders,'repeated empty-input exit is a harmless no-op');eq(state.view,'compare');

 env=setup();({ctx,state,el}=env);s=env.ready();
 const old=ctx.startGlobalSearch('old');const first=env.calls[0];eq(s.status,'searching');
 const newer=ctx.startGlobalSearch('new');const second=env.calls[1];ok(first.controls.signal.aborted,'new query aborts previous search');
 first.resolve(found('stale'));await old;eq(s.results,[],'late canceled result never paints');
 second.resolve(found('fresh'));await newer;eq(s.query,'new');eq(s.results.map(result=>result.id),['fresh']);eq(s.status,'ready');
 const departure=ctx.startGlobalSearch('departing');const departureCall=env.calls[2],departureGeneration=s.generation;
 ctx.view('interfaces');ok(departureCall.controls.signal.aborted,'sidebar departure cancels outstanding work');eq(s.generation,departureGeneration+1);eq(s.savedView,null,'sidebar departure retires original return snapshot');eq(state.view,'interfaces');eq(el.global.value,'');
 departureCall.resolve(found('late-after-navigation'));await departure;ok(!s.results.some(result=>result.id==='late-after-navigation'),'navigation generation blocks late completion');eq(state.view,'interfaces','late work does not navigate back to search');
 state.query='new local interfaces filter';state.page=2;el.global.value='fresh query';let prevented=0;
 ctx.searchEnter({key:'Enter',target:el.global,preventDefault(){prevented++;}});
 eq(prevented,1);eq(s.savedView.view,'interfaces','reentry captures current section, not the old comparison');eq(s.savedView.query,'new local interfaces filter');eq(s.savedView.page,2);
 const reentry=env.calls[3];reentry.resolve(found('reentered'));await settle();eq(s.status,'ready');ctx.exitGlobalSearch();eq(state.view,'interfaces');eq(state.query,'new local interfaces filter');eq(state.page,2);

 // Enter on newly typed text must submit that text instead of opening an old row.
 env=setup();({ctx,state,el}=env);s=env.ready();state.view='search';s.status='ready';s.query='old';s.results=found('old').results;el.global.value='different';
 ctx.searchEnter({key:'Enter',target:el.global,preventDefault(){}});eq(env.resultClicks(),0,'changed query Enter cannot activate stale match');eq(env.calls[0].parsed.query,'different');env.calls[0].resolve(found('different'));await settle();
 ctx.searchEnter({key:'Enter',target:el.global,preventDefault(){}});eq(env.resultClicks(),1,'same completed query Enter opens current first match');

 env=setup();({ctx,state}=env);s=env.ready();const changing=ctx.startGlobalSearch('model-change'),changingCall=env.calls[0];
 ctx.invalidateGlobalSearch(true);state.model={meta:{filename:'Other.conf'}};const other=ctx.globalSearchSession();changingCall.resolve(found('wrong-model'));await changing;
 ok(changingCall.controls.signal.aborted);ok(state.search===other);eq(other.results,[],'different model never receives former results');eq(other.filename,'Other.conf');

 env=setup();({ctx,state}=env);s=env.ready();s.documents=[{id:'old'}];s.results=[{id:'old'}];s.allResults=s.results;s.target={index:0};s.abort=new AbortController();const before=s.generation;
 ctx.invalidateGlobalSearch(false);ok(state.search===s,'masking invalidation keeps query/options session');ok(s.abort.signal.aborted);eq(s.generation,before+1);eq(s.documents,[]);eq(s.results,[]);eq(s.allResults,[]);ok(!s.indexReady);eq(s.target,null);

 // Execute the actual delegated click branch; only its destination call is stubbed.
 s.results=[{id:'a',matches:[{},{}]},{id:'b',matches:[{}]}];s.occurrences={a:0,b:0};s.target={index:0,destination:2};
 const step=n=>({hasAttribute:name=>name==='data-gs-target-step',dataset:{gsTargetStep:String(n)}});
 ctx.targetStep(step(1));eq(env.destinations.at(-1),[0,2],'within-result next keeps chosen Object/Section destination');eq(s.occurrences.a,1);
 ctx.targetStep(step(1));eq(env.destinations.at(-1),[1,0],'cross-result next chooses new result default destination');eq(s.occurrences.b,0);
 s.target={index:1,destination:1};ctx.targetStep(step(-1));eq(env.destinations.at(-1),[0,0],'cross-result previous chooses prior result default');eq(s.occurrences.a,1);
 s.target={index:0,destination:2};ctx.targetStep(step(-1));eq(env.destinations.at(-1),[0,2],'within-result previous preserves selected destination');eq(s.occurrences.a,0);
 const callCount=env.destinations.length;ctx.targetStep(step(-1));eq(env.destinations.length,callCount,'previous at first occurrence does not navigate');
 // Group actual locations linearly by category/object without losing representations.
 env=setup();({ctx,state}=env);s=env.ready();s.allResults=[{id:'a',category:'interfaces',objectKey:'record:1',sourceKind:'field',context:'global'},{id:'b',category:'routes',objectKey:'record:2',sourceKind:'field',context:'global'},{id:'c',category:'interfaces',objectKey:'record:1',sourceKind:'object',context:'global'},{id:'d',category:'interfaces',objectKey:'record:3',sourceKind:'field',context:'global'}];ctx.filterGlobalResults();eq(s.results.map(r=>r.id),['a','c','d','b'],'category and object representations stay together without duplicate count fabrication');s.source='field';ctx.filterGlobalResults();eq(s.results.map(r=>r.id),['a','d','b'],'source filtering preserves grouping');
 ok(source.includes("if(advanced)state.search.advanced=advanced.open"),'actual options expansion captured before replacing its DOM');ok(source.includes("event.target.isConnected&&event.target===el.content.querySelector('[data-gs-advanced]')"),'queued toggles from retired option elements cannot close current controls');
 console.log(checks+' global search controller snapshot, cancellation and navigation checks passed');
})().catch(error=>{console.error(error);process.exit(1);});
