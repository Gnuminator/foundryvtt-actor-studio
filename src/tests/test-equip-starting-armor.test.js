import { describe, vi, expect, it } from 'vitest';
import { armorSlot, equipStartingArmor } from '~/src/helpers/equipStartingArmor';

const armor = (type, equipped = false) => ({
  type: 'equipment',
  name: type,
  system: { type: { value: type }, equipped },
  update: vi.fn().mockResolvedValue(undefined)
});

describe('equipStartingArmor', () => {
  it('classifies body armor, shields and everything else', () => {
    expect(armorSlot(armor('light'))).toBe('body');
    expect(armorSlot(armor('heavy'))).toBe('body');
    expect(armorSlot(armor('shield'))).toBe('shield');
    expect(armorSlot(armor('trinket'))).toBeNull();
    expect(armorSlot({ type: 'weapon', system: {} })).toBeNull();
    expect(armorSlot(null)).toBeNull();
  });

  it('equips one body armor and one shield, leaving the rest', async () => {
    const taken = { body: false, shield: false };
    const mail = armor('heavy');
    const leather = armor('light');
    const shield = armor('shield');
    const amulet = armor('trinket');
    expect(await equipStartingArmor(mail, taken)).toBe(true);
    expect(await equipStartingArmor(leather, taken)).toBe(false);
    expect(await equipStartingArmor(shield, taken)).toBe(true);
    expect(await equipStartingArmor(amulet, taken)).toBe(false);
    expect(mail.update).toHaveBeenCalledWith({ 'system.equipped': true });
    expect(leather.update).not.toHaveBeenCalled();
    expect(amulet.update).not.toHaveBeenCalled();
  });

  it('does nothing for an already equipped item or a failed update', async () => {
    const taken = { body: false, shield: false };
    expect(await equipStartingArmor(armor('light', true), taken)).toBe(false);
    const broken = armor('medium');
    broken.update.mockRejectedValue(new Error('x'));
    expect(await equipStartingArmor(broken, taken)).toBe(false);
    expect(taken.body).toBe(false);
  });
});
