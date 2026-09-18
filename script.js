const $=s=>document.querySelector(s);
let orders=[];
const PASS='1234';
const TOKEN_STORAGE='orderQueueGithubTokenSession';
const CONFIG={owner:'CharMeeck',repo:'order-queue',branch:'main',path:'orders.json'};

const fmt=n=>new Intl.NumberFormat('ru-RU').format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const githubToken=()=>sessionStorage.getItem(TOKEN_STORAGE)||'';

async function load(){
  try{
    const r=await fetch('orders.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('Не удалось загрузить orders.json');
    orders=await r.json();
  }catch(e){orders=[]; setStatus('Не удалось загрузить очередь: '+e.message,'error')}
  refreshFilters(); render(); renderAdmin();
  $('#updated').textContent=new Date().toLocaleDateString('ru-RU');
}
function refreshFilters(){
  const t=$('#typeFilter'),d=$('#directionFilter'),tv=t.value,dv=d.value;
  t.innerHTML='<option value="">Все типы</option>'; d.innerHTML='<option value="">Все направления</option>';
  [...new Set(orders.map(x=>x.type).filter(Boolean))].sort().forEach(x=>t.insertAdjacentHTML('beforeend',`<option value="${esc(x)}">${esc(x)}</option>`));
  [...new Set(orders.map(x=>x.direction).filter(Boolean))].sort().forEach(x=>d.insertAdjacentHTML('beforeend',`<option value="${esc(x)}">${esc(x)}</option>`));
  t.value=tv;d.value=dv;
}
function render(){
  const q=$('#search').value.toLowerCase().trim(),type=$('#typeFilter').value,dir=$('#directionFilter').value,sort=$('#sort').value;
  let a=orders.filter(x=>(!q||String(x.name).toLowerCase().includes(q))&&(!type||x.type===type)&&(!dir||x.direction===dir));
  a.sort((x,y)=>sort==='name'?x.name.localeCompare(y.name,'ru'):sort==='time'?x.time-y.time:sort==='total'?y.total-x.total:y.priority-x.priority);
  $('#count').textContent=a.length;$('#priority').textContent=fmt(a.reduce((s,x)=>s+Number(x.priority||0),0));
  $('#orders').innerHTML=a.length?a.map((x,i)=>`<div class="row"><div class="num">${i+1}</div><div class="name">${esc(x.name)}</div><div class="number time">${fmt(x.time)}</div><div class="number priority">${fmt(x.priority)}</div><div class="number price">${fmt(x.price)}</div><div class="number buyout">${fmt(x.buyout)}</div><div class="number discount">${fmt(x.discount)}</div><div class="number total">${fmt(x.total)}</div><div class="type"><span class="badge">${esc(x.type||'—')}</span></div><div class="direction"><span class="badge">${esc(x.direction||'—')}</span></div></div>`).join(''):'<div class="empty">Ничего не найдено</div>';
}
function renderAdmin(){
  $('#adminOrders').innerHTML=orders.map((x,i)=>`<div class="admin-row"><div><strong>${esc(x.name)}</strong></div><div>${fmt(x.priority)}</div><div>${esc(x.type||'—')}</div><div class="actions"><button onclick="editOrder(${i})">Изменить</button><button class="del" onclick="deleteOrder(${i})">Удалить</button></div></div>`).join('')||'<div class="empty">Заказов пока нет</div>';
}
function saveLocal(){refreshFilters();render();renderAdmin();}
function setStatus(msg,kind=''){
  const el=$('#syncStatus'); if(!el)return;
  el.textContent=msg;el.className='sync-status '+kind;
}
function editOrder(i){
  const x=orders[i];$('#editIndex').value=i;$('#fName').value=x.name;$('#fTime').value=x.time;$('#fPriority').value=x.priority;$('#fPrice').value=x.price;$('#fBuyout').value=x.buyout;$('#fDiscount').value=x.discount;$('#fTotal').value=x.total;$('#fType').value=x.type||'';$('#fDirection').value=x.direction||'';
  window.scrollTo({top:0,behavior:'smooth'});
}
function deleteOrder(i){
  if(confirm(`Удалить заказ «${orders[i].name}»?`)){orders.splice(i,1);saveLocal();setStatus('Изменение пока только в редакторе. Нажми «Сохранить на сайте».','warn')}
}
window.editOrder=editOrder;window.deleteOrder=deleteOrder;

$('#orderForm').addEventListener('submit',e=>{
  e.preventDefault();const i=Number($('#editIndex').value);
  const x={name:$('#fName').value.trim(),time:Number($('#fTime').value),priority:Number($('#fPriority').value),price:Number($('#fPrice').value),buyout:Number($('#fBuyout').value),discount:Number($('#fDiscount').value),total:Number($('#fTotal').value),type:$('#fType').value.trim(),direction:$('#fDirection').value.trim()};
  if(i<0)orders.push(x);else orders[i]=x;
  saveLocal();e.target.reset();$('#editIndex').value=-1;setStatus('Изменение готово. Нажми «Сохранить на сайте».','warn');
});
$('#cancelEdit').onclick=()=>{$('#orderForm').reset();$('#editIndex').value=-1};

$('#download').onclick=()=>{
  const blob=new Blob([JSON.stringify(orders,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='orders.json';a.click();URL.revokeObjectURL(a.href);
};

async function githubApi(url,options={}){
  const token=githubToken();
  const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Authorization':'Bearer '+token};
  const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});
  const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!r.ok) throw new Error(data.message||`GitHub HTTP ${r.status}`);
  return data;
}
function openTokenModal(){
  $('#githubToken').value='';$('#tokenError').textContent='';$('#tokenModal').classList.remove('hidden');$('#githubToken').focus();
}
$('#cancelToken').onclick=()=>$('#tokenModal').classList.add('hidden');

async function saveToGithub(){
  let token=githubToken();
  if(!token){openTokenModal();return;}
  await performGithubSave(token);
}
async function performGithubSave(token){
  const base=`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.path}`;
  try{
    setStatus('Подключаюсь к GitHub…');
    let current;
    try{current=await githubApi(base+'?ref='+encodeURIComponent(CONFIG.branch),{headers:{'Authorization':'Bearer '+token}})}
    catch(e){ if(!String(e.message).toLowerCase().includes('not found')) throw e; current=null; }
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(orders,null,2))));
    const body={message:'Обновление очереди через админку',content,branch:CONFIG.branch};
    if(current?.sha)body.sha=current.sha;
    await githubApi(base,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    sessionStorage.setItem(TOKEN_STORAGE,token);
    $('#tokenModal').classList.add('hidden');
    setStatus('✓ Сохранено в GitHub. Сайт обновится через несколько секунд.','ok');
    $('#updated').textContent=new Date().toLocaleDateString('ru-RU');
  }catch(e){
    $('#tokenError').textContent=e.message;
    setStatus('Ошибка сохранения: '+e.message,'error');
    if(!sessionStorage.getItem(TOKEN_STORAGE)) $('#tokenModal').classList.remove('hidden');
  }
}
$('#confirmToken').onclick=async()=>{
  const token=$('#githubToken').value.trim();
  if(!token){$('#tokenError').textContent='Вставь токен.';return}
  $('#tokenError').textContent=''; await performGithubSave(token);
};
$('#saveGithub').onclick=saveToGithub;

$('#loginForm').onsubmit=e=>{
  e.preventDefault();
  if($('#password').value===PASS){$('#loginBox').classList.add('hidden');$('#panel').classList.remove('hidden');$('#loginError').textContent=''}
  else $('#loginError').textContent='Неверный пароль';
};
$('#logout').onclick=()=>{$('#panel').classList.add('hidden');$('#loginBox').classList.remove('hidden');$('#password').value='';sessionStorage.removeItem(TOKEN_STORAGE)};

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  const admin=b.dataset.tab==='admin';$('#queueTab').classList.toggle('hidden',admin);$('#adminTab').classList.toggle('hidden',!admin);
});
['search','typeFilter','directionFilter','sort'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
load();
