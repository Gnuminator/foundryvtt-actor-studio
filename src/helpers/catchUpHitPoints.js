/**
 * aitool fix: a Constitution increase while levelling raises the hit point maximum for every level the hero has
 * (2024 Player's Handbook, "Gaining a Level"), but dnd5e only adds the new level's own hit points to the current
 * value. A fighter who reaches a higher Constitution modifier at level 12 ended level 17 at 145 of 157, a new
 * hero that was not whole. The book changes the maximum only, so damage already taken stays taken: a hero that
 * was at full hit points before the level up ends it at full hit points, any other hero keeps its current value.
 *
 * Call snapshotHitPoints before the class level changes and catchUpHitPoints once the level up is done.
 */

/**
 * @param {Actor} actor
 * @returns {{value: number, max: number} | null}
 */
export function snapshotHitPoints(actor) {
  const hp = actor?.system?.attributes?.hp;
  if (!hp) return null;
  const value = Number(hp.value);
  const max = Number(hp.max);
  if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
  return { value, max };
}

/**
 * Brings a hero that was at full hit points before the level up back to full. Never lowers the value.
 *
 * @param {Actor} actor
 * @param {{value: number, max: number} | null} before  The snapshot from before the level up.
 * @returns {Promise<number>} How many hit points were added (0 when nothing changed).
 */
export async function catchUpHitPoints(actor, before) {
  try {
    const after = snapshotHitPoints(actor);
    if (!before || !after || typeof actor.update !== 'function') return 0;
    if (before.value < before.max) return 0;
    if (after.value >= after.max) return 0;
    await actor.update({ 'system.attributes.hp.value': after.max });
    return after.max - after.value;
  } catch (error) {
    window.GAS?.log?.w?.('[LEVELUP] Could not fill the current hit points after the level up', error);
    return 0;
  }
}
