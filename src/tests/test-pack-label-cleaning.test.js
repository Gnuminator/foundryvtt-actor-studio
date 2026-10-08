import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractItemsFromPacksSync } from '~/src/helpers/Utility';

// aitool: the ", Word" suffix cleaning must not merge items of one pack that differ only by that
// suffix (2024 species "Elf, Drow" / "Elf, High" / "Elf, Wood" all showed as "Elf").

const makePack = (name, label, names) => ({
  metadata: { name, label, id: `dnd5e.${name}`, type: 'Item', path: '', system: 'dnd5e', flags: {} },
  index: new Map(names.map((n, i) => [`id${i}`, { name: n }])),
});

const labelsOf = pack => extractItemsFromPacksSync([pack], ['name->label']).map(i => i.label);

describe('extractItemsFromPacksSync label cleaning', () => {
  beforeEach(() => {
    global.window = globalThis;
    window.GAS = { log: { d: vi.fn(), p: vi.fn(), e: vi.fn(), w: vi.fn() } };
    global.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
    global.game = {
      modules: { get: () => null },
      settings: { get: vi.fn(() => false) },
      i18n: { localize: s => s },
    };
  });

  it('keeps the three elf lineages and the gnome lineages distinct', () => {
    const labels = labelsOf(
      makePack('species', 'Species', [
        'Elf, Drow', 'Elf, High', 'Elf, Wood', 'Gnome, Forest', 'Gnome, Rock', 'Human',
      ]),
    );
    expect(labels).toEqual(['Elf, Drow', 'Elf, High', 'Elf, Wood', 'Gnome, Forest', 'Gnome, Rock', 'Human']);
  });

  it('also keeps compoundLabel distinct for lineages', () => {
    const items = extractItemsFromPacksSync(
      [makePack('species', 'Species', ['Elf, High', 'Elf, Wood'])],
      ['name->label'],
    );
    expect(items.map(i => i.compoundLabel)).toEqual(['[Species] Elf, High', '[Species] Elf, Wood']);
  });

  it('still strips the suffix from a lone "Something, Tasha\'s"', () => {
    expect(labelsOf(makePack('feats', 'Feats', ["Fey Touched, Tasha's", 'Alert']))).toEqual(['Fey Touched', 'Alert']);
  });

  it('still removes a bracket tag such as (TCR)', () => {
    expect(labelsOf(makePack('feats', 'Feats', ['Dragon Fear (TCR)', 'Shield [GMO]']))).toEqual([
      'Dragon Fear',
      'Shield',
    ]);
  });

  it('keeps both labels when a plain name and a suffixed name would collide', () => {
    // "Elf" is plain, "Elf, Tasha's" cleans to "Elf" but has a different step 1 label: both keep step 1
    expect(labelsOf(makePack('species', 'Species', ['Elf', "Elf, Tasha's"]))).toEqual(['Elf', "Elf, Tasha's"]);
  });

  it('does not compare items from different packs', () => {
    const items = extractItemsFromPacksSync(
      [
        makePack('a', 'Pack A', ['Elf, High']),
        makePack('b', 'Pack B', ['Elf, Wood']),
      ],
      ['name->label'],
    );
    expect(items.map(i => i.label)).toEqual(['Elf', 'Elf']);
  });
});
