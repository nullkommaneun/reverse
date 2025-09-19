const DemoCodes = {
  hello: `; schreibt 'HI' ins Memory
LOADA 72
STORE 16
LOADA 73
STORE 17
HLT`,

  worm: `; primitiver Wurm, setzt zufällige Speicherzellen
RANDOM
STORE 32
LOADA 72
STORE 33
LOADA 73
STORE 34
JMP 0`
};