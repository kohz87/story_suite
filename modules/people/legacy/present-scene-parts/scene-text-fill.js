// Remembering shaped scene models and writing their strings into rendered slots.
const models = new Map();
const MODEL_LIMIT = 16;

/** Keep a model so the slots rendered from it can be filled after the markup is inserted. */
export function rememberPresentScene(model) {
    if (!model?.signature) return model;
    models.delete(model.signature);
    models.set(model.signature, model);
    while (models.size > MODEL_LIMIT) models.delete(models.keys().next().value);
    return model;
}

/**
 * Write each remembered model's strings into its slots under `root` with textContent (never as
 * markup), and the now lines' full text into their title attribute. Only changed text is written.
 * Returns the number of slots written. Never throws.
 */
export function fillPresentSceneText(root) {
    let written = 0;
    try {
        if (!root) return 0;
        const sections = [
            ...(root.matches?.('[data-delta-scene]') ? [root] : []),
            ...(root.querySelectorAll?.('[data-delta-scene]') || []),
        ];
        for (const section of sections) {
            const model = models.get(section.getAttribute?.('data-delta-scene') ?? section.dataset?.deltaScene);
            if (!model) continue;
            for (const node of section.querySelectorAll?.('[data-delta-text]') || []) {
                const value = model.texts[Number(node.getAttribute?.('data-delta-text') ?? node.dataset?.deltaText)] ?? '';
                if (node.textContent !== value) {
                    node.textContent = value;
                    written += 1;
                }
            }
            for (const node of section.querySelectorAll?.('[data-delta-title]') || []) {
                const value = model.texts[Number(node.getAttribute?.('data-delta-title') ?? node.dataset?.deltaTitle)] ?? '';
                if ((node.getAttribute?.('title') ?? node.title) !== value) {
                    if (typeof node.setAttribute === 'function') node.setAttribute('title', value);
                    else node.title = value;
                    written += 1;
                }
            }
        }
    } catch (error) {
        console.warn('[NPC State Delta] present scene text could not be filled', error);
    }
    return written;
}
