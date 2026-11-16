// The empty inventory, the default item definition and the two value checks the shape checks use.

export function initialInventory() {
    return { defs: {}, stacks: {}, wallets: {}, aliases: {} };
}

/** A story-introduced item's definition before the `item.define` hooks (§7 defaults). */
export function defaultDef(id, name) {
    return {
        id, name, kind: 'goods', rarity: 'common', value: 0, stack: true, slot: null,
        stats: {}, effect: {}, tags: [], note: '',
    };
}

export const isCount = (value, min) => Number.isSafeInteger(value) && value >= min;
export const nonBlank = value => typeof value === 'string' && value.trim() !== '';
