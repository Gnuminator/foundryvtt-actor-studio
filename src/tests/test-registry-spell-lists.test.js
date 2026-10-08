import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// aitool: the Spells tab offers only spells on the dnd5e registry's class list (dnd5e 4+), because
// 2024 pack spells often carry no class labels and passed as "unrestricted homebrew" for every class.

const spell = (id, name, extra = {}) => ({
  id,
  uuid: `Compendium.phb.spells.Item.${id}`,
  name,
  type: 'spell',
  img: '',
  system: { identifier: name.toLowerCase().replace(/ /g, '-'), level: 1, ...extra.system },
  labels: extra.labels ?? {},
});

const docs = [
  spell('a', 'Magic Missile'),
  spell('b', 'Bless'),
  spell('c', 'Cure Wounds'),
  spell('d', 'Homebrew Bolt'),
  spell('e', 'Labelled Spell', { labels: { classes: 'Wizard' } }),
];

vi.mock('~/src/helpers/Utility', async importOriginal => ({
  ...(await importOriginal()),
  getPacksFromSettings: () => [{ collection: 'phb.spells', getDocuments: async () => docs }],
}));

const list = uuids => ({
  uuids: new Set(uuids.map(id => `Compendium.phb.spells.Item.${id}`)),
  identifiers: new Set(),
});
const lists = { wizard: list(['a']), cleric: list(['b', 'c']) };

describe('Spells tab: the registry class spell list decides', () => {
  let mod;

  beforeEach(async () => {
    global.window = globalThis;
    window.GAS = { log: { d: vi.fn(), p: vi.fn(), e: vi.fn(), w: vi.fn() }, dnd5eVersion: 5 };
    global.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
    global.game = { settings: { get: vi.fn(() => true) }, i18n: { localize: s => s } };
    globalThis.dnd5e = {
      registry: {
        spellLists: {
          forType: (type, id) => (type === 'class' ? lists[id] ?? null : null),
          forSpell: uuid =>
            new Set(Object.values(lists).filter(l => l.uuids.has(uuid))),
        },
      },
    };
    mod = await import('~/src/stores/spellSelection.js');
  });

  afterEach(() => {
    delete globalThis.dnd5e;
  });

  // setup.js mocks svelte's writable, so the store's last set() call holds the list.
  const offered = () => mod.availableSpells.set.mock.calls.at(-1)[0];
  const names = () => offered().map(s => s.name).sort();

  it('a wizard sees only wizard list spells', async () => {
    await mod.loadAvailableSpells('wizard');
    // Bless and Cure Wounds are on the cleric list only. "Labelled Spell" has a wizard label and
    // "Homebrew Bolt" no class data, but the registry covers the wizard, so its list decides.
    expect(names()).toEqual(['Magic Missile']);
  });

  it('a cleric sees only cleric list spells', async () => {
    await mod.loadAvailableSpells('cleric');
    expect(names()).toEqual(['Bless', 'Cure Wounds']);
  });

  it('a class the registry has no list for keeps the label checks and homebrew', async () => {
    await mod.loadAvailableSpells('wizardly-homebrew');
    expect(names()).toEqual(['Homebrew Bolt']);
  });

  it('matches by identifier when the uuid differs (the same spell in another pack)', () => {
    const l = { uuids: new Set(), identifiers: new Set(['shield']) };
    expect(mod.onClassList(l, { uuid: 'x', system: { identifier: 'shield' } })).toBe(true);
    expect(mod.onClassList(l, { uuid: 'x', system: {} })).toBe(false);
  });

  it('copies the spell identifier onto the offered spell', async () => {
    await mod.loadAvailableSpells('wizard');
    const mm = offered().find(s => s.name === 'Magic Missile');
    expect(mm.system.identifier).toBe('magic-missile');
  });
});
