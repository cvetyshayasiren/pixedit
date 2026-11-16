'use strict';

const App={
  tab:'draw',
  switchTab(mode){
    this.tab=mode;
    $('#tabDraw').classList.toggle('active',mode==='draw');
    $('#tabPhoto').classList.toggle('active',mode==='photo');
    $('#tabDraw').setAttribute('aria-selected',String(mode==='draw'));
    $('#tabPhoto').setAttribute('aria-selected',String(mode==='photo'));
    $('#modeDraw').hidden=mode!=='draw';
    $('#modePhoto').hidden=mode!=='photo';
    if(mode!=='photo')Photo.stopAnts();
    else if(Photo.sel)Photo.startAnts();
    requestAnimationFrame(()=>{(mode==='draw'?Draw.stage:Photo.stage).refresh();});
    Sound.blip(mode==='draw'?520:640,.04);
  }
};

function initTabs(){
  $('#tabDraw').addEventListener('click',()=>App.switchTab('draw'));
  $('#tabPhoto').addEventListener('click',()=>App.switchTab('photo'));
}

function initHotkeys(){
  document.addEventListener('keydown',e=>{
    if(modalOpen)return;
    if(e.target.closest('input,select,textarea'))return;
    if(e.ctrlKey||e.metaKey){
      if(e.code==='KeyZ'){e.preventDefault();e.shiftKey?Draw.redo():Draw.undo();}
      else if(e.code==='KeyY'){e.preventDefault();Draw.redo();}
      return;
    }
    switch(e.code){
      case 'KeyB':if(App.tab==='draw')Draw.setTool('brush');break;
      case 'KeyE':if(App.tab==='draw')Draw.setTool('eraser');break;
      case 'KeyI':if(App.tab==='draw')Draw.setTool('picker');break;
      case 'KeyG':if(App.tab==='draw')Draw.setTool('fill');break;
      case 'BracketLeft':if(App.tab==='draw')Draw.setBrush(Draw.brush-1);break;
      case 'BracketRight':if(App.tab==='draw')Draw.setBrush(Draw.brush+1);break;
      case 'Delete':if(App.tab==='draw')Draw.requestClear();break;
      case 'Digit1':case 'Numpad1':App.switchTab('draw');break;
      case 'Digit2':case 'Numpad2':App.switchTab('photo');break;
    }
  });
}

function initPaste(){
  document.addEventListener('paste',e=>{
    const items=e.clipboardData?.items;if(!items)return;
    for(const it of items){
      if(it.kind==='file'&&/^image\//.test(it.type)){
        const f=it.getAsFile();
        if(f){e.preventDefault();if(App.tab!=='photo')App.switchTab('photo');
          Photo.loadFile(f);toast('Изображение вставлено из буфера обмена','info');}
        return;
      }
    }
  });
}

function spawnFloatingPixels(){
  const host=$('#fpxHost'),cols=['#A78BFA','#FF3D8B','#29D9FF','#00E436','#FFB020'],rnd=mulberry32(7);
  for(let i=0;i<14;i++){
    const p=document.createElement('span');p.className='fpx';
    const s=4+Math.floor(rnd()*9);
    p.style.cssText=`left:${(rnd()*100).toFixed(1)}vw;width:${s}px;height:${s}px;background:${cols[i%cols.length]};animation-duration:${(16+rnd()*22).toFixed(1)}s,${(2+rnd()*2).toFixed(1)}s;animation-delay:-${(rnd()*30).toFixed(1)}s,-${(rnd()*2).toFixed(1)}s;`;
    host.appendChild(p);
  }
}

function boot(){
  initSound();
  initHelp();
  initTabs();
  initHotkeys();
  initPaste();
  spawnFloatingPixels();
  updateSoundBtn();
  Draw.init();
  Photo.init();
  requestAnimationFrame(()=>Draw.stage.fit());
}

document.addEventListener('DOMContentLoaded',boot);
