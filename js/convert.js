'use strict';

const ALGO_DESC={
  nearest:'Грубое уменьшение без сглаживания: каждый блок берёт один пиксель-образец. Самый «резкий» и ретро-вид.',
  average:'Усреднение цвета всех пикселей блока (с учётом прозрачности) — мягкий, сбалансированный результат.',
  median:'Медианное значение по каждому каналу в блоке — лучше сохраняет резкие границы и убирает шум.',
  dominant:'Самый частый цвет в блоке (по квантованным корзинам) — плакатный, «пластиковый» вид.',
  quantize:'Уменьшение до N цветов методом median cut + сопоставление с палитрой. Включите дизеринг для узорчатых градиентов.'
};
const ALGO_LABEL={nearest:'Nearest Neighbor',average:'Average / Box',median:'Median',dominant:'Dominant',quantize:'Квантизация'};

function nearestConvert(srcCanvas,tw,th){
  const c=document.createElement('canvas');c.width=tw;c.height=th;
  const cx=c.getContext('2d',{willReadFrequently:true});
  cx.imageSmoothingEnabled=false;
  cx.drawImage(srcCanvas,0,0,tw,th);
  return cx.getImageData(0,0,tw,th);
}

async function blockConvert(src,sw,sh,algo,tw,th,isStale){
  const out=new ImageData(tw,th),od=out.data;
  const maxBlock=(Math.ceil(sw/tw)+1)*(Math.ceil(sh/th)+1);
  let bR,bG,bB,bA,bins;
  if(algo==='median'){bR=new Uint8Array(maxBlock);bG=new Uint8Array(maxBlock);bB=new Uint8Array(maxBlock);bA=new Uint8Array(maxBlock);}
  if(algo==='dominant')bins=new Int32Array(4096*5);
  for(let by=0;by<th;by++){
    const y0=Math.floor(by*sh/th),y1=Math.max(y0+1,Math.floor((by+1)*sh/th));
    for(let bx=0;bx<tw;bx++){
      const x0=Math.floor(bx*sw/tw),x1=Math.max(x0+1,Math.floor((bx+1)*sw/tw));
      let r=0,g=0,b=0,a=0;
      if(algo==='average'){
        let sa=0,sr=0,sg=0,sb=0,n=0;
        for(let y=y0;y<y1;y++){let i=(y*sw+x0)*4;
          for(let x=x0;x<x1;x++,i+=4){const al=src[i+3];sa+=al;sr+=src[i]*al;sg+=src[i+1]*al;sb+=src[i+2]*al;n++;}}
        if(sa===0){r=g=b=a=0;}
        else{a=Math.round(sa/n);r=Math.round(sr/sa);g=Math.round(sg/sa);b=Math.round(sb/sa);}
      }else if(algo==='median'){
        let n=0;
        for(let y=y0;y<y1;y++){let i=(y*sw+x0)*4;
          for(let x=x0;x<x1;x++,i+=4){bR[n]=src[i];bG[n]=src[i+1];bB[n]=src[i+2];bA[n]=src[i+3];n++;}}
        const mr=bR.subarray(0,n),mg=bG.subarray(0,n),mb=bB.subarray(0,n),ma=bA.subarray(0,n);
        mr.sort();mg.sort();mb.sort();ma.sort();
        const m=n>>1;r=mr[m];g=mg[m];b=mb[m];a=ma[m];
      }else{
        bins.fill(0);
        for(let y=y0;y<y1;y++){let i=(y*sw+x0)*4;
          for(let x=x0;x<x1;x++,i+=4){
            const k=(((src[i]>>4)<<8)|((src[i+1]>>4)<<4)|(src[i+2]>>4))*5;
            bins[k]++;bins[k+1]+=src[i];bins[k+2]+=src[i+1];bins[k+3]+=src[i+2];bins[k+4]+=src[i+3];
          }}
        let best=0,bc=0;
        for(let k=0;k<bins.length;k+=5)if(bins[k]>bc){bc=bins[k];best=k;}
        r=Math.round(bins[best+1]/bc);g=Math.round(bins[best+2]/bc);
        b=Math.round(bins[best+3]/bc);a=Math.round(bins[best+4]/bc);
      }
      const o=(by*tw+bx)*4;od[o]=r;od[o+1]=g;od[o+2]=b;od[o+3]=a;
    }
    if((by&15)===15){await nextTick();if(isStale())return null;}
  }
  return out;
}

function quantizeImage(img,N,dither){
  const d=img.data,w=img.width,h=img.height;
  const idx=[];for(let i=0;i<d.length;i+=4)if(d[i+3]>=8)idx.push(i);
  if(!idx.length)return img;
  const ranges=box=>{
    let mn0=255,mn1=255,mn2=255,mx0=0,mx1=0,mx2=0;
    for(const i of box){
      if(d[i]<mn0)mn0=d[i];if(d[i]>mx0)mx0=d[i];
      if(d[i+1]<mn1)mn1=d[i+1];if(d[i+1]>mx1)mx1=d[i+1];
      if(d[i+2]<mn2)mn2=d[i+2];if(d[i+2]>mx2)mx2=d[i+2];
    }
    return[mx0-mn0,mx1-mn1,mx2-mn2];
  };
  let boxes=[idx];
  while(boxes.length<N){
    let bi=-1,best=-1,bch=0,blen=0;
    for(let k=0;k<boxes.length;k++){
      const box=boxes[k];if(box.length<2)continue;
      const rg=ranges(box),m=Math.max(rg[0],rg[1],rg[2]);
      if(m>best||(m===best&&box.length>blen)){best=m;bi=k;bch=rg.indexOf(m);blen=box.length;}
    }
    if(bi<0||best<=0)break;
    const box=boxes[bi];
    box.sort((a,b)=>d[a+bch]-d[b+bch]);
    const mid=box.length>>1;
    boxes.splice(bi,1,box.slice(0,mid),box.slice(mid));
  }
  const pal=boxes.map(box=>{
    let r=0,g=0,b=0;for(const i of box){r+=d[i];g+=d[i+1];b+=d[i+2];}
    const n=box.length;return[Math.round(r/n),Math.round(g/n),Math.round(b/n)];
  });
  const bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const amp=dither?Math.min(110,255/Math.cbrt(N)*.6):0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;if(d[i+3]<8)continue;
    const t=((bayer[y&3][x&3]+.5)/16-.5)*amp;
    const rr=clamp(d[i]+t,0,255),gg=clamp(d[i+1]+t,0,255),bb=clamp(d[i+2]+t,0,255);
    let bi=0,bd=Infinity;
    for(let p=0;p<pal.length;p++){
      const dr=rr-pal[p][0],dg=gg-pal[p][1],db=bb-pal[p][2];
      const dist=dr*dr+dg*dg+db*db;
      if(dist<bd){bd=dist;bi=p;}
    }
    d[i]=pal[bi][0];d[i+1]=pal[bi][1];d[i+2]=pal[bi][2];
  }
  return img;
}

