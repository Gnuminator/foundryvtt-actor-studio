/**
 * Helpers for the custom spell picker used by dnd5e ItemChoice advancements that grant spells
 * (Magic Initiate, Druidic Warrior and similar). They keep the picker's rules out of the Svelte
 * component so they can be tested without Foundry.
 */

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
 */
export function filterSpellChoices(spells, { config, maxSlot, registry = null, chosenUuids = [], chosenKeys = [] }) {
  const { minLevel, maxLevel, lists, schools } = readSpellRestriction(config, maxSlot);
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
