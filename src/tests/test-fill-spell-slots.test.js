import { describe, expect, it, vi } from 'vitest';
import { fillSpellSlots } from '~/src/helpers/fillSpellSlots.js';

describe('fillSpellSlots', () => {
  it('sets every slot with a max to its max', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const actor = {
      update,
      system: {
        spells: {
          spell1: { value: 0, max: 2 },
          spell2: { value: 1, max: 1 },
          spell3: { value: 0, max: 0 },
          pact: { value: 0, max: 1 }
        }
      }
    };
    expect(await fillSpellSlots(actor)).toBe(true);
    expect(update).toHaveBeenCalledWith({
      'system.spells.spell1.value': 2,
      'system.spells.pact.value': 1
    });
  });

  it('refills a levelled-up hero: partly used old slots and new empty slot levels (level 1 to 5)', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const actor = {
      update,
      system: {
        spells: {
          spell1: { value: 2, max: 4 },
          spell2: { value: 0, max: 3 },
          spell3: { value: 0, max: 2 },
          spell4: { value: 0, max: 0 },
          pact: { value: 0, max: 0 }
        }
      }
    };
    expect(await fillSpellSlots(actor)).toBe(true);
    expect(update).toHaveBeenCalledWith({
      'system.spells.spell1.value': 4,
      'system.spells.spell2.value': 3,
      'system.spells.spell3.value': 2
    });
  });

  it('fills multiclass slots and pact slots together, and leaves full slots alone', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const actor = {
      update,
      system: {
        spells: {
          spell1: { value: 4, max: 4 },
          spell2: { value: 1, max: 3 },
          pact: { value: 0, max: 2 }
        }
      }
    };
    expect(await fillSpellSlots(actor)).toBe(true);
    expect(update).toHaveBeenCalledWith({
      'system.spells.spell2.value': 3,
      'system.spells.pact.value': 2
    });
    update.mockClear();
    const full = { update, system: { spells: { spell1: { value: 4, max: 4 } } } };
    expect(await fillSpellSlots(full)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('does nothing for actors without slots', async () => {
    const update = vi.fn();
    expect(await fillSpellSlots({ update, system: { spells: { spell1: { value: 0, max: 0 } } } })).toBe(false);
    expect(await fillSpellSlots({ update, system: {} })).toBe(false);
    expect(await fillSpellSlots(null)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
