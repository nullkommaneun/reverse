const DemoCodes = {
  hello: `MOV EAX, #72
MOV [0x0010], EAX
MOV EAX, #73
MOV [0x0011], EAX
HLT
`,

  worm: `MOV ESI, #0x20
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
MOV EAX, #0
MOV EBX, #1
MOV ECX, #10
MOV ESI, #0x30
loop:
MOV [ESI], EAX
INC ESI
MOV EDX, EAX
ADD EDX, EBX
MOV EAX, EBX
MOV EBX, EDX
DEC ECX
JNZ loop
HLT
`
};
