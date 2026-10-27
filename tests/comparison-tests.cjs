const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the real view classifier without claiming DOM/layout coverage.
const html=fs.readFileSync('webview/index.html','utf8');
const start=html.indexOf('  function renderContent(){');
const end=html.indexOf('  function preserveInput(',start);
assert.ok(start>=0&&end>start,'renderContent source is present');
const classes=new Set(),content={innerHTML:'',classList:{add:name=>classes.add(name),remove:(...names)=>names.forEach(name=>classes.delete(name))}};
const state={model:{},view:'compare',comparison:null,compareMode:'records'};
const ctx={state,el:{content},mapObserver:null,workspaceCompare:()=>'',comparePage:()=>'<comparison>',tablePage:()=>'<table>',welcome:()=>'<welcome>'};
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
// Replacing the current input preserves review state, but not a context missing
// from the new source (the visible context selector must match the filter).
ctx.setModel=model=>{state.model=model;state.scope='';state.query='';state.filter='all';state.comparison=null;};
vm.runInContext(html.slice(html.indexOf('  function activateComparisonLeft('),html.indexOf('  function comparisonModeControls(')),ctx);
Object.assign(state,{scope:'old-context',filter:'Changed',query:'port',comparison:{id:'right'}});
ctx.activateComparisonLeft({meta:{contexts:['new-context']}});
assert.equal(state.scope,'');assert.equal(state.filter,'Changed');assert.equal(state.query,'port');assert.equal(state.comparison.id,'right');checks+=4;
state.scope='new-context';ctx.activateComparisonLeft({meta:{contexts:['new-context']}});assert.equal(state.scope,'new-context');assert.equal(state.compareLeftCleared,false);checks+=2;
console.log(checks+' comparison view checks passed (browser scrolling checked separately)');
