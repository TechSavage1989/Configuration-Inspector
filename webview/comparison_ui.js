/* Local, read-only, bounded-DOM side-by-side configuration text comparison. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./comparison.js'));
  else root.SWTextComparison=factory(root.SWComparison);
})(typeof globalThis!=='undefined'?globalThis:this,function(engine){
  'use strict';
  var MAX_BYTES=5*1024*1024,PAGE_SIZE=500;
  function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function blank(){return {name:'No input selected',text:'',origin:'model',masked:true,provided:false};}
  function validateText(text){
    if(typeof text!=='string')throw new Error('Choose readable text, not a binary configuration backup.');
    if(text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Each text comparison input is limited to 5 MB. Choose a smaller text export.');
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new Error('This input contains binary control characters. Choose a decoded text export.');
    return text;
  }
  function source(value,origin){
    if(value==null)return blank();
    return {name:String(value.name||'Pasted text').slice(0,300),text:validateText(value.text),origin:origin|| (value.origin==='direct'?'direct':'model'),masked:value.masked===true,provided:value.provided!==false};
  }
  function same(a,b){return a.text===b.text&&a.name===b.name&&a.origin===b.origin&&a.masked===b.masked&&a.provided===b.provided&&a.error===b.error;}
  function create(){return {left:blank(),right:blank(),defaults:{left:blank(),right:blank()},page:0,hunk:-1,sync:true,result:null,editor:null,error:'',loadToken:0,scroll:{top:0,left:0}};}
  function invalidate(state){state.result=null;state.page=0;state.hunk=-1;state.scroll={top:0,left:0};state.pendingRow=null;state.error='';}
  function setSources(state,values,options){
    ['left','right'].forEach(function(side){
      if(!Object.prototype.hasOwnProperty.call(values||{},side))return;
      var next;try{next=source(values[side],'model');}catch(error){next=blank();next.name=String(values[side]&&values[side].name||'Loaded configuration').slice(0,300);next.error=error.message+' The loaded configuration was not truncated; choose a smaller decoded text input for this mode.';}state.defaults[side]=next;
      if((options&&options.force)||state[side].origin==='model'){
        if(!same(state[side],next)){state[side]=Object.assign({},next);invalidate(state);}
      }
    });return state;
  }
  function sources(state){return {left:Object.assign({},state.left),right:Object.assign({},state.right)};}
  function exportState(state){function saved(s){return {name:s.name,text:s.text,origin:s.origin,masked:s.masked,provided:s.provided};}return {schema:1,left:saved(state.left),right:saved(state.right)};}
  function restoreState(data){
    if(!data||data.schema!==1||!data.left||!data.right)throw new Error('Invalid text comparison workspace.');
    var state=create();['left','right'].forEach(function(side){var s=data[side];if(typeof s.name!=='string'||typeof s.text!=='string'||!['model','direct'].includes(s.origin)||typeof s.masked!=='boolean'||typeof s.provided!=='boolean')throw new Error('Invalid text comparison source.');state[side]=source(s);});return state;
  }
  function build(state){
    if(!state.left.provided||!state.right.provided)return null;
    if(!state.result){try{state.result=engine.compareText(state.left.text,state.right.text);}catch(e){state.error=e.message||'The text comparison could not be calculated.';return null;}}
    return state.result;
  }
  var css='.sw-text-comparison{--stc-line:24px;min-width:0;color:var(--ink)}.stc-inputs,.stc-viewers{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.stc-input{padding:14px;border:1px solid var(--line);border-radius:8px;min-width:0}.stc-input h3{font-size:12px;margin:0 0 6px}.stc-input strong{display:block;font-size:12px;overflow-wrap:anywhere}.stc-input small{display:block;margin:5px 0 10px;color:var(--muted)}.stc-actions,.stc-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.stc-toolbar{padding:12px 0}.stc-toolbar .stc-spacer{flex:1}.stc-note{font-size:11px;color:var(--muted);margin:10px 0;overflow-wrap:anywhere}.stc-notice{padding:10px;border:1px solid var(--line);border-radius:6px;font-size:12px;margin:10px 0}.stc-pane{min-width:0;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:var(--surface,var(--theme-surface-ffffff,white))}.stc-pane-title{font-weight:600;font-size:11px;padding:9px 12px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.stc-scroll{height:360px;height:clamp(180px,48vh,560px);overflow:auto;scrollbar-gutter:stable;overscroll-behavior:contain;outline-offset:-3px}.stc-lines{width:max-content;min-width:100%}.stc-line{display:flex;align-items:stretch;height:var(--stc-line);min-height:var(--stc-line);font:12px/var(--stc-line) Consolas,"Courier New",monospace;white-space:pre;tab-size:4}.stc-number{width:50px;flex:0 0 50px;text-align:right;padding-right:8px;color:var(--muted);border-right:1px solid var(--line);user-select:none}.stc-marker{width:22px;flex:0 0 22px;text-align:center;user-select:none}.stc-code{padding-right:16px;white-space:pre}.stc-eof{color:var(--muted);font-size:10px;font-style:italic;padding:0 10px}.stc-added{background:var(--green-soft,#e6f5ec)}.stc-added .stc-marker{color:var(--green,#207745)}.stc-removed{background:var(--red-soft,#fae9ea)}.stc-removed .stc-marker{color:var(--red,#aa3444)}.stc-changed{background:var(--amber-soft,#fff3dc)}.stc-changed .stc-marker{color:var(--amber,#97620a)}.stc-ghost{background:var(--theme-surface-f1f3f8,#f1f3f8);color:var(--muted)}.stc-active{box-shadow:inset 3px 0 var(--accent);outline:1px solid var(--accent);outline-offset:-1px}.stc-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 0}.stc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px}.stc-legend span{padding:3px 7px;border-radius:4px}.stc-editor{width:min(720px,calc(100vw - 28px));max-height:calc(100vh - 30px);overflow:auto;border:1px solid var(--line);border-radius:10px;padding:20px;background:var(--theme-surface-ffffff,white);color:var(--ink)}.stc-editor::backdrop{background:#11182788}.stc-editor h3{margin:0 0 8px}.stc-editor label{display:block;margin:12px 0 5px;font-size:12px}.stc-editor input[type=text],.stc-editor textarea{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:5px;padding:8px}.stc-editor textarea{height:220px;resize:vertical;font:12px/1.5 Consolas,monospace}.stc-editor .stc-ack{display:flex;gap:9px;align-items:flex-start;margin:12px 0}.stc-editor .stc-ack input{margin-top:3px}.stc-editor .stc-error{color:var(--red);font-size:12px;margin:10px 0}.stc-file{max-width:100%}@media(max-width:740px){.stc-inputs,.stc-viewers{gap:6px}.stc-input{padding:9px}.stc-input .button{padding:6px;font-size:10px}.stc-number{width:35px;flex-basis:35px}.stc-marker{width:17px;flex-basis:17px}.stc-pane-title{padding:7px;font-size:10px}.stc-toolbar{gap:6px}.stc-scroll{height:300px}.stc-editor{padding:14px}.stc-editor textarea{height:180px}}';
  function button(action,label,extra){return '<button type="button" class="button small" data-stc-action="'+action+'"'+(extra||'')+'>'+label+'</button>';}
  function input(state,side){var s=state[side],label=side==='left'?'Left':'Right';return '<section class="stc-input"><h3>'+label+' configuration text</h3><strong>'+escape(s.name)+'</strong><small>'+(s.provided?(s.origin==='model'?'Loaded configuration':'Direct text input')+' · '+(s.masked?'Sensitive values masked':'Unmasked text'):'Load a text file or paste text; an empty text is a valid input.')+'</small>'+(s.error?'<p class="stc-notice" role="alert">'+escape(s.error)+'</p>':'')+'<div class="stc-actions">'+button('file','Load file',' data-stc-side="'+side+'"')+button('paste','Paste text',' data-stc-side="'+side+'"')+(s.origin==='direct'&&state.defaults[side].provided?button('default','Use loaded config',' data-stc-side="'+side+'"'):'')+'</div></section>';}
  function line(row,side,index,active){var value=row[side],kind=row.kind,marker=value?(kind==='added'?'+':kind==='removed'?'−':kind==='changed'?'~':' '):'·';return '<div class="stc-line stc-'+kind+(!value?' stc-ghost':'')+(row.hunk===active&&active>=0?' stc-active':'')+'" data-stc-row="'+index+'" data-stc-kind="'+kind+'" aria-label="'+escape((value?side+' line '+value.number+' '+kind:'No corresponding '+side+' line'))+'"><span class="stc-number" aria-hidden="true">'+(value?value.number:'')+'</span><span class="stc-marker" aria-hidden="true">'+marker+'</span><span class="stc-code">'+(value?escape(value.text):'')+'</span>'+(value&&!value.terminated?'<span class="stc-eof">No newline at end of file</span>':'')+'</div>';}
  function editor(state){var e=state.editor;if(!e)return '';var label=e.side==='left'?'Left':'Right';return '<dialog class="stc-editor" aria-labelledby="stc-editor-title"><h3 id="stc-editor-title">'+label+' text input</h3><p class="stc-note">Local comparison only. Direct files and pasted text are not automatically redacted and may contain passwords or other sensitive values. Inputs are never written back to the original file.</p><label for="stc-input-name">Input name</label><input id="stc-input-name" type="text" maxlength="300" value="'+escape(e.name)+'">'+(e.mode==='file'?'<label for="stc-input-file">UTF-8 text file · maximum 5 MB</label><input class="stc-file" id="stc-input-file" type="file" accept=".txt,.conf,.cfg,.xml,.json,.set,.log,.rsc,text/*"><p class="stc-note" id="stc-file-status">'+escape(e.fileStatus||'No file selected.')+'</p>':'<label for="stc-input-text">Paste configuration text · maximum 5 MB</label><textarea id="stc-input-text" spellcheck="false">'+escape(e.text)+'</textarea>')+'<label class="stc-ack"><input id="stc-unmasked-ack" type="checkbox"'+(e.ack?' checked':'')+'><span>Show this unmasked text in my local comparison.</span></label><p class="stc-error" role="alert">'+escape(e.error||'')+'</p><div class="stc-actions">'+button('cancel','Cancel')+button('save','Use '+label.toLowerCase()+' text',(e.loading?' disabled':''))+'</div></dialog>';}
  function render(state){
    var result=build(state),output='<style>'+css+'</style><section class="sw-text-comparison" aria-label="Side-by-side configuration text comparison"><div class="stc-inputs">'+input(state,'left')+input(state,'right')+'</div><p class="stc-note">Read-only line comparison. CRLF and LF line endings are normalized; final-newline changes remain differences. Masked loaded configurations can hide secret-only differences: use object comparison for those changes.</p>';
    if(state.error)output+='<p class="stc-notice" role="alert">'+escape(state.error)+'</p>';
    output+='<div class="stc-toolbar">'+button('swap','Swap text sides')+'<label><input type="checkbox" data-stc-sync'+(state.sync?' checked':'')+'> Synchronized scrolling</label><span class="stc-spacer"></span>';
    if(result&&!result.rejected){var total=result.hunks.length;output+=button('previous','Previous difference',state.hunk<=0?' disabled':'')+'<span class="stc-note" aria-live="polite">'+(state.hunk>=0?(state.hunk+1)+' / '+total:total+' difference blocks')+'</span>'+button('next','Next difference',!total||state.hunk>=total-1?' disabled':'');}
    output+='</div>';
    if(!result){output+='<div class="stc-notice">Choose a left and a right input to compare text. Loaded configuration sources are used when available.</div>';}
    else if(result.rejected){output+='<div class="stc-notice" role="alert">Comparison could not be calculated. '+escape((result.notices||[]).join(' '))+'</div>';}
    else{
      var rows=result.rows,pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.page=Math.max(0,Math.min(state.page,pages-1));var start=state.page*PAGE_SIZE,end=Math.min(rows.length,start+PAGE_SIZE);
      output+='<div class="stc-legend" aria-label="Difference legend"><span class="stc-added">+ Added</span><span class="stc-removed">− Removed</span><span class="stc-changed">~ Changed</span><span>Unchanged</span></div>';
      (result.notices||[]).forEach(function(note){output+='<p class="stc-notice" role="note">'+escape(note)+'</p>';});
      if(!result.hunks.length)output+='<p class="stc-notice">No text differences were found'+(state.left.masked||state.right.masked?' in the displayed (possibly redacted) text':'')+'.</p>';
      output+='<div class="stc-viewers">'+['left','right'].map(function(side){return '<section class="stc-pane"><div class="stc-pane-title">'+(side==='left'?'Left':'Right')+' · '+escape(state[side].name)+'</div><div class="stc-scroll" tabindex="0" role="region" aria-label="'+(side==='left'?'Left':'Right')+' configuration text" data-stc-pane="'+side+'"><div class="stc-lines">'+rows.slice(start,end).map(function(row,i){return line(row,side,start+i,state.hunk);}).join('')+(rows.length?'':'<p class="stc-note">Empty text</p>')+'</div></div></section>';}).join('')+'</div><div class="stc-pagination"><span>'+(rows.length?start+1:0)+'–'+end+' of '+rows.length.toLocaleString()+' aligned rows · '+(state.page+1)+' / '+pages+'</span><div class="stc-actions">'+button('page-previous','Previous rows',state.page===0?' disabled':'')+button('page-next','Next rows',state.page>=pages-1?' disabled':'')+'</div></div><p class="stc-note">Only '+PAGE_SIZE+' aligned rows are rendered per page. Difference navigation crosses pages. Use Page Up / Page Down inside either pane; F7 / Shift+F7 moves between difference blocks. '+result.left.lineCount.toLocaleString()+' left lines · '+result.right.lineCount.toLocaleString()+' right lines.</p>';
    }
    return output+editor(state)+'</section>';
  }
  function mount(container,state,onChange){
    var root=container.querySelector('.sw-text-comparison');if(!root)return function(){};
    var panes=Array.from(root.querySelectorAll('[data-stc-pane]')),dialog=root.querySelector('.stc-editor'),expectedScroll=new WeakMap();
    var lines=panes.map(function(pane){return pane.querySelector&&pane.querySelector('.stc-lines');}).filter(Boolean),width=lines.reduce(function(max,line){return Math.max(max,line.scrollWidth);},0);lines.forEach(function(line){line.style.minWidth=width+'px';});
    function movePane(pane,top,left){pane.scrollTop=top;pane.scrollLeft=left;expectedScroll.set(pane,{top:pane.scrollTop,left:pane.scrollLeft});}
    function redraw(){if(root.isConnected!==false)onChange();}
    function navigate(delta){var result=build(state);if(!result||result.rejected||!result.hunks.length)return;var next=Math.max(0,Math.min(result.hunks.length-1,state.hunk+delta));state.hunk=next;state.page=Math.floor(result.hunks[next].start/PAGE_SIZE);state.pendingRow=result.hunks[next].start;redraw();}
    function saveDraft(){if(!state.editor)return;var name=root.querySelector('#stc-input-name'),text=root.querySelector('#stc-input-text'),ack=root.querySelector('#stc-unmasked-ack');if(name)state.editor.name=name.value;if(text)state.editor.text=text.value;if(ack)state.editor.ack=ack.checked;}
    root.addEventListener('input',saveDraft);
    root.addEventListener('change',function(event){
      if(event.target.matches('[data-stc-sync]')){state.sync=event.target.checked;if(state.sync&&panes.length===2){movePane(panes[1],panes[0].scrollTop,panes[0].scrollLeft);}return;}
      if(event.target.id!=='stc-input-file')return;
      var file=event.target.files&&event.target.files[0],e=state.editor;if(!file||!e)return;
      var token=++state.loadToken;saveDraft();e.loading=true;e.error='';e.fileStatus='Reading '+file.name+'…';
      var status=root.querySelector('#stc-file-status'),save=root.querySelector('[data-stc-action="save"]');if(status)status.textContent=e.fileStatus;if(save)save.disabled=true;
      Promise.resolve().then(function(){if(file.size>MAX_BYTES)throw new Error('Each text comparison input is limited to 5 MB.');return file.arrayBuffer();}).then(function(buffer){
        var text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch(error){throw new Error('This file is not readable UTF-8 text. Export or save it as UTF-8 before comparing.');}
        validateText(text);if(state.loadToken!==token||state.editor!==e)return;
        e.text=text;e.name=file.name;e.fileLoaded=true;e.fileStatus=file.name+' · '+file.size.toLocaleString()+' bytes';
      }).catch(function(error){if(state.loadToken===token&&state.editor===e){e.error=error.message||'The file could not be read.';e.fileLoaded=false;}}).finally(function(){if(state.loadToken===token&&state.editor===e){e.loading=false;redraw();}});
    });
    root.addEventListener('click',function(event){
      var target=event.target.closest('[data-stc-action]');if(!target||!root.contains(target)||target.disabled)return;
      var action=target.getAttribute('data-stc-action'),side=target.getAttribute('data-stc-side');
      if(action==='previous'||action==='next'){navigate(action==='next'?1:-1);return;}
      if(action==='page-previous'||action==='page-next'){state.page+=action==='page-next'?1:-1;state.pendingRow=null;state.scroll={top:0,left:0};redraw();return;}
      if(action==='swap'){var before=state.left;state.left=Object.assign({},state.right,{origin:'direct'});state.right=Object.assign({},before,{origin:'direct'});invalidate(state);redraw();return;}
      if(action==='default'&&(side==='left'||side==='right')){state[side]=Object.assign({},state.defaults[side]);invalidate(state);redraw();return;}
      if((action==='paste'||action==='file')&&(side==='left'||side==='right')){state.editor={side:side,mode:action,name:action==='paste'&&state[side].provided?state[side].name:action==='paste'?'Pasted '+side+' text':'Text file',text:action==='paste'&&state[side].provided?state[side].text:'',ack:false,loading:false,fileLoaded:false};state.loadToken++;redraw();return;}
      if(action==='cancel'){state.loadToken++;state.editor=null;redraw();return;}
      if(action==='save'&&state.editor){saveDraft();var e=state.editor;try{if(e.loading)throw new Error('Wait for the file to finish loading.');if(e.mode==='file'&&!e.fileLoaded)throw new Error('Choose a readable UTF-8 text file first.');if(!e.ack)throw new Error('Confirm that you want to show this unmasked text locally.');state[e.side]=source({name:e.name,text:e.text,masked:false,provided:true},'direct');state.editor=null;state.loadToken++;invalidate(state);}catch(error){e.error=error.message;}redraw();}
    });
    root.addEventListener('keydown',function(event){if(event.key==='F7'&&!state.editor){event.preventDefault();navigate(event.shiftKey?-1:1);}});
    panes.forEach(function(pane){pane.addEventListener('scroll',function(){var expected=expectedScroll.get(pane);expectedScroll.delete(pane);if(expected&&expected.top===pane.scrollTop&&expected.left===pane.scrollLeft)return;state.scroll={top:pane.scrollTop,left:pane.scrollLeft};if(!state.sync)return;panes.forEach(function(other){if(other!==pane&&(Math.abs(other.scrollTop-pane.scrollTop)>1||Math.abs(other.scrollLeft-pane.scrollLeft)>1))movePane(other,pane.scrollTop,pane.scrollLeft);});});});
    panes.forEach(function(pane){movePane(pane,state.pendingRow==null?state.scroll.top:(state.pendingRow%PAGE_SIZE)*24,state.scroll.left);});state.pendingRow=null;
    if(dialog){dialog.addEventListener('cancel',function(event){event.preventDefault();state.loadToken++;state.editor=null;redraw();});dialog.showModal();var field=root.querySelector(state.editor.mode==='file'?'#stc-input-file':'#stc-input-text');if(field)field.focus();}
    return function(){state.loadToken++;};
  }
  return {create:create,setSources:setSources,sources:sources,exportState:exportState,restoreState:restoreState,render:render,mount:mount,validateText:validateText,PAGE_SIZE:PAGE_SIZE,MAX_BYTES:MAX_BYTES};
});
