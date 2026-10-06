/**
 * Fills a freshly built character's spell slots (and pact slots) to their maximum.
 *
 * dnd5e only recovers slots on a rest, so a hero Studio has just built would otherwise start with every
 * slot empty and slot-spending features would refuse until a long rest. This mirrors what dnd5e's own
 * Actor5e#_getRestSpellRecovery writes: system.spells.<key>.value = max.
 *
 * @param {Actor} actor  The newly created actor.
 * @returns {Promise<boolean>} True when an update was made.
 */
export async function fillSpellSlots(actor) {
  try {
    const spells = actor?.system?.spells;
    if (!spells || typeof actor.update !== 'function') return false;

    const updates = {};
    for (const [key, slot] of Object.entries(spells)) {
      const max = Number(slot?.max ?? 0);
      if (max > 0 && Number(slot?.value ?? 0) < max) {
        updates[`system.spells.${key}.value`] = max;
      }
    }
    if (Object.keys(updates).length === 0) return false;

    await actor.update(updates);
    return true;
  } catch (error) {
    window.GAS?.log?.w?.('[WORKFLOW] Could not fill spell slots for the new character', error);
    return false;
  }
}
