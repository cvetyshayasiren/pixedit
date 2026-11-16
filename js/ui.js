'use strict';

function toast(msg,type='info',ms=3600){
  const box=$('#toasts');
  while(box.children.length>=4)box.firstChild.remove();
  const icons={success:'i-check',error:'i-x',warn:'i-warn',info:'i-info'};
  const el=document.createElement('div');el.className='toast t-'+type;
  el.innerHTML=`<svg class="ic"><use href="#${icons[type]||'i-info'}"/></svg><span>${msg}</span><button class="toast-x" aria-label="Закрыть"><svg class="ic"><use href="#i-x"/></svg></button>`;
  box.appendChild(el);
  let dead=false;const kill=()=>{if(dead)return;dead=true;el.classList.add('out');setTimeout(()=>el.remove(),230);};
  el.querySelector('.toast-x').addEventListener('click',kill);
  setTimeout(kill,ms);
  if(type==='error')Sound.error();
}

let modalOpen=false;
function openModal({title,body='',html='',actions}){
  return new Promise(resolve=>{
    modalOpen=true;const root=$('#modalRoot');let closed=false;
    root.innerHTML=`<div class="modal-backdrop"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-title">${esc(title)}</div>
        <div class="modal-body">${body?`<p>${esc(body)}</p>`:''}${html}</div>
        <div class="modal-actions">${actions.map((a,i)=>`<button class="btn ${a.kind||''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    root.hidden=false;
    const cancelVal=(actions.find(a=>a.cancel)||{}).value??false;
    const close=v=>{if(closed)return;closed=true;root.hidden=true;root.innerHTML='';modalOpen=false;document.removeEventListener('keydown',onKey,true);resolve(v);};
    const onKey=e=>{
      if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close(cancelVal);}
      else if(e.key==='Enter'){const p=actions.find(a=>!a.cancel);if(p){e.preventDefault();e.stopPropagation();close(p.value);}}
    };
    document.addEventListener('keydown',onKey,true);
    root.querySelector('.modal-backdrop').addEventListener('click',()=>close(cancelVal));
    root.querySelectorAll('.modal-actions .btn').forEach(b=>b.addEventListener('click',()=>{
      const a=actions[+b.dataset.i];Sound.blip(a.cancel?300:620,.05);close(a.value);
    }));
    const btns=[...root.querySelectorAll('.modal-actions .btn')];
    (btns.find(b=>!actions[+b.dataset.i].cancel)||btns[0]).focus();
  });
}
const confirmDialog=o=>openModal({title:o.title,body:o.message,actions:[
  {label:o.cancelText||'Отмена',kind:'btn-ghost',value:false,cancel:true},
  {label:o.confirmText||'Подтвердить',kind:o.danger?'btn-danger-solid':'btn-primary',value:true}
]});

function initHelp(){
  $('#helpBtn').addEventListener('click',()=>{
    Sound.blip(660,.04);
    openModal({title:'ГОРЯЧИЕ КЛАВИШИ',html:`<div class="hotkeys">
      <span><kbd>B</kbd> <kbd>E</kbd> <kbd>I</kbd> <kbd>G</kbd></span><div>Кисть · Ластик · Пипетка · Заливка</div>
      <span><kbd>[</kbd> <kbd>]</kbd></span><div>Размер кисти меньше / больше</div>
      <span><kbd>Alt</kbd>+клик</span><div>Пипетка из любого инструмента</div>
      <span><kbd>ПКМ</kbd></span><div>Быстрый ластик поверх кисти</div>
      <span><kbd>Ctrl</kbd>+<kbd>Z</kbd></span><div>Отменить действие</div>
      <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></span><div>Вернуть действие</div>
      <span><kbd>Delete</kbd></span><div>Очистить холст (с подтверждением)</div>
      <span><kbd>1</kbd> <kbd>2</kbd></span><div>Режимы «Рисование» / «Из фото»</div>
      <span><kbd>Ctrl</kbd>+<kbd>V</kbd></span><div>Вставить изображение из буфера</div>
    </div><p class="hint" style="margin-top:12px">Буквенные клавиши работают в любой раскладке, включая русскую.</p>`,
    actions:[{label:'Понятно',kind:'btn-primary',value:true}]});
  });
}
