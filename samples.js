
const DemoCodes = {
  hello: `; schreibt 'HI' in den RAM bei 0x10/0x11
LOADA 72   ; 'H'
STORE 16
LOADA 73   ; 'I'
STORE 17
HLT`,
  worm: `; sehr einfacher, ungefährlicher "Wurm"
; wählt zufällige Startzelle, schreibt 'H','I' in Nachbarzellen und springt zurück
RANDOM
STORE 32    ; zufälliger Wert als "Marker"
LOADA 72
STORE 33
LOADA 73
STORE 34
JMP 0`
};
