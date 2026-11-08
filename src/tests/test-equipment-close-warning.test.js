import { describe, expect, it } from 'vitest';
import { shouldWarnOnEquipmentClose } from '~/src/helpers/equipmentCloseWarning';

describe('shouldWarnOnEquipmentClose', () => {
  it('warns on the equipment tab once something is picked, also at 100% before Confirm', () => {
    expect(shouldWarnOnEquipmentClose('equipment', [], 50)).toBe(true);
    expect(shouldWarnOnEquipmentClose('equipment', [], 100)).toBe(true);
  });
  it('stays quiet at 0%, on other tabs and when the tab is read-only', () => {
    expect(shouldWarnOnEquipmentClose('equipment', [], 0)).toBe(false);
    expect(shouldWarnOnEquipmentClose('class', [], 50)).toBe(false);
    expect(shouldWarnOnEquipmentClose('equipment', ['equipment'], 100)).toBe(false);
    expect(shouldWarnOnEquipmentClose('equipment', undefined, 50)).toBe(true);
  });
});
