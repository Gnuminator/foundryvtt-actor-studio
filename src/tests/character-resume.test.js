/**
 * Resume of an unfinished character (CharacterResume.js): flag handling and what counts as finished.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('svelte/store', () => ({
  get: (store) => store.value,
  writable: (value) => ({ value, set(v) { this.value = v; }, subscribe: vi.fn() }),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  readable: vi.fn(() => ({ subscribe: vi.fn() }))
}));

import {
  PENDING_FLAG,
  collectPicks,
  savePendingCreation,
  clearPendingCreation,
  getPendingCreation,
  actorHasItemFrom,
  finishedPickIds,
  findResumableActors
} from '~/src/helpers/CharacterResume';

const MODULE = 'foundryvtt-actor-studio';

function fakeActor({ flag, items = [], owner = true, type = 'character' } = {}) {
  const flags = flag ? { [PENDING_FLAG]: flag } : {};
  return {
    type,
    items: { some: (fn) => items.some(fn) },
    testUserPermission: () => owner,
    getFlag: vi.fn((scope, key) => (scope === MODULE ? flags[key] : undefined)),
    setFlag: vi.fn(async (scope, key, value) => { flags[key] = value; }),
    unsetFlag: vi.fn(async (scope, key) => { delete flags[key]; })
  };
}

beforeEach(() => {
  global.window = global;
  global.window.GAS = { log: { d: vi.fn(), w: vi.fn(), e: vi.fn() } };
  global.game = { user: { id: 'u1', isGM: false }, actors: { contents: [] } };
});

describe('collectPicks', () => {
  it('keeps only picks that are documents with a uuid', () => {
    const stores = {
      race: { value: { uuid: 'Compendium.x.race' } },
      subRace: { value: null },
      background: { value: { uuid: 'Compendium.x.bg' } },
      characterClass: { value: { name: 'no uuid' } },
      characterSubClass: { value: false }
    };
    expect(collectPicks(stores)).toEqual({ race: 'Compendium.x.race', background: 'Compendium.x.bg' });
  });
});

describe('pending flag', () => {
  it('saves the picks with the user id', async () => {
    const actor = fakeActor();
    const ok = await savePendingCreation(actor, { race: { value: { uuid: 'Compendium.x.race' } } });
    expect(ok).toBe(true);
    const flag = getPendingCreation(actor);
    expect(flag.picks).toEqual({ race: 'Compendium.x.race' });
    expect(flag.userId).toBe('u1');
  });

  it('does not save when there are no picks, and never throws', async () => {
    const actor = fakeActor();
    expect(await savePendingCreation(actor, {})).toBe(false);
    actor.setFlag.mockRejectedValueOnce(new Error('denied'));
    expect(await savePendingCreation(actor, { race: { value: { uuid: 'u' } } })).toBe(false);
  });

  it('clears the flag', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'a' } } });
    await clearPendingCreation(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith(MODULE, PENDING_FLAG);
    expect(getPendingCreation(actor)).toBeNull();
  });

  it('ignores a malformed flag', () => {
    expect(getPendingCreation(fakeActor({ flag: { nope: 1 } }))).toBeNull();
    expect(getPendingCreation(fakeActor())).toBeNull();
  });
});

describe('finished picks', () => {
  const species = { _stats: { compendiumSource: 'Compendium.x.race' } };
  const bgViaCore = { flags: { core: { sourceId: 'Compendium.x.bg' } } };
  const classViaModule = { flags: { [MODULE]: { sourceUuid: 'Compendium.x.cls' } } };

  it('recognises an owned item by any of the three source markers', () => {
    const actor = fakeActor({ items: [species, bgViaCore, classViaModule] });
    expect(actorHasItemFrom(actor, 'Compendium.x.race')).toBe(true);
    expect(actorHasItemFrom(actor, 'Compendium.x.bg')).toBe(true);
    expect(actorHasItemFrom(actor, 'Compendium.x.cls')).toBe(true);
    expect(actorHasItemFrom(actor, 'Compendium.x.other')).toBe(false);
  });

  it('lists the queue ids that are already on the actor', () => {
    const actor = fakeActor({ items: [species] });
    const done = finishedPickIds(actor, { race: 'Compendium.x.race', background: 'Compendium.x.bg', characterClass: 'Compendium.x.cls' });
    expect([...done]).toEqual(['race']);
  });

  it('a bare shell has nothing finished', () => {
    expect(finishedPickIds(fakeActor(), { race: 'a' }).size).toBe(0);
  });
});

describe('findResumableActors', () => {
  it('returns owned characters with a pending flag only', () => {
    const mine = fakeActor({ flag: { picks: { race: 'a' }, userId: 'u1' } });
    const notMine = fakeActor({ flag: { picks: { race: 'a' } }, owner: false });
    const done = fakeActor();
    const npc = fakeActor({ flag: { picks: { race: 'a' } }, type: 'npc' });
    global.game.actors.contents = [mine, notMine, done, npc];
    expect(findResumableActors({ id: 'u1' })).toEqual([mine]);
  });
});
