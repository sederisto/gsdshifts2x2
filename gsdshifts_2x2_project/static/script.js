//importe jsPDF e html2canvas (CDN)
const pdfScript = document.createElement('script');
pdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
document.head.appendChild(pdfScript);

const h2cScript = document.createElement('script');
h2cScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
document.head.appendChild(h2cScript);

//adicione o evento do botão
document.getElementById("export-pdf").addEventListener("click", async () => {

    const { jsPDF } = window.jspdf;

    const element = document.getElementById("compact-wrap");
    const monthTitle = document.getElementById("month-title").textContent;

    // Garantir renderização completa
    await new Promise(res => setTimeout(res, 300));

    html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF("l", "pt", "a4"); // paisagem
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Ajustar imagem proporcional na página
        let imgWidth = pageWidth - 40;
        let imgHeight = canvas.height * (imgWidth / canvas.width);

        pdf.setFontSize(18);
        pdf.text(`Escala Mensal - ${monthTitle}`, 40, 30);

        pdf.addImage(imgData, "PNG", 20, 50, imgWidth, imgHeight);

        pdf.save(`Escala_${monthTitle}.pdf`);
    });

});

// script.js - lógica do frontend, agora consumindo APIs Flask
const qs = (s, root=document) => root.querySelector(s);
const qsa = (s, root=document) => [...root.querySelectorAll(s)];
const uid = () => 'id_'+Math.random().toString(36).slice(2,9);
const formatDateISO = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const parseISO = s => {
  if(!s) return null;
  const p=s.split('-').map(x=>parseInt(x,10)); return new Date(p[0],p[1]-1,p[2]);
};
const daysInMonth = (y,m) => new Date(y,m+1,0).getDate();
const dateDiffDays = (a,b) => Math.floor((a.getTime() - b.getTime())/(24*3600*1000));

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let compactView = true;
let searchTerm = '';
let employees = [];
let holidays = [];

const monthSelect = qs('#month-select');
const yearSelect = qs('#year-select');
const monthTitle = qs('#month-title');

function initMonthYearSelectors(){
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  monthSelect.innerHTML = monthNames.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  const years = []; for(let y=currentYear-2;y<=currentYear+2;y++) years.push(y);
  yearSelect.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
  monthSelect.value = currentMonth; yearSelect.value = currentYear;
}

async function apiFetch(path, opts){
  try{
    const res = await fetch(path, opts);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }catch(e){
    console.error('API fetch error', e);
    return null;
  }
}

async function loadData(){
  const resE = await apiFetch('/api/employees');
  const resH = await apiFetch('/api/holidays');
  employees = resE || [];
  holidays = resH || [];
}

function parseType(type){
  const [num,kind] = (type||'1-2x2').split('-');
  return {shift:num, kind: kind};
}

function scheduleForMonth(emp, year, month){
  const days = daysInMonth(year,month);
  const rows = [];
  const parsed = parseType(emp.type);
  for(let d=1; d<=days; d++){
    const date = new Date(year,month,d);
    let working = true;
    if(parsed.kind === '2x2'){
      const start = emp.start ? parseISO(emp.start) : new Date(year,month,1);
      const diff = dateDiffDays(date, start);
      const idx = ((diff % 4) + 4) % 4;
      working = (idx === 0 || idx === 1);
    } else {
      const dow = date.getDay();
      if(emp.weeklyOff && emp.weeklyOff.includes(dow)) working = false; else working = true;
    }
    const isHoliday = holidays.find(h=>h.date === formatDateISO(date));
    rows.push({date,working,shift:parsed.shift,customTime:emp.customTime,isHoliday:isHoliday ? isHoliday.name : null});
  }
  return rows;
}

// procura boa data inicial para 2x2 - algoritmo simples tentando minimizar folgas em fins de semana
function findGoodStartFor2x2(emp,year,month){
  const days = daysInMonth(year,month);
  let best=null;
  for(let offset=0; offset<14; offset++){
    const candidateStart = new Date(year,month,1 + offset);
    const candISO = formatDateISO(candidateStart);
    const temp = Object.assign({}, emp, { type: emp.type.replace(/-fixo$/,'-2x2'), start:candISO });
    const sched = scheduleForMonth(temp, year, month);
    let score=0; let totalOff=0;
    for(let i=0;i<sched.length;i++){
      const day = sched[i];
      if(!day.working) totalOff++;
      const dow = day.date.getDay();
      if(!day.working && emp.weeklyOff && emp.weeklyOff.includes(dow)) score++;
      // penaliza folgas em dias úteis (queremos folgas preferencialmente em sáb/dom)
      if(!day.working && (dow>=1 && dow<=5)) score -= 0.5;
    }
    const prop = totalOff>0 ? (score/totalOff) : -999;
    if(!best || prop>best.prop){ best = {offset,prop,start:candISO,score,totalOff} }
  }
  return best ? best.start : formatDateISO(new Date(year,month,1));
}

