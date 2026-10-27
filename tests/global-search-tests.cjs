const assert=require('node:assert/strict'),Search=require('../webview/global_search.js');
let checks=0;function eq(value,expected,message){checks++;assert.deepEqual(value,expected,message);}function ok(value,message){checks++;assert.ok(value,message);}
function parse(query,options){const parsed=Search.parseQuery(query,options);ok(parsed.ok,parsed.error);return parsed;}
function matches(text,query,options){return Search.match(text,parse(query,options));}
function positions(result){return result.map(hit=>[hit.start,hit.end]);}
function documents(values){return values.map((text,index)=>({id:'doc-'+index,text,configurationId:'config-a',objectId:'object-'+Math.floor(index/2),category:'interfaces',source:'property',path:'Example/'+index,destinations:[{view:'interfaces',id:index}]}));}
(async()=>{
 let p=parse('port "native vlan" -disabled -"old route"');eq(p.positive,['port','native vlan']);eq(p.negative,['disabled','old route']);eq(p.mode,'all');
 p=parse('PORT port "Port" -OLD -old');eq(p.positive,['PORT']);eq(p.negative,['OLD']);
 p=parse('PORT port',{caseSensitive:true});eq(p.positive,['PORT','port']);
 p=parse('"-literal" -');eq(p.positive,['-literal','-']);
 p=parse('"say \\"hello\\""');eq(p.positive,['say "hello"']);
 p=parse('"C:\\temp"');eq(p.positive,['C:\\temp'],'ordinary backslashes stay literal');
 for(const query of ['', '   ', '-only', '-"only exclusion"', '"unfinished', '""', '"phrase"adjacent', 'embedded"quote', 'x'.repeat(2049), 'x'.repeat(513), Array(33).fill('word').join(' ')]){
  const invalid=Search.parseQuery(query);ok(!invalid.ok,'invalid query rejected');ok(!!invalid.error,'invalid query has an explanation');eq(Search.match('some text',invalid),[]);
 }
 ok(!Search.parseQuery('foo',{mode:'other'}).ok);ok(!Search.parseQuery('foo',{regex:true}).ok);ok(Search.syntax.includes('Regular expressions are not supported'));
 eq(positions(matches('port port PORT','port')),[[0,4],[5,9],[10,14]],'all repeated same-line occurrences');
 eq(positions(matches('port PORT port','port',{caseSensitive:true})),[[0,4],[10,14]]);
 eq(matches('native vlan 10; native vlan 20','"native vlan"').length,2,'phrases repeated in one location');
 eq(matches('port state enabled','port enabled').length,2,'all positive terms in same property');
 eq(matches('port state disabled','port enabled'),[],'all terms cannot be borrowed from a different property');
 eq(matches('port state disabled','port enabled',{mode:'any'}).length,1);
 eq(matches('port state disabled','port -disabled'),[]);
 eq(matches('port old route','port -"old route"'),[]);
 eq(matches('port DISABLED','port -disabled',{caseSensitive:true}).length,1);
 eq(matches('a.b aXb a.b','a.b').length,2,'regex punctuation is literal');
 eq(matches('route .* wildcard .*','.*').length,2);eq(matches('[a] (b) $x ^x + ?','[a]').length,1);
 eq(matches('192.0.2.1 192.0.2.10 1192.0.2.1','192.0.2.1',{wholeWord:true}).length,1,'whole IP does not match numeric suffix/prefix');
 eq(matches('Gi1/0/1 Gi1/0/10 xGi1/0/1','Gi1/0/1',{wholeWord:true}).length,1,'whole interface literal does not match embedded token');
 eq(matches('port ports _port port_ (port) PORT','port',{wholeWord:true}).length,3);
 eq(matches('café décafé café2 (CAFÉ)','café',{wholeWord:true}).length,2,'Unicode word boundaries and case');
 eq(matches('cafe café cafe\u0301','cafe',{wholeWord:true}).length,1,'combining mark remains part of identifier');
 eq(matches('設定 設定名 (設定)','設定',{wholeWord:true}).length,2);
 eq(matches('𐐀port port𐐀 port','port',{wholeWord:true}).length,1,'astral Unicode letters are identifier characters');
 eq(positions(matches('İ i I ı','i')),[[2,3],[4,5]],'case matching never remaps source offsets through expanding lowercase');
 eq(positions(matches('😀 PORT 😀 port','port')),[[3,7],[11,15]],'offsets stay UTF-16 and preserve emoji');
 eq(positions(matches('foobar foo bar','foo foobar bar',{mode:'any'})),[[0,6],[7,10],[11,14]],'overlap uses leftmost longest, no duplicate highlight');
 eq(positions(matches('aaaaaa','aa aaa',{mode:'any'})),[[0,3],[3,6]],'overlapping literals do not double-count characters');
 const spanning='x'.repeat(32766)+'needle '+'x'.repeat(32768)+'needle';
 eq(positions(matches(spanning,'needle')),[[32766,32772],[65541,65547]],'matches spanning scan chunks retained exactly once');
 const boundary='x'.repeat(32767)+'port '+'port';eq(matches(boundary,'port',{wholeWord:true}).length,1,'whole word checks original text across scan boundary');
 const raw='<img src=x onerror="alert(1)"> repeated <img>';const hits=matches(raw,'img');
 const highlighted=Search.highlight(raw,hits);ok(!highlighted.includes('<img'));ok(highlighted.includes('&lt;<mark>img</mark>'));ok(highlighted.includes('&quot;'));
 const long='before '.repeat(100)+'MATCH '+'after '.repeat(100),longHits=matches(long,'MATCH');
 const snippet=Search.snippet(long,longHits,{maxLength:120});ok(snippet.text.length<=120);ok(snippet.prefix&&snippet.suffix);ok(snippet.html.includes('<mark>MATCH</mark>'));eq(snippet.text,long.slice(snippet.start,snippet.end));
 const repeated=matches('first MATCH middle MATCH last','MATCH'),second=Search.snippet('first MATCH middle MATCH last',repeated,{matchIndex:1,maxLength:20,context:2});ok(second.start>0);ok(second.text.includes('MATCH'));ok(second.matches.length>0);

 const docs=documents(['port port PORT','port enabled','enabled only','unrelated','port disabled']);const original=JSON.stringify(docs);const progress=[];
 let result=await Search.search(docs,'port -disabled',{}, {onProgress:value=>progress.push(value)});
 eq(result.ok,true);eq(result.occurrences,4);eq(result.locations,2);eq(result.objects,1);eq(result.configurations,1);eq(result.documentsScanned,5);eq(result.totalDocuments,5);eq(JSON.stringify(docs),original,'engine never mutates input documents');
 eq(result.results[0].destinations,docs[0].destinations,'navigation metadata retained');eq(result.results[0].path,'Example/0');eq(progress[0].documentsScanned,0);eq(progress.at(-1).documentsScanned,5);
 result=await Search.search(docs,'port enabled');eq(result.locations,1);eq(result.occurrences,2,'all terms require same location');
 result=await Search.search(documents(['port','enabled']),'port enabled');eq(result.locations,0,'no cross-document all-term matching');
 result=await Search.search(documents(['port','enabled']),'port enabled',{mode:'any'});eq(result.locations,2);
 result=await Search.search([{id:'a',text:'port',configurationId:'a',objectId:'same'},{id:'b',text:'port',configurationId:'b',objectId:'same'},{id:'c',text:'port',configurationId:'b',source:'raw'}],'port');eq(result.objects,2,'object IDs are configuration-scoped');eq(result.locations,3);eq(result.configurations,2);
 result=await Search.search(docs,'"bad');eq(result.ok,false);ok(result.error.includes('closing'));eq(result.results,[]);
 const controller=new AbortController();controller.abort();checks++;await assert.rejects(Search.search(docs,'port',{}, {signal:controller.signal}),error=>error.name==='AbortError');
 const progressAbort=new AbortController();checks++;await assert.rejects(Search.search(docs,'port',{}, {signal:progressAbort.signal,onProgress:()=>progressAbort.abort()}),error=>error.name==='AbortError');
 const during=new AbortController();const pending=Search.search(documents(Array(20000).fill('port port port')),'port',{chunkSize:10},{signal:during.signal});setTimeout(()=>during.abort(),5);checks++;await assert.rejects(pending,error=>error.name==='AbortError');
 const noMatch=new AbortController();const scanning=Search.search(documents(['x'.repeat(5000000)]),'not-here',{timeSliceMs:1},{signal:noMatch.signal});setTimeout(()=>noMatch.abort(),2);checks++;await assert.rejects(scanning,error=>error.name==='AbortError','long no-match input remains cancellable');
 // A fresh request is independent of an older canceled one: no shared engine state.
 const old=new AbortController(),oldSearch=Search.search(documents(Array(5000).fill('old old')),'old',{chunkSize:1},{signal:old.signal});old.abort();
 checks++;const oldRejected=assert.rejects(oldSearch,error=>error.name==='AbortError');
 const fresh=await Search.search(documents(['fresh fresh']),'fresh');await oldRejected;eq(fresh.occurrences,2);eq(fresh.results[0].matches[0].term,'fresh');
 const large=documents(Array.from({length:6000},(_,i)=>'port '+i+' port port'));let yielded=false;setTimeout(()=>{yielded=true;},0);
 result=await Search.search(large,parse('port'),{chunkSize:100});ok(yielded,'search yields to event loop');eq(result.locations,6000);eq(result.occurrences,18000,'large search retains every repeated occurrence');eq(result.results.length,6000);eq(result.objects,3000);
 const dense='ab '.repeat(12000);result=await Search.search(documents([dense]),'ab');eq(result.occurrences,12000,'dense single property keeps every occurrence');
 eq(matches('a'.repeat(60000),'aaa').length,20000,'scan-chunk boundaries retain nonoverlapping repeated-pattern phase');
 result=await Search.search(documents(['a'.repeat(60000)]),'aaa');eq(result.occurrences,20000,'async repeated-pattern phase matches across scan boundaries');
 for(const sample of ['abc abc ab','foo FOO _foo','192.0.2.1 192.0.2.10','😀 test-test','alpha beta gamma'])for(const query of ['abc ab','foo','192.0.2.1','test','alpha -gamma']){
  const parsed=parse(query,{mode:'any',wholeWord:true});const sync=Search.match(sample,parsed);const asyncResult=await Search.search(documents([sample]),parsed);eq(asyncResult.results[0]?.matches||[],sync,'sync/async matching parity');
 }
 console.log(checks+' global search parser, occurrence and cancellation checks passed');
})().catch(error=>{console.error(error);process.exit(1);});
