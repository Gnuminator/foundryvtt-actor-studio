/**
 * Helpers for the custom spell picker used by dnd5e ItemChoice advancements that grant spells
 * (Magic Initiate, Druidic Warrior and similar). They keep the picker's rules out of the Svelte
 * component so they can be tested without Foundry.
 */

/**
 * The 2024 backgrounds that grant Magic Initiate with a named spell list (Acolyte: Cleric, Guide:
 * Druid, Sage: Wizard). The Magic Initiate item in the books is one generic feat that allows all
 * three lists, so the background is the only place the list is known. Kept books checked on
 * 2026-11-08: dnd5e origins24 (Acolyte, Sage) and the PHB module (Acolyte, Guide, Sage); no other
 * background grants Magic Initiate. A background that grants it without a named list is simply
 * not in this table and keeps all three lists.
 */
export const MAGIC_INITIATE_BACKGROUND_LISTS = Object.freeze({
  acolyte: 'class:cleric',
  guide: 'class:druid',
  sage: 'class:wizard'
});

/** The spell list a background fixes for its Magic Initiate, or null. */
export function magicInitiateListForBackground(backgroundName) {
  const key = String(backgroundName ?? '').trim().toLowerCase();
  return MAGIC_INITIATE_BACKGROUND_LISTS[key] ?? null;
}

/**
 * The spell list to force for a Magic Initiate spell step, or null when the feat was chosen freely
 * (or is not Magic Initiate), so the advancement's own lists apply.
 * The feat counts as the background's when its advancement origin points at a background item on
 * the actor; without an origin flag the background in `fallbackBackground` (Actor Studio's own
 * pick) is used.
 * @param {object} flow dnd5e ItemChoiceFlow
 * @param {object|null} [fallbackBackground] the background Actor Studio has selected
 * @returns {string|null} for example "class:wizard"
 */
export function resolveMagicInitiateList(flow, fallbackBackground = null) {
  const feat = flow?.advancement?.item ?? flow?.item;
  if (!/^magic initiate/i.test(String(feat?.name ?? ''))) return null;

  const origin = feat?.flags?.dnd5e?.advancementOrigin ?? feat?.getFlag?.('dnd5e', 'advancementOrigin');
  if (typeof origin === 'string' && origin) {
    const originItemId = origin.split('.')[0];
    const actor = feat?.parent ?? flow?.advancement?.item?.actor ?? flow?.actor;
    const source = actor?.items?.get?.(originItemId);
    if (source) return source.type === 'background' ? magicInitiateListForBackground(source.name) : null;
    // The origin item is not on the actor yet: only Actor Studio's own background counts, and only
    // when the origin points at it. Any other origin means the feat was chosen freely.
    const fallbackIds = [fallbackBackground?.id, fallbackBackground?._id].filter(Boolean);
    return fallbackIds.includes(originItemId) ? magicInitiateListForBackground(fallbackBackground?.name) : null;
  }
  return magicInitiateListForBackground(fallbackBackground?.name);
}

/** True for an ItemChoice advancement whose items are spells. */
export function isSpellChoiceAdvancement(advancement) {
  return advancement?.type === 'ItemChoice' && advancement?.configuration?.type === 'spell';
}

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value[Symbol.iterator] === 'function') return Array.from(value);
  return [];
};

/**
 * Turn the advancement's restrictions into plain values.
 * `restriction.level` is a string: "" (any), "0".."9", "available" or "availableNoCantrips".
 * @param {object} config  advancement.configuration
 * @param {number} maxSlot highest spell slot level the flow reports
 * @returns {{minLevel: number, maxLevel: number, lists: string[], schools: string[]}}
 */
export function readSpellRestriction(config, maxSlot = 9) {
  const restriction = config?.restriction ?? {};
  const level = restriction.level ?? '';
  let minLevel = 0;
  let maxLevel = 9;
  if (level === 'available') {
    maxLevel = maxSlot;
  } else if (level === 'availableNoCantrips') {
    minLevel = 1;
    maxLevel = maxSlot;
  } else if (level !== '' && !Number.isNaN(Number(level))) {
    minLevel = maxLevel = Number(level);
  }
  return {
    minLevel,
    maxLevel,
    lists: toArray(restriction.list),
    schools: toArray(restriction.school)
  };
}

/**
 * True when the spell is on at least one of the restriction's spell lists ("class:wizard").
 * Returns true when no list is named or when the registry knows none of them (homebrew list names),
 * so a missing registry never hides every spell.
 */
export function onRestrictionLists(spell, lists, registry) {
  if (!lists.length || !registry?.forType) return true;
  let known = false;
  for (const entry of lists) {
    const [type, id] = String(entry).split(':');
    const list = registry.forType(type, id);
    if (!list) continue;
    known = true;
    const identifier = spell.system?.identifier;
    if (list.uuids?.has(spell.uuid) || (identifier && list.identifiers?.has(identifier))) return true;
  }
  return !known;
}

const keyOf = (spell) => spell.system?.identifier || String(spell.name ?? '').toLowerCase();

/**
 * The spells the picker offers.
 * @param {object[]} spells        index entries of the configured spell packs (uuid, name, system.level ...)
 * @param {object} options
 * @param {object} options.config  advancement.configuration
 * @param {number} options.maxSlot flow._maxSpellSlotLevel()
 * @param {object|null} options.registry dnd5e.registry.spellLists
 * @param {Iterable<string>} [options.chosenUuids] spells already picked in this advancement
 * @param {Iterable<string>} [options.chosenKeys]  identifiers or lower-case names of those spells
 * @param {string|null} [options.listOverride] one spell list ("class:wizard") that replaces the advancement's lists
 */
export function filterSpellChoices(spells, { config, maxSlot, registry = null, chosenUuids = [], chosenKeys = [], listOverride = null }) {
  const { minLevel, maxLevel, lists: configLists, schools } = readSpellRestriction(config, maxSlot);
  const lists = listOverride ? [listOverride] : configLists;
  const poolUuids = new Set(toArray(config?.pool).map((p) => p?.uuid).filter(Boolean));
  const chosenU = new Set(chosenUuids);
  const chosenK = new Set(chosenKeys);
  const seen = new Set();
  const result = [];

  for (const spell of spells) {
    if (spell.type && spell.type !== 'spell') continue;
    const level = Number(spell.system?.level ?? 0);
    if (level < minLevel || level > maxLevel) continue;
    if (poolUuids.size && !poolUuids.has(spell.uuid)) continue;
    if (schools.length) {
      const school = spell.system?.school;
      if (school && !schools.includes(school)) continue;
    }
    if (!onRestrictionLists(spell, lists, registry)) continue;
    const key = keyOf(spell);
    if (chosenU.has(spell.uuid) || chosenK.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(spell);
  }

  return result.sort((a, b) => (Number(a.system?.level ?? 0) - Number(b.system?.level ?? 0)) || String(a.name).localeCompare(String(b.name)));
}

export { keyOf as spellChoiceKey };
