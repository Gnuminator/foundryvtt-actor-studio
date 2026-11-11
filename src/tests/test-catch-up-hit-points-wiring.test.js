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
