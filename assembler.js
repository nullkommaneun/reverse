// x86-lite Assembler v4.3 (robust parsing, label resolution, klare Fehler)

const REG_IDX = {EAX:0, EBX:1, ECX:2, EDX:3, ESI:4, EDI:5, EBP:6, ESP:7};
const TWOOPS = new Set(['MOV','ADD','SUB','CMP','AND','OR','XOR']);
const ONEOPS = new Set(['INC','DEC','NOT','SHL','SHR','RND']);
const NOOPS  = new Set(['HLT','RET']);
const JMP1   = new Set(['JMP','JZ','JNZ','CALL']);

function num(v){
  if (typeof v!=='string') return v|0;
  v=v.trim();
  if (v==='' ) return NaN;
  if (v.startsWith('#')) v = v.slice(1);
  if (/^0x/i.test(v)) return parseInt(v,16);
  if (/^[+-]?\\d+$/.test(v)) return parseInt(v,10);
  return NaN;
}

function stripComment(line){
  const i = line.indexOf(';');
  return i>=0 ? line.slice(0,i) : line;
}

function parseMem(tok){
  const inner = tok.slice(1,-1).trim();
  if (/^0x/i.test(inner) || /^[+-]?\\d+$/.test(inner)){
    return {mode:0, addr:num(inner)};
  }
  const m = inner.match(/^([A-Z]{3})(?:\\+(.+))?$/i);
  if (!m) throw new Error(`Ungültige Speicheradresse: ${tok}`);
  const reg = REG_IDX[m[1].toUpperCase()];
  if (reg===undefined) throw new Error(`Unbekanntes Register: ${m[1]}`);
  if (m[2]!==undefined){
    const off = num(m[2]);
    if (Number.isNaN(off)) throw new Error(`Ungültiger Offset in ${tok}`);
    return {mode:2, reg, off:off & 0xFF};
  }
  return {mode:1, reg};
}

function operandFrom(tok){
  tok = tok.trim();
  if (!tok) return {kind:'empty'};
  if (tok.startsWith('[')) return {kind:'mem', spec: parseMem(tok)};
  const upper = tok.toUpperCase();
  if (upper in REG_IDX) return {kind:'reg', reg: REG_IDX[upper]};
  const n = num(tok);
  if (!Number.isNaN(n)) return {kind:'imm', val: n & 0xFFFF};
  // treat as label
  return {kind:'label', name: tok};
}

function enc_operand(op){
  if (op.kind==='reg') return [0, [op.reg]];
  if (op.kind==='imm') return [1, [op.val & 0xFF]];
  if (op.kind==='mem'){
    const s = op.spec;
    if (s.mode===0) return [2, [0, s.addr & 0xFF, (s.addr>>8)&0xFF]];
    if (s.mode===1) return [2, [1, s.reg & 0xFF]];
    if (s.mode===2) return [2, [2, s.reg & 0xFF, s.off & 0xFF]];
  }
  throw new Error('Ungültiger Operand für Encoding.');
}

function size_twoop(a, b){
  const [ak, ab] = enc_operand(a);
  const [bk, bb] = enc_operand(b);
  return 1 + 1 + ab.length + bb.length;
}
function size_oneop(a, extra=0){
  const [ak, ab] = enc_operand(a);
  return 1 + 1 + ab.length + extra;
}

