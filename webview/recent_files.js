(function(root,factory){
 'use strict';
 var api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWRecentFiles=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 // Recent files keep only a browser file reference (File System Access handle) and
 // display metadata: file name, device name, vendor and when it was opened.
 // Configuration contents are never stored; reopening reads the original file.
 // Metadata and handles live in separate stores so listing never deserializes a
 // handle; a handle is read only when the person chooses to reopen that file.
 var DB='config-inspector-recent-files',META='entries',HANDLES='handles',LIMIT=10;
 var PENDING='config-inspector-recent-pending';
 function text(v){return v===undefined||v===null?'':String(v).trim().slice(0,200);}
 function key(name,device){return text(name).toLowerCase()+'\u0000'+text(device).toLowerCase();}
 function request(r){return new Promise(function(resolve,reject){r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(r.error);};});}
 function indexedStore(idb){
  var opening=null;
  function open(){if(!opening)opening=new Promise(function(resolve,reject){var r=idb.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(META,{keyPath:'id'});r.result.createObjectStore(HANDLES);};r.onsuccess=function(){resolve(r.result);};r.onerror=function(){opening=null;reject(r.error);};r.onblocked=function(){opening=null;reject(new Error('Recent files storage is in use by another window.'));};});return opening;}
  function run(names,mode,work){return open().then(function(db){return new Promise(function(resolve,reject){var t=db.transaction(names,mode),result;t.oncomplete=function(){resolve(result);};t.onerror=t.onabort=function(){reject(t.error||new Error('Recent files storage failed.'));};Promise.resolve(work(t)).then(function(v){result=v;},reject);});});}
  return {
   entries:function(){return run([META],'readonly',function(t){return request(t.objectStore(META).getAll());});},
   save:function(entry,handle){return run([META,HANDLES],'readwrite',function(t){t.objectStore(META).put(entry);t.objectStore(HANDLES).put(handle,entry.id);});},
   handle:function(id){return run([HANDLES],'readonly',function(t){return request(t.objectStore(HANDLES).get(id));});},
   remove:function(id){return run([META,HANDLES],'readwrite',function(t){t.objectStore(META).delete(id);t.objectStore(HANDLES).delete(id);});},
   clear:function(){return run([META,HANDLES],'readwrite',function(t){t.objectStore(META).clear();t.objectStore(HANDLES).clear();});},
   destroy:function(){return (opening||Promise.resolve(null)).catch(function(){return null;}).then(function(db){if(db)db.close();opening=null;return new Promise(function(resolve){var r=idb.deleteDatabase(DB);r.onsuccess=r.onerror=r.onblocked=function(){resolve();};});});}
  };
 }
 function memoryStore(){
  var entries=new Map(),handles=new Map();
  return {
   entries:function(){return Promise.resolve(Array.from(entries.values()).map(function(e){return Object.assign({},e);}));},
   save:function(entry,handle){entries.set(entry.id,Object.assign({},entry));handles.set(entry.id,handle);return Promise.resolve();},
   handle:function(id){return Promise.resolve(handles.get(id));},
   remove:function(id){entries.delete(id);handles.delete(id);return Promise.resolve();},
   clear:function(){entries.clear();handles.clear();return Promise.resolve();},
   destroy:function(){entries.clear();handles.clear();return Promise.resolve();}
  };
 }
 function create(options){
  options=options||{};
  var store=options.store||null,now=options.now||Date.now,counter=0,storage=options.storage,disabled=false;
  if(storage===undefined)try{storage=root&&root.localStorage;}catch(e){storage=null;}
  if(!store&&root&&root.indexedDB){try{store=indexedStore(root.indexedDB);}catch(e){store=null;}}
  // Resolved at call time so the browser's picker is always the current one.
  function picker(){return options.picker!==undefined?options.picker:root&&typeof root.showOpenFilePicker==='function'?function(o){return root.showOpenFilePicker(o);}:null;}
  function pending(value){try{if(!storage)return null;if(value===undefined)return storage.getItem(PENDING);if(value===null)storage.removeItem(PENDING);else storage.setItem(PENDING,value);}catch(e){}return null;}
  // A reopen that never finished (for example the page stopped while reading a
  // stored handle) turns the feature off instead of repeating the failure.
  var interrupted=!!pending();
  function supported(){return !disabled&&!interrupted&&!!store&&typeof picker()==='function';}
  function valid(e){return e&&typeof e.id==='string'&&typeof e.name==='string';}
  function sorted(items){return items.filter(valid).sort(function(a,b){return b.openedAt-a.openedAt;});}
  function summary(e){return {id:e.id,name:e.name,device:e.device,vendor:e.vendor,openedAt:e.openedAt};}
  function list(){if(!supported())return Promise.resolve([]);return store.entries().then(function(items){return sorted(items).slice(0,LIMIT).map(summary);});}
  async function remember(handle,meta){
   if(!supported()||!handle||handle.kind!=='file'||typeof handle.getFile!=='function')return null;
   meta=meta||{};var name=text(meta.name||handle.name),device=text(meta.device),items=sorted(await store.entries());
   var existing=items.find(function(e){return key(e.name,e.device)===key(name,device);});
   var entry={id:existing?existing.id:'recent-'+now().toString(36)+'-'+(counter++).toString(36)+'-'+Math.random().toString(36).slice(2,8),name:name,device:device,vendor:text(meta.vendor),openedAt:now()};
   await store.save(entry,handle);
   var stale=items.filter(function(e){return e.id!==entry.id;}).slice(LIMIT-1);
   for(var old of stale)await store.remove(old.id);
   return summary(entry);
  }
  async function choose(extensions){
   if(!supported())throw new Error('Recent files are not supported in this browser.');
   var accept=(extensions||[]).filter(function(x){return /^\.[a-z0-9]+$/i.test(x);});
   return picker()({multiple:true,excludeAcceptAllOption:false,types:accept.length?[{description:'Configuration exports',accept:{'text/plain':accept}}]:undefined});
  }
  async function open(id){
   if(!supported())throw new Error('Recent files are not available.');
   var entry=(await store.entries()).find(function(e){return e.id===id;});
   if(!valid(entry))throw new Error('This file is no longer in the recent files list.');
   pending(id);
   try{
    var handle=await store.handle(id),permission='granted';
    if(!handle||typeof handle.getFile!=='function')throw new Error(entry.name+' can no longer be opened from this list. Open it again from its folder.');
    if(typeof handle.queryPermission==='function')permission=await handle.queryPermission({mode:'read'});
    if(permission!=='granted'&&typeof handle.requestPermission==='function')permission=await handle.requestPermission({mode:'read'});
    if(permission!=='granted')throw new Error('Permission to read '+entry.name+' was not granted. Open it again and allow access.');
    var file;try{file=await handle.getFile();}catch(e){throw new Error(entry.name+' could not be opened. It may have been moved, renamed or deleted. Remove it from the list or open it again from its new location.');}
    return {file:file,handle:handle,item:summary(entry)};
   }finally{pending(null);}
  }
  function remove(id){return store?store.remove(id):Promise.resolve();}
  function clear(){return store?store.clear():Promise.resolve();}
  function destroy(){pending(null);return store?store.destroy():Promise.resolve();}
  function recover(){if(!interrupted)return Promise.resolve(false);disabled=true;pending(null);return destroy().then(function(){return true;});}
  return {supported:supported,interrupted:function(){return interrupted;},recover:recover,list:list,remember:remember,choose:choose,open:open,remove:remove,clear:clear,destroy:destroy};
 }
 return {create:create,memoryStore:memoryStore,LIMIT:LIMIT,PENDING_KEY:PENDING};
});
