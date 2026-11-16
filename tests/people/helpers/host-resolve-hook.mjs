// Module resolve hook for the synthetic host.
// 1. The NPC State sources keep the host imports they were written with ('../../../extensions.js', '../../../../script.js', counted for
//    SillyTavern's extension folder). Run in place in the repo those paths lead nowhere, so the two host modules the harness fakes are
//    answered here; any other host import fails as it always did.
// 2. A file asked for in the fake extension folder (.../third-party/npc_state_delta/<old package name>) that the harness did not copy
//    (the whole src/ tree) is answered with the file the layout rules moved it to.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { oldPath } from './old-path.js';

const STUBS = new Map([['extensions.js', new URL('./host-stubs/extensions.js', import.meta.url).href], ['script.js', new URL('./host-stubs/script.js', import.meta.url).href]]);
const EXT = `${path.sep}third-party${path.sep}npc_state_delta${path.sep}`;

export async function resolve(specifier, context, next) {
  const host = /^(?:\.\.\/)+(extensions|script)\.js$/.exec(specifier);
  if (host && context.parentURL?.includes('/modules/people/')) return { url: STUBS.get(`${host[1]}.js`), shortCircuit: true };
  if (specifier.startsWith('file:') && specifier.includes('/third-party/npc_state_delta/')) {
    const url = new URL(specifier);
    const file = fileURLToPath(url);
    if (!fs.existsSync(file)) {
      const real = oldPath(file.slice(file.indexOf(EXT) + EXT.length).split(path.sep).join('/'));
      if (fs.existsSync(real)) return next(pathToFileURL(real).href + url.search, context);
    }
  }
  return next(specifier, context);
}
