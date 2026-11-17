// What the story can write (a character's name, a skill, a foe, a line in the rolls) is shown as text and never parsed;
// the view code uses no markup APIs; the Rolls setting's fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { createPartyWidget } from '../../../../modules/rpg/view/party.js';
import { buildPanel, panelModel, readResolve } from '../../../../modules/rpg/view/battle-log.js';
import { characterDefinition, fakeState, foesDefinition, roleOf, skillsDefinition } from './helpers.js';

const MARK = '<img src=x onerror="globalThis.pwned=1"><b>bold</b>';

test('the view sources use no markup, script or random APIs; only the stylesheet link sets an address', () => {
    const dir = new URL('../../../../modules/rpg/view/', import.meta.url);
    const files = readdirSync(dir).filter(file => file.endsWith('.js'));
    assert.deepEqual(files.sort(), ['bars.js', 'battle-log.js', 'changes-lines.js', 'check-card.js', 'distribute.js', 'export.js', 'fight.js', 'gear-card.js', 'gear-stats.js', 'hero-data.js', 'index.js', 'party-data.js', 'party.js', 'settings-data.js', 'settings.js', 'skills.js', 'start.js', 'wizard-data.js', 'wizard.js']);
    for (const file of [...files, '../strings.js']) {
        const source = readFileSync(new URL(file, dir), 'utf8');
        assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|Math\.random|Date\.now/, file);
        assert.doesNotMatch(source, /\.on[a-z]+\s*=(?!=)/, `${file} assigns no on* handler`);
        assert.doesNotMatch(source, /setAttribute\(\s*['"]on/i, `${file} sets no on* attribute`);
        if (file !== 'index.js') assert.doesNotMatch(source, /setAttribute\(\s*['"](?:style|href|src)/i, `${file} sets no style, href or src`);
    }
});
