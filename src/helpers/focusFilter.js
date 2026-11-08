/**
 * Keep only the focus items that belong to a starting-equipment focus key
 * ("holy", "arcane", "druidic"), using CONFIG.DND5E.focusTypes[key].itemIds.
 *
 * Items are matched on their `_id` (the last segment of a uuid), because the id is the same in
 * every pack that carries the item. When the key is unknown, or none of the items match (a pack
 * that uses other ids), the list is returned unchanged so the player is never left with nothing.
 *
 * @param {Array<{_id?: string, value?: string, uuid?: string}>} items focus items, already filtered by property
 * @param {string} key focus key from the class starting equipment
 * @param {object} [focusTypes] CONFIG.DND5E.focusTypes
 * @returns {Array} filtered items
 */
export function filterFocusItemsByType(items, key, focusTypes = globalThis.CONFIG?.DND5E?.focusTypes) {
  const itemIds = focusTypes?.[key]?.itemIds;
  if (!itemIds || !Array.isArray(items)) return items;

  const wanted = new Set(Object.values(itemIds).map(String));
  if (!wanted.size) return items;

  const idOf = (item) => {
    if (item?._id) return String(item._id);
    const uuid = item?.value ?? item?.uuid;
    return typeof uuid === 'string' ? uuid.split('.').pop() : undefined;
  };

  const matches = items.filter((item) => wanted.has(idOf(item)));
  return matches.length ? matches : items;
}
