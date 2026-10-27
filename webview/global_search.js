(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWGlobalSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var MAX_QUERY=2048,MAX_TERMS=32,MAX_TERM=512,SCAN_CHUNK=32768;
 var identifier=/[\p{L}\p{N}\p{M}_]/u;
 function parseQuery(query,options){
  options=options||{};query=query==null?'':String(query);
  var parsed={ok:false,error:'',query:query,positive:[],negative:[],mode:options.mode||'all',caseSensitive:!!options.caseSensitive,wholeWord:!!options.wholeWord,regex:false};
  function fail(message){parsed.error=message;return parsed;}
  if(options.regex)return fail('Regular expressions are not supported. Search text is literal.');
  if(parsed.mode!=='all'&&parsed.mode!=='any')return fail('Choose either All terms or Any term.');
  if(query.length>MAX_QUERY)return fail('The query is too long. Use at most '+MAX_QUERY+' characters.');
  var i=0,count=0;
  while(i<query.length){
   while(i<query.length&&/\s/u.test(query[i]))i++;
   if(i===query.length)break;
   var excluded=false,value='';
   if(query[i]==='-'&&i+1<query.length&&!/\s/u.test(query[i+1])){excluded=true;i++;}
   if(query[i]==='"'){
    i++;var closed=false;
    while(i<query.length){
     var char=query[i++];
     if(char==='"'){closed=true;break;}
     if(char==='\\'&&i<query.length&&(query[i]==='"'||query[i]==='\\'))char=query[i++];
     value+=char;
    }
    if(!closed)return fail('A quoted phrase is missing its closing double quote.');
    if(i<query.length&&!/\s/u.test(query[i]))return fail('Put a space between a quoted phrase and the next term.');
    if(!value.length)return fail('An empty quoted phrase cannot be searched.');
   }else{
    while(i<query.length&&!/\s/u.test(query[i])){
     if(query[i]==='"')return fail('Start a quoted phrase at the beginning of a term.');
     value+=query[i++];
    }
   }
   count++;if(count>MAX_TERMS)return fail('Use at most '+MAX_TERMS+' terms or quoted phrases.');
   if(value.length>MAX_TERM)return fail('A search term is too long. Use at most '+MAX_TERM+' characters per term or phrase.');
   var list=excluded?parsed.negative:parsed.positive,key=parsed.caseSensitive?value:value.toLowerCase();
   if(!list.some(function(term){return (parsed.caseSensitive?term:term.toLowerCase())===key;}))list.push(value);
  }
  if(!parsed.positive.length)return fail(parsed.negative.length?'Include a word or phrase to find, not only exclusions.':'Enter a word or phrase to search.');
  parsed.ok=true;return parsed;
 }
 function escapePattern(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
 function previousCharacter(text,index){
  if(index<=0)return '';
  var start=index-1,code=text.charCodeAt(start);
  if(code>=0xDC00&&code<=0xDFFF&&start>0){var first=text.charCodeAt(start-1);if(first>=0xD800&&first<=0xDBFF)start--;}
  return text.slice(start,index);
 }
 function nextCharacter(text,index){return index>=text.length?'':String.fromCodePoint(text.codePointAt(index));}
 function boundary(text,start,end){return !identifier.test(previousCharacter(text,start))&&!identifier.test(nextCharacter(text,end));}
 // Internal regexes contain escaped literals only. User regular expressions are
 // never executed. Unicode matching retains offsets in the original UTF-16 text.
 // A null yield marks a bounded scan boundary, including long no-match inputs.
 function* occurrences(text,term,parsed){
  var expression=new RegExp(escapePattern(term),'gu'+(parsed.caseSensitive?'':'i'));
  for(var start=0;start<text.length;){
   var end=Math.min(start+SCAN_CHUNK,text.length),window=text.slice(start,Math.min(text.length,end+term.length-1)),found,consumed=start;
   expression.lastIndex=0;
   while((found=expression.exec(window))!==null){
    var from=start+found.index,to=from+found[0].length;
    if(from>=end)break;
    consumed=to;
    if(!parsed.wholeWord||boundary(text,from,to))yield {start:from,end:to,term:term};
   }
   start=Math.max(end,consumed);
   yield null;
  }
 }
 function nextSync(iterator){var item;do{item=iterator.next();}while(!item.done&&item.value===null);return item.done?null:item.value;}
 function firstHead(heads){
  var best=-1;
  for(var i=0;i<heads.length;i++)if(heads[i]&&(best<0||heads[i].start<heads[best].start||heads[i].start===heads[best].start&&heads[i].end>heads[best].end))best=i;
  return best;
 }
 function validParsed(parsed){return !!(parsed&&parsed.ok&&Array.isArray(parsed.positive)&&parsed.positive.length&&Array.isArray(parsed.negative));}
 function match(text,parsed){
  text=text==null?'':String(text);if(!validParsed(parsed)||!text)return [];
  for(var n=0;n<parsed.negative.length;n++)if(nextSync(occurrences(text,parsed.negative[n],parsed)))return [];
  var iterators=parsed.positive.map(function(term){return occurrences(text,term,parsed);}),heads=iterators.map(nextSync);
  if(parsed.mode==='all'&&heads.some(function(head){return !head;}))return [];
  var matches=[],lastEnd=-1,best;
  while((best=firstHead(heads))>=0){
   var found=heads[best];if(found.start>=lastEnd){matches.push(found);lastEnd=found.end;}
   heads[best]=nextSync(iterators[best]);
  }
  return matches;
 }
 function abortError(){var error=new Error('Search canceled.');error.name='AbortError';return error;}
 function checkAbort(signal){if(signal&&signal.aborted)throw abortError();}
 async function search(documents,query,options,controls){
  options=options||{};controls=controls||{};
  var signal=controls.signal,onProgress=typeof controls.onProgress==='function'?controls.onProgress:null;
  checkAbort(signal);
  var parsed=typeof query==='object'&&query!==null?query:parseQuery(query,options);
  var output={ok:validParsed(parsed),error:parsed&&parsed.error||'',query:parsed,results:[],occurrences:0,locations:0,objects:0,configurations:0,documentsScanned:0,totalDocuments:0};
  if(!output.ok){if(!output.error)output.error='Enter a valid search query.';return output;}
  if(!Array.isArray(documents))throw new TypeError('Search documents must be an array.');
  output.totalDocuments=documents.length;
  var objectIds=new Set(),configurationIds=new Set(),lastYield=Date.now(),lastProgress=0,steps=0;
  var chunkSize=Number.isFinite(options.chunkSize)?Math.max(1,Math.min(250,Math.floor(options.chunkSize))):50;
  var timeSlice=Number.isFinite(options.timeSliceMs)?Math.max(1,Math.min(32,options.timeSliceMs)):8;
  function progress(force){
   var now=Date.now();
   if(onProgress&&(force||now-lastProgress>=50)){
    lastProgress=now;
    onProgress({documentsScanned:output.documentsScanned,totalDocuments:output.totalDocuments,occurrences:output.occurrences,locations:output.locations,objects:output.objects,configurations:output.configurations});
    checkAbort(signal);
   }
  }
  async function tick(force){
   checkAbort(signal);steps++;
   if(force||steps>=2048||Date.now()-lastYield>=timeSlice){
    progress(false);await new Promise(function(resolve){setTimeout(resolve,0);});
    checkAbort(signal);steps=0;lastYield=Date.now();
   }
  }
  async function nextAsync(iterator){
   var item;
   do{item=iterator.next();await tick(false);}while(!item.done&&item.value===null);
   return item.done?null:item.value;
  }
  async function matchDocument(text){
   if(!text)return [];
   for(var n=0;n<parsed.negative.length;n++)if(await nextAsync(occurrences(text,parsed.negative[n],parsed)))return [];
   var iterators=parsed.positive.map(function(term){return occurrences(text,term,parsed);}),heads=[];
   for(var i=0;i<iterators.length;i++){
    heads[i]=await nextAsync(iterators[i]);
    if(!heads[i]&&parsed.mode==='all')return [];
   }
   var matches=[],lastEnd=-1,best;
   while((best=firstHead(heads))>=0){
    var found=heads[best];if(found.start>=lastEnd){matches.push(found);lastEnd=found.end;}
    heads[best]=await nextAsync(iterators[best]);
   }
   return matches;
  }
  progress(true);await tick(true);
  for(var index=0;index<documents.length;index++){
   checkAbort(signal);
   var document=documents[index];
   if(!document||typeof document!=='object')throw new TypeError('Each search document must be an object.');
   var text=document.text==null?'':String(document.text),matches=await matchDocument(text);
   if(matches.length){
    output.results.push({...document,text:text,matches:matches});output.occurrences+=matches.length;output.locations++;
    if(document.objectId!==undefined&&document.objectId!==null&&document.objectId!=='')objectIds.add(JSON.stringify([document.configurationId==null?'':document.configurationId,document.objectId]));
    if(document.configurationId!==undefined&&document.configurationId!==null)configurationIds.add(document.configurationId);
    output.objects=objectIds.size;output.configurations=configurationIds.size;
   }
   output.documentsScanned=index+1;await tick(output.documentsScanned%chunkSize===0);
  }
  checkAbort(signal);progress(true);return output;
 }
 function escapeHTML(text){return String(text==null?'':text).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}
 function highlight(text,matches){
  text=String(text==null?'':text);var html='',end=0;
  (matches||[]).forEach(function(found){
   var start=Number(found.start),finish=Number(found.end);
   if(!Number.isInteger(start)||!Number.isInteger(finish)||start<end||finish<=start||start<0||finish>text.length)return;
   html+=escapeHTML(text.slice(end,start))+'<mark>'+escapeHTML(text.slice(start,finish))+'</mark>';end=finish;
  });
  return html+escapeHTML(text.slice(end));
 }
 function snippet(text,matches,options){
  text=String(text==null?'':text);matches=matches||[];options=options||{};
  var maximum=Number.isFinite(options.maxLength)?Math.max(20,Math.min(2000,Math.floor(options.maxLength))):180;
  var context=Number.isFinite(options.context)?Math.max(0,Math.min(maximum,Math.floor(options.context))):48;
  var index=Number.isFinite(options.matchIndex)?Math.max(0,Math.min(matches.length-1,Math.floor(options.matchIndex))):0,focus=matches[index];
  var start=Math.max(0,(focus?focus.start:0)-context),end=Math.min(text.length,start+maximum);
  if(end===text.length)start=Math.max(0,end-maximum);
  // Do not cut a UTF-16 surrogate pair at a snippet boundary.
  if(start>0&&text.charCodeAt(start)>=0xDC00&&text.charCodeAt(start)<=0xDFFF)start++;
  if(end<text.length&&text.charCodeAt(end)>=0xDC00&&text.charCodeAt(end)<=0xDFFF)end--;
  var selected=matches.filter(function(found){return found.start<end&&found.end>start;}).map(function(found){return {start:Math.max(found.start,start)-start,end:Math.min(found.end,end)-start,term:found.term};});
  var value=text.slice(start,end);
  return {text:value,start:start,end:end,matches:selected,prefix:start>0,suffix:end<text.length,html:highlight(value,selected)};
 }
 return {parseQuery:parseQuery,match:match,search:search,snippet:snippet,highlight:highlight,escapeHTML:escapeHTML,limits:{queryLength:MAX_QUERY,terms:MAX_TERMS,termLength:MAX_TERM},syntax:'Literal words and double-quoted phrases; -word or -"phrase" excludes a location. All/any terms apply within one property or source line. Whole-word boundaries use Unicode letters, numbers, combining marks and underscore. Regular expressions are not supported.'};
});
