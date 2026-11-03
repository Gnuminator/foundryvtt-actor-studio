import { describe, it, expect } from 'vitest';
import {
  isSpellChoiceAdvancement,
  readSpellRestriction,
  onRestrictionLists,
  filterSpellChoices
} from '../helpers/spellChoice.js';

const spell = (name, level, extra = {}) => ({
  name,
  type: 'spell',
  uuid: `Compendium.test.spells.Item.${name}`,
  system: { level, identifier: name.toLowerCase().replace(/ /g, '-'), school: 'evo', ...extra.system },
  ...extra.top
});

const registry = (lists) => ({
  forType: (type, id) => lists[`${type}:${id}`] ?? null
});

const wizardList = {
  uuids: new Set(),
  identifiers: new Set(['fire-bolt', 'light', 'magic-missile'])
};

describe('spell choice advancement', () => {
  it('recognises spell ItemChoice only', () => {
    expect(isSpellChoiceAdvancement({ type: 'ItemChoice', configuration: { type: 'spell' } })).toBe(true);
    expect(isSpellChoiceAdvancement({ type: 'ItemChoice', configuration: { type: 'feat' } })).toBe(false);
    expect(isSpellChoiceAdvancement({ type: 'ItemGrant', configuration: { type: 'spell' } })).toBe(false);
    expect(isSpellChoiceAdvancement(null)).toBe(false);
  });

  it('reads level restrictions', () => {
    expect(readSpellRestriction({ restriction: { level: '0' } })).toMatchObject({ minLevel: 0, maxLevel: 0 });
    expect(readSpellRestriction({ restriction: { level: '1' } })).toMatchObject({ minLevel: 1, maxLevel: 1 });
    expect(readSpellRestriction({ restriction: { level: 'available' } }, 2)).toMatchObject({ minLevel: 0, maxLevel: 2 });
    expect(readSpellRestriction({ restriction: { level: 'availableNoCantrips' } }, 3)).toMatchObject({ minLevel: 1, maxLevel: 3 });
    expect(readSpellRestriction({ restriction: { level: '' } })).toMatchObject({ minLevel: 0, maxLevel: 9 });
  });

  it('matches spell lists by uuid or identifier and tolerates an unknown list', () => {
    const reg = registry({ 'class:wizard': wizardList });
    expect(onRestrictionLists(spell('Fire Bolt', 0), ['class:wizard'], reg)).toBe(true);
    expect(onRestrictionLists(spell('Cure Wounds', 1), ['class:wizard'], reg)).toBe(false);
    expect(onRestrictionLists(spell('Cure Wounds', 1), ['class:homebrew'], reg)).toBe(true);
    expect(onRestrictionLists(spell('Cure Wounds', 1), ['class:wizard'], null)).toBe(true);
  });

  it('offers cantrips from the lists, one per spell, without already chosen ones', () => {
    const spells = [
      spell('Fire Bolt', 0),
      { ...spell('Fire Bolt', 0), uuid: 'Compendium.other.spells.Item.fb' },
      spell('Light', 0),
      spell('Guidance', 0),
      spell('Magic Missile', 1)
    ];
    const result = filterSpellChoices(spells, {
      config: { restriction: { level: '0', list: new Set(['class:wizard']) } },
      maxSlot: 1,
      registry: registry({ 'class:wizard': wizardList }),
      chosenKeys: ['light']
    });
    expect(result.map((s) => s.name)).toEqual(['Fire Bolt']);
    expect(result[0].uuid).toBe('Compendium.test.spells.Item.Fire Bolt');
  });

  it('filters by school and by available slot level', () => {
    const spells = [spell('Fire Bolt', 0), spell('Detect Magic', 1, { system: { school: 'div' } }), spell('Fireball', 3)];
    const result = filterSpellChoices(spells, {
      config: { restriction: { level: 'available', school: new Set(['evo']) } },
      maxSlot: 2,
      registry: null
    });
    expect(result.map((s) => s.name)).toEqual(['Fire Bolt']);
  });
});
