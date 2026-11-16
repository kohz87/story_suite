// The module loaders and scripts of the combination matrix (docs/v2/MATRIX.md): each module's real
// definition is imported from its checkout by path and given a scripted reply, an action and a few
// facts to read back. Nothing here stubs a module; a module that is not checked out is simply absent
// and the rows that need it are skipped.
//
// A module entry (`MODULES[key]`):
//   * `dir`, `entry`: the folder name next to the others and the file that builds the definition;
//   * `make(imported, ref)`: a fresh definition; `ref.sdk` is the host's sdk once it is up (set after
//     createHost), for the modules whose settings come through it;
//   * `A`, `B`, `C`: three replies' change lines (A first, B second, C the swipe / re-read text);
//   * `setup(host)`: commands run before the first reply (an example module makes its party);
//   * `action(host)` → [type, payload]: the reader's action, run after reply A;
//   * `watch(host)` (optional): what the action is expected to change when `facts` does not show it;
//   * `facts(host)`: a plain projection of what the module keeps, to compare with a host that
//     only played the replies that should be left (never ids, which differ from host to host).
//
// Public face: re-exports its parts.

export { ORDER, MODULES } from './modules-parts/scripts.js';
export { FOLDERS, discoverRoots } from './modules-parts/discovery.js';
export { loadModules } from './modules-parts/loading.js';
