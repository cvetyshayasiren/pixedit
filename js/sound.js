'use strict';

const Sound={
  ctx:null,master:null,enabled:store.get('pl_sound','1')==='1',
  ensure(){
    if(!this.ctx){
      try{const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();
        this.master=this.ctx.createGain();this.master.gain.value=.05;this.master.connect(this.ctx.destination);}catch(e){this.ctx=null;}
    }
    if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  },
  blip(f=600,d=.05,type='square',f2=0){
    if(!this.enabled)return;this.ensure();if(!this.ctx)return;
    try{
      const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=type;o.frequency.setValueAtTime(f,t);
      if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(40,f2),t+d);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.9,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.03);
    }catch(e){}
  },
  arp(notes,gap=70){notes.forEach((n,i)=>setTimeout(()=>this.blip(n,.07),i*gap));},
  error(){this.blip(160,.16,'sawtooth',90);}
};

function updateSoundBtn(){
  const b=$('#soundBtn');b.classList.toggle('sound-on',Sound.enabled);
  b.setAttribute('aria-pressed',String(Sound.enabled));
  $('#soundUse').setAttribute('href',Sound.enabled?'#i-sound':'#i-mute');
  $('#soundState').textContent=Sound.enabled?'вкл':'выкл';
}

function initSound(){
  $('#soundBtn').addEventListener('click',()=>{
    Sound.enabled=!Sound.enabled;store.set('pl_sound',Sound.enabled?'1':'0');updateSoundBtn();
    if(Sound.enabled)Sound.blip(740,.05);
  });
  document.addEventListener('pointerdown',()=>{if(Sound.enabled)Sound.ensure();},{once:true});
}
