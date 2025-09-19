
/**
 * x86-lite VM
 * - 64KB Speicher
 * - Register: EAX, EBX, ECX, EDX, ESI, EDI, EBP, ESP (je 32 Bit, effektiv 0..255 für einfache Demos)
 * - Flags: ZF, CF, SF, OF (nur minimal benutzt)
 * - Befehle: MOV, ADD, SUB, INC, DEC, CMP, JMP, JZ, JNZ, PUSH, POP, CALL, RET, AND, OR, XOR, NOT, SHL, SHR, RND, HLT
 * - Adressierung: Imm (#n oder n), [addr], [REG], [REG+imm]
 */
class CPU {
  constructor(size = 0x10000) { // 64KB
    this.mem = new Uint8Array(size);
    this.reset();
  }
  reset(){
    this.reg = {EAX:0, EBX:0, ECX:0, EDX:0, ESI:0, EDI:0, EBP:0, ESP:0xFF00, EIP:0};
    this.flags = {ZF:0, CF:0, SF:0, OF:0};
    this.running = false;
    this.cycles = 0;
    this.programEnd = 0;
    this.mem.fill(0);
  }
  loadProgram(bytes, addr=0){
    this.mem.fill(0);
    this.mem.set(bytes, addr);
    this.reg.EIP = addr;
    this.programEnd = addr + bytes.length;
  }

  // Helpers
  _setZF(val){ this.flags.ZF = (val & 0xFF) === 0 ? 1 : 0; }
  _setSF(val){ this.flags.SF = (val & 0x80) ? 1 : 0; }
  _wr8(addr, v){ this.mem[addr & 0xFFFF] = v & 0xFF; }
  _rd8(addr){ return this.mem[addr & 0xFFFF]; }

  // Read next byte from code
  _fetch(){ return this.mem[(this.reg.EIP++) & 0xFFFF]; }
  _fetch16(){ const lo = this._fetch(); const hi = this._fetch(); return (hi<<8)|lo; }
  _fetch32(){ const b0=this._fetch(), b1=this._fetch(), b2=this._fetch(), b3=this._fetch(); return (b3<<24)|(b2<<16)|(b1<<8)|b0; }

