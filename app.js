
let cpu = new CPU();
let timer = null;
const grid = document.getElementById('gridView');
const gctx = grid.getContext('2d');
const hexPre = document.getElementById('hexView');

function toHex(n,w=2){ return n.toString(16).padStart(w,'0'); }

function renderGrid(){
  const cols = 64; // 64 * 100 = 640 width (bei 640x320 -> 64x32 Zellen)
  const rows = 32;
  const cellW = grid.width / cols;
  const cellH = grid.height / rows;
  for (let i=0;i<cols*rows;i++){
    const val = cpu.mem[i];
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    const hue = (val * 1.41) % 360;
    gctx.fillStyle = val===0 ? '#000' : `hsl(${hue}, 80%, 50%)`;
    gctx.fillRect(x,y,cellW,cellH);
  }
  gctx.strokeStyle='rgba(255,255,255,0.15)';
  gctx.strokeRect(0,0,grid.width,grid.height);
}

function renderHex(){
  const cols = 16;
  let out = '';
  for (let base=0; base<0x200; base+=cols){
    const bytes = [];
    const ascii = [];
    for (let i=0;i<cols;i++){
      const v = cpu.mem[base+i] ?? 0;
      bytes.push(toHex(v));
      ascii.push(v>=32 && v<127 ? String.fromCharCode(v) : '.');
    }
    out += toHex(base,4) + '  ' + bytes.join(' ') + '  |' + ascii.join('') + '|\n';
  }
  hexPre.textContent = out;
}

function renderDisasm(){
  const list = disassemble(cpu.mem, 0, cpu.programEnd || cpu.mem.length);
  const pc = cpu.reg.EIP;
  const html = list.map(item => {
    const cls = (item.addr === pc) ? 'insn pc' : 'insn';
    const b = item.bytes.map(b=>toHex(b)).join(' ');
    return `<div class="${cls}"><span class="addr">0x${toHex(item.addr,4)}</span> <span class="bytes">${b}</span> <span class="mn">${item.text.split(' ')[0]||''}</span> <span class="op">${item.text.split(' ').slice(1).join(' ')}</span></div>`;
  }).join('');
  const el = document.getElementById('disasm');
  el.innerHTML = html;
  const pcEl = el.querySelector('.pc');
  if (pcEl) pcEl.scrollIntoView({block:'nearest'});
}

function updateRegs(){
  const r = cpu.reg, f = cpu.flags;
  document.getElementById('registers').textContent =
    `EAX=${r.EAX} EBX=${r.EBX} ECX=${r.ECX} EDX=${r.EDX} ESI=${r.ESI} EDI=${r.EDI} EBP=${r.EBP} ESP=${toHex(r.ESP,4)} EIP=${toHex(r.EIP,4)}  |  ZF=${f.ZF} SF=${f.SF}`;
}

function assembleAndLoad(){
  const code = document.getElementById('codeArea').value;
  const bytes = assemble(code);
  cpu.reset();
  cpu.loadProgram(bytes, 0x0000);
  renderAll();
  window._lastBin = bytes;
}

function loadDemo(name){
  document.getElementById('codeArea').value = DemoCodes[name];
  assembleAndLoad();
}

function step(){ cpu.step(); renderAll(); }
function run(){
  stop(); cpu.running=true;
  timer = setInterval(()=>{ if(!cpu.step()){ stop(); } renderAll(); }, 100);
}
function stop(){ if (timer) clearInterval(timer); timer=null; cpu.running=false; }
function reset(){
  const code = document.getElementById('codeArea').value;
  const bytes = assemble(code);
  cpu.reset();
  cpu.loadProgram(bytes, 0x0000);
  renderAll();
}

function renderAll(){
  updateRegs(); renderDisasm();
  const active = document.querySelector('.tab.active')?.dataset.target || 'gridView';
  if (active==='gridView'){ renderGrid(); } else { renderHex(); }
}

function switchTab(ev){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  ev.target.classList.add('active');
  const target = ev.target.dataset.target;
  document.getElementById('gridView').classList.toggle('hidden', target!=='gridView');
  document.getElementById('hexView').classList.toggle('hidden', target!=='hexView');
  renderAll();
}

function downloadBytes(){
  const bytes = window._lastBin || new Uint8Array();
  const blob = new Blob([bytes], {type:'application/octet-stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'program.bin';
  a.click();
  URL.revokeObjectURL(a.href);
}

// init
loadDemo('hello');
