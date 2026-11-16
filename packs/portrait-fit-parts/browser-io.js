// The job: the browser's picture decoder and encoder (createImageBitmap and a canvas) as the `io` fitPortrait is given.

import { FitProblem } from './fit.js';

/** The browser's decoder and encoder: `win` is the page's window. → `bytes → io` (one picture; `close()` frees the decoded one). */
export function browserImageIo(win = globalThis) {
    return bytes => {
        let bitmap = null;
        const load = async () => {
            if (bitmap) return bitmap;
            if (typeof win.createImageBitmap !== 'function') throw new FitProblem('could not be read: this browser cannot read pictures');
            try { bitmap = await win.createImageBitmap(new win.Blob([bytes])); } catch { throw new FitProblem('could not be read as a picture'); }
            return bitmap;
        };
        const save = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
        return {
            async size() {
                const image = await load();
                return { width: image.width, height: image.height };
            },
            async encode(side, quality) {
                const image = await load();
                const scale = Math.min(1, side / Math.max(image.width, image.height));
                const canvas = win.document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                let blob = await save(canvas, 'image/webp', quality);
                if (!blob || blob.type !== 'image/webp') blob = await save(canvas, 'image/jpeg', quality);
                if (!blob) throw new FitProblem('could not be made smaller: this browser cannot save pictures');
                return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type === 'image/webp' ? 'webp' : 'jpg', width: canvas.width, height: canvas.height };
            },
            close() { bitmap?.close?.(); bitmap = null; },
        };
    };
}
