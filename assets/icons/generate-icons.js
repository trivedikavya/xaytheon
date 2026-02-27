/**
 * Generate minimal valid PNG icons for PWA manifest
 * Uses a bitmap approach to create simple but valid PNG files
 * Run this with: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = __dirname;

function createPNG(width, height, pixelFn) {
    // Create raw pixel data (RGBA)
    const rawData = Buffer.alloc(height * (1 + width * 4)); // +1 for filter byte per row

    for (let y = 0; y < height; y++) {
        const rowOffset = y * (1 + width * 4);
        rawData[rowOffset] = 0; // No filter
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixelFn(x, y, width, height);
            const pixelOffset = rowOffset + 1 + x * 4;
            rawData[pixelOffset] = r;
            rawData[pixelOffset + 1] = g;
            rawData[pixelOffset + 2] = b;
            rawData[pixelOffset + 3] = a;
        }
    }

    // Compress pixel data
    const compressed = zlib.deflateSync(rawData, { level: 9 });

    // Build PNG file
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type (RGBA)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    const ihdrChunk = makeChunk('IHDR', ihdr);

    // IDAT chunk
    const idatChunk = makeChunk('IDAT', compressed);

    // IEND chunk
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);

    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 for PNG chunks
function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Interpolate between two colors
function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
}

// Check if point is inside the X shape
function isInX(nx, ny) {
    // Normalized coordinates (0-1)
    // X shape consists of two diagonal bars crossing
    const cx = 0.5, cy = 0.5;
    const thickness = 0.08;

    // Bar 1: top-left to bottom-right
    const d1 = Math.abs((nx - cx) - (ny - cy)) / Math.sqrt(2);
    // Bar 2: top-right to bottom-left
    const d2 = Math.abs((nx - cx) + (ny - cy)) / Math.sqrt(2);

    const inBar1 = d1 < thickness && nx > 0.22 && nx < 0.78 && ny > 0.22 && ny < 0.78;
    const inBar2 = d2 < thickness && nx > 0.22 && nx < 0.78 && ny > 0.22 && ny < 0.78;

    return inBar1 || inBar2;
}

// Anti-aliased X check (returns 0-1 coverage)
function xCoverage(nx, ny, pixelSize) {
    const samples = 4;
    let coverage = 0;
    for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
            const snx = nx + (sx / samples - 0.5) * pixelSize;
            const sny = ny + (sy / samples - 0.5) * pixelSize;
            if (isInX(snx, sny)) coverage++;
        }
    }
    return coverage / (samples * samples);
}

function iconPixelFn(x, y, w, h) {
    const nx = x / w;
    const ny = y / h;
    const cx = 0.5, cy = 0.5;
    const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);
    const pixelSize = 1 / w;

    // Background gradient (#0a0a1a -> #0a0a0f)
    const t = (nx + ny) / 2;
    let r = lerp(10, 10, t);
    let g = lerp(10, 10, t);
    let b = lerp(26, 15, t);
    let a = 255;

    // Rounded corners
    const cornerR = 0.18;
    const corners = [
        [cornerR, cornerR],
        [1 - cornerR, cornerR],
        [cornerR, 1 - cornerR],
        [1 - cornerR, 1 - cornerR]
    ];

    for (const [ccx, ccy] of corners) {
        const inCornerRegion = (
            (ccx < 0.5 ? nx < ccx : nx > ccx) &&
            (ccy < 0.5 ? ny < ccy : ny > ccy)
        );
        if (inCornerRegion) {
            const cd = Math.sqrt((nx - ccx) ** 2 + (ny - ccy) ** 2);
            if (cd > cornerR) {
                a = 0;
                r = 0; g = 0; b = 0;
            } else if (cd > cornerR - pixelSize * 2) {
                // Anti-alias corner
                a = Math.round(255 * Math.max(0, (cornerR - cd) / (pixelSize * 2)));
            }
        }
    }

    if (a === 0) return [0, 0, 0, 0];

    // Subtle ring
    const ringR = 0.35;
    const ringW = 0.006;
    const ringDist = Math.abs(dist - ringR);
    if (ringDist < ringW) {
        const ringAlpha = 0.2 * (1 - ringDist / ringW);
        r = lerp(r, 99, ringAlpha);
        g = lerp(g, 102, ringAlpha);
        b = lerp(b, 241, ringAlpha);
    }

    // X shape with gradient
    const coverage = xCoverage(nx, ny, pixelSize);
    if (coverage > 0) {
        const gt = (nx + ny) / 2;
        const xr = lerp(99, 139, gt);   // #6366f1 -> #8b5cf6
        const xg = lerp(102, 92, gt);
        const xb = lerp(241, 246, gt);
        r = lerp(r, xr, coverage);
        g = lerp(g, xg, coverage);
        b = lerp(b, xb, coverage);
    }

    // Accent dots
    const dots = [
        { dx: 0.273, dy: 0.5, dr: 0.012, da: 0.6 },
        { dx: 0.727, dy: 0.5, dr: 0.012, da: 0.6 },
        { dx: 0.5, dy: 0.234, dr: 0.008, da: 0.4 },
        { dx: 0.5, dy: 0.766, dr: 0.008, da: 0.4 },
    ];
    for (const dot of dots) {
        const dd = Math.sqrt((nx - dot.dx) ** 2 + (ny - dot.dy) ** 2);
        if (dd < dot.dr) {
            const dotAlpha = dot.da * (1 - dd / dot.dr);
            r = lerp(r, 129, dotAlpha);  // #818cf8
            g = lerp(g, 140, dotAlpha);
            b = lerp(b, 248, dotAlpha);
        }
    }

    return [r, g, b, a];
}

// Generate all sizes
console.log('Generating PWA icons...');

for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;
    const filepath = path.join(outDir, filename);
    const png = createPNG(size, size, iconPixelFn);
    fs.writeFileSync(filepath, png);
    console.log(`  ✅ ${filename} (${png.length} bytes)`);
}

// Badge icon
const badgePng = createPNG(72, 72, iconPixelFn);
fs.writeFileSync(path.join(outDir, 'badge-72x72.png'), badgePng);
console.log('  ✅ badge-72x72.png');

console.log('\nAll icons generated successfully!');
