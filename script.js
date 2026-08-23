const $=s=>document.querySelector(s);
let orders=[];
const fmt=n=>new Intl.NumberFormat('ru-RU').format(n);
async function load(){
  orders=await fetch('orders.json').then(r=>r.json());
  const types=[...new Set(orders.map(x=>x.type).filter(Boolean))].sort();
  const dirs=[...new Set(orders.map(x=>x.direction).filter(Boolean))].sort();
  types.forEach(x=>$('#typeFilter').insertAdjacentHTML('beforeend',`<option>${x}</option>`));
  dirs.forEach(x=>$('#directionFilter').insertAdjacentHTML('beforeend',`<option>${x}</option>`));
  $('#updated').textContent=new Date().toLocaleDateString('ru-RU');
  render();
}
function render(){
  const q=$('#search').value.toLowerCase().trim(), type=$('#typeFilter').value, dir=$('#directionFilter').value, sort=$('#sort').value;
  let a=orders.filter(x=>(!q||x.name.toLowerCase().includes(q))&&(!type||x.type===type)&&(!dir||x.direction===dir));
  a.sort((x,y)=>sort==='name'?x.name.localeCompare(y.name,'ru'):sort==='time'?x.time-y.time:sort==='total'?y.total-x.total:y.priority-x.priority);
  $('#count').textContent=a.length;
  $('#priority').textContent=fmt(a.reduce((s,x)=>s+x.priority,0));
  $('#orders').innerHTML=a.length?a.map((x,i)=>`<div class="row">
    <div class="num">${i+1}</div><div class="name">${esc(x.name)}</div>
    <div class="number time">${fmt(x.time)}</div><div class="number priority">${fmt(x.priority)}</div>
    <div class="number price">${fmt(x.price)}</div><div class="number buyout">${fmt(x.buyout)}</div>
    <div class="number discount">${fmt(x.discount)}</div><div class="number total">${fmt(x.total)}</div>
    <div class="type"><span class="badge">${esc(x.type||'—')}</span></div>
    <div class="direction"><span class="badge">${esc(x.direction||'—')}</span></div>
  </div>`).join(''):`<div class="empty">Ничего не найдено</div>`;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
['search','typeFilter','directionFilter','sort'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
load().catch(()=>$('#orders').innerHTML='<div class="empty">Не удалось загрузить orders.json</div>');
