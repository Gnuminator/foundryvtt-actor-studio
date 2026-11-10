// aitool: hide a 2014 entry in a picker when a 2024 entry of the same thing is in the same list.
// The compendium packs stay untouched (the user, 2026-11-08); this only trims what a picker shows.
//
// Rules:
// - Callers pass the list the picker would show anyway (already narrowed by class, level, spell list),
//   so a 2014 entry is only hidden when its 2024 twin is really offered. A 2014 entry with no 2024
//   twin (Grave Domain, Magic Initiate spells the 2024 list lacks, MotM species) is never hidden.
// - A twin is: same `system.identifier`, or the same name after normalising (lower case, no
//   punctuation, no "the", words sorted, so "High Elf" equals "Elf, High"), in the same pack.
// - EXPLICIT_PAIRS covers entries that were renamed or spelled differently. It hides the first
//   identifier when the second one is in the list, whatever rules edition either entry carries.

/** 2014 or misspelled identifier -> identifiers of the entry that replaces it. */
export const EXPLICIT_PAIRS = {
  'aberrant-mind': ['aberrant'], // Aberrant Mind -> Aberrant Sorcery
  'clockwork-soul': ['clockwork'], // Clockwork Soul -> Clockwork Sorcery
  'way-of-mercy': ['mercy'], // Way of Mercy -> Warrior of Mercy
  'open-hand': ['hand'], // two 2024 Warrior of the Open Hand entries
  'tiefling-cthonic': ['tiefling-chthonic'], // typo in the 2014 entry
};

/**
 * Normalised comparison key for a name.
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'the')
    .sort()
    .join(' ');
}

const rulesOf = (item) => String(item?.system?.source?.rules ?? '');
const identifierOf = (item) => String(item?.system?.identifier ?? '');
// rawLabel is the name before label cleaning: a cleaned "Aasimar (MotM)" must not equal the 2024 "Aasimar"
const nameOf = (item) => item?.rawLabel ?? item?.label ?? item?.name ?? '';
const packOf = (item) => item?.packId ?? item?.packName ?? '';

/**
 * Drop 2014 entries that a 2024 entry in the same pack supersedes.
 * @param {Array} items picker items carrying `system.identifier` and `system.source.rules`
 * @param {{pairs?: Record<string,string[]>, requireName?: boolean}} [options] requireName: an identifier match also needs the same name (feats)
 * @returns {Array} the items to show, order kept
 */
export function hideSupersededItems(items, { pairs = EXPLICIT_PAIRS, requireName = false } = {}) {
  if (!Array.isArray(items) || items.length < 2) return items;

  const current = new Map(); // pack -> { ids: Set, names: Set } of 2024 entries
  const allIds = new Map(); // pack -> Set of every identifier
  for (const item of items) {
    const pack = packOf(item);
    if (!allIds.has(pack)) allIds.set(pack, new Set());
    if (identifierOf(item)) allIds.get(pack).add(identifierOf(item));
    if (rulesOf(item) !== '2024') continue;
    if (!current.has(pack)) current.set(pack, { ids: new Set(), names: new Set() });
    const entry = current.get(pack);
    if (identifierOf(item)) entry.ids.add(identifierOf(item));
    entry.names.add(nameKey(nameOf(item)));
  }

  return items.filter((item) => {
    const pack = packOf(item);
    const id = identifierOf(item);
    const replacements = pairs?.[id];
    if (replacements?.some((r) => allIds.get(pack)?.has(r))) return false;
    if (rulesOf(item) !== '2014') return true;
    const twins = current.get(pack);
    if (!twins) return true;
    if (id && twins.ids.has(id) && (!requireName || twins.names.has(nameKey(nameOf(item))))) return false;
    return !twins.names.has(nameKey(nameOf(item)));
  });
}
