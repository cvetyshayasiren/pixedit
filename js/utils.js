'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nextTick=()=>new Promise(r=>setTimeout(r,0));
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const store={get(k,d){try{return localStorage.getItem(k)??d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const hexToRgb=h=>{const n=parseInt(h.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};};
const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
const fmtBytes=n=>n>1048576?(n/1048576).toFixed(1)+' МБ':Math.max(1,Math.round(n/1024))+' КБ';
const loadImage=url=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('decode'));im.src=url;});

function downloadPNG(imgData,name){
  const c=document.createElement('canvas');c.width=imgData.width;c.height=imgData.height;
  c.getContext('2d').putImageData(imgData,0,0);
  const a=document.createElement('a');a.download=name;a.href=c.toDataURL('image/png');
  document.body.appendChild(a);a.click();a.remove();
}
