// Syntax-checks every shipped module (and the NPC State package folder): core/, modules/, packs/, ui/ (the old Story Director folder is checked by scripts/director/check.mjs), testkit/, examples/, scripts/ and authoring-kit/, run from the repo root.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (name === 'node_modules' || path === join('ui', 'legacy', 'director')) return [];
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') || path.endsWith('.mjs') ? [path] : [];
    });
}

const ROOTS = ['core', 'ui', 'modules', 'packs', 'testkit', 'examples', 'scripts', 'authoring-kit', 'packages/story-block', 'packages/npc-state-delta'];
for (const file of ROOTS.filter(existsSync).flatMap(walk)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log('syntax ok');
