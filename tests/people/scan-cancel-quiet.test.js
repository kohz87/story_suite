// A scan cancelled on purpose (chat change, page closing) is not a console error; a real failure still is.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };   // the host stubs read it when the scan part's imports load
const { createScanOpsPart } = await import('../../modules/people/calls/runtime-scan-ops.js');
import { stoppedError, scannerRoutingError } from '../../modules/people/calls/scanner-routing-parts/errors.js';

test('a cancelled scan is logged quietly, a timed-out or broken one is a console error', t => {
  const errors = t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'debug', () => {});
  const { noteScanFailure } = createScanOpsPart({ emptyAnswerChats: new Set() }, {});
  noteScanFailure('dossier scan', stoppedError(false), 'chat');
  assert.equal(errors.mock.callCount(), 0, 'cancelled');
  noteScanFailure('dossier scan', stoppedError(true), 'chat');
  noteScanFailure('dossier scan', scannerRoutingError('profile gone'), 'chat');
  noteScanFailure('dossier scan', new Error('boom'), 'chat');
  assert.equal(errors.mock.callCount(), 3);
});
