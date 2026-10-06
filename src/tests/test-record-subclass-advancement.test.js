import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/src/helpers/constants', () => ({
  MODULE_ID: 'foundryvtt-actor-studio'
}));

import { recordSubclassOnClassAdvancement } from '~/src/hooks/recordSubclassAdvancement.js';

const makeSetup = ({ dropped = [{ name: 'Champion', uuid: 'Compendium.x.Item.abc' }], value = {}, userId = 'u1' } = {}) => {
  const updateAdvancement = vi.fn().mockResolvedValue(undefined);
  const classItem = {
    type: 'class',
    identifier: 'fighter',
    name: 'Fighter',
    updateAdvancement,
    advancement: { byType: { Subclass: [{ id: 'adv1', value }] } }
  };
  const actor = {
    documentName: 'Actor',
    items: [classItem],
    getFlag: vi.fn(() => dropped)
  };
  const item = {
    type: 'subclass',
    id: 'sub1',
    uuid: 'Actor.a.Item.sub1',
    name: 'Champion',
    parent: actor,
    system: { classIdentifier: 'fighter' },
    _stats: { compendiumSource: 'Compendium.x.Item.abc' },
    flags: {}
  };
  return { item, actor, updateAdvancement, userId };
};

describe('recordSubclassOnClassAdvancement', () => {
  beforeEach(() => {
    globalThis.game = { user: { id: 'u1' } };
    globalThis.window = globalThis.window || globalThis;
    window.GAS = { log: { i: vi.fn(), w: vi.fn() } };
  });

  it('records the subclass on the class Subclass advancement', async () => {
    const { item, updateAdvancement } = makeSetup();
    expect(await recordSubclassOnClassAdvancement(item, {}, 'u1')).toBe(true);
    expect(updateAdvancement).toHaveBeenCalledWith('adv1', {
      value: { document: 'sub1', uuid: 'Compendium.x.Item.abc' }
    });
  });

  it('does nothing for another user, non-subclass items, or when Studio did not drop it', async () => {
    const a = makeSetup();
    expect(await recordSubclassOnClassAdvancement(a.item, {}, 'other')).toBe(false);
    const b = makeSetup();
    b.item.type = 'feat';
    expect(await recordSubclassOnClassAdvancement(b.item, {}, 'u1')).toBe(false);
    const c = makeSetup({ dropped: null });
    expect(await recordSubclassOnClassAdvancement(c.item, {}, 'u1')).toBe(false);
    expect(a.updateAdvancement).not.toHaveBeenCalled();
    expect(c.updateAdvancement).not.toHaveBeenCalled();
  });

  it('does not overwrite an advancement that is already set', async () => {
    const { item, updateAdvancement } = makeSetup({ value: { document: 'old', uuid: 'x' } });
    expect(await recordSubclassOnClassAdvancement(item, {}, 'u1')).toBe(false);
    expect(updateAdvancement).not.toHaveBeenCalled();
  });
});
