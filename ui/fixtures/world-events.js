// Harness fixture for World events (switch on): the World tab's Conditions here card and how the news came, and the World events rows of the World and time page.
import { worldRows } from '../select/settings-world.js';

const NEW_ROWS = ['world.worldEvents', 'world.tempo', 'world.directorCalls'];

/** The world view-model with `conditions` and the first two news items heard the way the world's own courier tells (confirmed, then rumour). */
export function withWorldEvents(world) {
  const stamp = (n, i) => (i < 2 ? { ...n, heard: [...n.heard, { where: 'in Bluewatch', when: 'June 5, 1200', from: i ? 'rumour' : 'a courier', how: i ? 'rumour' : 'confirmed' }] } : n);
  return {
    ...world,
    news: world.news.map(stamp),
    conditions: { place: 'Bluewatch', rows: [
      { key: 'unrest@Bluewatch', name: 'unrest', ref: 'Bluewatch', since: 'June 4, 1200', why: 'a levy', means: 'Crowds in the streets.', told: '' },
      { key: 'grain-dear@The March', name: 'grain-dear', ref: 'The March', since: 'June 3, 1200', why: 'a bad harvest', means: 'Bread costs more.', told: 'all goods ×1.3, grain ×2' },
    ] },
  };
}

/** The three World events rows of the World and time page, switch on, tempo 2, 3 Director calls. */
export const worldEventsRows = () => worldRows({ 'chronicle.tempo': '2' }, [{ id: 'story-director.world-events', on: true }], 3).filter(r => NEW_ROWS.includes(r.key));
