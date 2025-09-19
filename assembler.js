
// Minimal-Assembler für das Instruktionsset
// Syntax: eine Instruktion pro Zeile, Kommentare mit ';'
// Befehle: LOADA <imm>, LOADB <imm>, STORE <addr>, ADD, JMP <addr>, CMP, JEQ <addr>, RANDOM, HLT

function parseNumber(tok){
  if (tok.startsWith("0x") || tok.startsWith("0X")) return parseInt(tok, 16);
  return parseInt(tok, 10);
}

function assemble(code){
  const out = [];
  const lines = code.split('\n');
  for (let raw of lines){
    const line = raw.split(';')[0].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const ins = parts[0].toUpperCase();
    switch(ins){
      case 'LOADA': out.push(0x01, parseNumber(parts[1]||'0')); break;
      case 'LOADB': out.push(0x02, parseNumber(parts[1]||'0')); break;
      case 'STORE': out.push(0x03, parseNumber(parts[1]||'0')); break;
      case 'ADD': out.push(0x04); break;
      case 'JMP': out.push(0x05, parseNumber(parts[1]||'0')); break;
      case 'CMP': out.push(0x06); break;
      case 'JEQ': out.push(0x07, parseNumber(parts[1]||'0')); break;
      case 'RANDOM': out.push(0x08); break;
      case 'HLT': out.push(0xFF); break;
      default:
        console.warn('Unbekannte Instruktion:', ins);
    }
  }
  return new Uint8Array(out);
}
