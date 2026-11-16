'use strict';

const Photo={
  srcCanvas:null,srcData:null,srcW:0,srcH:0,
  full:null,cropped:null,sel:null,dragStart:null,dragging:false,
  jobId:0,antsRaf:0,stage:null,ctx:null,

  init(){
    this.ctx=$('#pCanvas').getContext('2d',{willReadFrequently:true});
    this.stage=new StageView($('#pArea'),$('#pWrap'),$('#pCanvas'),$('#pOverlay'));
    this.stage.extra=(c,t)=>this.drawCrop(c,t);
    wireZoom(this.stage,{minus:'#pZoomOut',plus:'#pZoomIn',range:'#pZoomRange',label:'#pZoomLabel',fit:'#pFitBtn',grid:'#pGridBtn'});

    const dz=$('#dropZone'),fi=$('#fileInput');
    dz.addEventListener('click',()=>fi.click());
    dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click();}});
    fi.addEventListener('change',()=>{if(fi.files[0])this.loadFile(fi.files[0]);fi.value='';});
    let dragCnt=0;
    dz.addEventListener('dragenter',e=>{e.preventDefault();dragCnt++;dz.classList.add('drag');});
    dz.addEventListener('dragleave',()=>{dragCnt=Math.max(0,dragCnt-1);if(!dragCnt)dz.classList.remove('drag');});
    window.addEventListener('dragover',e=>e.preventDefault());
    window.addEventListener('drop',e=>{
      e.preventDefault();dragCnt=0;dz.classList.remove('drag');
      const f=[...(e.dataTransfer?.files||[])].find(f=>/^image\//.test(f.type)||/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(f.name));
      if(f){if(App.tab!=='photo')App.switchTab('photo');this.loadFile(f);}
      else if(e.dataTransfer?.files?.length)toast('Неподдерживаемый файл. Загрузите изображение (PNG, JPG, WebP, GIF).','error');
    });
    $('#demoBtn').addEventListener('click',()=>this.loadDemo());
    $('#pEmptyDemoBtn').addEventListener('click',()=>this.loadDemo());
    $('#removeSrcBtn').addEventListener('click',()=>this.removeSource());

    const schedule=debounce(()=>this.process(false),240);
    $('#sizeSel').addEventListener('change',()=>{Sound.blip(540,.03);schedule();});
    $('#algoSel').addEventListener('change',()=>{this.updateAlgoUI();Sound.blip(600,.03);schedule();});
    $('#colorsRange').addEventListener('input',()=>{$('#colorsVal').textContent=$('#colorsRange').value;schedule();});
    $('#ditherChk').addEventListener('change',()=>{Sound.blip(700,.03);schedule();});
    $('#smoothChk').addEventListener('change',()=>{this.applySmoothing();Sound.blip(700,.03);});
    $('#applyBtn').addEventListener('click',()=>{Sound.blip(660,.04);this.process(true);});
    $('#cropApplyBtn').addEventListener('click',()=>this.applyCrop());
    $('#cropResetBtn').addEventListener('click',()=>this.resetCrop());
    $('#pExportBtn').addEventListener('click',()=>{
      const d=this.cropped||this.full;if(!d)return;
      downloadPNG(d,`pixel-photo-${d.width}x${d.height}.png`);
      toast(`PNG сохранён: ${d.width}×${d.height} px, без масштабирования`,'success');Sound.arp([660,880,1320]);
    });
    $('#toDrawBtn').addEventListener('click',()=>this.toDrawing());

    const ov=$('#pOverlay');
    ov.addEventListener('contextmenu',e=>e.preventDefault());
    ov.addEventListener('pointerdown',e=>{
      if(!this.full||modalOpen||e.button!==0)return;
      ov.setPointerCapture(e.pointerId);
      const p=this.stage.pixelFromEvent(e);
      this.dragStart=p;this.dragging=true;
      this.sel={x:p.x,y:p.y,w:1,h:1};
      this.startAnts();this.updateCropButtons();this.updateSelInfo();
    });
    ov.addEventListener('pointermove',e=>{
      if(!this.full)return;
      const p=this.stage.pixelFromEvent(e);
      $('#pCursor').textContent=p.inside?`X:${String(p.x).padStart(2,'0')} Y:${String(p.y).padStart(2,'0')}`:'X:— Y:—';
      if(this.dragging){
        const x0=Math.min(this.dragStart.x,p.x),y0=Math.min(this.dragStart.y,p.y);
        this.sel={x:x0,y:y0,w:Math.abs(p.x-this.dragStart.x)+1,h:Math.abs(p.y-this.dragStart.y)+1};
        this.updateSelInfo();
      }
    });
    const endDrag=()=>{
      if(!this.dragging)return;this.dragging=false;
      if(this.sel&&this.sel.w<=1&&this.sel.h<=1){this.sel=null;this.stopAnts();}
      this.updateCropButtons();this.updateSelInfo();this.stage.redrawOverlay();
      if(this.sel)Sound.blip(820,.04);
    };
    ov.addEventListener('pointerup',endDrag);
    ov.addEventListener('pointercancel',endDrag);
    ov.addEventListener('pointerleave',()=>{if(!this.dragging)$('#pCursor').textContent='X:— Y:—';});
    this.updateAlgoUI();this.updateControls();
  },

  async loadFile(file){
    const okType=/^image\//.test(file.type)||/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name||'');
    if(!okType){toast('Неподдерживаемый файл. Загрузите изображение (PNG, JPG, WebP, GIF).','error');return;}
    if(file.size>20*1048576){toast(`Файл ${fmtBytes(file.size)} — слишком большой. Максимум 20 МБ.`,'error');return;}
    const url=URL.createObjectURL(file);
    try{
      const img=await loadImage(url);
      const w=img.naturalWidth,h=img.naturalHeight;
      if(!w||!h)throw new Error('decode');
      if(w>4096||h>4096){toast(`Слишком большое изображение: ${w}×${h} px. Максимум — 4096 px по стороне.`,'error',5200);return;}
      this.setSource(img,w,h,{name:file.name||'изображение',size:file.size});
      toast(`Загружено: ${esc(file.name||'изображение')} · ${w}×${h} px`,'success');
    }catch(err){toast('Не удалось прочитать изображение. Попробуйте другой файл.','error');}
    finally{URL.revokeObjectURL(url);}
  },
  loadDemo(){
    const c=generateDemoPhoto();
    this.setSource(c,c.width,c.height,{name:'demo-zakat.png',size:null});
    toast('Демо-закат сгенерирован — попробуйте разные алгоритмы!','success');
  },
  setSource(source,w,h,meta){
    this.srcW=w;this.srcH=h;
    if(!this.srcCanvas)this.srcCanvas=document.createElement('canvas');
    this.srcCanvas.width=w;this.srcCanvas.height=h;
    const sx=this.srcCanvas.getContext('2d',{willReadFrequently:true});
    sx.clearRect(0,0,w,h);sx.drawImage(source,0,0);
    this.srcData=sx.getImageData(0,0,w,h);
    const pc=$('#previewCanvas'),px=pc.getContext('2d');
    px.imageSmoothingEnabled=true;px.clearRect(0,0,pc.width,pc.height);
    const sc=Math.min(pc.width/w,pc.height/h),dw=Math.round(w*sc),dh=Math.round(h*sc);
    px.drawImage(this.srcCanvas,(pc.width-dw)/2,(pc.height-dh)/2,dw,dh);
    $('#fileMeta').innerHTML=`<b>${esc(meta.name)}</b><br>${w}×${h} px · ${meta.size?fmtBytes(meta.size):'демо-изображение'}`;
    $('#previewCard').hidden=false;
    this.full=null;this.cropped=null;this.sel=null;this.stopAnts();
    this.updateControls();this.process(false);Sound.arp([520,700]);
  },
  removeSource(){
    this.jobId++;this.srcData=null;this.srcCanvas=null;this.full=null;this.cropped=null;this.sel=null;
    this.stopAnts();$('#previewCard').hidden=true;$('#procBadge').hidden=true;
    $('#pWrap').style.display='none';$('#pEmpty').hidden=false;
    $('#pResultInfo').textContent='— × —';$('#pExportHint').textContent='Экспорт в разрешении пиксель-арта, без масштабирования.';
    this.updateControls();this.updateCropButtons();this.updateSelInfo();
    toast('Изображение убрано','info');Sound.blip(300,.06,'square',180);
  },

  async process(manual){
    if(!this.srcData)return;
    const id=++this.jobId;
    $('#procBadge').hidden=false;
    await nextTick();
    const S=+$('#sizeSel').value,sw=this.srcW,sh=this.srcH;
    let tw,th;
    if(sw>=sh){tw=S;th=Math.max(1,Math.round(S*sh/sw));}
    else{th=S;tw=Math.max(1,Math.round(S*sw/sh));}
    const algo=$('#algoSel').value,isStale=()=>id!==this.jobId;
    let out=null;
    try{
      if(algo==='nearest')out=nearestConvert(this.srcCanvas,tw,th);
      else if(algo==='quantize'){
        out=await blockConvert(this.srcData.data,sw,sh,'average',tw,th,isStale);
        if(isStale()||!out)return;
        out=quantizeImage(out,+$('#colorsRange').value,$('#ditherChk').checked);
      }
      else out=await blockConvert(this.srcData.data,sw,sh,algo,tw,th,isStale);
    }catch(err){
      if(!isStale()){$('#procBadge').hidden=true;toast('Ошибка обработки изображения','error');}
      return;
    }
    if(isStale()||!out)return;
    this.full=out;this.cropped=null;this.sel=null;this.stopAnts();
    this.renderResult();
    $('#procBadge').hidden=true;
    if(manual)toast(`Готово: ${tw}×${th} px · ${ALGO_LABEL[algo]}`,'success');
    if(manual)Sound.arp([600,900]);
  },

  renderResult(){
    const d=this.cropped||this.full;if(!d)return;
    $('#pEmpty').hidden=true;$('#pWrap').style.display='block';
    this.stage.setContentSize(d.width,d.height);
    this.ctx.putImageData(d,0,0);
    this.applySmoothing();
    $('#pResultInfo').textContent=`${d.width}×${d.height} px`;
    $('#pExportHint').textContent=`PNG ${d.width}×${d.height} px · ${this.cropped?'после кадрирования · ':''}без масштабирования`;
    this.updateControls();this.updateCropButtons();this.updateSelInfo();
    this.stage.fit();
  },
  applySmoothing(){
    $('#pCanvas').style.imageRendering=$('#smoothChk').checked?'pixelated':'auto';
  },
  updateAlgoUI(){
    const algo=$('#algoSel').value,q=algo==='quantize',has=!!this.srcData;
    $('#algoDesc').textContent=ALGO_DESC[algo];
    $('#colorsRange').disabled=!has||!q;$('#ditherChk').disabled=!has||!q;
    $('#colorsField').classList.toggle('off',!q);$('#ditherField').classList.toggle('off',!q);
  },
  updateControls(){
    const has=!!this.srcData;
    $('#sizeSel').disabled=!has;$('#algoSel').disabled=!has;$('#applyBtn').disabled=!has;
    $('#pExportBtn').disabled=!this.full;$('#toDrawBtn').disabled=!this.full;
    this.updateAlgoUI();
  },
  updateCropButtons(){
    $('#cropApplyBtn').disabled=!this.sel;
    $('#cropResetBtn').disabled=!(this.cropped||this.sel);
  },
  updateSelInfo(){
    const el=$('#pSelInfo');
    if(this.sel)el.textContent=`Выделение: ${this.sel.w}×${this.sel.h}`;
    else if(this.cropped)el.textContent=`Кадрировано · ${this.cropped.width}×${this.cropped.height}`;
    else el.textContent='Выделение: —';
    $('#pHint').textContent=this.sel?'Отпустите кнопку мыши и нажмите «Применить кадрирование»':'Зажмите ЛКМ и потяните по результату для кадрирования';
  },

  applyCrop(){
    if(!this.sel||!this.full)return;
    const s=this.sel;
    this.cropped=this.ctx.getImageData(s.x,s.y,s.w,s.h);
    this.sel=null;this.stopAnts();
    this.renderResult();
    toast(`Кадрирование применено: ${s.w}×${s.h} px`,'success');Sound.arp([700,1000]);
  },
  resetCrop(){
    this.cropped=null;this.sel=null;this.stopAnts();
    this.renderResult();
    toast('Кадрирование сброшено — показан полный результат','info');Sound.blip(400,.06,'square',600);
  },
  drawCrop(c,t){
    if(!this.sel)return;
    const z=this.stage.zoom,s=this.sel;
    const x=s.x*z,y=s.y*z,w=s.w*z,h=s.h*z;
    const dw=this.stage.w*z,dh=this.stage.h*z;
    c.fillStyle='rgba(5,7,18,.66)';c.fillRect(0,0,dw,dh);
    c.clearRect(x,y,w,h);
    c.strokeStyle='#0a0d20';c.lineWidth=4;c.strokeRect(x,y,w,h);
    c.strokeStyle='#29D9FF';c.lineWidth=2;c.strokeRect(x,y,w,h);
    c.strokeStyle='rgba(255,255,255,.95)';c.lineWidth=1.5;
    c.setLineDash([6,6]);c.lineDashOffset=-(t/45)%12;c.strokeRect(x,y,w,h);c.setLineDash([]);
    c.fillStyle='#29D9FF';c.strokeStyle='#062033';c.lineWidth=1;
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([hx,hy])=>{c.fillRect(hx-4,hy-4,8,8);c.strokeRect(hx-4,hy-4,8,8);});
    const label=`${s.w}×${s.h}`;
    c.font='11px "JetBrains Mono",monospace';
    const tw=c.measureText(label).width+14;
    const lx=clamp(x,2,dw-tw-2),ly=y>26?y-24:Math.min(y+h+6,dh-20);
    c.fillStyle='rgba(11,14,36,.94)';c.fillRect(lx,ly,tw,18);
    c.strokeStyle='rgba(41,217,255,.6)';c.lineWidth=1;c.strokeRect(lx+.5,ly+.5,tw-1,17);
    c.fillStyle='#73EFF7';c.fillText(label,lx+7,ly+13);
  },
  startAnts(){
    if(this.antsRaf)return;
    const tick=t=>{
      this.antsRaf=0;
      if(!this.sel||$('#modePhoto').hidden)return;
      this.stage.redrawOverlay(t);
      this.antsRaf=requestAnimationFrame(tick);
    };
    this.antsRaf=requestAnimationFrame(tick);
  },
  stopAnts(){if(this.antsRaf){cancelAnimationFrame(this.antsRaf);this.antsRaf=0;}},

  async toDrawing(){
    const d=this.cropped||this.full;if(!d)return;
    if(Draw.hasContent()){
      const ok=await confirmDialog({title:'ПЕРЕНЕСТИ В «РИСОВАНИЕ»?',
        message:'Текущий рисунок на холсте будет заменён результатом конвертации. Отменить замену будет нельзя.',
        confirmText:'Перенести',danger:true});
      if(!ok)return;
    }
    Draw.adopt(d);App.switchTab('draw');
    toast(`Результат ${d.width}×${d.height} открыт в режиме «Рисование»`,'success');Sound.arp([600,800,1000]);
  }
};
