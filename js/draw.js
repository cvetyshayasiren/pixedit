'use strict';

const PALETTE=['#000000','#1A1C2C','#333C57','#566C86','#94B0C2','#C2C3C7','#F4F4F4','#FFFFFF',
'#5D275D','#7E2553','#B13E53','#FF004D','#FF77A8','#FFCCAA','#AB5236','#EF7D57',
'#FFA300','#FFCD75','#FFEC27','#FFF1E8','#008751','#257179','#38B764','#00E436',
'#A7F070','#29366F','#3B5DC9','#29ADFF','#41A6F6','#73EFF7','#83769C','#5F574F'];
const TOOL_NAMES={brush:'Кисть',eraser:'Ластик',picker:'Пипетка',fill:'Заливка'};
const TOOL_COLORS={brush:'#A78BFA',eraser:'#FF3D8B',picker:'#29D9FF',fill:'#FFB020'};

const Draw={
  w:32,h:32,tool:'brush',brush:1,color:hexToRgb('#41A6F6'),hex:'#41A6F6',
  imgData:null,undoStack:[],redoStack:[],stroke:false,eraseStroke:false,last:null,hover:null,recent:[],lastTick:0,
  stage:null,ctx:null,

  init(){
    this.ctx=$('#dCanvas').getContext('2d',{willReadFrequently:true});
    this.stage=new StageView($('#dArea'),$('#dWrap'),$('#dCanvas'),$('#dOverlay'));
    this.stage.extra=c=>this.drawHover(c);
    wireZoom(this.stage,{minus:'#dZoomOut',plus:'#dZoomIn',range:'#dZoomRange',label:'#dZoomLabel',fit:'#dFitBtn',grid:'#dGridBtn'});
    this.initCanvas(32,32);
    const saved=store.get('pl_color','#41a6f6');
    this.setColor(/^#[0-9a-f]{6}$/i.test(saved)?saved:'#41a6f6');
    this.buildPalette();this.renderRecent();

    $$('#toolBtns .tool').forEach(b=>b.addEventListener('click',()=>this.setTool(b.dataset.tool)));
    $$('#brushSeg button').forEach(b=>b.addEventListener('click',()=>this.setBrush(+b.dataset.size)));
    $('#undoBtn').addEventListener('click',()=>this.undo());
    $('#redoBtn').addEventListener('click',()=>this.redo());
    $('#clearBtn').addEventListener('click',()=>this.requestClear());
    $('#spriteBtn').addEventListener('click',()=>this.stampSprite());
    $('#createBtn').addEventListener('click',()=>this.requestCreate());
    $('#presetSel').addEventListener('change',e=>{
      if(e.target.value!=='custom'){$('#wInput').value=e.target.value;$('#hInput').value=e.target.value;}
      Sound.blip(540,.03);
    });
    const markCustom=()=>{
      const w=$('#wInput').value,h=$('#hInput').value;
      $('#presetSel').value=(w===h&&['16','32','64','128'].includes(w))?w:'custom';
    };
    $('#wInput').addEventListener('input',markCustom);
    $('#hInput').addEventListener('input',markCustom);
    $('#colorInput').addEventListener('input',e=>this.setColor(e.target.value));
    $('#hexInput').addEventListener('change',e=>{
      let v=e.target.value.trim();if(!v.startsWith('#'))v='#'+v;
      if(/^#[0-9a-f]{6}$/i.test(v)){this.setColor(v);Sound.blip(880,.04);}
      else{e.target.value=this.hex;e.target.classList.add('shake');setTimeout(()=>e.target.classList.remove('shake'),350);toast('Неверный HEX-код. Формат: #RRGGBB','warn');}
    });
    $('#dExportBtn').addEventListener('click',()=>{
      downloadPNG(this.imgData,`pixel-art-${this.w}x${this.h}.png`);
      toast(`PNG сохранён: ${this.w}×${this.h} px, с прозрачностью`,'success');Sound.arp([660,880,1320]);
    });

    const ov=$('#dOverlay');
    ov.addEventListener('contextmenu',e=>e.preventDefault());
    ov.addEventListener('pointerdown',e=>{
      if(modalOpen)return;
      const p=this.stage.pixelFromEvent(e);if(!p.inside)return;
      ov.setPointerCapture(e.pointerId);
      if(this.tool==='picker'||e.altKey){this.pick(p);return;}
      const erase=this.tool==='eraser'||(this.tool==='brush'&&e.button===2);
      if(this.tool==='fill'){if(e.button===0)this.doFill(p);return;}
      if(e.button!==0&&e.button!==2)return;
      this.pushHistory();this.stroke=true;this.eraseStroke=erase;this.last=p;
      this.paintBrush(p.x,p.y,erase);this.render();this.addRecent();this.tickSound(p,erase);
    });
    ov.addEventListener('pointermove',e=>{
      const p=this.stage.pixelFromEvent(e);
      this.hover=p;this.updateCoords(p.inside?p:null);
      if(this.stroke){
        this.line(this.last.x,this.last.y,p.x,p.y,(x,y)=>this.paintBrush(x,y,this.eraseStroke));
        this.last=p;this.render();this.tickSound(p,this.eraseStroke);
      }
      this.stage.redrawOverlay();
    });
    const endStroke=()=>{if(this.stroke){this.stroke=false;this.updateEmptyChip();}};
    ov.addEventListener('pointerup',endStroke);
    ov.addEventListener('pointercancel',endStroke);
    ov.addEventListener('pointerleave',()=>{if(!this.stroke){this.hover=null;this.updateCoords(null);this.stage.redrawOverlay();}});
    this.setTool('brush');this.setBrush(1);
  },

  initCanvas(w,h){
    this.w=w;this.h=h;
    this.stage.setContentSize(w,h);
    this.imgData=new ImageData(w,h);
    this.render();
    this.undoStack=[];this.redoStack=[];this.syncHistory();
    $('#dSizeChip').textContent=`${w}×${h} px`;
    $('#dExportHint').textContent=`Файл ${w}×${h} px · прозрачность сохраняется · без масштабирования`;
    this.updateEmptyChip();this.stage.fit();
  },
  async requestCreate(){
    const w=parseInt($('#wInput').value,10),h=parseInt($('#hInput').value,10);
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>512||h>512){
      toast('Неверный размер: укажите целые числа от 1 до 512','error');
      [$('#wInput'),$('#hInput')].forEach(i=>{i.classList.add('shake');setTimeout(()=>i.classList.remove('shake'),350);});
      return;
    }
    if(this.hasContent()){
      const ok=await confirmDialog({title:'СОЗДАТЬ НОВЫЙ ХОЛСТ?',
        message:`Текущий рисунок ${this.w}×${this.h} будет удалён. Отменить это действие будет нельзя.`,
        confirmText:'Создать холст',danger:true});
      if(!ok)return;
    }
    this.initCanvas(w,h);
    toast(`Холст ${w}×${h} создан`,'success');Sound.arp([520,780]);
  },
  async requestClear(){
    if(!this.hasContent()){toast('Холст уже пуст','info');return;}
    const ok=await confirmDialog({title:'ОЧИСТИТЬ ХОЛСТ?',
      message:'Весь рисунок будет удалён. Вернуть его можно через «Отменить» (Ctrl+Z).',
      confirmText:'Очистить',danger:true});
    if(!ok)return;
    this.pushHistory();this.imgData.data.fill(0);this.render();this.updateEmptyChip();
    toast('Холст очищен — Ctrl+Z вернёт рисунок','success');Sound.blip(300,.09,'square',150);
  },
  hasContent(){const d=this.imgData.data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;return false;},
  render(){this.ctx.putImageData(this.imgData,0,0);},
  updateEmptyChip(){$('#dEmptyChip').hidden=this.hasContent();},
  updateCoords(p){$('#dCoords').textContent=p?`X:${String(p.x).padStart(2,'0')} Y:${String(p.y).padStart(2,'0')}`:'X:— Y:—';},

  historyCap(){return clamp(Math.floor(48e6/(this.w*this.h*4)),8,80);},
  pushHistory(){
    this.undoStack.push(this.imgData.data.slice());
    if(this.undoStack.length>this.historyCap())this.undoStack.shift();
    this.redoStack.length=0;this.syncHistory();
  },
  undo(){
    if(!this.undoStack.length)return;
    this.redoStack.push(this.imgData.data.slice());
    const snap=this.undoStack.pop();
    this.imgData=new ImageData(new Uint8ClampedArray(snap),this.w,this.h);
    this.render();this.syncHistory();this.updateEmptyChip();Sound.blip(500,.06,'square',300);
  },
  redo(){
    if(!this.redoStack.length)return;
    this.undoStack.push(this.imgData.data.slice());
    const snap=this.redoStack.pop();
    this.imgData=new ImageData(new Uint8ClampedArray(snap),this.w,this.h);
    this.render();this.syncHistory();this.updateEmptyChip();Sound.blip(300,.06,'square',520);
  },
  syncHistory(){$('#undoBtn').disabled=!this.undoStack.length;$('#redoBtn').disabled=!this.redoStack.length;},

  setTool(t){
    this.tool=t;
    $$('#toolBtns .tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));
    this.updateToolChip();this.stage.redrawOverlay();Sound.blip(600,.035);
  },
  setBrush(n){
    this.brush=clamp(n,1,3);
    $$('#brushSeg button').forEach(b=>b.classList.toggle('on',+b.dataset.size===this.brush));
    this.updateToolChip();this.stage.redrawOverlay();Sound.blip(480+this.brush*80,.03);
  },
  updateToolChip(){
    $('#dToolName').textContent=(this.tool==='brush'||this.tool==='eraser')?`${TOOL_NAMES[this.tool]} ${this.brush}×${this.brush}`:TOOL_NAMES[this.tool];
  },
  setColor(hex){
    this.hex=hex.toUpperCase();this.color=hexToRgb(this.hex);
    $('#colorInput').value=this.hex.toLowerCase();
    $('#hexInput').value=this.hex;
    $('#dColorChip').style.background=this.hex;
    $('#dColorHex').textContent=this.hex;
    const pv=$('#curPreview');pv.style.background=this.hex;pv.style.boxShadow=`0 0 16px ${this.hex}66`;
    $$('#swatchGrid .swatch').forEach(s=>s.classList.toggle('sel',s.dataset.hex===this.hex));
    store.set('pl_color',this.hex);
  },
  buildPalette(){
    const g=$('#swatchGrid');g.innerHTML='';
    PALETTE.forEach(hex=>{
      const b=document.createElement('button');b.className='swatch';b.dataset.hex=hex;
      b.style.background=hex;b.title=hex;b.setAttribute('aria-label','Цвет '+hex);
      b.addEventListener('click',()=>{this.setColor(hex);Sound.blip(880,.035);});
      g.appendChild(b);
    });
  },
  addRecent(){
    this.recent=[this.hex,...this.recent.filter(h=>h!==this.hex)].slice(0,10);this.renderRecent();
  },
  renderRecent(){
    const r=$('#recentRow');r.innerHTML='';
    for(let i=0;i<10;i++){
      if(this.recent[i]){
        const b=document.createElement('button');b.className='swatch';b.style.background=this.recent[i];b.title=this.recent[i];
        b.addEventListener('click',()=>{this.setColor(this.recent[i]);Sound.blip(880,.035);});
        r.appendChild(b);
      }else{const s=document.createElement('span');s.className='slot';r.appendChild(s);}
    }
  },

  paintBrush(px,py,erase){
    const n=this.brush,off=Math.floor((n-1)/2),d=this.imgData.data,{r,g,b}=this.color;
    for(let dy=0;dy<n;dy++)for(let dx=0;dx<n;dx++){
      const x=px-off+dx,y=py-off+dy;
      if(x<0||y<0||x>=this.w||y>=this.h)continue;
      const i=(y*this.w+x)*4;
      if(erase){d[i]=0;d[i+1]=0;d[i+2]=0;d[i+3]=0;}
      else{d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}
    }
  },
  line(x0,y0,x1,y1,cb){
    let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    for(;;){cb(x0,y0);if(x0===x1&&y0===y1)break;const e2=2*err;
      if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
  },
  doFill(p){
    const{width:w,height:h,data:d}=this.imgData,i0=(p.y*w+p.x)*4;
    const tr=d[i0],tg=d[i0+1],tb=d[i0+2],ta=d[i0+3];
    const{r,g,b}=this.color;
    if(tr===r&&tg===g&&tb===b&&ta===255){toast('Область уже этого цвета','info');return;}
    const match=i=>d[i]===tr&&d[i+1]===tg&&d[i+2]===tb&&d[i+3]===ta;
    this.pushHistory();
    const stack=[p.x,p.y];
    while(stack.length){
      const cy=stack.pop(),cx=stack.pop();
      if(!match((cy*w+cx)*4))continue;
      let xL=cx,iL=(cy*w+cx)*4;while(xL>0&&match(iL-4)){xL--;iL-=4;}
      let xR=cx,iR=(cy*w+cx)*4;while(xR<w-1&&match(iR+4)){xR++;iR+=4;}
      for(let x=xL;x<=xR;x++){
        const k=(cy*w+x)*4;d[k]=r;d[k+1]=g;d[k+2]=b;d[k+3]=255;
        if(cy>0&&match(k-w*4))stack.push(x,cy-1);
        if(cy<h-1&&match(k+w*4))stack.push(x,cy+1);
      }
    }
    this.render();this.addRecent();this.updateEmptyChip();
    Sound.blip(400,.05);setTimeout(()=>Sound.blip(660,.06),55);
  },
  pick(p){
    const i=(p.y*this.w+p.x)*4,d=this.imgData.data;
    if(d[i+3]===0){toast('Прозрачный пиксель — цвет не выбран','info');return;}
    this.setColor(rgbToHex(d[i],d[i+1],d[i+2]));this.addRecent();
    this.setTool('brush');Sound.blip(980,.05);
  },
  tickSound(p,erase){
    const now=performance.now();if(now-this.lastTick<70)return;this.lastTick=now;
    Sound.blip(erase?260:500+((p.x+p.y)%5)*45,.028);
  },
  drawHover(c){
    if(!this.hover||!this.hover.inside)return;
    const z=this.stage.zoom,n=(this.tool==='brush'||this.tool==='eraser')?this.brush:1,off=Math.floor((n-1)/2);
    const x=(this.hover.x-off)*z,y=(this.hover.y-off)*z,s=n*z,col=TOOL_COLORS[this.tool];
    c.fillStyle=col+'22';c.fillRect(x,y,s,s);
    c.strokeStyle=col;c.lineWidth=2;
    if(this.tool==='eraser')c.setLineDash([4,3]);
    c.strokeRect(x+1,y+1,s-2,s-2);c.setLineDash([]);
  },
  stampSprite(){
    const pat=['..X.....X..','...X...X...','..XXXXXXX..','.XX.XXX.XX.','XXXXXXXXXXX','X.XXXXXXX.X','X.X.....X.X','...XX.XX...'];
    const s=clamp(Math.min(Math.floor(this.w/11),Math.floor(this.h/8)),1,8);
    const ox=Math.floor((this.w-11*s)/2),oy=Math.floor((this.h-8*s)/2);
    this.pushHistory();
    const d=this.imgData.data;
    const put=(x,y,hex)=>{const{r,g,b}=hexToRgb(hex);for(let dy=0;dy<s;dy++)for(let dx=0;dx<s;dx++){
      const px=x+dx,py=y+dy;if(px<0||py<0||px>=this.w||py>=this.h)continue;
      const i=(py*this.w+px)*4;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}};
    pat.forEach((row,ry)=>[...row].forEach((ch,rx)=>{
      if(ch!=='X')return;
      const hex=ry===0?'#FF3D8B':ry<3?'#A7F070':'#00E436';
      put(ox+rx*s,oy+ry*s,hex);
    }));
    put(ox+3*s,oy+3*s,'#1A1C2C');put(ox+7*s,oy+3*s,'#1A1C2C');
    this.render();this.updateEmptyChip();
    toast('Спрайт добавлен — попробуйте инструменты! Ctrl+Z уберёт его','success');Sound.arp([520,660,880]);
  },
  adopt(data){
    $('#wInput').value=data.width;$('#hInput').value=data.height;
    $('#presetSel').value=(data.width===data.height&&['16','32','64','128'].includes(String(data.width)))?String(data.width):'custom';
    this.w=data.width;this.h=data.height;
    this.stage.setContentSize(this.w,this.h);
    this.imgData=new ImageData(new Uint8ClampedArray(data.data),data.width,data.height);
    this.render();this.undoStack=[];this.redoStack=[];this.syncHistory();
    $('#dSizeChip').textContent=`${this.w}×${this.h} px`;
    $('#dExportHint').textContent=`Файл ${this.w}×${this.h} px · прозрачность сохраняется · без масштабирования`;
    this.updateEmptyChip();this.stage.fit();
  }
};
