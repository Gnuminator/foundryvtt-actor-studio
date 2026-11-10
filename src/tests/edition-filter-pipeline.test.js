import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractItemsFromPacksSync, extractItemsFromPacksAsync } from '~/src/helpers/Utility';
import { hideSupersededItems } from '~/src/helpers/editionFilter';

// aitool: the species path as Race.svelte runs it (extract, then filter), plus the getIndex fields.

const KEYS = ['name->label', 'type', 'system.identifier', 'system.source.rules'];
const entry = (name, identifier, rules) => ({
  name,
  type: 'race',
  system: { identifier, source: { rules } },
});
const makePack = (entries) => ({
  metadata: { name: 'species', label: 'Species', id: 'world.species', type: 'Item', path: '', system: 'dnd5e', flags: {} },
  index: new Map(entries.map((e, i) => [`id${i}`, e])),
  getIndex: vi.fn(async () => new Map(entries.map((e, i) => [`id${i}`, e]))),
});
const labels = (items) => items.map((i) => i.label);

beforeEach(() => {
  global.window = globalThis;
  window.GAS = { log: { d: vi.fn(), p: vi.fn(), e: vi.fn(), w: vi.fn() } };
  global.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
  global.game = { modules: { get: () => null }, settings: { get: vi.fn(() => false) }, i18n: { localize: (s) => s } };
});

describe('species through extract then filter (Race.svelte sync path)', () => {
  const pack = () =>
    makePack([
      entry('Forest Gnome', 'forest-gnome', '2014'),
      entry('Gnome, Forest', 'gnome-forest', '2024'),
      entry('Gnome, Rock', 'gnome-rock', '2024'),
      entry('Aasimar (MotM)', 'aasimar-motm', '2014'),
      entry('Aasimar', 'aasimar', '2024'),
      entry('Goliath (MotM)', 'goliath-motm', '2014'),
      entry('Goliath', 'goliath', '2024'),
      entry('Orc (MotM)', 'orc-motm', '2014'),
      entry('Orc', 'orc', '2024'),
      entry('Kenku (MotM)', 'kenku', '2014'),
    ]);

  it('hides the 2014 Forest Gnome and keeps Gnome, Forest once', () => {
    const out = hideSupersededItems(extractItemsFromPacksSync([pack()], KEYS));
    expect(labels(out).filter((l) => /gnome/i.test(l))).toEqual(['Gnome, Forest', 'Gnome, Rock']);
  });

  it('keeps the cleaned MotM labels apart from the plain 2024 names (M4)', () => {
    const items = extractItemsFromPacksSync([pack()], KEYS);
    // the cleaned labels are equal pairs now, which must not make the filter hide the 2014 entry
    expect(labels(items).filter((l) => l === 'Aasimar')).toHaveLength(2);
    const out = hideSupersededItems(items);
    expect(out).toHaveLength(items.length - 1); // only Forest Gnome goes
    expect(labels(out)).toContain('Kenku');
  });
});

describe('extractItemsFromPacksAsync getIndex fields', () => {
  it('leaves system.source.* paths out of the index fields but still extracts them', async () => {
    const p = makePack([entry('Bless', 'bless', '2024')]);
    const items = await extractItemsFromPacksAsync([p], ['name->label'], ['system.identifier', 'system.source.rules']);
    expect(p.getIndex).toHaveBeenCalledWith({ fields: ['system.identifier'] });
    expect(items[0].system.source.rules).toBe('2024');
  });
});
