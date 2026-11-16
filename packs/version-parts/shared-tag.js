// Version text parts: the shared pre-release tag reader.

export const tagOf = text => String(text).split('.').map(part => (/^\d+$/.test(part) ? Number(part) : part));
