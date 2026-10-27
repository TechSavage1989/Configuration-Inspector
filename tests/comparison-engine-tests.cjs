const assert=require('node:assert/strict'),{compareText}=require('../webview/comparison.js');
let checks=0;
function eq(actual,expected,message){checks++;assert.deepEqual(actual,expected,message);}
function ok(actual,message){checks++;assert.ok(actual,message);}
function kinds(result){return result.rows.map(row=>row.kind);}
function reconstruct(result,side){return result.rows.flatMap(row=>row[side]?[row[side].text+(row[side].terminated?'\n':'')]:[]).join('');}
function retained(left,right,options){
 const result=compareText(left,right,options);ok(!result.rejected,'comparison accepted');
 eq(reconstruct(result,'left'),left.replace(/\r\n|\r/g,'\n'),'every left source line retained in order');
 eq(reconstruct(result,'right'),right.replace(/\r\n|\r/g,'\n'),'every right source line retained in order');
 for(const side of ['left','right'])eq(result.rows.flatMap(row=>row[side]?[row[side].number]:[]),Array.from({length:result[side].lineCount},(_,i)=>i+1),'line numbers monotonic and complete');
 return result;
}
let r=retained('','');eq(r.rows,[]);eq(r.hunks,[]);
r=retained('','\n');eq(kinds(r),['added']);eq(r.right.lineCount,1);eq(r.rows[0].right.text,'');
r=retained('a\n','a');eq(kinds(r),['changed'],'terminal newline difference is not lost');eq(r.rows[0].left.terminated,true);eq(r.rows[0].right.terminated,false);
r=retained('a\r\nb\r\n','a\nb\n');eq(kinds(r),['unchanged','unchanged']);eq(r.left.endings,{LF:0,CRLF:2,CR:0});ok(r.notices.some(note=>note.includes('Line-ending styles differ')));
r=retained('a\rb\nc\r\n','a\nb\nc\n');eq(r.left.lineEnding,'mixed');eq(r.counts.unchanged,3);
r=retained('first\nlast\n','first\ninserted\nlast\n');eq(kinds(r),['unchanged','added','unchanged']);eq(r.rows[1].right.number,2);eq(r.hunks,[{id:0,start:1,end:1}]);
r=retained('first\nremoved\nlast\n','first\nlast\n');eq(kinds(r),['unchanged','removed','unchanged']);
r=retained('a\nb\nc\nd\ne\n','a\nB\nc\nD\ne\n');eq(kinds(r),['unchanged','changed','unchanged','changed','unchanged']);eq(r.hunks,[{id:0,start:1,end:1},{id:1,start:3,end:3}]);eq(r.rows.map(row=>row.hunk),[null,0,null,1,null]);
r=retained('one\ntwo\nthree\n','ONE\nTWO\n');eq(kinds(r),['changed','changed','removed']);
r=retained('one\ntwo\n','ONE\nTWO\nTHREE\n');eq(kinds(r),['changed','changed','added']);
r=retained('!\na\n!\nb\n!\n','!\nnew\n!\na\n!\nb\n!\n');eq(r.counts.added,2);eq(r.counts.unchanged,5);ok(!r.approximate);
r=retained('  keep spaces  \ncase\n','keep spaces\nCASE\n');eq(r.counts.changed,2,'whitespace and case differences stay meaningful');
r=retained('<img src=x onerror=alert(1)>\n','<script>example</script>\n');eq(r.rows[0].left.text,'<img src=x onerror=alert(1)>','engine returns plain source text, not HTML');
const long='x'.repeat(200000);r=retained(long+'\nend\n',long+'!\nend\n');eq(r.counts.changed,1);eq(r.rows[0].right.text.length,200001);
const lines=Array.from({length:12000},(_,i)=>'interface Example'+i+'\n');
const before=lines.join(''),after=lines.slice(0,6000).join('')+'inserted Example line\n'+lines.slice(6000).join('');
r=retained(before,after);eq(r.counts,{added:1,removed:0,changed:0,unchanged:12000});ok(!r.approximate,'large localized insertion is exact');
const replacements=lines.map((line,i)=>i%3?'changed '+i+'\n':line).join('');
r=retained(before,replacements);eq(r.counts.changed,8000);eq(r.counts.unchanged,4000);
const repeated='repeat\n'.repeat(3000)+'old\n',repeatedAfter='other\n'.repeat(3000)+'new\n';
r=retained(repeated,repeatedAfter,{maxWork:100,maxTraceCells:100,maxEditDistance:8});ok(r.approximate);ok(r.notices.some(note=>note.includes('Every input line is retained')));eq(r.counts.changed,3001);
r=retained(lines.slice(0,1000).join(''),lines.slice(0,1000).reverse().join(''),{maxWork:20000,maxEditDistance:8});ok(r.rows.length>=1000,'reordered lines are retained');
r=retained('a\nb\n','a\nc\n',{maxWork:0});ok(r.approximate,'zero work budget explicitly falls back');
r=compareText('12345','123456',{maxCharacters:5});ok(r.rejected);eq(r.rows,[]);ok(r.notices[0].includes('No input was truncated'));
r=compareText('a\nb\n','a\n',{maxLines:1});ok(r.rejected);eq(r.left.lineCount,2);
// Deterministic fuzz checks catch backtracking/ordering errors without large runs.
let seed=271828;function random(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
for(let iteration=0;iteration<80;iteration++){
 const a=Array.from({length:random(18)},()=>String(random(5))+'\n').join('');
 const b=Array.from({length:random(18)},()=>String(random(5))+'\n').join('');
 r=retained(a,b);eq(r.rows.reduce((n,row)=>n+(row.kind!=='unchanged'),0),r.counts.added+r.counts.removed+r.counts.changed);
 ok(r.hunks.every(h=>r.rows.slice(h.start,h.end+1).every(row=>row.hunk===h.id&&row.kind!=='unchanged')));
}
console.log(checks+' bounded text comparison engine checks passed');
