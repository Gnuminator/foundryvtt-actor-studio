// Starting armor and shields arrive unequipped from Item.create. Equip one body armor and one shield.
const BODY_ARMOR = new Set(['light', 'medium', 'heavy']);

/** Returns 'body', 'shield' or null for a created item. */
export function armorSlot(item) {
  if (!item || item.type !== 'equipment') return null;
  const t = item.system?.type?.value;
  if (BODY_ARMOR.has(t)) return 'body';
  if (t === 'shield') return 'shield';
  return null;
}

/**
 * Equip a created starting item when it is body armor or a shield and the slot is still free.
 * `taken` is a { body, shield } object shared across the loop. Returns true when it equipped.
 */
export async function equipStartingArmor(item, taken) {
  const slot = armorSlot(item);
  if (!slot || taken[slot] || item.system?.equipped === true) return false;
  try {
    await item.update({ 'system.equipped': true });
    taken[slot] = true;
    return true;
  } catch (e) {
    window.GAS?.log?.w?.('[WORKFLOW] Could not equip starting armor', item.name, e);
    return false;
  }
}
