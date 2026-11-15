// Source text of a facade file together with the parts it re-exports, in re-export order, for tests that pin source text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function partsSource(file) {
    const facade = path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
    const text = fs.readFileSync(facade, 'utf8');
    const parts = [...new Set([...text.matchAll(/from '(\.\/[^']+\.js)'/g)].map(match => match[1]))];
    return [text, ...parts.map(part => fs.readFileSync(path.resolve(path.dirname(facade), part), 'utf8'))].join('\n');
}
