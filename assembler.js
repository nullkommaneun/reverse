// ganz einfacher Assembler: wandelt ein paar Instruktionen in Bytes

function assemble(code) {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
  const out = [];
  for (let line of lines) {
    const parts = line.split(/\s+/);
    const instr = parts[0].toUpperCase();
    switch (instr) {
      case 'LOADA': out.push(0x01, parseInt(parts[1])); break;
      case 'LOADB': out.push(0x02, parseInt(parts[1])); break;
      case 'STORE': out.push(0x03, parseInt(parts[1])); break;
      case 'ADD': out.push(0x04); break;
      case 'JMP': out.push(0x05, parseInt(parts[1])); break;
      case 'CMP': out.push(0x06); break;
      case 'JEQ': out.push(0x07, parseInt(parts[1])); break;
      case 'RANDOM': out.push(0x08); break;
      case 'HLT': out.push(0xFF); break;
      default: console.warn('Unbekannt:', instr);
    }
  }
  return new Uint8Array(out);
}