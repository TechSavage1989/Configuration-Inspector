// The editable SVG is authoritative. No fonts, external images or redesign.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),sizes=[16,20,24,32,40,48,64,128,256];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function generate(input){
 const svg=String(input).replace(/\r\n/g,'\n');
 if(!/<svg\b/.test(svg)||/<!DOCTYPE|<!ENTITY|<(?:script|foreignObject|image|text)\b|\bon[a-z]+\s*=|\b(?:xlink:)?href\s*=/i.test(svg))throw Error('Icon must be self-contained vector paths/shapes without scripts, linked resources or fonts');
 const render=size=>new Resvg(svg,{font:{loadSystemFonts:false},fitTo:{mode:'width',value:size}}).render();
 const image=render(512);if(image.width!==512||image.height!==512)throw Error('Expected square 512px icon');
 const png=image.asPng(),frames=sizes.map(size=>{const im=render(size);if(im.width!==size||im.height!==size)throw Error('Invalid frame dimensions');return im.asPng();});
 const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
 let offset=header.length;
 sizes.forEach((size,i)=>{const p=6+16*i;header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(frames[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=frames[i].length;});
 const ico=Buffer.concat([header,...frames]);
 const metadata={source:'icon.svg',sourceSha256:hash(svg),renderer:'@resvg/resvg-js@2.6.2',pngSize:512,icoSizes:sizes,pngSha256:hash(png),icoSha256:hash(ico)};
 return {png,ico,metadata};
}
function main(){
 const result=generate(fs.readFileSync(path.join(root,'webview/icon.svg'),'utf8'));
 const files={'icon.png':result.png,'icon.ico':result.ico,'icon-assets.json':Buffer.from(JSON.stringify(result.metadata,null,2)+'\n')};
 for(const [name,bytes] of Object.entries(files)){
  const target=path.join(root,'webview',name);
  if(process.argv.includes('--check')){
   let existing=fs.readFileSync(target);if(name.endsWith('.json'))existing=Buffer.from(existing.toString().replace(/\r\n/g,'\n'));
   if(!existing.equals(bytes))throw Error(name+' is stale; run node scripts/build-icons.cjs');
  }else fs.writeFileSync(target,bytes);
 }
 console.log('Canonical SVG, 512px PNG and '+sizes.length+' Windows ICO frames '+(process.argv.includes('--check')?'verified':'generated'));
}
if(require.main===module)main();
module.exports={generate,sizes,hash};
