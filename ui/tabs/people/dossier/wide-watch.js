// Marks an open dossier `dwide` while its content is wide enough for Mood and Right now to sit side by side (ui/css/dossier.css).

const WIDE = 1000;   // the dossier's content width (px) from which Mood | Right now sit side by side

/** Watches the dossier `root`: it gets the class `dwide` while its content is 1,000 px wide or more (measured, not the window). Returns `stop()`. */
export function watchWide(root) {
  const view = root?.ownerDocument?.defaultView ?? null;
  const Observer = view?.ResizeObserver ?? null;
  if (!Observer) return () => {};
  const measure = () => {
    const scroll = root.querySelector('.dscroll');
    if (!scroll) return;
    const style = view.getComputedStyle(scroll);
    const inner = scroll.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    root.classList.toggle('dwide', inner >= WIDE);
  };
  const observer = new Observer(measure);
  observer.observe(root);
  const scroll = root.querySelector('.dscroll');
  if (scroll) observer.observe(scroll);
  return () => observer.disconnect();
}
