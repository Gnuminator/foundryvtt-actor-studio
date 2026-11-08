/**
 * Keep only the focus items that belong to a starting-equipment focus key
 * ("holy", "arcane", "druidic"), using CONFIG.DND5E.focusTypes[key].itemIds.
 *
 * dnd5e stores full compendium uuids there (Compendium.dnd5e.equipment24.Item.phbhsyAmuletworn).
 * Items are matched on the last uuid segment, which is the same in every pack that copies the
 * item (the Player's Handbook module), and on the item name, which also catches the dnd5e SRD
 * pack where the same focus has another id. When the key is unknown, or nothing matches, the
 * list is returned unchanged so the player is never left with nothing.
 *
 * @param {Array<{_id?: string, value?: string, uuid?: string, label?: string, name?: string}>} items focus items, already filtered by property
 * @param {string} key focus key from the class starting equipment
 * @param {object} [focusTypes] CONFIG.DND5E.focusTypes
 * @param {(uuid: string) => {name?: string}|null} [resolve] looks a uuid up for its name
 * @returns {Array} filtered items
 */
export function filterFocusItemsByType(items, key, focusTypes = globalThis.CONFIG?.DND5E?.focusTypes, resolve = globalThis.fromUuidSync) {
  const itemIds = focusTypes?.[key]?.itemIds;
  if (!itemIds || !Array.isArray(items)) return items;

  const uuids = Object.values(itemIds).map(String);
  const wantedIds = new Set(uuids.map((uuid) => uuid.split('.').pop()));
  if (!wantedIds.size) return items;

  const wantedNames = new Set();
  for (const uuid of uuids) {
    let name;
    try { name = resolve?.(uuid)?.name; } catch (err) { name = undefined; }
    if (typeof name === 'string' && name) wantedNames.add(name.toLowerCase());
  }

  const idOf = (item) => {
    if (item?._id) return String(item._id);
    const uuid = item?.value ?? item?.uuid;
    return typeof uuid === 'string' ? uuid.split('.').pop() : undefined;
  };
  const nameOf = (item) => String(item?.name ?? item?.label ?? '').toLowerCase();

  const matches = items.filter((item) => wantedIds.has(idOf(item)) || wantedNames.has(nameOf(item)));
  return matches.length ? matches : items;
}
