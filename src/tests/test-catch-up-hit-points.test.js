import { describe, expect, it, vi } from 'vitest';
import { catchUpHitPoints, snapshotHitPoints } from '~/src/helpers/catchUpHitPoints.js';

const actorWith = (value, max) => ({
  system: { attributes: { hp: { value, max } } },
  update: vi.fn().mockResolvedValue(undefined)
});

describe('catchUpHitPoints', () => {
  it('reads value and max, and nothing from an actor without hit points', () => {
    expect(snapshotHitPoints(actorWith(10, 12))).toEqual({ value: 10, max: 12 });
    expect(snapshotHitPoints({ system: {} })).toBeNull();
    expect(snapshotHitPoints(undefined)).toBeNull();
  });

  it('brings a hero that was whole back to full (fighter level 12: the maximum grew 12 more than the value)', async () => {
    const actor = actorWith(100, 112);
    expect(await catchUpHitPoints(actor, { value: 92, max: 92 })).toBe(12);
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 112 });
  });

  it('does nothing when the hero is already full', async () => {
    const actor = actorWith(100, 100);
    expect(await catchUpHitPoints(actor, { value: 92, max: 92 })).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
  });

  it('leaves a hurt hero alone: damage taken stays taken', async () => {
    const actor = actorWith(78, 112);
    expect(await catchUpHitPoints(actor, { value: 70, max: 92 })).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
  });

  it('does nothing without a snapshot', async () => {
    const actor = actorWith(1, 10);
    expect(await catchUpHitPoints(actor, null)).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
