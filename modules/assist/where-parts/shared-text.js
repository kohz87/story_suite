// The small text and number helpers the where files share: fold a name, clip a text, read a finite number.

export const fold = text => String(text ?? '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const clip = (text, max) => { const chars = [...String(text ?? '').replace(/\s+/g, ' ').trim()]; return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join(''); };
export const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
