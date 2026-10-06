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

  it('does nothing for actors without slots', async () => {
    const update = vi.fn();
    expect(await fillSpellSlots({ update, system: { spells: { spell1: { value: 0, max: 0 } } } })).toBe(false);
    expect(await fillSpellSlots({ update, system: {} })).toBe(false);
    expect(await fillSpellSlots(null)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
