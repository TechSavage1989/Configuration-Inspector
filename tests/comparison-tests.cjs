const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the real view classifier without claiming DOM/layout coverage.
const html=fs.readFileSync('webview/index.html','utf8');
const start=html.indexOf('  function renderContent(){');
const end=html.indexOf('  function preserveInput(',start);
assert.ok(start>=0&&end>start,'renderContent source is present');
const classes=new Set(),content={innerHTML:'',classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),add:name=>classes.add(name),remove:(...names)=>names.forEach(name=>classes.delete(name))}};
const state={model:{},view:'compare',comparison:null,compareMode:'records'};
const ctx={ensureSearchStyles:()=>{},mountObjectComparisonScroll:()=>{},state,el:{content},mapObserver:null,workspaceCompare:()=>'',comparePage:()=>'<comparison>',tablePage:()=>'<table>',welcome:()=>'<welcome>'};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
let checks=0;
for(const comparison of [null,{}])for(const mode of ['records','fields']){
  // Switching from an existing fixed-table view must remove its clipping class.
  state.view='raw';ctx.renderContent();assert.ok(classes.has('list-view'));checks++;
  state.view='compare';state.comparison=comparison;state.compareMode=mode;ctx.renderContent();
  assert.ok(!classes.has('list-view'),`${mode}, loaded=${!!comparison}: comparison excludes unrelated fixed-table layout`);checks++;
  assert.equal(content.innerHTML,'<comparison>');checks++;
  assert.ok(classes.has('comparison-view'),'comparison uses its own fixed workspace');checks++;
}
state.compareLoadersCollapsed=true;ctx.renderContent();assert.ok(classes.has('compare-loaders-collapsed'));checks++;
state.model=null;ctx.renderContent();assert.equal(content.innerHTML,'<comparison>','comparison opens without a parsed model');checks++;
state.view='overview';ctx.renderContent();assert.ok(!classes.has('comparison-view')&&!classes.has('compare-loaders-collapsed'),'other views retain their own layout');checks++;assert.equal(content.innerHTML,'<welcome>');checks++;
let mounted=0,cleaned=0;ctx.window={SWComparisonNavigation:{mount:()=>{mounted++;return ()=>{cleaned++;};}}};
state.view='compare';state.compareMode='records';ctx.renderContent();assert.equal(mounted,1);checks++;
ctx.renderContent();assert.equal(cleaned,1);assert.equal(mounted,2);checks+=2;
state.view='overview';ctx.renderContent();assert.equal(cleaned,2);assert.equal(state.comparisonNavigationCleanup,null);checks+=2;
// Replacing the current input preserves review state, but not a context missing
// from the new source (the visible context selector must match the filter).
ctx.setModel=model=>{state.model=model;state.scope='';state.query='';state.filter='all';state.comparison=null;};
vm.runInContext(html.slice(html.indexOf('  function activateComparisonLeft('),html.indexOf('  function mountObjectComparisonScroll(')),ctx);
Object.assign(state,{scope:'old-context',filter:'Changed',query:'port',comparison:{id:'right'}});
ctx.activateComparisonLeft({meta:{contexts:['new-context']}});
assert.equal(state.scope,'');assert.equal(state.filter,'Changed');assert.equal(state.query,'port');assert.equal(state.comparison.id,'right');checks+=4;
state.scope='new-context';ctx.activateComparisonLeft({meta:{contexts:['new-context']}});assert.equal(state.scope,'new-context');assert.equal(state.compareLeftCleared,false);checks+=2;
// Fractional nested boundaries forward only vertical movement to results;
// genuine nested scrolling, horizontal gestures and zoom keep native handling.
vm.runInContext(html.slice(html.indexOf('  function mountObjectComparisonScroll('),html.indexOf('  function comparisonModeControls(')),ctx);
let wheel;const results={scrollTop:100,clientHeight:200,scrollHeight:2000,contains:()=>true,addEventListener:(name,fn,options)=>{assert.equal(name,'wheel');assert.equal(options.passive,false);wheel=fn;}};
ctx.mountObjectComparisonScroll({querySelector:()=>results});
const nested={scrollTop:760,clientHeight:300,scrollHeight:1061};
function gesture(overrides={}){let prevented=false;wheel({target:{closest:()=>nested},deltaY:100,deltaX:0,deltaMode:0,preventDefault:()=>{prevented=true;},...overrides});return prevented;}
assert.ok(gesture());assert.equal(results.scrollTop,200);checks+=2;
nested.scrollTop=300;assert.equal(gesture(),false);assert.equal(results.scrollTop,200);checks+=2;
nested.scrollTop=0;assert.ok(gesture({deltaY:-50}));assert.equal(results.scrollTop,150);checks+=2;
assert.equal(gesture({deltaY:-50,ctrlKey:true}),false);assert.equal(gesture({deltaY:-50,shiftKey:true}),false);assert.equal(gesture({deltaY:-50,deltaX:100}),false);checks+=3;
results.scrollTop=0;assert.equal(gesture({deltaY:-50}),false);checks++;
nested.scrollTop=761;assert.ok(gesture({deltaMode:1,deltaY:2}));assert.equal(results.scrollTop,48);checks+=2;
console.log(checks+' comparison view checks passed (browser scrolling checked separately)');
