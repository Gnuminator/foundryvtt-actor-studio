/**
 * Resume fixes L1 to L6 (CharacterResume.js): deferred clear, name/type duplicate fallback, guards,
 * one offer per user, unresolvable picks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('svelte/store', () => ({
  get: (store) => store.value,
  writable: (value) => ({ value, set(v) { this.value = v; }, subscribe: vi.fn() }),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  readable: vi.fn(() => ({ subscribe: vi.fn() }))
}));

const queueCreationItems = vi.fn();
vi.mock('~/src/lib/workflow', () => ({ queueCreationItems }));
vi.mock('~/src/helpers/WorkflowStateMachine', () => ({ workflowFSMContext: {} }));

import {
  PENDING_FLAG,
  clearPendingCreationWhenIdle,
  finishedPickIds,
  findResumableActors,
  applyResume,
  resumeActorStudio,
  offerResumeOnReady,
  claimOffer
} from '~/src/helpers/CharacterResume';

const MODULE = 'foundryvtt-actor-studio';

function fakeActor({ id = 'a1', flag, items = [], ownership, owner = true, name = 'Hero' } = {}) {
  const flags = flag ? { [PENDING_FLAG]: flag } : {};
  return {
    id,
    name,
    type: 'character',
    ownership,
    items: { some: (fn) => items.some(fn) },
    testUserPermission: () => owner,
    getFlag: vi.fn((scope, key) => (scope === MODULE ? flags[key] : undefined)),
    setFlag: vi.fn(async (scope, key, value) => { flags[key] = value; }),
    unsetFlag: vi.fn(async (scope, key) => { delete flags[key]; })
  };
}

function fakeStores() {
  const mk = () => ({ value: null, set(v) { this.value = v; } });
  return { race: mk(), subRace: mk(), background: mk(), characterClass: mk(), characterSubClass: mk(), actorInGame: mk(), isActorCreated: mk() };
}

let advancementOpen;
let studioOpen;

beforeEach(() => {
  vi.useFakeTimers();
  queueCreationItems.mockClear();
  advancementOpen = false;
  studioOpen = true;
  global.window = global;
  global.window.GAS = { log: { d: vi.fn(), w: vi.fn(), e: vi.fn() } };
  global.ui = { notifications: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } };
  global.game = { user: { id: 'u1' }, actors: { contents: [], get: vi.fn() }, sessionId: 's1' };
  global.document = {
    querySelector: (sel) => (sel.includes('advancement') && advancementOpen ? {} : null),
    getElementById: () => (studioOpen ? {} : null)
  };
  global.fromUuid = vi.fn();
});

afterEach(() => { vi.useRealTimers(); });

describe('L1: the flag stays while advancement windows are open', () => {
  it('clears at once when nothing is open', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'r' } } });
    expect(await clearPendingCreationWhenIdle(actor)).toBe(true);
    expect(actor.unsetFlag).toHaveBeenCalledTimes(1);
  });

  it('waits for the open window to close, then clears once', async () => {
    advancementOpen = true;
    const actor = fakeActor({ flag: { picks: { race: 'r' } } });
    const p = clearPendingCreationWhenIdle(actor, { intervalMs: 100 });
    await vi.advanceTimersByTimeAsync(500);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
    advancementOpen = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toBe(true);
    expect(actor.unsetFlag).toHaveBeenCalledTimes(1);
  });

  it('keeps the flag when Studio is closed with a window still open', async () => {
    advancementOpen = true;
    const actor = fakeActor({ flag: { picks: { race: 'r' } } });
    const p = clearPendingCreationWhenIdle(actor, { intervalMs: 100 });
    studioOpen = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toBe(false);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});

describe('L2: duplicate detection falls back to name and type', () => {
  it('treats a hand-added item with the same name and type as finished', () => {
    const actor = fakeActor({ items: [{ name: 'Elf', type: 'race' }] });
    const picks = { race: 'Compendium.x.elf', background: 'Compendium.x.sage' };
    const docs = { race: { name: 'Elf', type: 'race' }, background: { name: 'Sage', type: 'background' } };
    expect([...finishedPickIds(actor, picks, docs)]).toEqual(['race']);
  });

  it('does not match a different type with the same name', () => {
    const actor = fakeActor({ items: [{ name: 'Wizard', type: 'feat' }] });
    expect(finishedPickIds(actor, { characterClass: 'u' }, { characterClass: { name: 'Wizard', type: 'class' } }).size).toBe(0);
  });

  it('applyResume skips a name/type match instead of queueing a second copy', async () => {
    const actor = fakeActor({
      flag: { picks: { race: 'Compendium.x.elf', background: 'Compendium.x.sage' }, userId: 'u1' },
      items: [{ name: 'Elf', type: 'race' }]
    });
    global.fromUuid.mockImplementation(async (u) => (u.endsWith('elf') ? { name: 'Elf', type: 'race', uuid: u } : { name: 'Sage', type: 'background', uuid: u }));
    const left = await applyResume({ actor, stores: fakeStores(), dropItemRegistry: {} });
    expect([...left]).toEqual(['background']);
    const args = queueCreationItems.mock.calls[0][0];
    expect([...args.skipIds]).toEqual(['race']);
  });
});

describe('L3: guards on the forced and normal resume path', () => {
  beforeEach(() => {
    global.sessionStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    global.window.location = { reload: vi.fn() };
  });

  it('refuses when the user does not own the actor', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'r' } }, owner: false });
    global.game.actors.get.mockReturnValue(actor);
    expect(await resumeActorStudio('a1')).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('after a reload for this resume it does not reload again', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'r' } } });
    global.game.actors.get.mockReturnValue(actor);
    global.document.getElementById = () => null;
    global.document.querySelector = () => ({}); // Studio root present -> "already open", returns false before any reload
    await resumeActorStudio('a1', { afterReload: true });
    vi.runAllTimers();
    expect(global.window.location.reload).not.toHaveBeenCalled();
  });

  it('offerResumeOnReady passes the forced actor on as afterReload', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'r' }, userId: 'u1' } });
    global.game.actors.get.mockReturnValue(actor);
    global.sessionStorage.getItem.mockReturnValue('a1');
    global.document.querySelector = () => ({}); // Studio already open: resume returns before opening
    await offerResumeOnReady();
    expect(global.sessionStorage.removeItem).toHaveBeenCalled();
    expect(global.window.location.reload).not.toHaveBeenCalled();
  });
});

describe('L3: a GM only counts actors listed with OWNER', () => {
  it('ignores another player\'s build for a GM', () => {
    const flag = { picks: { race: 'r' }, userId: 'u2' };
    const playersBuild = fakeActor({ flag, ownership: { u2: 3, default: 0 } });
    const gmsBuild = fakeActor({ id: 'a2', flag, ownership: { u1: 3 } });
    global.game.actors.contents = [playersBuild, gmsBuild];
    expect(findResumableActors({ id: 'u1' })).toEqual([gmsBuild]);
  });
});

describe('L4: one login dialog per user', () => {
  function userWith(flagStore, sid) {
    return {
      user: {
        id: 'u1',
        getFlag: vi.fn(() => flagStore.value),
        setFlag: vi.fn(async (s, k, v) => { flagStore.value = v; })
      },
      sid
    };
  }

  it('the first browser wins, a second one within the window stays quiet', async () => {
    const store = { value: undefined };
    const a = userWith(store, 'sA');
    global.game.user = a.user;
    global.game.sessionId = 'sA';
    const first = claimOffer({ id: 'a1' }, { settleMs: 10 });
    await vi.advanceTimersByTimeAsync(20);
    expect(await first).toBe(true);
    global.game.sessionId = 'sB';
    expect(await claimOffer({ id: 'a1' }, { settleMs: 10 })).toBe(false);
  });

  it('when both write at once only the last writer shows it', async () => {
    const store = { value: undefined };
    global.game.user = userWith(store, 'sA').user;
    global.game.sessionId = 'sA';
    const pa = claimOffer({ id: 'a1' }, { settleMs: 50 });
    store.value = { actorId: 'a1', sessionId: 'sB', at: Date.now() }; // the other browser wrote last
    await vi.advanceTimersByTimeAsync(60);
    expect(await pa).toBe(false);
  });
});

describe('L5: the flag is cleared once', () => {
  it('a second clear after the first is a no-op', async () => {
    const actor = fakeActor({ flag: { picks: { race: 'r' } } });
    await clearPendingCreationWhenIdle(actor);
    await clearPendingCreationWhenIdle(actor);
    expect(actor.unsetFlag).toHaveBeenCalledTimes(1);
  });
});

describe('L6: an unresolvable pick does not count as queued', () => {
  it('reports it, queues the rest and keeps the flag', async () => {
    const actor = fakeActor({
      id: 'a6',
      flag: { picks: { race: 'Compendium.x.gone', background: 'Compendium.x.sage' }, userId: 'u1' }
    });
    global.fromUuid.mockImplementation(async (u) => (u.endsWith('gone') ? null : { name: 'Sage', type: 'background', uuid: u }));
    const left = await applyResume({ actor, stores: fakeStores(), dropItemRegistry: {} });
    expect([...left]).toEqual(['background']);
    expect(left.unresolved).toEqual(['race']);
    expect(ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining('race'));
    expect([...queueCreationItems.mock.calls[0][0].skipIds]).toEqual(['race']);
    // the queue ends: clearing must not mark the build finished
    await clearPendingCreationWhenIdle(actor);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  it('with nothing else left, keeps the flag and queues nothing', async () => {
    const actor = fakeActor({ id: 'a7', flag: { picks: { race: 'Compendium.x.gone' }, userId: 'u1' } });
    global.fromUuid.mockResolvedValue(null);
    const left = await applyResume({ actor, stores: fakeStores(), dropItemRegistry: {} });
    expect(left.length).toBe(0);
    expect(left.unresolved).toEqual(['race']);
    expect(queueCreationItems).not.toHaveBeenCalled();
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
