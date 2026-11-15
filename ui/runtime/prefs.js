// Stores fold state per device and spoiler levels per chat through the port.

const STORAGE_KEY = 'storySuite.ui.fold';
const SPOILER_LEVELS = new Set(['scene', 'plan']);

function readStorageFolds(storage) {
  if (!storage || typeof storage.getItem !== 'function') return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorageFolds(storage, folds) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(folds));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

function normalizeSpoilers(raw) {
  return {
    scene: Boolean(raw?.scene),
    plan: Boolean(raw?.plan),
  };
}

/** Creates a preference store for per-device folds and per-chat spoilers. */
export function createPrefs({
  port = null,
  storage = null,
  chatId = 'default',
  initialFolds = null,
  initialSpoilers = null,
} = {}) {
  const deviceFolds = new Map();
  const chatSpoilers = new Map();
  const listeners = new Set();

  let activeChatId = String(chatId || 'default');

  const stored = readStorageFolds(storage);
  for (const [key, val] of Object.entries(stored)) {
    deviceFolds.set(key, Boolean(val));
  }
  if (initialFolds && typeof initialFolds === 'object') {
    for (const [key, val] of Object.entries(initialFolds)) {
      deviceFolds.set(key, Boolean(val));
    }
  }
  if (port?.prefs?.getDevice) {
    const fromPort = port.prefs.getDevice();
    if (fromPort && typeof fromPort === 'object') {
      for (const [key, val] of Object.entries(fromPort)) {
        deviceFolds.set(key, Boolean(val));
      }
    }
  }

  function loadChatSpoilers(id) {
    if (chatSpoilers.has(id)) return chatSpoilers.get(id);
    const fromPort = port?.prefs?.getChat?.(id);
    const state = normalizeSpoilers(fromPort);
    chatSpoilers.set(id, state);
    return state;
  }

  if (initialSpoilers && typeof initialSpoilers === 'object') {
    chatSpoilers.set(activeChatId, normalizeSpoilers(initialSpoilers));
  } else {
    loadChatSpoilers(activeChatId);
  }

  function notify(change) {
    for (const fn of listeners) fn(change);
  }

  function getFold(key, fallback = false) {
    if (deviceFolds.has(key)) return deviceFolds.get(key);
    return Boolean(fallback);
  }

  function setFold(key, folded) {
    if (!key || typeof key !== 'string') {
      throw new TypeError('Fold key must be a non-empty string');
    }
    const next = Boolean(folded);
    deviceFolds.set(key, next);
    writeStorageFolds(storage, Object.fromEntries(deviceFolds));
    port?.prefs?.setDevice?.(key, next);
    notify({ kind: 'fold', key, value: next });
    return next;
  }

  function toggleFold(key, fallback = false) {
    return setFold(key, !getFold(key, fallback));
  }

  function getSpoilers(id = activeChatId) {
    const state = loadChatSpoilers(String(id || 'default'));
    return { scene: state.scene, plan: state.plan };
  }

  function getSpoiler(level, id = activeChatId) {
    if (!SPOILER_LEVELS.has(level)) {
      throw new TypeError(`Unknown spoiler level: ${String(level)}`);
    }
    return getSpoilers(id)[level];
  }

  function setSpoiler(level, shown, id = activeChatId) {
    if (!SPOILER_LEVELS.has(level)) {
      throw new TypeError(`Unknown spoiler level: ${String(level)}`);
    }
    const targetId = String(id || 'default');
    const state = loadChatSpoilers(targetId);
    const next = Boolean(shown);
    state[level] = next;
    if (port?.prefs?.setChat) {
      port.prefs.setChat(targetId, level, next);
    } else if (typeof port?.command === 'function') {
      Promise.resolve(port.command('prefs.spoiler.set', {
        chatId: targetId,
        level,
        value: next,
      })).catch(() => {});
    }
    notify({ kind: 'spoiler', chatId: targetId, level, value: next });
    return next;
  }

  function toggleSpoiler(level, id = activeChatId) {
    return setSpoiler(level, !getSpoiler(level, id), id);
  }

  function setChat(nextChatId) {
    const resolved = String(nextChatId || 'default');
    activeChatId = resolved;
    const state = loadChatSpoilers(resolved);
    notify({ kind: 'chat', chatId: resolved, spoilers: { ...state } });
    return { ...state };
  }

  function getChat() {
    return activeChatId;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onChange listener must be a function');
    }
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    getFold,
    setFold,
    toggleFold,
    getSpoiler,
    getSpoilers,
    setSpoiler,
    toggleSpoiler,
    setChat,
    getChat,
    onChange,
  };
}
