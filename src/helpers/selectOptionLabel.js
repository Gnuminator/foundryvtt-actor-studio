/**
 * Strip source book identifiers (e.g., "(TCR)", "[GMO]", ", Tasha's") from a select option label.
 *
 * aitool: labels from extractItemsFromPacksSync are already cleaned per pack (it keeps ", Lineage"
 * names such as "Elf, High" when stripping would merge items), so for those (labelCleaned) only the
 * bracket tags are removed here. Stripping ", subtitle" again turned every 2024 elf lineage back
 * into "Elf" in the species list.
 * @param {string} labelText - The option label
 * @param {boolean} [labelCleaned=false] - True when the pack extractor already cleaned the label
 * @returns {string} The label to show
 */
export function stripSourceLabels(labelText, labelCleaned = false) {
  if (!labelText) return '';
  const noTags = labelText.replace(/\s*[\[\(][\w\s]+[\]\)]/g, ''); // Remove [XXX] or (XXX) patterns
  if (labelCleaned) return noTags.trim();
  return noTags
    .replace(/\s*,\s*.*/g, '') // Remove ", subtitle" patterns
    .trim();
}
