
function toHex(n,w=2){ return n.toString(16).padStart(w,'0'); }

function disassemble(mem, start=0, end=mem.length){
  const out = [];
  let pc = start;
  function rd(){ return mem[pc++]; }
  function rd16(){ const lo=rd(), hi=rd(); return (hi<<8)|lo; }

  while(pc < end){
    const at = pc;
    const op = rd();
    let text='', bytes=[op];
    function readOp2(mn){
      const mode=rd(); bytes.push(mode);
      const dstK=(mode>>0)&3, srcK=(mode>>2)&3;
      const [dstTxt, dstBytes]=readOperand(dstK); bytes.push(...dstBytes);
      const [srcTxt, srcBytes]=readOperand(srcK); bytes.push(...srcBytes);
      text = mn + ' ' + dstTxt + ', ' + srcTxt;
    }
    function readOp1(mn){
      const mode=rd(); bytes.push(mode);
      const [dstTxt, dstBytes]=readOperand((mode>>0)&3); bytes.push(...dstBytes);
      text = mn + ' ' + dstTxt;
      if (mn==='SHL' || mn==='SHR'){ const c=rd(); bytes.push(c); text += ', '+c; }
    }
    function readOperand(kind){
      if (kind===0){ const r=rd(); return [regName(r), [r]]; }
      if (kind===1){ const v=rd(); return ['#'+v, [v]]; }
      if (kind===2){
        const mode=rd(); let s=''; const bs=[mode];
        if (mode===0){ const a=rd16(); bs.push(a&0xFF, (a>>8)&0xFF); s='['+toHex(a,4)+']'; }
        else if (mode===1){ const r=rd(); bs.push(r); s='['+regName(r)+']'; }
        else { const r=rd(), off=rd(); bs.push(r,off); s='['+regName(r)+'+'+off+']'; }
        return [s, bs];
      }
      return ['#0',[0]];
    }
    function regName(i){ return ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP'][i&7]; }

    switch(op){
      case 0xFF: text='HLT'; break;
      case 0x10: readOp2('MOV'); break;
      case 0x11: readOp2('ADD'); break;
      case 0x12: readOp2('SUB'); break;
      case 0x13: readOp1('INC'); break;
      case 0x14: readOp1('DEC'); break;
      case 0x15: readOp2('CMP'); break;
      case 0x20: { const a=rd16(); bytes.push(a&0xFF,(a>>8)&0xFF); text='JMP '+toHex(a,4); } break;
      case 0x21: { const a=rd16(); bytes.push(a&0xFF,(a>>8)&0xFF); text='JZ '+toHex(a,4); } break;
      case 0x22: { const a=rd16(); bytes.push(a&0xFF,(a>>8)&0xFF); text='JNZ '+toHex(a,4); } break;
      case 0x30: readOp1('PUSH'); break;
      case 0x31: readOp1('POP'); break;
      case 0x32: { const a=rd16(); bytes.push(a&0xFF,(a>>8)&0xFF); text='CALL '+toHex(a,4); } break;
      case 0x33: text='RET'; break;
      case 0x40: readOp2('AND'); break;
      case 0x41: readOp2('OR'); break;
      case 0x42: readOp2('XOR'); break;
      case 0x43: readOp1('NOT'); break;
      case 0x44: readOp1('SHL'); break;
      case 0x45: readOp1('SHR'); break;
      case 0x50: readOp1('RND'); break;
      default: text = 'DB 0x'+toHex(op); break;
    }
    out.push({addr: at, bytes, text});
    if (op===0xFF) break;
  }
  return out;
}
