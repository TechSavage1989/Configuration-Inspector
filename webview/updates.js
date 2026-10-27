(function(root,factory){'use strict';root.SWUpdates=factory(root);})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  var repository='https://github.com/TechSavage1989/Configuration-Inspector',maxWorkspace=96*1024*1024;
  function snapshot(core,workspace,state){
    var models=workspace.slice(),count=models.length;
    function index(model){if(!model)return -1;var i=models.indexOf(model);if(i<0){i=models.length;models.push(model);}return i;}
    var selected=index(state.model),comparison=index(state.comparison);
    var result={schema:1,count:count,selected:selected,comparison:comparison,models:models.map(function(m){return {filename:m.meta.filename||'Configuration',snapshot:core.exportJSON(m,false),decodedText:m.decodedText||''};}),view:state.view,scope:state.scope||'',categoryTabs:state.categoryTabs||{},showUnassigned:!!state.showUnassigned,showEmpty:!!state.showEmpty};
    result.compareMode=['records','text','fields'].includes(state.compareMode)?state.compareMode:'records';
    if(state.compareText){if(!root.SWTextComparison)throw new Error('Text comparison cannot be preserved. Close it before updating.');if(state.compareText.editor)throw new Error('Save or cancel the pending text comparison input before updating.');result.textComparison=root.SWTextComparison.exportState(state.compareText);}
    var text=JSON.stringify(result);if(new TextEncoder().encode(text).length>maxWorkspace)throw new Error('The open workspace is too large to preserve during an update. Export and close configurations before restarting.');return text;
  }
  async function decodeWorkspace(data,parse){
    if(!data||data.schema!==1||!Array.isArray(data.models)||!Number.isInteger(data.count)||data.count<0||data.count>data.models.length||!Number.isInteger(data.selected)||!Number.isInteger(data.comparison))throw new Error('Invalid update workspace.');
    if(data.selected< -1||data.selected>=data.models.length||data.comparison< -1||data.comparison>=data.models.length||data.count&&data.selected<0)throw new Error('Invalid workspace selection.');
    var models=[];
    for(var item of data.models){if(!item||typeof item.snapshot!=='string'||typeof item.filename!=='string'||typeof item.decodedText!=='string')throw new Error('Invalid configuration in the update workspace.');var model=await parse(item.snapshot,{filename:item.filename});model.decodedText=item.decodedText;models.push(model);}
    var compareText=null;if(data.textComparison!==undefined){if(!root.SWTextComparison)throw new Error('The text comparison restorer is unavailable.');compareText=root.SWTextComparison.restoreState(data.textComparison);}
    return {compareText:compareText,compareMode:['records','text','fields'].includes(data.compareMode)?data.compareMode:'records',models:models.slice(0,data.count),model:data.selected<0?null:models[data.selected],comparison:data.comparison<0?null:models[data.comparison],view:typeof data.view==='string'?data.view:'overview',scope:typeof data.scope==='string'?data.scope:'',categoryTabs:data.categoryTabs&&typeof data.categoryTabs==='object'&&!Array.isArray(data.categoryTabs)?data.categoryTabs:{},showUnassigned:!!data.showUnassigned,showEmpty:!!data.showEmpty};
  }
  function create(options){
    options=options||{};var bridge=options.bridge||root.chrome&&root.chrome.webview,native=!!(bridge&&typeof bridge.postMessage==='function'&&typeof bridge.addEventListener==='function'),state={current:'5.17.2',state:'idle',message:'',automatic:true,busy:false,ready:false,available:false},handlers={},restoring=false,installing=false;
    var commands=['update-ui-ready','update-status','update-check','update-download','update-later','update-auto-on','update-auto-off','update-restored','update-restore-failed'];
    function request(command){if(!native)throw new Error('Built-in updates are available in the Windows desktop edition.');if(!commands.includes(command))throw new Error('Unknown update action.');bridge.postMessage(command);}
    if(native)bridge.addEventListener('message',async function(event){
      var data=event.data;if(!data||typeof data!=='object')return;
      if(data.type==='config-inspector-updates'){
        if(!['idle','checking','current','available','downloading','ready','installing','error','unavailable'].includes(data.state)||typeof data.busy!=='boolean'||typeof data.automatic!=='boolean'||typeof data.message!=='string')return;
        state=Object.assign({},data);if(data.state!=='installing')installing=false;if(handlers.change)handlers.change(state);
      }else if(data.type==='config-inspector-update-workspace'&&!restoring){
        restoring=true;
        try{if(!handlers.restore)throw new Error('The workspace restoration handler is unavailable.');await handlers.restore(data.workspace);request('update-restored');}
        catch(e){if(handlers.error)handlers.error('Workspace restoration failed. The updater will restore the previous version. '+e.message);request('update-restore-failed');}
      }
    });
    return {native:native,state:function(){return state;},request:request,start:function(value){handlers=value||{};if(native)request('update-ui-ready');},install:function(workspace){if(!native||installing)throw new Error('An update installation is already in progress or unavailable.');if(typeof workspace!=='string'||new TextEncoder().encode(workspace).length>maxWorkspace)throw new Error('The workspace exceeds the update limit.');JSON.parse(workspace);installing=true;try{bridge.postMessage('update-install\n'+workspace);}catch(e){installing=false;throw e;}},installing:function(){return installing;}};
  }
  return {create:create,manager:create(),snapshot:snapshot,decodeWorkspace:decodeWorkspace,repository:repository};
});
