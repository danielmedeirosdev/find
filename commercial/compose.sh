#!/usr/bin/env bash
# Mixagem final: vídeo + trilha + SFX
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ART="/opt/cursor/artifacts"
mkdir -p "$ART" "$DIR/out"

VISUAL="$DIR/video-visual.webm"
OUT="$ART/onefind-commercial-v2.mp4"

# Converter visual para mp4 30fps
ffmpeg -y -i "$VISUAL" -r 30 -t 28 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow \
  "$DIR/out/visual.mp4" 2>/dev/null

# Trilha premium minimal (synth ambient + pulse sutil)
ffmpeg -y \
  -f lavfi -i "sine=frequency=55:duration=28" \
  -f lavfi -i "sine=frequency=110:duration=28" \
  -f lavfi -i "sine=frequency=220:duration=28" \
  -filter_complex "
    [0]volume=0.08,afade=t=in:st=0:d=2,afade=t=out:st=25:d=3[a0];
    [1]volume=0.04,afade=t=in:st=2:d=3,afade=t=out:st=24:d=3[a1];
    [2]volume=0.015,tremolo=f=0.25:d=0.3,afade=t=in:st=5:d=4,afade=t=out:st=23:d=4[a2];
    [a0][a1][a2]amix=inputs=3:duration=longest,volume=0.9,lowpass=f=800[music]
  " -map "[music]" -q:a 4 "$DIR/out/music.mp3" 2>/dev/null

# SFX: notificações (0-3.8s), impacto (4s), confirm (17.2s), final (24s)
ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.08" -af "volume=0.12,afade=t=out:st=0.04:d=0.04" "$DIR/out/ping1.wav" 2>/dev/null
ffmpeg -y -f lavfi -i "sine=frequency=660:duration=0.08" -af "volume=0.1,afade=t=out:st=0.04:d=0.04" "$DIR/out/ping2.wav" 2>/dev/null
ffmpeg -y -f lavfi -i "sine=frequency=90:duration=0.35" -af "volume=0.35,afade=t=out:st=0.15:d=0.2" "$DIR/out/impact.wav" 2>/dev/null
ffmpeg -y -f lavfi -i "sine=frequency=520:duration=0.12" -af "volume=0.08" "$DIR/out/confirm.wav" 2>/dev/null
ffmpeg -y -f lavfi -i "sine=frequency=130:duration=0.5" -af "volume=0.2,afade=t=out:st=0.25:d=0.25" "$DIR/out/final.wav" 2>/dev/null

# Montar faixa SFX com delays
ffmpeg -y \
  -i "$DIR/out/ping1.wav" -i "$DIR/out/ping2.wav" -i "$DIR/out/ping1.wav" \
  -i "$DIR/out/ping2.wav" -i "$DIR/out/ping1.wav" \
  -i "$DIR/out/impact.wav" -i "$DIR/out/confirm.wav" -i "$DIR/out/final.wav" \
  -filter_complex "
    [0]adelay=800|800,volume=0.9[a];
    [1]adelay=1400|1400,volume=0.85[b];
    [2]adelay=2100|2100,volume=0.8[c];
    [3]adelay=2800|2800,volume=0.75[d];
    [4]adelay=3400|3400,volume=0.7[e];
    [5]adelay=4000|4000,volume=1[f];
    [6]adelay=17200|17200,volume=0.85[g];
    [7]adelay=24000|24000,volume=1[h];
    [a][b][c][d][e][f][g][h]amix=inputs=8:duration=longest:dropout_transition=0[sfx]
  " -map "[sfx]" "$DIR/out/sfx.wav" 2>/dev/null

# Mix master audio: música + sfx
ffmpeg -y \
  -i "$DIR/out/music.mp3" -i "$DIR/out/sfx.wav" \
  -filter_complex "
    [0]volume=0.62[m];
    [1]volume=0.8[s];
    [m][s]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.18,apad=pad_dur=28,alimiter=limit=0.95[aout]
  " -map "[aout]" -t 28 -q:a 3 "$DIR/out/master-audio.mp3"

# Vídeo final
ffmpeg -y -i "$DIR/out/visual.mp4" -i "$DIR/out/master-audio.mp3" \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k -shortest \
  -movflags +faststart \
  "$OUT"

echo "✓ Exportado: $OUT"
ffprobe -v quiet -print_format json -show_format -show_streams "$OUT" | head -40
