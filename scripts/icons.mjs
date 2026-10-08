// Writes extension/icons/{16,48,128}.png: a white padlock on a blue rounded square.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE = [37, 99, 235];
const WHITE = [255, 255, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// Coverage of one pixel (0..1) by shape(x, y) in unit coordinates, 4x4 supersampled.
function cover(shape, px, py, size) {
  let hit = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) hit += shape((px + (i + 0.5) / 4) / size, (py + (j + 0.5) / 4) / size);
  return hit / 16;
}
const roundRect = (x, y, x0, y0, x1, y1, r) => {
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && dx * dx + dy * dy <= r * r;
};
const tile = (x, y) => roundRect(x, y, 0, 0, 1, 1, 0.2);
const shackle = (x, y) => {
  const d = Math.hypot(x - 0.5, y - 0.42);
  return (y <= 0.42 && d >= 0.13 && d <= 0.21) || (y > 0.42 && y < 0.5 && Math.abs(Math.abs(x - 0.5) - 0.17) <= 0.04);
};
const lock = (x, y) => roundRect(x, y, 0.25, 0.46, 0.75, 0.82, 0.06) || shackle(x, y);

function png(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const a = cover(tile, x, y, size);
      const w = cover(lock, x, y, size);
      row.push(...BLUE.map((b, i) => Math.round(b + (WHITE[i] - b) * w)), Math.round(a * 255));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 48, 128]) writeFileSync(new URL(`../extension/icons/${size}.png`, import.meta.url), png(size));
