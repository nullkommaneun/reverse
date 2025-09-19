
// Disassembler für das Minimal-ISA
// Liefert ein Array von Einträgen: {addr, bytes[], text}

function disassemble(mem, start=0, end=mem.length){
  const out = [];
  let pc = start;
  while (pc < end){
    const op = mem[pc];
    let bytes = [op];
    let text = '';
    switch(op){
      case 0x01: // LOADA imm
        bytes.push(mem[pc+1]); text = `LOADA ${mem[pc+1]}`; pc += 2; break;
      case 0x02: // LOADB imm
        bytes.push(mem[pc+1]); text = `LOADB ${mem[pc+1]}`; pc += 2; break;
      case 0x03: // STORE addr
        bytes.push(mem[pc+1]); text = `STORE ${mem[pc+1]}`; pc += 2; break;
      case 0x04: // ADD
        text = `ADD`; pc += 1; break;
      case 0x05: // JMP addr
        bytes.push(mem[pc+1]); text = `JMP ${mem[pc+1]}`; pc += 2; break;
      case 0x06: // CMP
        text = `CMP`; pc += 1; break;
      case 0x07: // JEQ addr
        bytes.push(mem[pc+1]); text = `JEQ ${mem[pc+1]}`; pc += 2; break;
      case 0x08: // RANDOM
        text = `RANDOM`; pc += 1; break;
      case 0xFF: // HLT
        text = `HLT`; pc += 1; break;
      default:
        text = `DB 0x${op.toString(16).padStart(2,'0')}`; pc += 1; break;
    }
    out.push({addr: pc - bytes.length, bytes, text});
    if (op === 0xFF) break;
  }
  return out;
}
