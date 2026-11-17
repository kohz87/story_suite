// `suite.at(rel)` that works on a checkout of either layout: the dry-run compares commits from before and after the move.
// `rel` is named from the Story Block folder as of the old layout; it is looked up there first, then where the layout rules put it.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atEitherLayout } from '../release/layout-paths.mjs';

const SB_DIR = 'packages/story-block';

/** Loads module `rel` of the checkout behind `suite`: at the old path if it is there, else at its layout-mapped new path. */
export function suiteAt(suite, rel) {
  const sb = suite.roots?.sb;
  if (!sb) return suite.at(rel);
  // sb is the package folder on a checkout of the old layout, the repo root on one of the new layout
  const root = path.basename(sb) === 'story-block' && path.basename(path.dirname(sb)) === 'packages' ? path.resolve(sb, '../..') : sb;
  const old = path.posix.join(SB_DIR, rel);
  const found = atEitherLayout(root, old);
  return found === old ? suite.at(rel) : import(pathToFileURL(path.join(root, found)).href);
}

/** Like `suiteAt`, for a file that moved after the layout move: `rel` as the old layout names it, else `now`, its repo path today. */
export async function suiteAtAny(suite, rel, now) {
  try { return await suiteAt(suite, rel); } catch (error) {
    const sb = suite.roots?.sb;
    if (!sb) throw error;
    const root = path.basename(sb) === 'story-block' && path.basename(path.dirname(sb)) === 'packages' ? path.resolve(sb, '../..') : sb;
    return import(pathToFileURL(path.join(root, now)).href);
  }
}
