
const DemoCodes = {
  hello: `; schreibe 'H' & 'I' nach 0x0010/0x0011
MOV EAX, #72
MOV [0x0010], EAX
MOV EAX, #73
MOV [0x0011], EAX
HLT
`,

  worm: `; harmloser "Wurm": Marker + 'HI' an Basisadresse (ESI) und wieder zum Start
MOV ESI, #0x20
loop:
RND EAX
MOV [ESI], EAX
MOV EAX, #72
MOV [ESI+1], EAX
MOV EAX, #73
MOV [ESI+2], EAX
JMP loop
`,

  fib: `; Fibonacci-Folge ab 0x0030 (10 Werte)
MOV EAX, #0     ; a
MOV EBX, #1     ; b
MOV ECX, #10    ; n
MOV ESI, #0x30  ; Ziel

loop:
MOV [ESI], EAX
INC ESI
; tmp = a + b  -> EDX
MOV EDX, EAX
ADD EDX, EBX
; rotieren: a=b, b=tmp
MOV EAX, EBX
MOV EBX, EDX
DEC ECX
JNZ loop
HLT
`
};
