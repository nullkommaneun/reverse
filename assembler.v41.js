
// x86-lite Assembler (fix: korrekte Längenberechnung & saubere Kommentarbehandlung)

const REG_IDX = {EAX:0, EBX:1, ECX:2, EDX:3, ESI:4, EDI:5, EBP:6, ESP:7};

function num(v){
  if (typeof v!=='string') return v|0;
  v=v.trim();
  if (v.startsWith('#')) v = v.slice(1);
  if (v.startsWith('0x')||v.startsWith('0X')) return parseInt(v,16);
  return parseInt(v,10);
}

function stripComment(line){
  const i = line.indexOf(';');
  return i>=0 ? line.slice(0,i) : line;
}

function parseMem(tok){
  // [0x1234] | [REG] | [REG+imm]
  const inner = tok.slice(1,-1).trim();
  if (inner.match(/^0x/i) || inner.match(/^\d+$/)){
    return {mode:0, addr:num(inner)};
  }
  const m = inner.match(/^([A-Z]{3})(?:\+(.+))?$/i);
  if (!m) return {mode:0, addr:0};
  const reg = REG_IDX[m[1].toUpperCase()] ?? 0;
  if (m[2]) return {mode:2, reg, off:num(m[2])&0xFF};
  return {mode:1, reg};
}

function operandFrom(tok){
  tok = tok.trim();
  if (tok.startsWith('[')) return {kind:'mem', spec: parseMem(tok)};
  if (tok.toUpperCase() in REG_IDX) return {kind:'reg', reg: REG_IDX[tok.toUpperCase()]};
  return {kind:'imm', val: num(tok)};
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
  return [1,[0]];
}

function size_twoop(opA, opB){
  const [ak, ab] = enc_operand(opA);
  const [bk, bb] = enc_operand(opB);
  return 1 /*opc*/ + 1 /*mode*/ + ab.length + bb.length;
}
function size_oneop(opA, extra=0){
  const [ak, ab] = enc_operand(opA);
  return 1 /*opc*/ + 1 /*mode*/ + ab.length + extra;
}

function assemble(code){
  const lines = code.split('\n');

  // First pass: tokenize, compute labels with exact sizes
  const labels = new Map();
  const toks = [];
  let pc = 0;

  for (let raw of lines){
    let line = stripComment(raw).trim();
    if (!line) continue;
    if (line.endsWith(':')){ labels.set(line.slice(0,-1), pc); continue; }

    const [mn, restStr=''] = line.split(/\s+/, 2);
    const mnem = mn.toUpperCase();
    const ops = restStr.split(',').map(s=>s.trim()).filter(Boolean).map(operandFrom);

    // size accounting
    switch(mnem){
      case 'HLT': case 'RET':
        pc += 1; break;
      case 'JMP': case 'JZ': case 'JNZ': case 'CALL':
        pc += 1 + 2; break;
      case 'INC': case 'DEC': case 'NOT': case 'RND':
        pc += size_oneop(ops[0]); break;
      case 'SHL': case 'SHR':
        pc += size_oneop(ops[0], 1 /*shift imm*/); break;
      case 'PUSH': case 'POP':
        pc += size_oneop(ops[0]); break;
      case 'MOV': case 'ADD': case 'SUB': case 'CMP': case 'AND': case 'OR': case 'XOR':
        pc += size_twoop(ops[0], ops[1]); break;
      default:
        // Fallback: DB 0x00
        pc += 1;
    }

    toks.push({mnem, ops});
  }

  // Second pass: emit bytes with resolved labels
  const out = [];
  function outb(b){ out.push(b & 0xFF); }
  function out16(n){ outb(n & 0xFF); outb((n>>8)&0xFF); }

  for (let t of toks){
    const {mnem, ops} = t;
    switch(mnem){
      case 'HLT': outb(0xFF); break;
      case 'RET': outb(0x33); break;

      case 'JMP': case 'JZ': case 'JNZ': case 'CALL': {
        const tok = ops[0];
        // label oder absolute Zahl (imm16)
        let addr;
        if (tok.kind==='imm') addr = tok.val;
        else if (tok.kind==='mem' && tok.spec.mode===0) addr = tok.spec.addr;
        else {
          const key = stripComment(lines.find(l => l.trim().endsWith(':') && l.includes(tok)) || '') || '';
          addr = labels.get(tok) ?? labels.get(tok.val) ?? 0;
        }
        const opc = mnem==='JMP'?0x20:mnem==='JZ'?0x21:mnem==='JNZ'?0x22:0x32;
        outb(opc); out16(addr|0);
        break;
      }

      case 'INC': case 'DEC': case 'NOT': case 'RND': {
        const opA = ops[0];
        const [ak, ab] = enc_operand(opA);
        const opc = mnem==='INC'?0x13:mnem==='DEC'?0x14:mnem==='NOT'?0x43:0x50;
        outb(opc); outb(ak); ab.forEach(outb);
        break;
      }
      case 'SHL': case 'SHR': {
        const opA = ops[0];
        const [ak, ab] = enc_operand(opA);
        outb(mnem==='SHL'?0x44:0x45); outb(ak); ab.forEach(outb); outb(1);
        break;
      }
      case 'PUSH': {
        const [ak, ab] = enc_operand(ops[0]);
        outb(0x30); outb(ak); ab.forEach(outb);
        break;
      }
      case 'POP': {
        const [ak, ab] = enc_operand(ops[0]);
        outb(0x31); outb(ak); ab.forEach(outb);
        break;
      }
      case 'MOV': case 'ADD': case 'SUB': case 'CMP': case 'AND': case 'OR': case 'XOR': {
        const [ak, ab] = enc_operand(ops[0]);
        const [bk, bb] = enc_operand(ops[1]);
        const opc = mnem==='MOV'?0x10:mnem==='ADD'?0x11:mnem==='SUB'?0x12:mnem==='CMP'?0x15:mnem==='AND'?0x40:mnem==='OR'?0x41:0x42;
        outb(opc); outb( (ak & 3) | ((bk & 3)<<2) );
        ab.forEach(outb); bb.forEach(outb);
        break;
      }
      default:
        outb(0x00); // unbekannter Befehl
    }
  }

  return new Uint8Array(out);
}
