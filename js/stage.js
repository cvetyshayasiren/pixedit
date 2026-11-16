'use strict';

class StageView{
  constructor(area,wrap,canvas,overlay){
    this.area=area;this.wrap=wrap;this.canvas=canvas;this.overlay=overlay;
    this.octx=overlay.getContext('2d');
    this.w=0;this.h=0;this.zoom=12;this.autoFit=true;this.gridOn=true;this.extra=null;this.onZoom=null;
    this.ro=new ResizeObserver(()=>{if(area.clientWidth>40)this.refresh();});
    this.ro.observe(area);
  }
  setContentSize(w,h){
    this.w=w;this.h=h;this.canvas.width=w;this.canvas.height=h;this.autoFit=true;this.refresh();
  }
  refresh(){this.autoFit?this.fit():this.layout();}
  fit(){
    if(!this.w||this.area.clientWidth<40)return;
    const z=Math.floor(Math.min((this.area.clientWidth-36)/this.w,(this.area.clientHeight-36)/this.h));
    this.zoom=clamp(z||1,1,64);this.autoFit=true;this.layout();
  }
  setZoom(z,manual=true){this.zoom=clamp(Math.round(z),1,64);if(manual)this.autoFit=false;this.layout();}
  layout(){
    if(!this.w)return;
    const dw=this.w*this.zoom,dh=this.h*this.zoom;
    this.wrap.style.width=dw+'px';this.wrap.style.height=dh+'px';
    this.wrap.style.setProperty('--cell',this.zoom+'px');
    const dpr=Math.min(2,window.devicePixelRatio||1);
    this.overlay.width=Math.max(1,Math.round(dw*dpr));this.overlay.height=Math.max(1,Math.round(dh*dpr));
    this.overlay.style.width=dw+'px';this.overlay.style.height=dh+'px';
    this.octx.setTransform(dpr,0,0,dpr,0,0);
    this.redrawOverlay();
    if(this.onZoom)this.onZoom(this.zoom);
  }
  redrawOverlay(t=performance.now()){
    if(!this.w)return;
    const c=this.octx,dw=this.w*this.zoom,dh=this.h*this.zoom;
    c.clearRect(0,0,dw,dh);
    if(this.gridOn&&this.zoom>=6){
      c.strokeStyle='rgba(154,163,209,.15)';c.lineWidth=1;c.beginPath();
      for(let x=1;x<this.w;x++){c.moveTo(x*this.zoom+.5,0);c.lineTo(x*this.zoom+.5,dh);}
      for(let y=1;y<this.h;y++){c.moveTo(0,y*this.zoom+.5);c.lineTo(dw,y*this.zoom+.5);}
      c.stroke();
    }
    if(this.extra)this.extra(c,t);
  }
  pixelFromEvent(e){
    const r=this.canvas.getBoundingClientRect();
    const x=Math.floor((e.clientX-r.left)/this.zoom),y=Math.floor((e.clientY-r.top)/this.zoom);
    return{x:clamp(x,0,this.w-1),y:clamp(y,0,this.h-1),inside:x>=0&&y>=0&&x<this.w&&y<this.h};
  }
}

const zoomStep=z=>z<=4?1:z<=12?2:4;
function wireZoom(stage,ids){
  const range=$(ids.range),label=$(ids.label),grid=$(ids.grid);
  $(ids.minus).addEventListener('click',()=>{stage.setZoom(stage.zoom-zoomStep(stage.zoom));Sound.blip(420,.03);});
  $(ids.plus).addEventListener('click',()=>{stage.setZoom(stage.zoom+zoomStep(stage.zoom));Sound.blip(560,.03);});
  range.addEventListener('input',()=>stage.setZoom(+range.value));
  $(ids.fit).addEventListener('click',()=>{stage.fit();Sound.blip(660,.04);});
  grid.addEventListener('click',()=>{
    stage.gridOn=!stage.gridOn;grid.classList.toggle('on',stage.gridOn);
    grid.setAttribute('aria-pressed',String(stage.gridOn));stage.redrawOverlay();Sound.blip(700,.03);
  });
  stage.onZoom=z=>{range.value=z;label.textContent='×'+z;};
}
