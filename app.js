let cpu = new CPU(256);
let interval = null;
const canvas = document.getElementById('memoryCanvas');
const ctx = canvas.getContext('2d');

function drawMemory() {
  const w = 16, h = 16;
  for (let i = 0; i < cpu.mem.length; i++) {
    const x = (i % 32) * w;
    const y = Math.floor(i / 32) * h;
    const val = cpu.mem[i];
    ctx.fillStyle = val === 0 ? '#000' : `hsl(${val},100%,50%)`;
    ctx.fillRect(x, y, w, h);
  }
}

function updateRegisters() {
  document.getElementById('registers').innerText =
    `A=${cpu.reg.A} B=${cpu.reg.B} PC=${cpu.reg.PC} FLAGS=${cpu.reg.FLAGS} CYCLES=${cpu.cycles}`;
}

function assembleAndLoad() {
  const code = document.getElementById('codeArea').value;
  const bytes = assemble(code);
  cpu.reset();
  cpu.loadProgram(bytes, 0);
  drawMemory();
  updateRegisters();
}

function loadDemo(name) {
  document.getElementById('codeArea').value = DemoCodes[name];
  assembleAndLoad();
}

function step() {
  cpu.step();
  drawMemory();
  updateRegisters();
}

function run() {
  cpu.running = true;
  interval = setInterval(() => {
    if (!cpu.running) { stop(); return; }
    cpu.step();
    drawMemory();
    updateRegisters();
  }, 150);
}

function stop() {
  clearInterval(interval);
  cpu.running = false;
}

function reset() {
  cpu.reset();
  drawMemory();
  updateRegisters();
}

loadDemo('hello');