// Keeping the document still and a window's layer over the visible area while a window is open.

const PHONE = '(max-width: 759.98px)';


/**
 * Holds the document still while a window is open: the scroll position it had is put back if anything moves it, and a scroll
 * that reaches the end of the window's own scrollers does not carry on into the page. → release().
 */
export function holdPage(doc) {
    const root = doc?.scrollingElement ?? doc?.documentElement ?? null;
    if (!root || typeof doc.addEventListener !== 'function') return () => {};
    const top = root.scrollTop || 0;
    const left = root.scrollLeft || 0;
    const style = doc.documentElement?.style ?? null;
    const was = style ? style.overscrollBehavior : '';
    if (style) style.overscrollBehavior = 'none';
    const keep = () => {
        if (root.scrollTop !== top) root.scrollTop = top;
        if (root.scrollLeft !== left) root.scrollLeft = left;
    };
    doc.addEventListener('scroll', keep);
    return () => {
        doc.removeEventListener?.('scroll', keep);
        if (style) style.overscrollBehavior = was ?? '';
    };
}

/**
 * Keeps a full-screen `layer` (position: fixed) over the visible area on a phone: when the visual viewport has been shrunk (the
 * on-screen keyboard) or panned (the browser brings a focused box into view), the layer takes its top and height, so the window's
 * header never leaves the screen. Wide screens are left alone. → stop().
 */
export function followViewport(doc, layer) {
    const view = doc?.defaultView;
    const vv = view?.visualViewport;
    if (!vv || typeof vv.addEventListener !== 'function' || !layer?.style) return () => {};
    const phone = () => view.matchMedia?.(PHONE)?.matches !== false;
    const clear = () => { layer.style.top = ''; layer.style.height = ''; };
    const apply = () => {
        if (!phone()) { clear(); return; }
        const top = Number(vv.offsetTop) || 0;
        const height = Number(vv.height) || 0;
        if (height > 0 && (top > 0.5 || Math.abs(height - (view.innerHeight || height)) > 1)) {
            layer.style.top = `${Math.round(top)}px`;
            layer.style.height = `${Math.round(height)}px`;
        } else clear();
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
    return () => {
        vv.removeEventListener?.('resize', apply);
        vv.removeEventListener?.('scroll', apply);
        clear();
    };
}
