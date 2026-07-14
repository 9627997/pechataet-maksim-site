const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NS='http://www.w3.org/2000/svg';

const colors=[
 ['Молочный','#f3eadc'],['Белый','#ffffff'],['Пудровый','#e5c5c4'],['Красный','#b7202d'],
 ['Бордовый','#6b1f2d'],['Изумрудный','#0c6a4f'],['Оливковый','#6f754e'],
 ['Голубой','#86b9ca'],['Синий','#274d83'],['Лавандовый','#9b8db5'],['Серый','#8e8d89'],['Чёрный','#171717']
];

const state={
 panel:'upload',width:15,ribbon:'#f3eadc',print:'#171717',logo:null,logoType:null,
 text:'печатаетмаксим',font:'Manrope',fontSize:32,repeatMm:100,bundle:'bundle',
 stickerSize:40,stickerBg:'#ffffff',meters:100,stickerQty:100
};

function el(tag,attrs={}){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n}
function activate(group,button){$$(group+' button').forEach(b=>b.classList.remove('active'));button.classList.add('active')}
function saveState(){const c={...state,logo:null};localStorage.setItem('ribbon-studio-next-v01',JSON.stringify(c))}
function restoreState(){try{Object.assign(state,JSON.parse(localStorage.getItem('ribbon-studio-next-v01')||'{}'))}catch(e){}}

colors.forEach(([name,color],i)=>{
 const b=document.createElement('button');b.className='swatch'+(i===0?' active':'');b.title=name;b.style.background=color;
 b.onclick=()=>{ $$('.swatch').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.ribbon=color;render() };
 $('#ribbonSwatches').appendChild(b);
});

