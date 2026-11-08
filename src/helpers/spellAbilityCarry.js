// Magic Initiate, Gnomish Lineage and similar feats ask for the spellcasting ability on one step and
// again on the next spell step of the same feat. The player picked it once, so carry it over: the
// next step starts on the first step's ability, and the player can still change it.

const remembered = new Map();

/** Forget everything (a new character starts clean). */
export const resetSpellAbilityCarry = () => remembered.clear();

/** Remember the ability a player picked on a select, under the feat or species item that asked. */
export const recordSpellAbility = (key, value) => {
  if (!key || !value) return;
  remembered.set(key, value);
};

/**
 * Preselect the remembered ability on a freshly shown select.
 * @returns {boolean} true when the select was changed (the caller sends its change event)
 */
export const applyRememberedSpellAbility = (key, select) => {
  const value = remembered.get(key);
  if (!value || !select || select.value === value) return false;
  const known = Array.from(select.options ?? []).some((option) => option.value === value);
  if (!known) return false;
  select.value = value;
  return true;
};

/**
 * Wire one advancement element: remember changes, preselect on new selects.
 * @param {HTMLElement} root the element the advancement step lives in
 * @param {() => string|null} getKey the item the current step belongs to
 */
export const watchSpellAbility = (root, getKey) => {
  if (!root || root.gasSpellAbilityCarry) return;
  root.gasSpellAbilityCarry = true;

  root.addEventListener('change', (event) => {
    const select = event.target?.closest?.('select[name="ability"]');
    if (select) recordSpellAbility(getKey(), select.value);
  });

  const apply = () => {
    const select = root.querySelector('select[name="ability"]');
    if (!select || select.gasSpellAbilityApplied) return;
    select.gasSpellAbilityApplied = true;
    if (applyRememberedSpellAbility(getKey(), select)) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  if (typeof MutationObserver === 'function') {
    new MutationObserver(apply).observe(root, { childList: true, subtree: true });
  }
  apply();
};
