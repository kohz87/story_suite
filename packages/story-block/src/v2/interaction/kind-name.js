// What a kind is called in a sentence: its own `title`, else its id's last part made readable ("mod/hard_bargain" → "Hard bargain").

const fromId = kindId => {
    const tail = String(kindId ?? 'interaction').split('/').at(-1).replace(/[-_]+/gu, ' ').trim();
    return tail ? tail[0].toUpperCase() + tail.slice(1) : 'interaction';
};

export const kindName = (kind, kindId) => String(kind?.title ?? fromId(kindId)).trim() || 'interaction';
