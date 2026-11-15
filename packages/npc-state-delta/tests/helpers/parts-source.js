// Source text of a root facade module together with every file in its sibling <name>-parts/ folder, for tests that pin source text.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../../', import.meta.url);

export function partsSource(file) {
    const facade = fs.readFileSync(new URL(file, root), 'utf8');
    const folder = path.join(root.pathname, `${file.replace(/\.js$/, '')}-parts`);
    const parts = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith('.js')).sort() : [];
    return [facade, ...parts.map(name => fs.readFileSync(path.join(folder, name), 'utf8'))].join('\n');
}
