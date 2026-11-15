import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  global.foundry = { utils: { deepClone: (o) => JSON.parse(JSON.stringify(o)) } };
  global.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
  global.window = globalThis;
  window.GAS = { log: { d: vi.fn(), w: vi.fn(), e: vi.fn(), i: vi.fn() }, close: vi.fn() };
});

describe('catchUpHitPoints: tempmax and a rejecting update', () => {
  it('counts the temporary maximum change in the ceiling', async () => {
    const { snapshotHitPoints, catchUpHitPoints } = await import('~/src/helpers/catchUpHitPoints.js');
    const actor = {
      system: { attributes: { hp: { value: 100, max: 112, tempmax: 5 } } },
      update: vi.fn().mockResolvedValue(undefined)
    };
    expect(snapshotHitPoints(actor)).toEqual({ value: 100, max: 117 });
    expect(await catchUpHitPoints(actor, { value: 92, max: 92 })).toBe(17);
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 117 });
  });

  it('treats a negative tempmax as a lower ceiling', async () => {
    const { snapshotHitPoints } = await import('~/src/helpers/catchUpHitPoints.js');
    const actor = { system: { attributes: { hp: { value: 50, max: 60, tempmax: -10 } } } };
    expect(snapshotHitPoints(actor)).toEqual({ value: 50, max: 50 });
  });

  it('returns 0 and warns when the update rejects', async () => {
    const { catchUpHitPoints } = await import('~/src/helpers/catchUpHitPoints.js');
    const actor = {
      system: { attributes: { hp: { value: 100, max: 112 } } },
      update: vi.fn().mockRejectedValue(new Error('locked'))
    };
    await expect(catchUpHitPoints(actor, { value: 92, max: 92 })).resolves.toBe(0);
    expect(window.GAS.log.w).toHaveBeenCalled();
  });
});

describe('level up state machine: hitPointsBefore lifecycle', () => {
  async function load() {
    vi.doMock('~/src/helpers/AdvancementManager', () => ({
      destroyAdvancementManagers: vi.fn(),
      AdvancementManager: class {}
    }));
    const mod = await import('~/src/helpers/LevelUpStateMachine.js');
    return mod;
  }

  it('takes the snapshot on entering selecting_class_level and clears it when reset to idle', async () => {
    const { createLevelUpStateMachine, levelUpFSMContext } = await load();
    levelUpFSMContext.actor = { system: { attributes: { hp: { value: 40, max: 40, tempmax: 2 } } } };
    const fsm = createLevelUpStateMachine();
    fsm.handle('start_level_up');
    expect(levelUpFSMContext.hitPointsBefore).toEqual({ value: 40, max: 42 });
    fsm.handle('reset');
    expect(fsm.getCurrentState()).toBe('idle');
    expect(levelUpFSMContext.hitPointsBefore).toBeNull();
  });

  it('clears the snapshot when the machine ends in the error state', async () => {
    const { createLevelUpStateMachine, levelUpFSMContext } = await load();
    levelUpFSMContext.actor = { system: { attributes: { hp: { value: 40, max: 40 } } } };
    const fsm = createLevelUpStateMachine();
    fsm.handle('start_level_up');
    expect(levelUpFSMContext.hitPointsBefore).not.toBeNull();
    fsm.handle('error');
    expect(fsm.getCurrentState()).toBe('error');
    expect(levelUpFSMContext.hitPointsBefore).toBeNull();
  });
});

describe('level up state machine: completed handler restores full hit points', () => {
  async function drive({ clearDuringFill = false } = {}) {
    vi.doMock('~/src/helpers/AdvancementManager', () => ({
      destroyAdvancementManagers: vi.fn(),
      AdvancementManager: class {}
    }));
    let ctx;
    vi.doMock('~/src/helpers/fillSpellSlots', () => ({
      // a reset reaching idle while the slots fill nulls the snapshot (PR 14 L1)
      fillSpellSlots: vi.fn(async () => { if (clearDuringFill) ctx.hitPointsBefore = null; })
    }));
    const closed = new Promise((resolve) => { global.Hooks = { call: vi.fn(resolve) }; });
    global.game = { actors: { get: () => null }, modules: { get: () => null }, settings: { get: () => undefined } };
    const { createLevelUpStateMachine, levelUpFSMContext } = await import('~/src/helpers/LevelUpStateMachine.js');
    ctx = levelUpFSMContext;
    const { dropItemRegistry } = await import('~/src/stores/index');
    dropItemRegistry.advanceQueue = vi.fn().mockResolvedValue(true);

    // full hit points before (42 of 40 + 2 tempmax), a Constitution rise leaves current below the new maximum after the level up
    const hp = { value: 42, max: 40, tempmax: 2 };
    const actor = {
      system: { attributes: { hp } },
      update: vi.fn().mockResolvedValue(undefined),
      getFlag: () => undefined,
      sheet: { render: vi.fn().mockResolvedValue(undefined) }
    };
    ctx.actor = actor;
    const fsm = createLevelUpStateMachine();
    fsm.handle('start_level_up');
    expect(ctx.hitPointsBefore).toEqual({ value: 42, max: 42 });
    hp.max = 52; // new maximum after the level up, value unchanged
    fsm.handle('class_level_selected');
    await closed; // gas.close is the last step of the completed handler
    return { actor, fsm, ctx };
  }

  it('reaches completed and sets the current hit points to the effective maximum (max + tempmax)', async () => {
    const { actor, fsm, ctx } = await drive();
    expect(fsm.getCurrentState()).toBe('completed');
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 54 });
    expect(ctx.hitPointsBefore).toBeNull();
  }, 10000);

  it('still catches up when the snapshot is nulled during the slot fill (captured before the first await)', async () => {
    const { actor } = await drive({ clearDuringFill: true });
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 54 });
  }, 10000);
});
