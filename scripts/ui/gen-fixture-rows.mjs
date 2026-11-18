// Writes ui/fixtures/settings-real.js from the real Settings selectors on a real host at code defaults: `node scripts/ui/gen-fixture-rows.mjs` (one job: the dump).
import { writeFileSync } from 'node:fs';
import { realSettings, renderRealFixture } from '../../tests/ui/fixtures/real-settings.js';

const vm = await realSettings();
writeFileSync(new URL('../../ui/fixtures/settings-real.js', import.meta.url), renderRealFixture(vm));
process.exit(0);
