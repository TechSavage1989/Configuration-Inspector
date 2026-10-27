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
  assert.ok(!classes.has('list-view'),`${mode}, loaded=${!!comparison}: comparison keeps the content scroll owner`);checks++;
  assert.equal(content.innerHTML,'<comparison>');checks++;
}
state.model=null;ctx.renderContent();assert.equal(content.innerHTML,'<comparison>','comparison opens without a parsed model');checks++;
state.view='overview';ctx.renderContent();assert.equal(content.innerHTML,'<welcome>');checks++;
console.log(checks+' comparison view checks passed (browser scrolling checked separately)');
