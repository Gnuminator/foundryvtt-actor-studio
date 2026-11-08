import { describe, it, expect } from 'vitest';
import {
  MAGIC_INITIATE_BACKGROUND_LISTS,
  magicInitiateListForBackground,
  resolveMagicInitiateList,
  filterSpellChoices
} from '../helpers/spellChoice.js';

const spell = (name, level) => ({
  name,
  type: 'spell',
  uuid: `Compendium.test.spells.Item.${name}`,
  system: { level, identifier: name.toLowerCase().replace(/ /g, '-'), school: 'evo' }
});

const lists = {
  'class:wizard': { uuids: new Set(), identifiers: new Set(['fire-bolt', 'magic-missile']) },
  'class:cleric': { uuids: new Set(), identifiers: new Set(['sacred-flame', 'bless']) },
  'class:druid': { uuids: new Set(), identifiers: new Set(['druidcraft', 'goodberry']) }
};
const registry = { forType: (type, id) => lists[`${type}:${id}`] ?? null };
const all = [spell('Fire Bolt', 0), spell('Magic Missile', 1), spell('Sacred Flame', 0), spell('Bless', 1), spell('Druidcraft', 0), spell('Goodberry', 1)];
const config = { restriction: { level: '', list: ['class:cleric', 'class:druid', 'class:wizard'] } };

const flowFor = (featName, origin, items) => ({
  advancement: {
    item: {
      name: featName,
      flags: { dnd5e: origin ? { advancementOrigin: origin } : {} },
      parent: { items: { get: (id) => items[id] } }
    }
  }
});

describe('Magic Initiate list from the background', () => {
  it('has the three 2024 backgrounds of the kept books', () => {
    expect(MAGIC_INITIATE_BACKGROUND_LISTS).toEqual({ acolyte: 'class:cleric', guide: 'class:druid', sage: 'class:wizard' });
    expect(magicInitiateListForBackground('Sage')).toBe('class:wizard');
    expect(magicInitiateListForBackground('Soldier')).toBeNull();
  });

  it('forces the Wizard list when Sage granted the feat', () => {
    const flow = flowFor('Magic Initiate', 'bg1.adv1', { bg1: { type: 'background', name: 'Sage' } });
    const override = resolveMagicInitiateList(flow);
    expect(override).toBe('class:wizard');
    const result = filterSpellChoices(all, { config, maxSlot: 1, registry, listOverride: override });
    expect(result.map((s) => s.name)).toEqual(['Fire Bolt', 'Magic Missile']);
  });

  it('keeps all three lists for a freely chosen feat, even with a Sage background', () => {
    const flow = flowFor('Magic Initiate', 'cls1.adv9', { cls1: { type: 'class', name: 'Cleric' }, bg1: { type: 'background', name: 'Sage' } });
    expect(resolveMagicInitiateList(flow, { name: 'Sage' })).toBeNull();
    const result = filterSpellChoices(all, { config, maxSlot: 1, registry, listOverride: null });
    expect(result).toHaveLength(6);
  });

  it('uses the selected background when the feat has no origin flag', () => {
    const flow = flowFor('Magic Initiate', null, {});
    expect(resolveMagicInitiateList(flow, { name: 'Guide' })).toBe('class:druid');
    expect(resolveMagicInitiateList(flow, null)).toBeNull();
  });

  it('ignores other feats and backgrounds without a named list', () => {
    expect(resolveMagicInitiateList(flowFor('Druidic Warrior', 'bg1.a', { bg1: { type: 'background', name: 'Sage' } }))).toBeNull();
    expect(resolveMagicInitiateList(flowFor('Magic Initiate', 'bg1.a', { bg1: { type: 'background', name: 'Soldier' } }))).toBeNull();
  });
});
