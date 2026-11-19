// Places an open dossier in desktop layout A's page column (ui/css/desk.css): under the tab strip, over the tab, with the card column left in view (SHB3; mock sheets-desktop.html, frame dossier).

const WIDE = 1000;   // the dossier's content width (px) from which Mood | Right now sit side by side (ui/css/dossier.css .dwide)

const deskOn = (view, el) => {
  try { return String(view.getComputedStyle(el).getPropertyValue('--su-desk')).trim() === '1'; } catch { return false; }
};

/**
 * Watches the dossier `root` once it is in the suite. While the desktop layout is drawn it gets the class `ddesk` and the
 * page column's left, top (just under the tab strip) and width; it keeps `bottom: 0` from dossier.css. It gets `dwide` while
 * its content is 1,000 px wide or more (measured, not the window). A click on the tab strip calls `onStrip()` first, so
 * the dossier closes before the tab opens. Under the desktop width nothing is set. Returns `stop()`.
 */
export function placeOnDesk(root, { onStrip = null } = {}) {
  const view = root?.ownerDocument?.defaultView ?? null;
  const Observer = view?.ResizeObserver ?? null;
  if (!Observer) return () => {};
  const wired = { page: null, strip: null, scroll: null };
  const stripClick = () => { if (root.classList.contains('ddesk')) onStrip?.(); };

  function clear() {
    root.classList.remove('ddesk');
    for (const side of ['left', 'top', 'width']) root.style.removeProperty(side);
  }

  function wire(page, strip, scroll) {
    if (wired.page === page) return;
    unwire();
    Object.assign(wired, { page, strip, scroll });
    observer.observe(page);
    if (strip) { observer.observe(strip); strip.addEventListener('click', stripClick, true); }
    scroll?.addEventListener('scroll', place, { passive: true });
  }

  function unwire() {
    if (wired.page) observer.unobserve(wired.page);
    if (wired.strip) { observer.unobserve(wired.strip); wired.strip.removeEventListener('click', stripClick, true); }
    wired.scroll?.removeEventListener('scroll', place);
    Object.assign(wired, { page: null, strip: null, scroll: null });
  }

  function place() {
    if (!root.isConnected) return;
    const desk = root.parentNode?.querySelector?.('.su-desk');
    const page = desk?.querySelector('.su-page');
    const frame = root.offsetParent;
    if (!page || !frame || !deskOn(view, desk)) { clear(); return; }
    wire(page, page.querySelector('.su-strip'), desk.parentNode);
    // (Settings › Look › Text size zooms the suite: a measured box is on screen, a length set here is zoomed, so it is divided back)
    const F = frame.getBoundingClientRect();
    const zoom = frame.offsetWidth ? F.width / frame.offsetWidth : 1;
    const P = page.getBoundingClientRect();
    const strip = wired.strip?.getBoundingClientRect();
    const gap = parseFloat(view.getComputedStyle(page).rowGap) || 0;
    const top = strip ? strip.bottom + gap * zoom : P.top;
    root.classList.add('ddesk');
    root.style.left = `${(P.left - F.left) / zoom - frame.clientLeft}px`;
    root.style.top = `${(top - F.top) / zoom - frame.clientTop}px`;
    root.style.width = `${P.width / zoom}px`;
  }

  function measure() {
    const scroll = root.querySelector('.dscroll');
    if (!scroll) return;
    const style = view.getComputedStyle(scroll);
    const inner = scroll.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    root.classList.toggle('dwide', inner >= WIDE);
  }

  const observer = new Observer(() => { place(); measure(); });
  observer.observe(root);
  const scroll = root.querySelector('.dscroll');
  if (scroll) observer.observe(scroll);
  return () => { unwire(); observer.disconnect(); };
}
