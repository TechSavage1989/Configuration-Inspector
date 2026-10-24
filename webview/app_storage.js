(function(root,factory){'use strict';root.SWAppStorage=factory(root);})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  var KEYS=['config-studio.theme','config-inspector-device-specs-v1','config-inspector-auto-specs'];
  function create(options){
    options=options||{};var bridge=options.bridge||root.chrome&&root.chrome.webview,storage=options.storage,pending=new Map();
    try{if(storage===undefined)storage=root.localStorage;}catch(e){}
    var native=!!(bridge&&typeof bridge.postMessage==='function'&&typeof bridge.addEventListener==='function');
    if(native)bridge.addEventListener('message',function(event){var data=event.data;if(!data||data.type!=='config-inspector-storage'||typeof data.action!=='string')return;var task=pending.get(data.action);if(!task)return;pending.delete(data.action);clearTimeout(task.timer);if(typeof data.ok!=='boolean'){task.reject(new Error('Invalid storage response'));return;}task.resolve(data);});
    function request(command){
      if(!native)return Promise.reject(new Error('Storage folders are managed by your browser.'));
      if(!['storage-info','storage-choose','storage-default','storage-delete-all'].includes(command))return Promise.reject(new Error('Unknown storage action'));
      if(pending.size)return Promise.reject(new Error('Another storage action is in progress.'));
      return new Promise(function(resolve,reject){var timer=setTimeout(function(){pending.delete(command);reject(new Error('The app host did not respond. Reopen App settings and try again.'));},command==='storage-choose'?600000:60000);pending.set(command,{resolve:resolve,reject:reject,timer:timer});try{bridge.postMessage(command);}catch(e){clearTimeout(timer);pending.delete(command);reject(e);}});
    }
    function clearLocal(){var failed=[];KEYS.forEach(function(key){try{if(storage)storage.removeItem(key);}catch(e){failed.push(key);}});return !failed.length;}
    return {native:native,request:request,clearLocal:clearLocal};
  }
  return {create:create,manager:create()};
});