$$('.nav-item').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$$('.next-panel').forEach(b=>b.onclick=()=>showPanel(b.dataset.next));
function showPanel(id){
 state.panel=id;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
 $$('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+id));
}

$$('#widthChoice button').forEach(b=>b.onclick=()=>{activate('#widthChoice',b);state.width=+b.dataset.value;render()});
$$('#printChoice button').forEach(b=>b.onclick=()=>{activate('#printChoice',b);state.print=b.dataset.value;render()});
$$('#bundleChoice button').forEach(b=>b.onclick=()=>{activate('#bundleChoice',b);state.bundle=b.dataset.value;render()});
$$('#stickerSizeChoice button').forEach(b=>b.onclick=()=>{activate('#stickerSizeChoice',b);state.stickerSize=+b.dataset.value;render()});
$$('#stickerBgChoice button').forEach(b=>b.onclick=()=>{activate('#stickerBgChoice',b);state.stickerBg=b.dataset.value;render()});
$$('#viewTabs button').forEach(b=>b.onclick=()=>{activate('#viewTabs',b);setView(b.dataset.view)});

function setView(view){
 $('#ribbonArea').style.display=view==='sticker'?'none':'block';
 $('#stickerArea').style.display=view==='ribbon'||state.bundle==='ribbon'?'none':'grid';
 $('.kit-layout').style.gridTemplateColumns=view==='kit'&&state.bundle==='bundle'?'minmax(0,1fr) 340px':'1fr';
}

$('#textInput').oninput=e=>{state.text=e.target.value;render()};
$('#fontSelect').oninput=e=>{state.font=e.target.value;render()};
$('#fontSize').oninput=e=>{state.fontSize=+e.target.value;render()};
$('#repeatMm').oninput=e=>{state.repeatMm=Math.max(40,+e.target.value||100);render()};
$('#meters').oninput=e=>{state.meters=+e.target.value;render()};
$('#stickerQty').oninput=e=>{state.stickerQty=+e.target.value;render()};

$('#logoInput').onchange=e=>loadFile(e.target.files[0]);
const dropZone=$('#dropZone');
['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.style.borderColor='#171717'}));
['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.style.borderColor=''}));
dropZone.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
function showFileCard(file,meta,quality,isWarning=false){
  $('#fileCard').hidden=false;
  $('#fileCard').classList.toggle('warning',isWarning);
  $('#fileCardIcon').textContent=isWarning?'!':'✓';
  $('#fileCardName').textContent=file.name;
  $('#fileCardMeta').textContent=meta;
  $('#fileCardQuality').textContent=quality;
  $('#continueUpload').disabled=false;
}
function loadFile(file){
 if(!file)return;
 const ext=file.name.split('.').pop().toLowerCase(),r=new FileReader();
 if(ext==='svg'){
  r.onload=()=>{
   const d=new DOMParser().parseFromString(r.result,'image/svg+xml'),s=d.documentElement;
   if(s.nodeName.toLowerCase()!=='svg'){alert('Не удалось прочитать SVG');return}
   s.querySelectorAll('script,foreignObject').forEach(n=>n.remove());
   const vb=(s.getAttribute('viewBox')||'').trim().split(/\s+/).map(Number);
   const ratio=vb.length===4&&vb[3]?vb[2]/vb[3]:1;
   state.logo={data:'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(s)))),ratio};
   state.logoType='svg';showFileCard(file,'SVG · векторный файл','Отлично: файл готов к печати');render();
  };r.readAsText(file);
 }else if(['jpg','jpeg','png'].includes(ext)){
  r.onload=()=>{const im=new Image();im.onload=()=>{state.logo={data:r.result,ratio:im.width/im.height};state.logoType=ext==='png'?'png':'jpeg';
const minSide=Math.min(im.width,im.height);
const warning=minSide<1000;
showFileCard(file,`${ext.toUpperCase()} · ${im.width} × ${im.height} px`,warning?'Мы бесплатно проверим и подготовим файл':'Качество изображения хорошее',warning);
render()};im.src=r.result};r.readAsDataURL(file)
 }else alert('Поддерживаются SVG, PNG и JPEG');
}

$('#makeBeautiful').onclick=()=>{
 state.width=state.logo&&state.logo.ratio>2?20:15;
 state.repeatMm=state.width===20?90:80;
 state.fontSize=state.width===20?34:28;
 state.stickerSize=40;
 state.bundle='bundle';
 syncControls();render();
 $('#recommendationText').textContent='Макет автоматически выровнен: выбран оптимальный размер и шаг повтора.';
};

function drawLogo(parent,cx,cy,maxW,maxH){
 if(!state.logo)return;
 let w=maxW,h=w/state.logo.ratio;if(h>maxH){h=maxH;w=h*state.logo.ratio}
 const image=el('image',{x:cx-w/2,y:cy-h/2,width:w,height:h,preserveAspectRatio:'xMidYMid meet'});
 image.setAttribute('href',state.logo.data);parent.appendChild(image);
}
function drawText(parent,x,y,size,anchor='middle'){
 if(!state.text)return;
 const t=el('text',{x,y,'text-anchor':anchor,'dominant-baseline':'middle','font-family':state.font,'font-size':size,'font-weight':'700',fill:state.print});
 if(['#b69249','#c6c8cd'].includes(state.print))t.setAttribute('filter','url(#metallic)');
 t.textContent=state.text;parent.appendChild(t);
}

function renderRibbon(){
 const h=state.width===15?90:120,y=130-h/2;
 ['ribbonBase','ribbonShine','clipRect'].forEach(id=>{$('#'+id).setAttribute('y',y);$('#'+id).setAttribute('height',h)});
 $('#safeZone').setAttribute('y',y+10);$('#safeZone').setAttribute('height',h-20);$('#ribbonBase').setAttribute('fill',state.ribbon);
 const layer=$('#ribbonContent');layer.innerHTML='';
 const step=state.repeatMm*4;
 for(let x=70;x<1200;x+=step){
  const g=el('g');
  if(state.logo){drawLogo(g,x-55,130,105,h*.62);drawText(g,x+65,130,state.fontSize,'middle')}
  else drawText(g,x,130,state.fontSize,'middle');
  layer.appendChild(g);
 }
}

function renderSticker(){
 $('#stickerBg').setAttribute('fill',state.stickerBg);
 const layer=$('#stickerContent');layer.innerHTML='';
 const dark=state.stickerBg==='#171717';
 const oldPrint=state.print;if(dark&&state.print==='#171717')state.print='#ffffff';
 if(state.logo){drawLogo(layer,200,155,180,110);drawText(layer,200,265,34)}
 else drawText(layer,200,200,42);
 state.print=oldPrint;
 $('#stickerSizeLabel').textContent='Ø'+state.stickerSize+' мм';
}

function price(){
 const ribbonBase={10:390,25:590,50:790,100:1090,200:1590}[state.meters]||1090;
 const widthExtra=state.width===20?180:0;
 const stickerBase=state.bundle==='bundle'?({50:450,100:700,250:1350,500:2200}[state.stickerQty]||700):0;
 return ribbonBase+widthExtra+stickerBase;
}

function render(){
 renderRibbon();renderSticker();
 $('#stickerArea').style.display=state.bundle==='bundle'?'grid':'none';
 $('.kit-layout').style.gridTemplateColumns=state.bundle==='bundle'?'minmax(0,1fr) 340px':'1fr';
 $('#status').textContent=`Лента ${state.width} мм · ${state.bundle==='bundle'?'стикер Ø'+state.stickerSize+' мм · ':''}шаг ${state.repeatMm} мм`;
 $('#orderRibbon').textContent=`${state.width} мм · ${state.meters} м`;
 $('#orderSticker').textContent=`Ø${state.stickerSize} мм · ${state.stickerQty} шт.`;
 $('#orderStickerRow').style.display=state.bundle==='bundle'?'flex':'none';
 $('#orderRepeat').textContent=state.repeatMm+' мм';
 $('#totalPrice').textContent=price().toLocaleString('ru-RU')+' ₽';
 saveState();
}

function syncControls(){
 $$('#widthChoice button').forEach(b=>b.classList.toggle('active',+b.dataset.value===state.width));
 $$('#printChoice button').forEach(b=>b.classList.toggle('active',b.dataset.value===state.print));
 $$('#bundleChoice button').forEach(b=>b.classList.toggle('active',b.dataset.value===state.bundle));
 $$('#stickerSizeChoice button').forEach(b=>b.classList.toggle('active',+b.dataset.value===state.stickerSize));
 $$('#stickerBgChoice button').forEach(b=>b.classList.toggle('active',b.dataset.value===state.stickerBg));
 $('#textInput').value=state.text;$('#fontSelect').value=state.font;$('#fontSize').value=state.fontSize;
 $('#repeatMm').value=state.repeatMm;$('#meters').value=state.meters;$('#stickerQty').value=state.stickerQty;
}

$('#openOrder').onclick=()=>{
 $('#orderSummary').innerHTML=`<strong>Лента ${state.width} мм, ${state.meters} м</strong><br>Шаг: ${state.repeatMm} мм<br>${state.bundle==='bundle'?`Стикер Ø${state.stickerSize} мм, ${state.stickerQty} шт.<br>`:''}Стоимость: ${price().toLocaleString('ru-RU')} ₽`;
 $('#orderModal').classList.add('open');$('#orderModal').setAttribute('aria-hidden','false');
};
$('#closeOrder').onclick=()=>$('#orderModal').classList.remove('open');
$('#downloadOrder').onclick=()=>{
 const text=[
  'Заявка — Ribbon Studio / Печатает Максим',
  'Имя: '+$('#customerName').value,
  'Телефон: '+$('#customerPhone').value,
  'Telegram: '+$('#customerTelegram').value,
  'Комментарий: '+$('#customerComment').value,
  `Лента: ${state.width} мм, ${state.meters} м`,
  `Шаг повтора: ${state.repeatMm} мм`,
  state.bundle==='bundle'?`Стикер: Ø${state.stickerSize} мм, ${state.stickerQty} шт.`:'Стикер: нет',
  `Предварительная стоимость: ${price()} ₽`
 ].join('\n');
 const blob=new Blob([text],{type:'text/plain'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='zayavka-ribbon-studio.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
$('#resetProject').onclick=()=>{localStorage.removeItem('ribbon-studio-next-v01');location.reload()};

restoreState();syncControls();render();
