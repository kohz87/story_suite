// The Studio's zip writer (pure, browser and node): every file stored, UTF-8 names, no folder entries, a fixed 1980-01-01 time stamp.
//
// writeStoredZip([{ name, bytes }]) → the zip as a Uint8Array, the files in the order given. It gives the same bytes as the writer in
// scripts/core/build-example-zip.mjs (a test checks it against tests/fixtures/packs/ersveil-3/ersveil.zip), so a pack the Studio exports is laid out
// as packs/bundle.js readPackZip reads it.

import { crc32 } from '../packs/zip.js';

const DOS_DATE = (1 << 5) | 1; // 1980-01-01, time 00:00:00
const UTF8 = 0x0800;

function localHeader(label, crc, size) {
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 10, true);
    head.setUint16(6, UTF8, true);
    head.setUint16(12, DOS_DATE, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, size, true);
    head.setUint32(22, size, true);
    head.setUint16(26, label.length, true);
    return new Uint8Array(head.buffer);
}

function centralEntry(label, crc, size, offset) {
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 10, true);
    entry.setUint16(8, UTF8, true);
    entry.setUint16(14, DOS_DATE, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, label.length, true);
    entry.setUint32(42, offset, true);
    return new Uint8Array(entry.buffer);
}

/** `files`: `[{ name, bytes }]` → the zip as a Uint8Array (stored, fixed time stamp, listed in the order given). */
export function writeStoredZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const { name, bytes } of files) {
        const label = encoder.encode(name);
        const crc = crc32(bytes);
        central.push(centralEntry(label, crc, bytes.length, offset), label);
        parts.push(localHeader(label, crc, bytes.length), label, bytes);
        offset += 30 + label.length + bytes.length;
    }
    const size = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of all) { out.set(part, at); at += part.length; }
    return out;
}
