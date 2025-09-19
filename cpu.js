class CPU {
  constructor(memorySize = 256) {
    this.mem = new Uint8Array(memorySize);
    this.reset();
  }

  reset() {
    this.reg = { A: 0, B: 0, PC: 0, FLAGS: 0 };
    this.running = false;
    this.cycles = 0;
    this.mem.fill(0);
  }

  loadProgram(bytes, addr = 0) {
    this.mem.set(bytes, addr);
    this.reg.PC = addr;
  }

  step() {
    const op = this.mem[this.reg.PC++];
    switch (op) {
      case 0x01: // LOAD A, imm
        this.reg.A = this.mem[this.reg.PC++];
        break;
      case 0x02: // LOAD B, imm
        this.reg.B = this.mem[this.reg.PC++];
        break;
      case 0x03: // STORE [addr], A
        {
          const addr = this.mem[this.reg.PC++];
          this.mem[addr] = this.reg.A;
        }
        break;
      case 0x04: // ADD A, B
        this.reg.A = (this.reg.A + this.reg.B) & 0xFF;
        break;
      case 0x05: // JMP addr
        this.reg.PC = this.mem[this.reg.PC];
        break;
      case 0x06: // CMP A,B -> FLAGS
        this.reg.FLAGS = (this.reg.A === this.reg.B) ? 1 : 0;
        this.reg.PC++;
        break;
      case 0x07: // JEQ addr
        {
          const addr = this.mem[this.reg.PC++];
          if (this.reg.FLAGS === 1) this.reg.PC = addr;
        }
        break;
      case 0x08: // RANDOM -> A
        this.reg.A = Math.floor(Math.random() * 256);
        break;
      case 0xFF: // HLT
        this.running = false;
        return false;
      default:
        this.running = false;
        return false;
    }
    this.cycles++;
    return true;
  }
}