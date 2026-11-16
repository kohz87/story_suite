// The small text formats the report uses: yes/no/unknown, a number and a byte size.

export const yes = value => (value === true ? 'yes' : value === false ? 'no' : 'unknown');
export const num = n => (Number.isFinite(n) ? Number(n).toLocaleString('en-US') : 'unknown');
export const sizeText = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} bytes`);
