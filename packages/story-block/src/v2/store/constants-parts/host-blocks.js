// The host's savepoint-block tests and the reader-setup test.
import { reachesBranch } from '../../evidence.js';
import { HOST_DOMAIN } from '../../timeline/gate.js';

// The host's savepoints domain (timeline/gate.js): written only by the host's own blocks (module story-block, operation savepoint.*).
// A write reaches it when its path or `from` is the domain, anything below it, or anything that holds it (/domains, the root): any op.
const HOST_BRANCH = ['domains', HOST_DOMAIN];
export const touchesHostDomain = op => !op || typeof op !== 'object' || reachesBranch(op.path, HOST_BRANCH) || reachesBranch(op.from, HOST_BRANCH);
export const hostBlock = (module, type) => module === 'story-block' && typeof type === 'string' && type.startsWith('savepoint.');
// The reader's own chat-block click (Story Block's data-module setup: define, redefine, remove, pin, attach, migrate, Add to party; cause `ui`)
// is an action on the reply, not the reply's story: a Re-read of that reply keeps it, as it keeps the reader's other actions (a swipe or a delete still takes it).
export const readerSetup = (span, receipts) => span?.guard?.owner === 'story-block' && String(span.guard.predicate?.kind ?? '').startsWith('dm.')
    && receipts.length > 0 && receipts.every(receipt => receipt?.cause === 'ui');
