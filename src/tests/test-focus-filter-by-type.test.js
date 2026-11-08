import { describe, expect, it } from 'vitest';
import { filterFocusItemsByType } from '~/src/helpers/focusFilter.js';

const focusTypes = {
  holy: { itemIds: { amulet: 'phbhsyAmuletworn', emblem: 'phbhsyEmblemborn', reliquary: 'phbhsyReliquaryh' } },
  druidic: { itemIds: { mistletoe: 'phbdruMistletoe', totem: 'phbdruTotemTotem' } }
};

const items = [
  { label: 'Amulet', _id: 'phbhsyAmuletworn' },
  { label: 'Crystal', _id: 'phbarcCrystal000' },
  { label: 'Emblem', _id: 'phbhsyEmblemborn' },
  { label: 'Mistletoe', value: 'Compendium.dnd-players-handbook.equipment.Item.phbdruMistletoe' },
  { label: 'Reliquary', _id: 'phbhsyReliquaryh' },
  { label: 'Stone Tablet', _id: 'phbtriStoneTabl' }
];

describe('filterFocusItemsByType', () => {
  it('keeps only Amulet, Emblem and Reliquary for the holy focus', () => {
    expect(filterFocusItemsByType(items, 'holy', focusTypes).map((i) => i.label)).toEqual(['Amulet', 'Emblem', 'Reliquary']);
  });

  it('matches on the last uuid segment when _id is missing', () => {
    expect(filterFocusItemsByType(items, 'druidic', focusTypes).map((i) => i.label)).toEqual(['Mistletoe']);
  });

  it('reads full compendium uuids as dnd5e stores them and matches the SRD copy by name', () => {
    const real = { holy: { itemIds: { amulet: 'Compendium.dnd5e.equipment24.Item.phbhsyAmuletworn', emblem: 'Compendium.dnd5e.equipment24.Item.phbhsyEmblemborn' } } };
    const names = { 'Compendium.dnd5e.equipment24.Item.phbhsyAmuletworn': { name: 'Amulet' }, 'Compendium.dnd5e.equipment24.Item.phbhsyEmblemborn': { name: 'Emblem' } };
    const list = [
      { label: 'Amulet', _id: 'phbhsyAmuletworn' },
      { label: 'Emblem', _id: 'laVqttkGMW4B9654' },
      { label: 'Rod', _id: 'phbafcRod0000000' }
    ];
    expect(filterFocusItemsByType(list, 'holy', real, (uuid) => names[uuid]).map((i) => i.label)).toEqual(['Amulet', 'Emblem']);
  });

  it('returns the list unchanged for an unknown key', () => {
    expect(filterFocusItemsByType(items, 'nope', focusTypes)).toBe(items);
  });

  it('returns the list unchanged when no item matches the ids (other pack)', () => {
    const other = [{ label: 'Wand', _id: 'zzz' }];
    expect(filterFocusItemsByType(other, 'holy', focusTypes)).toBe(other);
  });
});
