// The Studio page's entry: starts the Studio on #studio (studio/index.html) and leaves its handle on the page for checks.

import { startStudio } from './app.js';

const root = globalThis.document?.getElementById('studio');
if (root) globalThis.storySuiteStudio = startStudio({ doc: globalThis.document, root });
