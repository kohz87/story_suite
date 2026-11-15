// Test helper: opens the Settings overlay with the section hook and returns one section page as the user would see it.
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';

/** Returns { el, ov, calls, settings, sec, page(id) } over `buildSettings()` merged with `extra`. */
export function mountSettings(extra = {}) {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ov = createSettingsOverlay({
    doc, settings, renderSection: renderSettingsSection,
    onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]),
  });
  ov.open();
  const sec = id => settings.sections.find(s => s.id === id);
  const page = (id) => { ov.show(id); return ov.el.querySelector('.spage'); };
  return { el: ov.el, ov, calls, settings, sec, page };
}
