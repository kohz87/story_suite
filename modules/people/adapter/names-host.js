// Finding the host and noticing it go: the event sent on the document, how often and how many times to look, and how often to check it is alive.

/** Sent on the document with detail { hosted } when Delta registers with a v2 host and when it goes away. */
export const V2_HOST_EVENT = 'people:v2-host';

export const HOST_RETRY_MS = 250;

export const HOST_RETRY_ATTEMPTS = 40;

export const HOST_ALIVE_MS = 5000;
