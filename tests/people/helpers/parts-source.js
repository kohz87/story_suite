// Source text of a facade file together with its parts, for tests that pin source text: the files it re-exports, in
// re-export order, then any other file in its sibling <name>-parts/ folder. A relative path is read from the package root.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oldPath } from './old-path.js';


export function partsSource(file) {
    const facade = file instanceof URL ? fileURLToPath(file) : oldPath(file);
    const text = fs.readFileSync(facade, 'utf8');
    const reexported = [...new Set([...text.matchAll(/from '(\.\/[^']+\.js)'/g)].map(match => path.resolve(path.dirname(facade), match[1])))];
    const folder = facade.replace(/\.js$/, '-parts');
    const inFolder = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith('.js')).sort().map(name => path.join(folder, name)) : [];
    const parts = [...new Set([...reexported, ...inFolder])];
    return [text, ...parts.map(part => fs.readFileSync(part, 'utf8'))].join('\n');
}
