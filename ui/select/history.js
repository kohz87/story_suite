// Builds the Tools page's Story history card from the handle's `history()` answer (core/store/sealed-base.js, core/turn/seal-idle.js): how far
// back this chat keeps its replies step by step, and the switch that tidies older ones.
import { HISTORY_STRINGS as H } from '../../core/strings/history.js';
import { fill } from '../../core/strings.js';

/**
 * `answer`: { on (host setting sealHistory), status ('none' | 'ok' | 'drift' | 'branch' | 'missing'), sealed (replies), from (the first message
 * kept step by step), window, step } or null (no chat). → { title, text, on, button } or null.
 */
export function selectHistory(answer) {
  if (!answer) return null;
  const { on, status, sealed, from, window, step } = answer;
  const text = status === 'branch' || status === 'missing' ? H.toolsReadOnly
    : sealed > 0 ? fill(H.toolsSealed, { window, from })
      : on ? fill(H.toolsAll, { window, limit: window + step }) : H.toolsOff;
  return { title: H.toolsTitle, text, on: on === true, button: on ? 'Turn off' : 'Turn on' };
}