  // Encoding (very simple):
  // opcode (1B) | mode (1B) | operands (variable)
  // mode bits: dstKind(2) srcKind(2) addrMode(4) -> hier minimal genutzt
  // Kind: 0=reg,1=imm,2=mem
  step(){
    const op = this._fetch();
    switch(op){
      case 0xFF: /*HLT*/ this.running=false; return false;

      case 0x10: /*MOV*/ {
        const mode = this._fetch();
        const dstK = (mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const val = this._readOperand(srcK, true);
        this._writeOperand(dstK, dst, val);
        this._setZF(val); this._setSF(val);
        break;
      }
      case 0x11: /*ADD r/s*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const b = this._readOperand(srcK, true);
        const res = (a + b) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x12: /*SUB*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const b = this._readOperand(srcK, true);
        const res = (a - b) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x13: /*INC dst*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const res = (a + 1) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x14: /*DEC dst*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const res = (a - 1) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x15: /*CMP a,b -> flags*/ {
        const mode = this._fetch();
        const a = this._readOperand((mode>>0)&3, true);
        const b = this._readOperand((mode>>2)&3, true);
        const res = (a - b) & 0xFF;
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x20: /*JMP imm16*/ { const addr = this._fetch16(); this.reg.EIP = addr; break; }
      case 0x21: /*JZ imm16*/ { const addr = this._fetch16(); if (this.flags.ZF) this.reg.EIP = addr; break; }
      case 0x22: /*JNZ imm16*/ { const addr = this._fetch16(); if (!this.flags.ZF) this.reg.EIP = addr; break; }

      case 0x30: /*PUSH r/imm/mem*/ {
        const mode = this._fetch();
        const val = this._readOperand((mode>>0)&3, true);
        this.reg.ESP = (this.reg.ESP - 1) & 0xFFFF;
        this._wr8(this.reg.ESP, val);
        break;
      }
      case 0x31: /*POP reg*/ {
        const mode = this._fetch();
        const dst = this._readOperand((mode>>0)&3);
        const v = this._rd8(this.reg.ESP);
        this.reg.ESP = (this.reg.ESP + 1) & 0xFFFF;
        this._writeOperand((mode>>0)&3, dst, v);
        break;
      }
      case 0x32: /*CALL imm16*/ {
        const addr = this._fetch16();
        // push return addr (EIP low byte nur, da wir 8-bit Daten rechnen)
        const ret = this.reg.EIP & 0xFF;
        this.reg.ESP = (this.reg.ESP - 1) & 0xFFFF;
        this._wr8(this.reg.ESP, ret);
        this.reg.EIP = addr;
        break;
      }
      case 0x33: /*RET*/ {
        const lo = this._rd8(this.reg.ESP);
        this.reg.ESP = (this.reg.ESP + 1) & 0xFFFF;
        this.reg.EIP = lo | 0;
        break;
      }

      case 0x40: /*AND*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const b = this._readOperand(srcK, true);
        const res = (a & b) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x41: /*OR*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const b = this._readOperand(srcK, true);
        const res = (a | b) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x42: /*XOR*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const b = this._readOperand(srcK, true);
        const res = (a ^ b) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x43: /*NOT dst*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const res = (~a) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x44: /*SHL dst, imm*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const c = this._fetch() & 7;
        const res = (a << c) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x45: /*SHR dst, imm*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const a = this._readOperandValue(dstK, dst);
        const c = this._fetch() & 7;
        const res = (a >>> c) & 0xFF;
        this._writeOperand(dstK, dst, res);
        this._setZF(res); this._setSF(res);
        break;
      }
      case 0x50: /*RND dst*/ {
        const mode = this._fetch();
        const dstK=(mode>>0)&3;
        const dst = this._readOperand(dstK);
        const val = Math.floor(Math.random()*256) & 0xFF;
        this._writeOperand(dstK, dst, val);
        this._setZF(val); this._setSF(val);
        break;
      }

      default:
        this.running=false; return false;
    }
    this.cycles++;
    return true;
  }

  // Operand I/O
  // kind: 0=reg,1=imm8,2=mem
  _readOperand(kind, immediateValue=false){
    switch(kind){
      case 0: { // reg id
        const id = this._fetch();
        return id; // returns reg index
      }
      case 1: { // imm8
        const v = this._fetch();
        return immediateValue ? v : v; // if used as dst -> not supported (ignored)
      }
      case 2: { // mem reference spec
        // mode: 0=[addr16], 1=[reg], 2=[reg+imm8]
        const m = this._fetch();
        if (m===0){ const addr = this._fetch16(); return {mode:0, addr}; }
        if (m===1){ const reg = this._fetch(); return {mode:1, reg}; }
        if (m===2){ const reg = this._fetch(); const off=this._fetch(); return {mode:2, reg, off}; }
        return {mode:0, addr:0};
      }
      default: return 0;
    }
  }
  _addrFromMemSpec(spec){
    if (spec.mode===0) return spec.addr & 0xFFFF;
    if (spec.mode===1){
      const r = this._getRegByIndex(spec.reg);
      return (r & 0xFFFF);
    }
    if (spec.mode===2){
      const r = this._getRegByIndex(spec.reg);
      return (r + (spec.off|0)) & 0xFFFF;
    }
    return 0;
  }
  _readOperandValue(kind, token){
    if (kind===0){ return this._getRegByIndex(token); }
    if (kind===1){ return token & 0xFF; }
    if (kind===2){ const addr=this._addrFromMemSpec(token); return this._rd8(addr); }
    return 0;
  }
  _writeOperand(kind, token, val){
    if (kind===0){ this._setRegByIndex(token, val & 0xFF); return; }
    if (kind===2){ const addr=this._addrFromMemSpec(token); this._wr8(addr, val); return; }
    // imm as dst not supported
  }
  _getRegByIndex(idx){
    switch(idx&7){
      case 0: return this.reg.EAX; case 1: return this.reg.EBX; case 2: return this.reg.ECX; case 3: return this.reg.EDX;
      case 4: return this.reg.ESI; case 5: return this.reg.EDI; case 6: return this.reg.EBP; default: return this.reg.ESP;
    }
  }
  _setRegByIndex(idx, val){
    switch(idx&7){
      case 0: this.reg.EAX=val&0xFF; break; case 1: this.reg.EBX=val&0xFF; break;
      case 2: this.reg.ECX=val&0xFF; break; case 3: this.reg.EDX=val&0xFF; break;
      case 4: this.reg.ESI=val&0xFF; break; case 5: this.reg.EDI=val&0xFF; break;
      case 6: this.reg.EBP=val&0xFF; break; default: this.reg.ESP=val&0xFFFF; break;
    }
  }
}