function generateDemoPhoto(){
  const W=960,H=640,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true}),rnd=mulberry32(20261117);
  const horizon=430;
  let sky=x.createLinearGradient(0,0,0,horizon);
  sky.addColorStop(0,'#2b1a5e');sky.addColorStop(.45,'#a03a7c');sky.addColorStop(.78,'#ff5e8a');sky.addColorStop(1,'#ffb347');
  x.fillStyle=sky;x.fillRect(0,0,W,horizon);
  const sunX=620,sunY=330;
  let glow=x.createRadialGradient(sunX,sunY,10,sunX,sunY,150);
  glow.addColorStop(0,'rgba(255,244,200,.95)');glow.addColorStop(.35,'rgba(255,207,94,.5)');glow.addColorStop(1,'rgba(255,207,94,0)');
  x.fillStyle=glow;x.fillRect(sunX-160,sunY-160,320,320);
  x.fillStyle='#fff2b0';x.beginPath();x.arc(sunX,sunY,46,0,7);x.fill();
  x.fillStyle='rgba(255,255,255,.12)';
  for(let i=0;i<6;i++){const cx=rnd()*W,cy=40+rnd()*180;x.beginPath();x.ellipse(cx,cy,70+rnd()*90,10+rnd()*12,0,0,7);x.fill();}
  const ridge=(baseY,amp,color,seed)=>{
    const r2=mulberry32(seed);x.fillStyle=color;x.beginPath();x.moveTo(0,horizon);
    let y=baseY;x.lineTo(0,y);
    for(let px=0;px<=W;px+=40){y=baseY+(r2()-.5)*amp;x.lineTo(px,y);}
    x.lineTo(W,horizon);x.closePath();x.fill();
  };
  ridge(300,120,'#3a2670',11);ridge(345,100,'#241a4f',22);ridge(390,70,'#171233',33);
  let water=x.createLinearGradient(0,horizon,0,H);
  water.addColorStop(0,'#7a3f8f');water.addColorStop(.3,'#3a2a7a');water.addColorStop(1,'#12102e');
  x.fillStyle=water;x.fillRect(0,horizon,W,H-horizon);
  let refl=x.createLinearGradient(0,horizon,0,H);
  refl.addColorStop(0,'rgba(255,200,110,.55)');refl.addColorStop(1,'rgba(255,120,140,0)');
  x.fillStyle=refl;x.fillRect(sunX-44,horizon,88,H-horizon);
  x.fillStyle='rgba(255,220,150,.35)';
  for(let i=0;i<46;i++){const ry=horizon+8+rnd()*(H-horizon-20);x.fillRect(sunX-40-rnd()*60,ry,30+rnd()*90,2);}
  x.fillStyle='rgba(160,170,255,.14)';
  for(let i=0;i<40;i++){const ry=horizon+rnd()*(H-horizon);x.fillRect(rnd()*W,ry,40+rnd()*120,1.5);}
  x.fillStyle='#0c0a22';x.beginPath();x.moveTo(0,H);x.lineTo(0,560);
  x.quadraticCurveTo(180,540,320,585);x.quadraticCurveTo(420,615,520,H);x.closePath();x.fill();
  x.fillStyle='#080618';
  for(let i=0;i<7;i++){
    const tx=30+i*38+rnd()*16,ty=560+rnd()*26,th2=42+rnd()*30;
    x.beginPath();x.moveTo(tx,ty);x.lineTo(tx+13,ty-th2);x.lineTo(tx+26,ty);x.closePath();x.fill();
    x.fillRect(tx+11,ty,4,10);
  }
  x.strokeStyle='rgba(20,12,40,.8)';x.lineWidth=2;
  [[210,120],[260,100],[305,132]].forEach(([bx,by])=>{
    x.beginPath();x.arc(bx-7,by,7,Math.PI*1.15,Math.PI*1.85);x.arc(bx+7,by,7,Math.PI*1.15,Math.PI*1.85);x.stroke();
  });
  let vg=x.createRadialGradient(W/2,H/2,H/3,W/2,H/2,W*.72);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(5,3,18,.4)');
  x.fillStyle=vg;x.fillRect(0,0,W,H);
  const im=x.getImageData(0,0,W,H),dd=im.data;
  for(let i=0;i<dd.length;i+=4){const n=(rnd()-.5)*14;dd[i]+=n;dd[i+1]+=n;dd[i+2]+=n;}
  x.putImageData(im,0,0);
  return c;
}
