const fs=require('node:fs'),assert=require('node:assert/strict');
const {generate,sizes,hash}=require('../scripts/build-icons.cjs');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const svg=fs.readFileSync('webview/icon.svg','utf8').replace(/\r\n/g,'\n'),result=generate(svg);
const ico=fs.readFileSync('webview/icon.ico'),png=fs.readFileSync('webview/icon.png'),meta=JSON.parse(fs.readFileSync('webview/icon-assets.json','utf8'));
ok(ico.equals(result.ico),'ICO regenerated exactly from canonical SVG');ok(png.equals(result.png),'PNG regenerated exactly');ok(meta.sourceSha256===hash(svg),'canonical source provenance');ok(meta.icoSha256===hash(ico)&&meta.pngSha256===hash(png),'derived asset hashes');
ok(ico.readUInt16LE(0)===0&&ico.readUInt16LE(2)===1,'ICO header');ok(ico.readUInt16LE(4)===sizes.length,'nine native sizes');
let offset=6+16*sizes.length;
for(let i=0;i<sizes.length;i++){
 const p=6+16*i,size=sizes[i],length=ico.readUInt32LE(p+8),start=ico.readUInt32LE(p+12),frame=ico.subarray(start,start+length);
 ok((ico[p]||256)===size&&(ico[p+1]||256)===size,'ICO dimensions');ok(ico.readUInt16LE(p+4)===1&&ico.readUInt16LE(p+6)===32,'32-bit alpha frames');ok(start===offset&&frame.length===length,'bounded contiguous frame');ok(frame.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG encoded frame');ok(frame.readUInt32BE(16)===size&&frame.readUInt32BE(20)===size,'PNG dimensions');offset+=length;
}
ok(offset===ico.length,'no extra icon bytes');ok(png.readUInt32BE(16)===512&&png.readUInt32BE(20)===512,'large source preview');
const html=fs.readFileSync('webview/index.html','utf8'),favicon=[...html.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/g)];ok(favicon.length===1,'no competing legacy favicons');
const decode=tag=>Buffer.from(tag.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/)[1],'base64').toString('utf8');ok(decode(favicon[0][0])===svg,'favicon uses exact canonical SVG');
const brand=html.match(/<img class="brand-app-icon"[^>]*>/g);ok(brand.length===1&&decode(brand[0])===svg,'app branding uses exact canonical SVG');
const host=fs.readFileSync('webview/app.cpp','utf8'),rc=fs.readFileSync('webview/app.rc','utf8');ok(rc.includes('1 ICON "icon.ico"'),'Windows resource uses generated ICO');ok(host.includes('WM_SETICON,ICON_BIG')&&host.includes('WM_SETICON,ICON_SMALL'),'matching large and small window icon selection');
for(const bad of ['<svg><script/></svg>','<svg onload="x"/>','<svg><image href="file:///private"/></svg>','<!DOCTYPE svg><svg/>','<svg><text>font dependency</text></svg>']){checks++;assert.throws(()=>generate(bad),/self-contained/);}
console.log(checks+' canonical icon checks passed');
