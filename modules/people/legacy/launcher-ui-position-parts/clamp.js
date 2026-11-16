/* Launcher viewport clamping: keeps a launcher position inside the viewport margin. */
import { finite } from './shared-number.js';

const VIEWPORT_MARGIN_PX = 8;

export function clampLauncherPosition(position = {}, viewport = {}, size = {}, margin = VIEWPORT_MARGIN_PX) {
    const safeMargin = Math.max(0, finite(margin, VIEWPORT_MARGIN_PX));
    const width = Math.max(0, finite(viewport.width));
    const height = Math.max(0, finite(viewport.height));
    const itemWidth = Math.max(0, finite(size.width));
    const itemHeight = Math.max(0, finite(size.height));
    const maxLeft = Math.max(safeMargin, width - itemWidth - safeMargin);
    const maxTop = Math.max(safeMargin, height - itemHeight - safeMargin);
    return {
        left: Math.min(maxLeft, Math.max(safeMargin, finite(position.left, maxLeft))),
        top: Math.min(maxTop, Math.max(safeMargin, finite(position.top, maxTop))),
    };
}
