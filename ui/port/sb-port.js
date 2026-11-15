// Wraps Story Block's sdk as the UI port: views come from injected selectors fed by sdk queries, actions pass through, and nothing throws.

const FAILED = Object.freeze({ ok: false, code: 'FAILED', message: 'The engine could not do that.' });

function failure(error) {
  return { ...FAILED, message: String(error?.message || FAILED.message) };
}

/** Builds `read(name, args)`: an sdk query whose failure or missing answer comes back as null (a gap the UI hides). */
export function makeReader(sdk) {
  return (name, args) => {
    try {
      const answer = sdk?.query?.(name, args);
      return answer === undefined ? null : answer;
    } catch {
      return null;
    }
  };
}

async function guarded(sdk, method, ...args) {
  if (typeof sdk?.[method] !== 'function') return { ...FAILED, message: `The engine has no ${method}.` };
  try {
    return await sdk[method](...args);
  } catch (error) {
    return failure(error);
  }
}

/** Creates the port: `selectors` maps a tab to `(read) → view-model`; `prefs` is `{ device, chat }` stores; `reread(index)` is the sdk's. */
export function createSbPort({ sdk, selectors = {}, prefs = null } = {}) {
  const read = makeReader(sdk);
  const port = {
    view(tab, args) {
      const select = Object.hasOwn(selectors, tab) ? selectors[tab] : null;
      if (typeof select !== 'function') return null;
      try {
        const vm = select(read, args);
        return vm === undefined ? null : vm;
      } catch {
        return null;
      }
    },
    command: (type, payload, options) => guarded(sdk, 'command', type, payload, options),
    preview: (type, payload) => guarded(sdk, 'preview', type, payload),
    commit: token => guarded(sdk, 'commit', token),
    reread: index => guarded(sdk, 'reread', index),
    on(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('port.on listener must be a function');
      const off = sdk?.on?.(event, fn);
      return typeof off === 'function' ? off : () => {};
    },
  };
  if (prefs) {
    const device = prefs.device;
    const chat = prefs.chat;
    port.prefs = {
      getDevice: () => device?.get?.() ?? {},
      setDevice: (key, value) => device?.set?.(key, value),
      getChat: () => chat?.get?.() ?? {},
      setChat: (_chatId, level, value) => chat?.set?.(level, value),
    };
  }
  return port;
}
