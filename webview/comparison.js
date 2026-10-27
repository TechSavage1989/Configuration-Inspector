(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWComparison=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 // Pure line comparison: never edits source and never inserts source as HTML.
 // Work and trace budgets bound difficult/repetitive diffs; a positional fallback
 // retains every line and is explicitly identified as approximate.
 function limit(value,fallback,maximum){
  return Number.isFinite(value)?Math.max(0,Math.min(maximum,Math.floor(value))):fallback;
 }
 function inspect(text,maxLines){
  var endings={LF:0,CRLF:0,CR:0},breaks=0;
  for(var i=0;i<text.length;i++){
   if(text.charCodeAt(i)===13){breaks++;if(text.charCodeAt(i+1)===10){endings.CRLF++;i++;}else endings.CR++;}
   else if(text.charCodeAt(i)===10){breaks++;endings.LF++;}
  }
  var finalNewline=/[\r\n]$/.test(text),lineCount=text.length?breaks+(finalNewline?0:1):0;
  var types=Object.keys(endings).filter(function(key){return endings[key]>0;});
  var metadata={characters:text.length,lineCount:lineCount,finalNewline:finalNewline,endings:endings,lineEnding:types.length>1?'mixed':types[0]||'none'};
  if(lineCount>maxLines)return {metadata:metadata,lines:null};
  var lines=[],start=0,pattern=/\r\n|\r|\n/g,match;
  while((match=pattern.exec(text))!==null){lines.push({number:lines.length+1,text:text.slice(start,match.index),terminated:true});start=pattern.lastIndex;}
  if(start<text.length)lines.push({number:lines.length+1,text:text.slice(start),terminated:false});
  return {metadata:metadata,lines:lines};
 }
 function compareText(leftText,rightText,options){
  options=options||{};
  leftText=leftText==null?'':String(leftText);rightText=rightText==null?'':String(rightText);
  var maxCharacters=limit(options.maxCharacters,25*1024*1024,25*1024*1024);
  var maxLines=limit(options.maxLines,200000,200000);
  var maxWork=limit(options.maxWork,2000000,4000000);
  var maxEditDistance=limit(options.maxEditDistance,512,1024);
  var maxTraceCells=limit(options.maxTraceCells,250000,1000000);
  var maxMilliseconds=limit(options.maxMilliseconds,250,2000);
  var result={rows:[],hunks:[],counts:{added:0,removed:0,changed:0,unchanged:0},approximate:false,rejected:false,notices:[],left:null,right:null};
  if(leftText.length>maxCharacters||rightText.length>maxCharacters){
   result.rejected=true;
   result.left={characters:leftText.length,lineCount:null};result.right={characters:rightText.length,lineCount:null};
   result.notices.push('Text comparison was not calculated: each input must be at most '+maxCharacters.toLocaleString()+' characters. No input was truncated.');return result;
  }
  var left=inspect(leftText,maxLines),right=inspect(rightText,maxLines),a=left.lines,b=right.lines;
  result.left=left.metadata;result.right=right.metadata;
  if(!a||!b){result.rejected=true;result.notices.push('Text comparison was not calculated: each input must be at most '+maxLines.toLocaleString()+' lines. No input was truncated.');return result;}
  if(left.metadata.lineEnding!==right.metadata.lineEnding&&left.metadata.lineCount&&right.metadata.lineCount)
   result.notices.push('Line-ending styles differ ('+left.metadata.lineEnding+' / '+right.metadata.lineEnding+'); CRLF, LF and CR are normalized for line matching. Final newline differences are still highlighted.');
  var started=Date.now(),work=0,exhausted=false;
  function spend(amount){
   work+=amount||1;
   if(work>maxWork||(work%1024===0&&Date.now()-started>maxMilliseconds))exhausted=true;
   return !exhausted;
  }
  function equal(i,j){return a[i].text===b[j].text;}
  function append(i,j){
   var l=i==null?null:a[i],r=j==null?null:b[j];
   var kind=!l?'added':!r?'removed':l.text===r.text&&l.terminated===r.terminated?'unchanged':'changed';
   result.rows.push({left:l,right:r,kind:kind,hunk:null});result.counts[kind]++;
  }
  function positional(a0,a1,b0,b1){
   result.approximate=true;
   for(var i=0,n=Math.max(a1-a0,b1-b0);i<n;i++)append(a0+i<a1?a0+i:null,b0+i<b1?b0+i:null);
  }
  function emitOperations(operations){
   var removed=[],added=[];
   function flush(){for(var i=0,n=Math.max(removed.length,added.length);i<n;i++)append(i<removed.length?removed[i]:null,i<added.length?added[i]:null);removed=[];added=[];}
   operations.forEach(function(op){if(op.type==='same'){flush();append(op.a,op.b);}else if(op.type==='delete')removed.push(op.a);else added.push(op.b);});flush();
  }
  function myers(a0,a1,b0,b1){
   var n=a1-a0,m=b1-b0,cap=Math.min(n+m,maxEditDistance),v=new Map([[1,0]]),trace=[],cells=0;
   function get(map,key){return map.has(key)?map.get(key):-Infinity;}
   for(var d=0;d<=cap;d++){
    cells+=v.size;if(cells>maxTraceCells||!spend(v.size))return null;
    trace.push(new Map(v));
    for(var k=-d;k<=d;k+=2){
     if(!spend())return null;
     var x=k===-d||(k!==d&&get(v,k-1)<get(v,k+1))?get(v,k+1):get(v,k-1)+1,y=x-k;
     while(x<n&&y<m&&equal(a0+x,b0+y)){if(!spend())return null;x++;y++;}
     v.set(k,x);
     if(x>=n&&y>=m){
      var operations=[];x=n;y=m;
      for(var depth=d;depth>0;depth--){
       var previous=trace[depth],diagonal=x-y;
       var previousDiagonal=diagonal===-depth||(diagonal!==depth&&get(previous,diagonal-1)<get(previous,diagonal+1))?diagonal+1:diagonal-1;
       var previousX=get(previous,previousDiagonal),previousY=previousX-previousDiagonal;
       while(x>previousX&&y>previousY){operations.push({type:'same',a:a0+--x,b:b0+--y});}
       if(x===previousX)operations.push({type:'insert',b:b0+--y});else operations.push({type:'delete',a:a0+--x});
      }
      while(x>0&&y>0)operations.push({type:'same',a:a0+--x,b:b0+--y});
      while(x>0)operations.push({type:'delete',a:a0+--x});while(y>0)operations.push({type:'insert',b:b0+--y});
      return operations.reverse();
     }
    }
   }
   return null;
  }
  function gap(a0,a1,b0,b1){
   // Prefix/suffix matches cost linear work and also keep fallback boundaries useful.
   while(a0<a1&&b0<b1&&equal(a0,b0)){append(a0++,b0++);spend();}
   var suffix=0;
   while(a0<a1&&b0<b1&&equal(a1-1,b1-1)){a1--;b1--;suffix++;spend();}
   if(a0===a1){for(var j=b0;j<b1;j++)append(null,j);}
   else if(b0===b1){for(var i=a0;i<a1;i++)append(i,null);}
   else if(exhausted)positional(a0,a1,b0,b1);
   else {var operations=myers(a0,a1,b0,b1);if(operations)emitOperations(operations);else positional(a0,a1,b0,b1);}
   for(var s=0;s<suffix;s++)append(a1+s,b1+s);
  }
  // Unique common lines are safe anchors. Their longest increasing subsequence
  // keeps order; repeated lines are handled by Myers inside the bounded gaps.
  function anchors(a0,a1,b0,b1){
   var positions=new Map(),rightPositions=new Map();
   for(var i=a0;i<a1;i++){if(!spend())return [];positions.set(a[i].text,positions.has(a[i].text)?-1:i);}
   for(var j=b0;j<b1;j++){if(!spend())return [];rightPositions.set(b[j].text,rightPositions.has(b[j].text)?-1:j);}
   var candidates=[];
   positions.forEach(function(i,text){var j=rightPositions.get(text);if(i>=0&&j>=0)candidates.push({a:i,b:j});});
   var tails=[],previous=[];
   for(var c=0;c<candidates.length;c++){
    var lo=0,hi=tails.length;
    while(lo<hi){if(!spend())return [];var mid=(lo+hi)>>1;if(candidates[tails[mid]].b<candidates[c].b)lo=mid+1;else hi=mid;}
    previous[c]=lo?tails[lo-1]:-1;tails[lo]=c;
   }
   var out=[],cursor=tails.length?tails[tails.length-1]:-1;
   while(cursor>=0){out.push(candidates[cursor]);cursor=previous[cursor];}
   return out.reverse();
  }
  var a0=0,b0=0,a1=a.length,b1=b.length,suffix=0;
  while(a0<a1&&b0<b1&&equal(a0,b0)){append(a0++,b0++);spend();}
  while(a0<a1&&b0<b1&&equal(a1-1,b1-1)){a1--;b1--;suffix++;spend();}
  var points=a0<a1&&b0<b1&&!exhausted?anchors(a0,a1,b0,b1):[];
  points.forEach(function(point){gap(a0,point.a,b0,point.b);append(point.a,point.b);a0=point.a+1;b0=point.b+1;});
  gap(a0,a1,b0,b1);for(var tail=0;tail<suffix;tail++)append(a1+tail,b1+tail);
  var hunk=null;
  result.rows.forEach(function(row,index){
   if(row.kind==='unchanged'){hunk=null;return;}
   if(!hunk){hunk={id:result.hunks.length,start:index,end:index};result.hunks.push(hunk);}
   else hunk.end=index;
   row.hunk=hunk.id;
  });
  if(result.approximate)result.notices.push('Some large or highly changed sections use bounded positional alignment. Every input line is retained; alignment in those sections is approximate.');
  result.work=work;
  return result;
 }
 return {compareText:compareText};
});
