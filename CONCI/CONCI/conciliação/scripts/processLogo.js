'use strict';

/**
 * One-shot: converte o fundo preto do logo.png original em fundo branco,
 * preservando o círculo verde e o monograma preto internos.
 *
 * Usa flood fill (BFS) a partir dos quatro cantos, marcando como "fundo"
 * apenas os pixels escuros CONECTADOS à borda da imagem — o monograma preto
 * dentro do círculo não é alcançado porque está isolado pelo verde, então
 * permanece intacto.
 *
 * Uso: node scripts/processLogo.js <origem.png> <destino1.png> [destino2.png ...]
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const DARK_THRESHOLD = 60; // soma R+G+B abaixo disso é considerado "fundo preto"

function isDark(data, idx) {
  return data[idx] + data[idx + 1] + data[idx + 2] < DARK_THRESHOLD;
}

function floodFillBackgroundToWhite(png) {
  const { width, height, data } = png;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function tryEnqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    const idx = pos * 4;
    if (!isDark(data, idx)) return;
    visited[pos] = 1;
    queue.push(pos);
  }

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head];
    head += 1;
    const x = pos % width;
    const y = (pos - x) / width;
    const idx = pos * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;

    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  return png;
}

function main() {
  const [, , srcArg, ...destArgs] = process.argv;
  if (!srcArg || destArgs.length === 0) {
    console.error('Uso: node scripts/processLogo.js <origem.png> <destino1.png> [destino2.png ...]');
    process.exit(1);
  }

  const src = path.resolve(srcArg);
  const buffer = fs.readFileSync(src);
  const png = PNG.sync.read(buffer);
  floodFillBackgroundToWhite(png);
  const out = PNG.sync.write(png);

  destArgs.forEach((destArg) => {
    const dest = path.resolve(destArg);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, out);
    console.log('Gerado:', dest);
  });
}

main();