function assemble(source){
  const lines = source.split('\\n');
  const labels = new Map();
  const toks = [];
  let pc = 0;

  // Pass 1: tokenize + Größenberechnung
  for (let lineNo=0; lineNo<lines.length; lineNo++){
    const s = stripComment(lines[lineNo]).trim();
    if (!s) continue;
    if (/:\\s*$/.test(s)){
      const name = s.slice(0, s.indexOf(':')).trim();
      labels.set(name, pc);
      continue;
    }
    const m = s.match(/^([A-Za-z]{2,5})(?:\\s+(.*))?$/);
    if (!m) throw new Error(`Unlesbare Zeile ${lineNo+1}: "${s}"`);
    const mnem = m[1].toUpperCase();
    const opsRaw = (m[2]||'').split(',').map(x=>x.trim()).filter(x=>x.length>0);
    let ops = opsRaw.map(operandFrom);

    // checks
    if (TWOOPS.has(mnem) && ops.length!==2) throw new Error(`${mnem} erwartet 2 Operanden (Zeile ${lineNo+1})`);
    if (ONEOPS.has(mnem) && ops.length!==1) throw new Error(`${mnem} erwartet 1 Operanden (Zeile ${lineNo+1})`);
    if (NOOPS.has(mnem)   && ops.length!==0) throw new Error(`${mnem} erwartet 0 Operanden (Zeile ${lineNo+1})`);
    if (JMP1.has(mnem)    && ops.length!==1) throw new Error(`${mnem} erwartet 1 Operanden (Zeile ${lineNo+1})`);

    const opsForSize = ops.map(op => op.kind==='label' ? {kind:'imm', val:0} : op);
    let size = 0;
    switch(mnem){
      case 'HLT': case 'RET': size = 1; break;
      case 'JMP': case 'JZ': case 'JNZ': case 'CALL': size = 3; break;
      case 'INC': case 'DEC': case 'NOT': case 'RND': size = size_oneop(opsForSize[0]); break;
      case 'SHL': case 'SHR': size = size_oneop(opsForSize[0], 1); break;
      case 'PUSH': case 'POP': size = size_oneop(opsForSize[0]); break;
      default: size = size_twoop(opsForSize[0], opsForSize[1]); break;
    }
    toks.push({mnem, ops, lineNo});
    pc += size;
  }

  // Pass 2: ausgeben mit Label-Auflösung
  const out = [];
  function outb(b){ out.push(b & 0xFF); }
  function out16(n){ outb(n & 0xFF); outb((n>>8)&0xFF); }

  const resolve = (op) => {
    if (op.kind==='label'){
      if (!labels.has(op.name)) throw new Error(`Unbekanntes Label "${op.name}"`);
      return {kind:'imm', val: labels.get(op.name)};
    }
    return op;
  };

  for (const t of toks){
    const {mnem, ops} = t;
    switch(mnem){
      case 'HLT': outb(0xFF); break;
      case 'RET': outb(0x33); break;
      case 'JMP': case 'JZ': case 'JNZ': case 'CALL': {
        const o = resolve(ops[0]);
        const addr = o.val & 0xFFFF;
        const opc = mnem==='JMP'?0x20:mnem==='JZ'?0x21:mnem==='JNZ'?0x22:0x32;
        outb(opc); out16(addr);
        break;
      }
      case 'INC': case 'DEC': case 'NOT': case 'RND': {
        const o = resolve(ops[0]);
        const [ak, ab] = enc_operand(o);
        const opc = mnem==='INC'?0x13:mnem==='DEC'?0x14:mnem==='NOT'?0x43:0x50;
        outb(opc); outb(ak); ab.forEach(outb);
        break;
      }
      case 'SHL': case 'SHR': {
        const o = resolve(ops[0]);
        const [ak, ab] = enc_operand(o);
        outb(mnem==='SHL'?0x44:0x45); outb(ak); ab.forEach(outb); outb(1);
        break;
      }
      case 'PUSH': {
        const o = resolve(ops[0]);
        const [ak, ab] = enc_operand(o);
        outb(0x30); outb(ak); ab.forEach(outb);
        break;
      }
      case 'POP': {
        const o = resolve(ops[0]);
        const [ak, ab] = enc_operand(o);
        outb(0x31); outb(ak); ab.forEach(outb);
        break;
      }
      default: { // two-op
        const a = resolve(ops[0]);
        const b = resolve(ops[1]);
        const [ak, ab] = enc_operand(a);
        const [bk, bb] = enc_operand(b);
        const opc = mnem==='MOV'?0x10:mnem==='ADD'?0x11:mnem==='SUB'?0x12:mnem==='CMP'?0x15:mnem==='AND'?0x40:mnem==='OR'?0x41:0x42;
        outb(opc); outb((ak & 3) | ((bk & 3)<<2)); ab.forEach(outb); bb.forEach(outb);
      }
    }
  }
  return new Uint8Array(out);
}
