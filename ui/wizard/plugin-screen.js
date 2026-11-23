// Draws a screen a plug-in module declares (its template names one of the module's widgets) in the shared bottom sheet, titled by the screen.
import { openSheet } from '../kit/sheet.js';

/**
 * `createPluginScreens({ screens, sdk, sheetCtx })`: `screens.find(id)` is core/boot/screen-source.js's. → `{ open(id, payload, { onEnd }) → true, or false when no module declares it, close(), isOpen() }`.
 * The widget gets `render(el, props, api)` with api = { command, query, preview, commit, on, close }; closing the sheet runs the cleanup the widget returned.
 */
export function createPluginScreens({ screens, sdk, sheetCtx = () => ({}) }) {
  let current = null;
  function open(id, payload, { onEnd = null } = {}) {
    const found = screens?.find?.(id);
    if (!found) return false;
    current?.close();
    let cleanup = null;
    let ended = false;
    const sheet = openSheet(sheetCtx() ?? {}, { title: found.title, id: 'plugin-screen', onClose: () => {
      if (ended) return;
      ended = true;
      try { if (typeof cleanup === 'function') cleanup(); } catch (error) { console.warn('[Story Suite] a plug-in screen did not clean up', error); }
      if (current === handle) current = null;
      onEnd?.();
    } });
    const handle = { close: () => sheet.close() };
    current = handle;
    const api = {
      command: (type, args, options) => sdk.command(type, args, { ...options, cause: 'ui' }),
      query: (name, args) => sdk.query(name, args),
      preview: (type, args) => sdk.preview(type, args),
      commit: token => sdk.commit(token),
      on: (event, fn) => sdk.on(event, fn),
      close: handle.close,
    };
    try { cleanup = found.widget.render(sheet.body, { ...found.widget.props, ...(payload && typeof payload === 'object' ? payload : {}) }, api); } catch (error) { console.warn('[Story Suite] a plug-in screen could not be drawn', error); sheet.close(); return false; }
    return true;
  }
  return { open, close: () => current?.close(), isOpen: () => current !== null };
}
