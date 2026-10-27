/* Geometry-based navigation for rendered, read-only object and original-field pages. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SWComparisonNavigation=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clamp(value,low,high){return Math.min(Math.max(low,Number.isFinite(value)?value:low),Math.max(low,high));}
  function viewportGeometry(total,visible,top,track){
    total=Math.max(0,total||0);visible=Math.max(0,visible||0);track=Math.max(0,track||0);
    var max=Math.max(0,total-visible),height=max?Math.min(track,Math.max(4,track*visible/Math.max(1,total))):track;
    return {height:height,top:max?clamp(top,0,max)/max*(track-height):0,max:max,travel:Math.max(0,track-height)};
  }
  function dragScroll(position,offset,total,visible,track){var g=viewportGeometry(total,visible,0,track);return g.travel?clamp(position-offset,0,g.travel)/g.travel*g.max:0;}
  function mapScroll(position,total,visible,track){return clamp((track?position/track:0)*total-visible/2,0,Math.max(0,total-visible));}
  function activeSection(sections,top,visible,total){
    if(!sections.length)return '';
    if(total>visible&&top+visible>=total-2)return sections[sections.length-1].key;
    var found=sections[0].key;sections.forEach(function(section){if(section.top<=top+2)found=section.key;});return found;
  }
  function markerItems(items){
    var markers=[],collapsed=new Map();items.forEach(function(item){
      if(!item.collapsed){markers.push(Object.assign({},item,{count:1}));return;}
      var key=item.groupKey+':'+item.kind,marker=collapsed.get(key);
      if(marker)marker.count++;else {marker=Object.assign({},item,{count:1});collapsed.set(key,marker);markers.push(marker);}
    });return markers;
  }
  function mount(container,options){
    options=options||{};

    var fields=!!container.querySelector('.comparison-field-minimap'),results=container.querySelector(fields?'.comparison-field-results .data-wrap':'.comparison-object-results');if(!results)return function(){};
    var map=container.querySelector(fields?'.comparison-field-minimap':'.comparison-object-minimap'),viewport=map&&map.querySelector('.comparison-object-map-viewport'),layer=map&&map.querySelector('.comparison-object-map-markers'),nav=container.querySelector('.comparison-bookmarks');
    var doc=container.ownerDocument,view=doc&&doc.defaultView||globalThis,raf=view.requestAnimationFrame?view.requestAnimationFrame.bind(view):function(fn){return setTimeout(fn,16);},cancel=view.cancelAnimationFrame?view.cancelAnimationFrame.bind(view):clearTimeout;
    var groups=fields?[]:Array.from(results.querySelectorAll('.comparison-object-group')),cards=Array.from(results.querySelectorAll(fields?'[data-field-diff-kind]':'.comparison-card')),buttons=nav?Array.from(nav.querySelectorAll('[data-comparison-section]')):[],sections=[],items=[],disposed=false,frame=null,geometryPending=false,measuredTotal=null,observer=null,drag=null,suppressClick=false,listeners=[];
    if(map&&!layer){layer=doc.createElement('div');layer.className='comparison-object-map-markers';map.appendChild(layer);}
    function listen(node,name,fn,options){if(!node)return;node.addEventListener(name,fn,options);listeners.push(function(){node.removeEventListener(name,fn,options);});}
    function bounds(){return {total:results.scrollHeight||0,visible:results.clientHeight||0,track:map?map.clientHeight||0:0};}
    function isCollapsed(group){return !!group&&group.getAttribute('data-comparison-collapsible')==='true'&&!group.open;}
    function rememberSections(){if(!options.collapsedSections)return;groups.forEach(function(group){if(group.getAttribute('data-comparison-collapsible')!=='true')return;var key=group.getAttribute('data-comparison-category');if(isCollapsed(group))options.collapsedSections.add(key);else options.collapsedSections.delete(key);});}

    function update(){
      if(disposed)return;var b=bounds();
      // Scroll anchoring can run before ResizeObserver after details expand.
      // Never publish a new extent beside markers measured against the old one.
      if(b.total!==measuredTotal){schedule(true);return;}
      var top=clamp(results.scrollTop,0,Math.max(0,b.total-b.visible)),active=activeSection(sections,top,b.visible,b.total);
      buttons.forEach(function(button){var selected=button.getAttribute('data-comparison-section')===active;button.classList.toggle('active',selected);if(selected)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');var section=sections.find(function(section){return section.key===button.getAttribute('data-comparison-section');});if(section)button.setAttribute('aria-expanded',String(!section.collapsed));});
      if(map&&viewport){var g=viewportGeometry(b.total,b.visible,top,b.track);viewport.style.top=g.top+'px';viewport.style.height=g.height+'px';viewport.style.pointerEvents=g.max?'auto':'none';map.setAttribute('aria-valuemin','0');map.setAttribute('aria-valuemax',String(Math.round(g.max)));map.setAttribute('aria-valuenow',String(Math.round(top)));map.setAttribute('aria-valuetext',items.length?'Current page: '+items.length+(fields?' fields; ':' objects; ')+Math.round(top/Math.max(1,g.max)*100)+'% through results':fields?'No fields on this page':'No objects on this page');map.setAttribute('aria-disabled',String(!g.max&&!items.some(function(item){return item.collapsed;})));}
    }
    function measure(){
      if(disposed)return;var origin=results.getBoundingClientRect().top+(results.clientTop||0),scroll=results.scrollTop,extent=results.scrollHeight||0,total=extent||1,fieldHeader=fields&&results.querySelector('thead'),fieldHeaderHeight=fieldHeader?fieldHeader.getBoundingClientRect().height:0;
      sections=groups.filter(function(group){return !!group.querySelector('.comparison-card');}).map(function(group){var key=group.getAttribute('data-comparison-category'),heading=group.querySelector('.comparison-group-heading'),button=buttons.find(function(button){return button.getAttribute('data-comparison-section')===key;});return {key:key,node:group,collapsed:isCollapsed(group),top:Math.max(0,group.getBoundingClientRect().top-origin+scroll),height:heading?heading.getBoundingClientRect().height:0,label:group.getAttribute('data-comparison-label')||(button?button.textContent.trim():key)};});
      items=cards.map(function(card,index){var rect=card.getBoundingClientRect(),group=card.closest('.comparison-object-group'),section=sections.find(function(section){return group&&section.key===group.getAttribute('data-comparison-category');}),label=card.querySelector('.detail-label'),kind=(card.getAttribute(fields?'data-field-diff-kind':'data-object-kind')||'Unchanged').toLowerCase();return {index:index,groupKey:section?section.key:'',groupLabel:section?section.label:'',collapsed:!!(section&&section.collapsed),top:section&&section.collapsed?section.top:Math.max(0,rect.top-origin+scroll),height:section&&section.collapsed?section.height:Math.max(0,rect.height),headingHeight:fields?fieldHeaderHeight:section?section.height:0,kind:['added','removed','changed','unchanged'].includes(kind)?kind:'unchanged',label:fields?card.getAttribute('data-diff-key')||'Field '+(index+1):label?label.textContent.trim():'Object '+(index+1)};});
      if(layer){var fragment=doc.createDocumentFragment();markerItems(items).forEach(function(item){var mark=doc.createElement('span');mark.className='comparison-object-map-marker'+(fields?' comparison-field-map-marker':'')+(item.collapsed?' comparison-object-map-aggregate':'');mark.setAttribute('data-object-map-count',String(item.count));if(item.collapsed){mark.setAttribute('data-object-map-collapsed','true');mark.setAttribute('data-object-map-group',item.groupKey);mark.style.left=(['added','removed','changed','unchanged'].indexOf(item.kind)*25)+'%';mark.style.width='25%';mark.style.right='auto';}if(fields){mark.setAttribute('data-field-map-index',String(item.index));mark.setAttribute('data-field-map-kind',item.kind);}mark.setAttribute('data-object-map-kind',item.kind);mark.setAttribute('data-object-map-index',String(item.index));mark.setAttribute('data-object-map-top',String(item.top));mark.style.top=clamp(item.top/total*100,0,100)+'%';mark.style.height=clamp(item.height/total*100,0,100-item.top/total*100)+'%';mark.title=item.collapsed?item.groupLabel+' collapsed · '+item.count+' '+item.kind+' object'+(item.count===1?'':'s')+' · expand to '+item.label:item.kind.charAt(0).toUpperCase()+item.kind.slice(1)+' · '+item.label;fragment.appendChild(mark);});sections.forEach(function(section){var mark=doc.createElement('span');mark.className='comparison-object-map-section';mark.setAttribute('data-object-map-section',section.key);mark.setAttribute('data-object-map-top',String(section.top));mark.style.top=clamp(section.top/total*100,0,100)+'%';mark.title='Section · '+section.label+(section.collapsed?' (collapsed; expand to navigate)':'');fragment.appendChild(mark);});layer.replaceChildren(fragment);}
      measuredTotal=extent;if(map)map.setAttribute('data-object-map-total',String(measuredTotal));
      update();
    }
    function schedule(geometry){if(disposed)return;geometryPending=geometryPending||geometry;if(frame!==null)return;frame=raf(function(){frame=null;var needsGeometry=geometryPending;geometryPending=false;if(needsGeometry)measure();else update();});}
    function jump(top){results.scrollTop=clamp(top,0,Math.max(0,results.scrollHeight-results.clientHeight));update();}
    function endDrag(event){
      if(!drag||event&&event.pointerId!==undefined&&event.pointerId!==drag.id)return;
      var id=drag.id;drag=null;suppressClick=true;if(map){map.removeAttribute('data-object-map-dragging');try{if(map.hasPointerCapture&&map.hasPointerCapture(id))map.releasePointerCapture(id);}catch(error){/* Capture may already have been released by the browser. */}}
    }
    function expandSection(key){
      var section=sections.find(function(section){return section.key===key;});
      if(section&&section.collapsed){section.node.open=true;rememberSections();geometryPending=false;measure();section=sections.find(function(section){return section.key===key;});}
      return section;
    }
    listen(nav,'click',function(event){var button=event.target.closest&&event.target.closest('[data-comparison-section]');if(!button||!nav.contains(button))return;var section=expandSection(button.getAttribute('data-comparison-section'));if(section){event.preventDefault();jump(section.top);}});
    function jumpFromPoint(event){
      var mark=event.target.closest&&event.target.closest('[data-object-map-index]'),sectionMark=event.target.closest&&event.target.closest('[data-object-map-section]'),item=mark&&items[Number(mark.getAttribute('data-object-map-index'))],section=sectionMark&&sections.find(function(section){return section.key===sectionMark.getAttribute('data-object-map-section');});
      if(viewport&&viewport.contains(event.target))return;
      if(item){if(item.collapsed){var index=item.index;expandSection(item.groupKey);item=items[index];}jump(item.top-item.headingHeight);}else if(section){section=expandSection(section.key);jump(section.top);}else {var b=bounds();jump(mapScroll(event.clientY-map.getBoundingClientRect().top,b.total,b.visible,b.track));}
    }
    listen(map,'pointerdown',function(event){
      if(drag)return;
      suppressClick=false;if(event.button!==0||event.isPrimary===false||!viewport)return;
      if(bounds().total!==measuredTotal||geometryPending)measure();
      jumpFromPoint(event);suppressClick=true;if(map.focus)map.focus({preventScroll:true});event.preventDefault();
      var b=bounds(),g=viewportGeometry(b.total,b.visible,results.scrollTop,b.track);if(!g.max||!g.travel)return;
      // A track/marker press jumps first, then preserves that exact position as
      // the drag origin. This avoids a second jump when grabbing outside the thumb.
      drag={id:event.pointerId,startY:event.clientY,startTop:results.scrollTop};map.setAttribute('data-object-map-dragging','true');
      try{map.setPointerCapture(event.pointerId);}catch(error){drag=null;map.removeAttribute('data-object-map-dragging');}
    });
    listen(map,'pointermove',function(event){if(!drag||event.pointerId!==drag.id)return;var b=bounds(),g=viewportGeometry(b.total,b.visible,results.scrollTop,b.track);jump(drag.startTop+(g.travel?(event.clientY-drag.startY)/g.travel*g.max:0));event.preventDefault();});
    listen(map,'pointerup',endDrag);listen(map,'pointercancel',endDrag);listen(map,'lostpointercapture',endDrag);
    listen(map,'click',function(event){
      if(suppressClick){suppressClick=false;event.preventDefault();return;}
      jumpFromPoint(event);if(map.focus)map.focus({preventScroll:true});
    });
    listen(map,'keydown',function(event){var max=Math.max(0,results.scrollHeight-results.clientHeight),top=results.scrollTop,page=Math.max(48,results.clientHeight*.9),next={Home:0,End:max,ArrowUp:top-48,ArrowDown:top+48,PageUp:top-page,PageDown:top+page}[event.key];if(next!==undefined){endDrag();event.preventDefault();jump(next);}});
    listen(results,'scroll',function(){schedule(false);},{passive:true});listen(results,'toggle',function(){rememberSections();schedule(true);},true);
    listen(view,'resize',function(){schedule(true);});listen(view,'blur',function(){endDrag();});
    if(view.ResizeObserver){observer=new view.ResizeObserver(function(){schedule(true);});[results,map].concat(groups,cards).filter(Boolean).forEach(function(node){observer.observe(node);});}
    measure();
    return function(){if(disposed)return;rememberSections();disposed=true;endDrag();if(frame!==null)cancel(frame);if(observer)observer.disconnect();listeners.forEach(function(remove){remove();});listeners=[];};
  }
  return {mount:mount,viewportGeometry:viewportGeometry,dragScroll:dragScroll,mapScroll:mapScroll,activeSection:activeSection,markerItems:markerItems};
});
