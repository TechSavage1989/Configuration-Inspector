const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),UI=require('../webview/comparison_ui.js'),{boot}=require('./harness.cjs');
const html=fs.readFileSync('webview/index.html','utf8'),real=boot().ctx;let checks=0,rendered=0,closed=0,modal='',notice='';
function ok(value,message){checks++;assert.ok(value,message);}function eq(a,b,message){checks++;assert.equal(a,b,message);}
const models=['A','B','C'].map(name=>real.SWCore.parse(`version 15.2\nhostname Example-${name}\nusername reader privilege 1 secret TEST_SECRET_ONLY_${name}\ninterface GigabitEthernet1/0/1\n description Example ${name}\n exit\n`,{filename:'imported-'+name+'.conf'}));
const foreign=real.SWCore.parse('config system global\n set hostname Example-Forti\nend\n',{filename:'example-forti.conf'}),workspace=models.slice(),state={model:models[0],comparison:models[1],compareMode:'records',hideSensitive:true,scope:'',filter:'Changed',query:'Example',compareCategory:'interfaces',page:2,sortKey:'name',sortDir:1,compareLoadersCollapsed:true};
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={state,workspace,h,icon:()=>'',window:{SWTextComparison:UI,SWImporters:real.SWImporters},el:{modal:{close:()=>closed++}},openModal:value=>{modal=value;},modalHeader:(title,subtitle)=>title+' '+subtitle,toast:value=>{notice=value;},render:()=>rendered++,setModel:model=>{if(!workspace.includes(model))workspace.push(model);state.model=model;state.comparison=null;state.filter='all';state.query='';state.hideSensitive=true;state.scope='';}};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('  function comparisonLeftModel('),html.indexOf('  function mountObjectComparisonScroll('))+html.slice(html.indexOf('  function comparisonImportedModels('),html.indexOf('  function comparePage(')),ctx);
function choose(side,model){ctx.showImportedComparison(side);ctx.selectImportedComparison(String(state.comparisonImportedChoice.models.indexOf(model)));}
const originals=models.map(m=>m.decodedText);
eq(ctx.comparisonImportedModels().length,3,'existing workspace models are deduplicated by identity');
for(const mode of ['records','fields','text']){
 Object.assign(state,{compareMode:mode,model:models[0],comparison:models[1],query:'Example',filter:'Changed',compareCategory:'interfaces',hideSensitive:true,compareLeftCleared:false});
 choose('left',models[2]);eq(state.model,models[2],mode+' left selection reuses the exact parsed model');eq(state.comparison,models[1],mode+' left selection preserves right');eq(state.compareMode,mode);eq(state.query,'Example');eq(state.filter,'Changed');eq(state.compareCategory,'interfaces');ok(state.compareLoadersCollapsed,mode+' selection retains collapsed input state');
 choose('right',models[0]);eq(state.model,models[2]);eq(state.comparison,models[0],mode+' right selection reuses an imported model');eq(state.view,'compare');eq(state.page,1,'new comparison starts at reachable first page');
 const sources=mode==='text'?UI.render(state.compareText,{hideSensitive:true,importedAvailable:true}):ctx.comparisonSources();eq((sources.match(/data-action="compare-use-imported"/g)||[]).length,4,'both sides provide expanded and collapsed imported access');ok(!sources.includes('workspace-comparison'),'no obsolete right-only selector');
 if(mode==='text'){ok(state.compareText.left.masked&&state.compareText.right.masked,'loaded selection follows masking');ok(!UI.sources(state.compareText).left.text.includes('TEST_SECRET_ONLY_'),'loaded text contains no raw secret');ok(!sources.includes('Use loaded config'),'one clear imported-selection control replaces redundant loaded-default shortcut');}
}
// Explicitly replacing one direct-text slot must not overwrite the other slot.
state.compareMode='text';state.compareText.right={name:'direct-right.txt',text:'DIRECT RIGHT',origin:'direct',masked:false,provided:true};choose('left',models[1]);eq(state.compareText.left.name,'imported-B.conf');eq(state.compareText.right.text,'DIRECT RIGHT');eq(state.compareText.right.origin,'direct');
UI.setSources(state.compareText,{left:ctx.textComparisonSource(state.model),right:ctx.textComparisonSource(state.comparison)});eq(state.compareText.right.text,'DIRECT RIGHT','mode/render refresh preserves the unrelated direct input');
choose('right',models[2]);eq(state.compareText.right.origin,'model');ok(state.compareText.right.masked);eq(state.compareText.right.name,'imported-C.conf');
state.hideSensitive=false;choose('left',models[0]);ok(state.compareText.left.text.includes('TEST_SECRET_ONLY_A'),'explicit existing unmask preference is honored');state.hideSensitive=true;UI.setSources(state.compareText,{left:ctx.textComparisonSource(state.model)});ok(!state.compareText.left.text.includes('TEST_SECRET_ONLY_A'),'masking still refreshes imported text after selection');
state.compareLeftCleared=true;choose('left',models[0]);ok(!state.compareLeftCleared,'imported selection restores an explicitly cleared side');
// Parsed comparisons preserve the existing vendor guard; direct text can use any imported source.
workspace.push(foreign);state.compareMode='records';state.model=models[0];state.comparison=models[1];ctx.showImportedComparison('right');ok(modal.includes('Different vendor')&&modal.includes(' disabled'),'incompatible parsed choice is explained and disabled');const previous=state.comparison;ctx.selectImportedComparison('3');eq(state.comparison,previous);ok(notice.includes('matching configuration'));
state.compareMode='text';choose('right',foreign);eq(state.comparison,foreign,'text selection supports an imported different-vendor source');
// The chooser exposes escaped identity metadata only, never configuration values.
models[2].meta.filename='<img src=x onerror=alert(1)>.conf';ctx.showImportedComparison('left');ok(modal.includes('&lt;img')&&!modal.includes('<img src=x'),'imported filenames are escaped');ok(!modal.includes('TEST_SECRET_ONLY_'),'chooser never serializes configuration contents');
const before=state.model;for(const invalid of ['-1','1.5','bad','999'])ctx.selectImportedComparison(invalid);eq(state.model,before,'invalid or stale indexes do not change selection');
Object.assign(state,{model:models[0],comparison:models[1]});ctx.showImportedComparison('left');workspace.splice(workspace.indexOf(models[2]),1);ctx.selectImportedComparison('2');eq(state.model,models[0],'removed workspace choice cannot select the wrong remaining model');
models.forEach((m,i)=>eq(m.decodedText,originals[i],'selection never mutates imported source'));
workspace.splice(0);state.model=null;state.comparison=null;eq(ctx.comparisonImportedModels().length,0);ok(ctx.comparisonImportedButton('left',true).includes(' disabled'),'empty workspace leaves discoverable disabled controls');const empty=UI.render(UI.create(),{importedAvailable:false});eq((empty.match(/workspace" disabled/g)||[]).length,4);
ok(rendered>0&&closed===rendered,'successful choices close the chooser and render the comparison');
ok(!html.includes('id="workspace-comparison"'),'legacy dropdown removed from live UI');
console.log(checks+' imported comparison selection checks passed');
