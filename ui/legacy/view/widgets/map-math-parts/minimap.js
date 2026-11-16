// The minimap: the viewport box and mapping a minimap click back to a world point.

/** The part of the view inside the world: the minimap's viewport box (w/h are 0 when outside). */
export function minimapBox(view, world) {
    const x = Math.max(view.x, world.x);
    const y = Math.max(view.y, world.y);
    const right = Math.min(view.x + view.w, world.x + world.w);
    const bottom = Math.min(view.y + view.h, world.y + world.h);
    return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/**
 * The world point under a client position on the minimap, which shows the whole world letterboxed
 * (SVG preserveAspectRatio="xMidYMid meet").
 */
export function minimapToWorld(world, rect, clientX, clientY) {
    const scale = Math.min(rect.width / world.w, rect.height / world.h);
    const offsetX = (rect.width - world.w * scale) / 2;
    const offsetY = (rect.height - world.h * scale) / 2;
    return {
        x: world.x + (clientX - rect.left - offsetX) / scale,
        y: world.y + (clientY - rect.top - offsetY) / scale,
    };
}
