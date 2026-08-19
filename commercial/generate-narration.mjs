#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOICE = 'pt-BR-AntonioNeural';
const EDGE = process.env.HOME + '/.local/bin/edge-tts';

const script = `Quantas vezes você precisa parar tudo, só pra organizar sua agenda?
Mensagens, horários, remarcações...
Chega.
Com o ONEFIND, sua agenda fica organizada, seus atendimentos sob controle, e seu financeiro em um só lugar.
Menos tempo organizando.
Mais tempo atendendo.
ONEFIND.
Comece agora.`;

const raw = path.join(__dirname, 'narration-raw.mp3');
const out = path.join(__dirname, 'narration.mp3');

execSync(
  `"${EDGE}" --voice ${VOICE} --rate=-2% --pitch=-1Hz --text ${JSON.stringify(script)} --write-media "${raw}"`,
  { stdio: 'inherit' }
);

// Ajuste fino para ~27s (vídeo 28s)
const dur = parseFloat(
  execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${raw}"`).toString()
);
const target = 27.2;
const tempo = Math.min(1.45, Math.max(1.0, dur / target));
execSync(
  `ffmpeg -y -i "${raw}" -filter:a "atempo=${tempo.toFixed(3)},highpass=f=80,afade=t=out:st=${target - 0.4}:d=0.4" -t ${target} "${out}"`,
  { stdio: 'inherit' }
);
console.log(`Narração ${dur.toFixed(1)}s → ${target}s (atempo ${tempo.toFixed(2)})`);
