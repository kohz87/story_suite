/* NPC State Delta dossier surface: portrait image references: the key table, the image source attribute and the signature mark. */
import { escapeHtml } from '../../util/html.js';
import { plain } from '../dossier-ui-model.js';

// (perf) A data-URL picture reaches the panel by reference: the markup carries a short key (data-delta-portrait="3") and the
// controller sets the image's src property once the element is in the page, so the picture is never escaped into HTML, parsed
// back out of it, or copied into a render signature. A file path or plain URL stays in the markup as before. Presentation
// only: the stored record is never touched. A key lives while some dossier in the view shows its picture.
export function createPortraitRefs() {
    const keys = new Map();
    const sources = new Map();
    let next = 0;
    return {
        /** The key for a data URL (made the first time it is shown), or '' for anything else. */
        key(value) {
            const src = String(value ?? '');
            if (!src.startsWith('data:')) return '';
            let key = keys.get(src);
            if (!key) { next += 1; key = String(next); keys.set(src, key); sources.set(key, src); }
            return key;
        },
        src: key => sources.get(String(key)) || '',
        /** Forgets every picture not in `keep` (a Set of the sources the view still shows). */
        release(keep = new Set()) {
            for (const [src, key] of [...keys]) if (!keep.has(src)) { keys.delete(src); sources.delete(key); }
        },
        get size() { return keys.size; },
        /** Sets the src of every keyed image under `container` that has none yet. */
        fill(container) {
            for (const img of container?.querySelectorAll?.('img[data-delta-portrait]') || []) {
                if (img.hasAttribute?.('src')) continue;
                const src = sources.get(String(img.dataset?.deltaPortrait ?? ''));
                if (src) img.src = src;
            }
        },
    };
}

// The image's source attribute: the key for a data URL when `refs` is given, the escaped URL otherwise.
function imageSourceAttribute(src, refs = null) {
    const key = refs ? refs.key(src) : '';
    return key ? `data-delta-portrait="${key}"` : `src="${escapeHtml(src)}"`;
}

// What a render signature records for a picture: its key, or the URL itself.
function portraitMark(src, refs) {
    const key = refs.key(src);
    return key ? `ref:${key}` : plain(src);
}

export { imageSourceAttribute, portraitMark };