// ---------- Render ----------
function renderCompact(){
  const days = daysInMonth(currentYear,currentMonth);
  const table = document.createElement('table'); table.className='compact';
  const thead = document.createElement('thead');
  const trWeek = document.createElement('tr');
  const thName = document.createElement('th'); thName.className='sticky'; thName.textContent='Funcionário'; trWeek.appendChild(thName);
  const weekdayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
  for(let d=1; d<=days; d++){
    const date = new Date(currentYear,currentMonth,d);
    const th = document.createElement('th'); th.textContent = weekdayNames[date.getDay()]; trWeek.appendChild(th);
  }
  thead.appendChild(trWeek);
  const trh = document.createElement('tr');
  const thName2 = document.createElement('th'); thName2.className='sticky'; thName2.textContent=''; trh.appendChild(thName2);
  for(let d=1; d<=days; d++){ const th = document.createElement('th'); th.textContent=d; trh.appendChild(th) }
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  const filtered = employees.filter(e=> e.name && e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  for(const emp of filtered){
    const sched = scheduleForMonth(emp,currentYear,currentMonth);
    const tr = document.createElement('tr');
    const tdName = document.createElement('td'); tdName.className='sticky';
    tdName.innerHTML = `<strong>${emp.name||''}</strong>
      <div class="small">
        ${(emp.type ? emp.type.replace('-', ' • ') : '')}
        ${emp.customTime ? '• '+emp.customTime : ''}
      </div>`;
    tr.appendChild(tdName);
    for(let i=0;i<sched.length;i++){
      const cell = document.createElement('td');
      if(sched[i].isHoliday){ cell.className='cell-holiday'; cell.title = sched[i].isHoliday + ' (feriado)'; }
      else cell.className = sched[i].working ? 'cell-work' : 'cell-off';
      if(sched[i].working) cell.innerHTML = `<span class="shift">T${sched[i].shift} ${sched[i].customTime ? ('• '+sched[i].customTime) : ''}</span>`;
      else cell.textContent = '';
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const wrap = qs('#compact-wrap'); wrap.innerHTML=''; wrap.appendChild(table);
  monthTitle.textContent = `${qs('#month-select option:checked').textContent} ${currentYear}`;
}

function renderEmpList(){
  const el = qs('#emp-list'); el.innerHTML='';
  const filtered = employees.filter(e=> e.name && e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  filtered.forEach(emp=>{
    const div = document.createElement('div'); div.className='emp-item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${emp.name||''}</strong>
      <div class="small">
        ${(emp.type ? emp.type.replace('-', ' • ') : '')}
        ${emp.customTime ? '• '+emp.customTime : ''}
      </div>`;
    const right = document.createElement('div');
    const btnEdit = document.createElement('button'); btnEdit.className='btn ghost'; btnEdit.textContent='Editar'; btnEdit.onclick = ()=>openModal(emp.id);
    const btnDel = document.createElement('button'); btnDel.style.background='var(--danger)'; btnDel.textContent='Excluir'; btnDel.onclick = async ()=>{
      if(!confirm('Excluir '+emp.name+'?')) return;
      await fetch('/api/employees/'+emp.id, { method: 'DELETE' });
      await reloadAndRender();
    };
    const btnConv = document.createElement('button'); btnConv.className='btn ghost'; btnConv.textContent='Converter→2x2'; btnConv.onclick = async ()=>{
      if((emp.type||'').endsWith('2x2')){ alert('Já é 2x2'); return; }
      const newStart = findGoodStartFor2x2(emp,currentYear,currentMonth);
      if(!confirm(`Converter ${emp.name} para 2x2 usando data inicial ${newStart}?`)) return;
      const updated = Object.assign({}, emp, { type: emp.type.replace(/-fixo$/,'-2x2'), start:newStart });
      await fetch('/api/employees/'+emp.id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updated) });
      await reloadAndRender();
    }
    right.appendChild(btnConv); right.appendChild(btnEdit); right.appendChild(btnDel);
    div.appendChild(left); div.appendChild(right); el.appendChild(div);
  })
}

// ---------- Modal / CRUD ----------
let editingId = null;
function openModal(id=null){
  editingId = id;
  const modal = qs('#modal'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
  qs('#modal-title').textContent = id ? 'Editar funcionário' : 'Novo funcionário';
  const emp = employees.find(e=>e.id===id);
  qs('#emp-name').value = emp ? emp.name : '';
  qs('#emp-type').value = emp ? emp.type : '1-2x2';
  qs('#emp-custom-time').value = emp ? (emp.customTime||'') : '';
  qs('#emp-start').value = emp ? (emp.start || formatDateISO(new Date())) : formatDateISO(new Date());
  qsa('.dow').forEach(cb=>cb.checked = emp && emp.weeklyOff && emp.weeklyOff.includes(parseInt(cb.value)) );
}
qs('#add-emp').onclick = ()=>openModal(null);
qs('#cancel-emp').onclick = ()=>{ qs('#modal').classList.remove('open'); qs('#modal').setAttribute('aria-hidden','true'); }

qs('#save-emp').onclick = async ()=>{
  const name = qs('#emp-name').value.trim(); if(!name){ alert('Informe o nome'); return; }
  const type = qs('#emp-type').value;
  const customTime = qs('#emp-custom-time').value.trim();
  const start = qs('#emp-start').value;
  const weeklyOff = qsa('.dow').filter(cb=>cb.checked).map(cb=>parseInt(cb.value));
  const payload = { name, type, customTime, start, weeklyOff };
  if(editingId){
    await fetch('/api/employees/'+editingId, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  } else {
    await fetch('/api/employees', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  }
  qs('#modal').classList.remove('open'); qs('#modal').setAttribute('aria-hidden','true');
  await reloadAndRender();
}

qs('#manage-holidays').onclick = ()=>{ qs('#modal-hol').classList.add('open'); qs('#modal-hol').setAttribute('aria-hidden','false'); renderHolidayList(); }
qs('#close-hol').onclick = ()=>{ qs('#modal-hol').classList.remove('open'); qs('#modal-hol').setAttribute('aria-hidden','true'); }
qs('#add-hol').onclick = async ()=>{
  const date = qs('#hol-date').value; const name = qs('#hol-name').value.trim(); if(!date||!name){ alert('Informe data e nome'); return; }
  await fetch('/api/holidays', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({date,name}) });
  qs('#hol-date').value=''; qs('#hol-name').value=''; await reloadAndRender(); renderHolidayList();
}

function renderHolidayList(){ const el = qs('#holiday-list'); el.innerHTML=''; holidays.forEach(h=>{
  const d = document.createElement('div'); d.style.display='flex'; d.style.justifyContent='space-between'; d.style.alignItems='center'; d.style.padding='6px 0';
  d.innerHTML = `<div><strong>${h.name}</strong><div class="small">${h.date}</div></div>`;
  const btn = document.createElement('button'); btn.className='btn ghost'; btn.textContent='Excluir'; btn.onclick = async ()=>{ if(confirm('Excluir feriado '+h.name+'?')){ await fetch('/api/holidays/'+h.id,{ method:'DELETE'}); await reloadAndRender(); renderHolidayList(); } };
  d.appendChild(btn); el.appendChild(d);
}) }

// ---------- Export CSV ----------
async function exportCSV(){
  // request backend CSV
  const res = await fetch(`/api/export/csv?year=${currentYear}&month=${currentMonth+1}`);
  if(res.ok){
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = `escala_${currentYear}_${currentMonth+1}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } else {
    alert('Falha ao gerar CSV');
  }
}

// ---------- Helpers ----------
async function reloadAndRender(){
  await loadData();
  renderEmpList(); renderCompact();
}

qs('#export-csv').onclick = exportCSV;
qs('#prev-month').onclick = ()=>{ currentMonth--; if(currentMonth<0){ currentMonth=11; currentYear--; } monthSelect.value=currentMonth; yearSelect.value=currentYear; renderCompact(); }
qs('#next-month').onclick = ()=>{ currentMonth++; if(currentMonth>11){ currentMonth=0; currentYear++; } monthSelect.value=currentMonth; yearSelect.value=currentYear; renderCompact(); }
monthSelect.onchange = ()=>{ currentMonth = parseInt(monthSelect.value); renderCompact(); }
yearSelect.onchange = ()=>{ currentYear = parseInt(yearSelect.value); renderCompact(); }
qs('#toggle-view').onclick = ()=>{ compactView = !compactView; qs('#toggle-view').textContent = compactView ? 'Ver: Compacto' : 'Ver: Calendário'; renderCompact(); }
qs('#search').oninput = (e)=>{ searchTerm = e.target.value; renderEmpList(); renderCompact(); }
qs('#clear-search').onclick = ()=>{ qs('#search').value=''; searchTerm=''; renderEmpList(); renderCompact(); }

// Inicialização
initMonthYearSelectors();
loadData().then(()=>{ renderEmpList(); renderCompact(); });
