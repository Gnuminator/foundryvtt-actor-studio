/**
 * Subclass guard (fork): a level-up that queues a subclass keeps it on the actor until the subclass item
 * is there; the record disappears once the item exists and a missing one stays recoverable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PENDING_SUBCLASS_FLAG,
  savePendingSubclass,
  getPendingSubclass,
  hasPendingSubclassItem,
  clearPendingSubclassIfDone
} from '~/src/helpers/PendingSubclass';

const MODULE = 'foundryvtt-actor-studio';
const CHAMPION = { uuid: 'Compendium.dnd5e.classes24.Item.phbftrChampion00', name: 'Champion' };

function fakeActor({ items = [], flag } = {}) {
  const flags = flag ? { [PENDING_SUBCLASS_FLAG]: flag } : {};
  return {
    items,
    getFlag: vi.fn((scope, key) => (scope === MODULE ? flags[key] : undefined)),
    setFlag: vi.fn(async (scope, key, value) => { flags[key] = value; }),
    unsetFlag: vi.fn(async (scope, key) => { delete flags[key]; })
  };
}

beforeEach(() => {
  globalThis.game = { user: { id: 'u1' } };
});

describe('savePendingSubclass', () => {
  it('stores the uuid and name on the actor', async () => {
    const actor = fakeActor();
    expect(await savePendingSubclass(actor, CHAMPION)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(MODULE, PENDING_SUBCLASS_FLAG, expect.objectContaining({ uuid: CHAMPION.uuid, name: 'Champion', userId: 'u1' }));
  });

  it('does nothing without a subclass uuid, and never throws', async () => {
    expect(await savePendingSubclass(fakeActor(), { name: 'x' })).toBe(false);
    const broken = fakeActor();
    broken.setFlag = vi.fn().mockRejectedValue(new Error('no'));
    expect(await savePendingSubclass(broken, CHAMPION)).toBe(false);
  });
});

describe('getPendingSubclass', () => {
  it('is pending while the subclass item is missing', () => {
    const actor = fakeActor({ flag: { ...CHAMPION } });
    expect(getPendingSubclass(actor)).toMatchObject({ name: 'Champion' });
  });

  it('is not pending once the subclass item is on the actor (by source or by name)', () => {
    const bySource = fakeActor({ flag: { ...CHAMPION }, items: [{ type: 'subclass', name: 'Other', _stats: { compendiumSource: CHAMPION.uuid } }] });
    const byName = fakeActor({ flag: { ...CHAMPION }, items: [{ type: 'subclass', name: 'Champion' }] });
    expect(getPendingSubclass(bySource)).toBeNull();
    expect(getPendingSubclass(byName)).toBeNull();
  });

  it('ignores a non-subclass item with the same name, and an actor without the flag', () => {
    expect(getPendingSubclass(fakeActor({ flag: { ...CHAMPION }, items: [{ type: 'feat', name: 'Champion' }] }))).not.toBeNull();
    expect(getPendingSubclass(fakeActor())).toBeNull();
    expect(hasPendingSubclassItem(null, CHAMPION)).toBe(false);
  });
});

describe('clearPendingSubclassIfDone', () => {
  it('removes the flag once the item is there, keeps it while it is missing', async () => {
    const done = fakeActor({ flag: { ...CHAMPION }, items: [{ type: 'subclass', name: 'Champion' }] });
    await clearPendingSubclassIfDone(done);
    expect(done.unsetFlag).toHaveBeenCalledWith(MODULE, PENDING_SUBCLASS_FLAG);
    const missing = fakeActor({ flag: { ...CHAMPION } });
    await clearPendingSubclassIfDone(missing);
    expect(missing.unsetFlag).not.toHaveBeenCalled();
  });
});
