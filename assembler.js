
// x86-lite Assembler
// Syntax-Elemente:
//  - Register: EAX, EBX, ECX, EDX, ESI, EDI, EBP, ESP
//  - Immediate: #10 oder 10 oder 0x1F
//  - Speicher: [0x1234], [EAX], [ESI+5]
//  - Labels: name:
// Unterstützte Mnemonics: MOV, ADD, SUB, INC, DEC, CMP, JMP, JZ, JNZ, PUSH, POP, CALL, RET, AND, OR, XOR, NOT, SHL, SHR, RND, HLT

const REG_IDX = {EAX:0, EBX:1, ECX:2, EDX:3, ESI:4, EDI:5, EBP:6, ESP:7};

function num(v){
  if (typeof v!=='string') return v|0;
  v=v.trim();
  if (v.startsWith('#')) v = v.slice(1);
  if (v.startsWith('0x')||v.startsWith('0X')) return parseInt(v,16);
  return parseInt(v,10);
}

function parseMem(tok){
  // [0x1234] | [REG] | [REG+imm]
  const inner = tok.slice(1,-1).trim();
  if (inner.match(/^0x/i) || inner.match(/^\d+$/)){
    return {mode:0, addr:num(inner)};
  }
  // REG or REG+imm
  const m = inner.match(/^([A-Z]{3})(?:\+(.+))?$/i);
  if (!m) return {mode:0, addr:0};
  const reg = REG_IDX[m[1].toUpperCase()] ?? 0;
  if (m[2]) return {mode:2, reg, off:num(m[2])&0xFF};
  return {mode:1, reg};
}

function enc_operand(dstOrSrc){
  // returns [kind, bytes[]]
  if (dstOrSrc.kind==='reg') return [0, [dstOrSrc.reg]];
  if (dstOrSrc.kind==='imm') return [1, [dstOrSrc.val & 0xFF]];
  if (dstOrSrc.kind==='mem'){
    const spec = dstOrSrc.spec;
    if (spec.mode===0){ return [2, [0, spec.addr & 0xFF, (spec.addr>>8)&0xFF]]; }
    if (spec.mode===1){ return [2, [1, spec.reg & 0xFF]]; }
    if (spec.mode===2){ return [2, [2, spec.reg & 0xFF, spec.off & 0xFF]]; }
  }
  return [1,[0]];
}

function parseOperand(tok){
  tok = tok.trim();
  if (tok.startsWith('[')) return {kind:'mem', spec: parseMem(tok)};
  if (tok.toUpperCase() in REG_IDX) return {kind:'reg', reg: REG_IDX[tok.toUpperCase()]};
  return {kind:'imm', val: num(tok)};
}

function assemble(code){
  const lines = code.split('\n');
  // First pass: collect labels
  const labels = new Map();
  let pc = 0;
  const tokens = [];

  function emit(opc, mode, aBytes=[], bBytes=[]){ pc += 1 + (mode!==null?1:0) + aBytes.length + bBytes.length; }

  for (let raw of lines){
    let line = raw.split(';')[0].trim();
    if (!line) continue;
    if (line.endsWith(':')){ labels.set(line.slice(0,-1), pc); continue; }
    const parts = line.split(/\s+/);
    const mnem = parts[0].toUpperCase();
    const rest = raw.split(/\s+/).slice(1).join(' ').split(',').map(s=>s.trim()).filter(Boolean);
    tokens.push({mnem, rest, at: pc});
    switch(mnem){
      case 'HLT': emit(0xFF,null); break;

      case 'INC': case 'DEC': case 'NOT': case 'SHL': case 'SHR': case 'RND':
        // single operand
        // opcode + mode + dst
        emit( (mnem==='INC'?0x13:mnem==='DEC'?0x14:mnem==='NOT'?0x43:mnem==='SHL'?0x44:mnem==='SHR'?0x45:0x50), 0, [0]); break;

      case 'RET': emit(0x33,null); break;
      case 'JMP': emit(0x20, null, [0,0]); break;
      case 'JZ':  emit(0x21, null, [0,0]); break;
      case 'JNZ': emit(0x22, null, [0,0]); break;
      case 'CALL': emit(0x32, null, [0,0]); break;
      case 'PUSH': emit(0x30, 0, [0]); break;
      case 'POP':  emit(0x31, 0, [0]); break;

      case 'MOV': case 'ADD': case 'SUB': case 'CMP': case 'AND': case 'OR': case 'XOR':
        // two operands
        emit( mnem==='MOV'?0x10:mnem==='ADD'?0x11:mnem==='SUB'?0x12:mnem==='CMP'?0x15:mnem==='AND'?0x40:mnem==='OR'?0x41:0x42, 0, [0], [0]);
        break;

      default: emit(0xFF,null); break;
    }
  }

  // Second pass: real bytes
  const out = [];
  function outb(b){ out.push(b & 0xFF); }
  function out16(n){ outb(n & 0xFF); outb((n>>8)&0xFF); }

  pc = 0;
  for (let t of tokens){
    const {mnem, rest} = t;
    const A = rest[0]; const B = rest[1];
    switch(mnem){
      case 'HLT': outb(0xFF); break;

      case 'INC': case 'DEC': case 'NOT': case 'SHL': case 'SHR': case 'RND': {
        const op = mnem==='INC'?0x13:mnem==='DEC'?0x14:mnem==='NOT'?0x43:mnem==='SHL'?0x44:mnem==='SHR'?0x45:0x50;
        const a = parseOperand(A);
        const [ak, ab] = enc_operand(a);
        outb(op); outb(ak); ab.forEach(outb);
        if (mnem==='SHL' || mnem==='SHR'){ outb(1); } // standard shift=1
        break;
      }

      case 'RET': outb(0x33); break;
      case 'JMP': case 'JZ': case 'JNZ': case 'CALL': {
        const addrTok = A;
        const addr = labels.has(addrTok) ? labels.get(addrTok) : num(addrTok);
        const opc = mnem==='JMP'?0x20:mnem==='JZ'?0x21:mnem==='JNZ'?0x22:0x32;
        outb(opc); out16(addr);
        break;
      }

      case 'PUSH': {
        const a = parseOperand(A);
        const [ak, ab] = enc_operand(a);
        outb(0x30); outb(ak); ab.forEach(outb);
        break;
      }
      case 'POP': {
        const a = parseOperand(A);
        const [ak, ab] = enc_operand(a);
        outb(0x31); outb(ak); ab.forEach(outb);
        break;
      }

      case 'MOV': case 'ADD': case 'SUB': case 'CMP': case 'AND': case 'OR': case 'XOR': {
        const a = parseOperand(A);
        const b = parseOperand(B);
        const [ak, ab] = enc_operand(a);
        const [bk, bb] = enc_operand(b);
        const opc = mnem==='MOV'?0x10:mnem==='ADD'?0x11:mnem==='SUB'?0x12:mnem==='CMP'?0x15:mnem==='AND'?0x40:mnem==='OR'?0x41:0x42;
        const mode = (ak & 3) | ((bk & 3)<<2);
        outb(opc); outb(mode);
        ab.forEach(outb); bb.forEach(outb);
        break;
      }

      default: outb(0xFF); break;
    }
  }
  return new Uint8Array(out);
}
