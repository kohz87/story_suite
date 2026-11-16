// Syntax-checks every shipped module (everything under ui/legacy/director/, run from the repo root).
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
    });
}

for (const file of walk(join('ui', 'legacy', 'director'))) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log('syntax ok');
