const assert=require('node:assert/strict'),N=require('../webview/comparison_navigation.js');
let checks=0;function eq(a,b,message){checks++;assert.deepEqual(a,b,message);}function ok(value,message){checks++;assert.ok(value,message);}function near(a,b,message){checks++;assert.ok(Math.abs(a-b)<.001,message||`${a} != ${b}`);}
eq(N.viewportGeometry(1000,200,400,100),{height:20,top:40,max:800,travel:80});
eq(N.viewportGeometry(100,200,90,100),{height:100,top:0,max:0,travel:0});
eq(N.viewportGeometry(0,0,0,0),{height:0,top:0,max:0,travel:0});
eq(N.viewportGeometry(100000,100,99900,100),{height:4,top:96,max:99900,travel:96});
eq(N.dragScroll(-50,2,1000,200,100),0);eq(N.dragScroll(999,2,1000,200,100),800);eq(N.dragScroll(50,10,1000,200,100),400);eq(N.dragScroll(50,10,100,200,100),0);
eq(N.mapScroll(50,1000,200,100),400);eq(N.mapScroll(1000,1000,200,100),800);eq(N.mapScroll(-10,1000,200,100),0);
const sections=[{key:'interfaces',top:50},{key:'routes',top:1000}];eq(N.activeSection(sections,0,200,2000),'interfaces');eq(N.activeSection(sections,999,200,2000),'routes');eq(N.activeSection(sections,1800,200,2000),'routes');eq(N.activeSection([],0,100,0),'');
// A compact DOM fixture exercises actual mount handlers and observer cleanup,
// without claiming browser geometry/capture validation (hosted suite does that).
class Node{
 constructor(name='div'){this.name=name;this.attributes={};this.style={};this.children=[];this.handlers={};this.selectors={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};this.textContent='';this.clientHeight=100;this.scrollHeight=100;this.scrollTop=0;this.clientTop=0;this.capture=new Set();this.rect={top:0,height:100,left:0,width:20};}
 set className(value){this._className=value;}get className(){return this._className||'';}
 setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}removeAttribute(name){delete this.attributes[name];}
 appendChild(node){this.children.push(node);node.parent=this;return node;}replaceChildren(fragment){this.children=fragment.children||[fragment];this.children.forEach(node=>node.parent=this);}
 querySelector(selector){return this.selectors[selector]||null;}querySelectorAll(selector){return this.selectors[selector]||[];}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 closest(selector){return this.closestSelectors?.[selector]||this.parent?.closest(selector)||null;}
 getBoundingClientRect(){return {...this.rect,bottom:this.rect.top+this.rect.height};}
 addEventListener(name,fn){(this.handlers[name]||(this.handlers[name]=[])).push(fn);}removeEventListener(name,fn){this.handlers[name]=(this.handlers[name]||[]).filter(handler=>handler!==fn);}
 emit(name,values={}){const event={target:this,button:0,pointerId:7,isPrimary:true,preventDefault(){this.prevented=true;},...values};(this.handlers[name]||[]).slice().forEach(fn=>fn(event));return event;}
 setPointerCapture(id){this.capture.add(id);}hasPointerCapture(id){return this.capture.has(id);}releasePointerCapture(id){this.capture.delete(id);this.emit('lostpointercapture',{pointerId:id});}focus(){this.focused=true;}
}
const frames=new Map();let frameId=0,resize;
const view=new Node('window');view.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};view.cancelAnimationFrame=id=>frames.delete(id);view.ResizeObserver=class{constructor(fn){this.fn=fn;this.observed=[];this.disconnected=false;resize=this;}observe(node){this.observed.push(node);}disconnect(){this.disconnected=true;}};
function flush(){for(let iteration=0;frames.size&&iteration<10;iteration++){const batch=Array.from(frames.values());frames.clear();batch.forEach(fn=>fn());}assert.equal(frames.size,0);}
const doc={defaultView:view,createElement:name=>new Node(name),createDocumentFragment:()=>new Node('fragment')};
const container=new Node(),results=new Node(),map=new Node(),thumb=new Node(),layer=new Node(),nav=new Node();container.ownerDocument=doc;
container.selectors={'.comparison-object-results':results,'.comparison-object-minimap':map,'.comparison-bookmarks':nav};map.selectors={'.comparison-object-map-viewport':thumb,'.comparison-object-map-markers':layer};map.appendChild(layer);map.appendChild(thumb);map.clientHeight=200;map.rect={top:20,height:200,left:0,width:20};results.clientHeight=200;results.scrollHeight=2400;results.rect={top:100,height:200,left:0,width:600};
const buttons=['interfaces','routes'].map(key=>{const button=new Node('button');button.setAttribute('data-comparison-section',key);button.textContent=key;button.closestSelectors={'[data-comparison-section]':button};nav.appendChild(button);return button;});nav.selectors['[data-comparison-section]']=buttons;
const groups=sections.map(section=>{const group=new Node('section'),heading=new Node('h3');group.setAttribute('data-comparison-category',section.key);group.contentTop=section.top;group.getBoundingClientRect=()=>({top:results.rect.top+group.contentTop-results.scrollTop,height:900});heading.rect.height=30;group.selectors['.comparison-group-heading']=heading;return group;});
const cards=[{top:90,height:300,kind:'Changed',group:groups[0],label:'Port one'},{top:1030,height:1300,kind:'Added',group:groups[1],label:'Route one'}].map((item,index)=>{const card=new Node('article'),label=new Node('h3');Object.assign(card,item);card.setAttribute('data-object-kind',item.kind);label.textContent=item.label;card.selectors['.detail-label']=label;card.closestSelectors={'.comparison-object-group':item.group};card.getBoundingClientRect=()=>({top:results.rect.top+card.top-results.scrollTop,height:card.height});item.group.selectors['.comparison-card']=card;return card;});
results.selectors={'.comparison-object-group':groups,'.comparison-card':cards};
const cleanup=N.mount(container);eq(layer.children.length,4,'one marker per rendered object plus actual section markers');eq(resize.observed.length,6,'observer limited to current results/map/groups/cards');eq(map.getAttribute('data-object-map-total'),'2400');eq(buttons[0].getAttribute('aria-current'),'location');eq(buttons[1].getAttribute('aria-current'),null);eq(layer.children[0].getAttribute('data-object-map-top'),'90');near(parseFloat(layer.children[0].style.top),90/2400*100);near(parseFloat(layer.children[1].style.height),1300/2400*100);ok(layer.children[0].title.includes('Changed · Port one'),'marker names actual rendered object');
nav.emit('click',{target:buttons[1]});eq(results.scrollTop,1000,'bookmark moves results directly');eq(buttons[1].getAttribute('aria-current'),'location');eq(buttons[0].getAttribute('aria-current'),null);near(parseFloat(thumb.style.top),1000/2200*(200-200*200/2400));
results.scrollTop=0;results.emit('scroll');flush();eq(buttons[0].getAttribute('aria-current'),'location');
map.emit('keydown',{key:'End'});eq(results.scrollTop,2200);eq(map.getAttribute('aria-valuenow'),'2200');map.emit('keydown',{key:'Home'});eq(results.scrollTop,0);map.emit('keydown',{key:'ArrowDown'});eq(results.scrollTop,48);map.emit('keydown',{key:'PageDown'});eq(results.scrollTop,228);map.emit('keydown',{key:'PageUp'});eq(results.scrollTop,48);
const marker=layer.children[1];marker.closestSelectors={'[data-object-map-index]':marker};map.emit('click',{target:marker});eq(results.scrollTop,1000,'object click reserves sticky heading height');
map.emit('click',{clientY:120});eq(results.scrollTop,1100,'free map click centers actual content position');
map.emit('keydown',{key:'Home'});let event=map.emit('pointerdown',{target:thumb,clientY:22});ok(event.prevented);ok(map.hasPointerCapture(7));eq(map.getAttribute('data-object-map-dragging'),'true');
map.emit('pointermove',{pointerId:8,clientY:900});eq(results.scrollTop,0,'unrelated pointer cannot move map');
map.emit('pointermove',{clientY:900});eq(results.scrollTop,2200,'drag beyond lower boundary reaches last actual content');map.emit('pointermove',{clientY:-100});eq(results.scrollTop,0,'drag beyond upper boundary reaches start');
map.emit('pointermove',{clientY:120});const dragged=results.scrollTop;ok(dragged>0&&dragged<2200);map.emit('pointerup');ok(!map.hasPointerCapture(7));eq(map.getAttribute('data-object-map-dragging'),null);map.emit('click',{clientY:20});eq(results.scrollTop,dragged,'synthetic post-drag click cannot jump again');map.emit('pointermove',{clientY:900});eq(results.scrollTop,dragged,'move after release does nothing');
// A new pointer gesture restores ordinary map clicking; cancellation releases capture.
map.emit('pointerdown',{target:map,clientY:40});map.emit('click',{clientY:40});eq(results.scrollTop,140);
event=map.emit('pointerdown',{target:thumb,clientY:20+parseFloat(thumb.style.top)+1});ok(map.hasPointerCapture(7));map.emit('pointercancel');ok(!map.hasPointerCapture(7));eq(map.getAttribute('data-object-map-dragging'),null);const canceled=results.scrollTop;map.emit('pointermove',{clientY:900});eq(results.scrollTop,canceled);
// Expanding content and resizing recomputes actual variable-height map geometry.
cards[0].height=700;cards[1].top=1430;groups[1].contentTop=1400;results.scrollHeight=2800;
// A scroll-anchoring update may precede both toggle and ResizeObserver delivery.
// The first frame must not advertise a new total with stale marker offsets.
const oldThumbHeight=thumb.style.height;results.emit('scroll');const scrollFrame=Array.from(frames.values());frames.clear();scrollFrame.forEach(fn=>fn());
eq(map.getAttribute('data-object-map-total'),'2400','extent is committed only with measured markers');eq(layer.children[1].getAttribute('data-object-map-top'),'1030');eq(thumb.style.height,oldThumbHeight,'thumb retains the same measured snapshot');eq(frames.size,1,'scroll extent change schedules a geometry frame');
flush();eq(map.getAttribute('data-object-map-total'),'2800');eq(layer.children[1].getAttribute('data-object-map-top'),'1430');near(parseFloat(layer.children[0].style.height),700/2800*100);
results.emit('toggle');flush();eq(layer.children[1].getAttribute('data-object-map-top'),'1430');
map.clientHeight=300;results.clientHeight=400;resize.fn();flush();near(parseFloat(thumb.style.height),300*400/2800);eq(map.getAttribute('aria-valuemax'),'2400');
// Resize bursts coalesce, and externally lost capture cannot leave a drag armed.
for(let i=0;i<8;i++)resize.fn();eq(frames.size,1,'resize work is bounded to one frame');flush();
map.emit('pointerdown',{target:thumb,clientY:20+parseFloat(thumb.style.top)+1});ok(map.hasPointerCapture(7));map.capture.delete(7);map.emit('lostpointercapture');eq(map.getAttribute('data-object-map-dragging'),null);const lost=results.scrollTop;map.emit('pointermove',{clientY:900});eq(results.scrollTop,lost);
// Short/empty viewports stay bounded and have no movable thumb.
results.scrollTop=0;results.scrollHeight=100;results.clientHeight=400;resize.fn();flush();eq(thumb.style.height,'300px');eq(map.getAttribute('aria-disabled'),'true');map.emit('pointerdown',{target:thumb,clientY:25});ok(!map.hasPointerCapture(7));
results.scrollHeight=2800;resize.fn();flush();map.emit('pointerdown',{target:thumb,clientY:22});ok(map.hasPointerCapture(7));results.emit('scroll');ok(frames.size>0);cleanup();ok(!map.hasPointerCapture(7),'rerender cleanup releases active capture');eq(frames.size,0);ok(resize.disconnected);eq(Object.values(map.handlers).flat().length,0);eq(Object.values(results.handlers).flat().length,0);eq(Object.values(view.handlers).flat().length,0);cleanup();
const empty=new Node();eq(typeof N.mount(empty),'function');
console.log(checks+' object comparison navigation geometry/event checks passed');
