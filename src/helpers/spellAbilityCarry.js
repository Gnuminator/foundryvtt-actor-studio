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
 * The spellcasting ability of the character's class (or subclass), as a dnd5e ability key.
 * Looks at the class picked in Studio, then at class and subclass items already on the actor.
 * @param {object[]} sources candidate items (class documents, subclass documents)
 * @returns {string|null}
 */
export const spellcastingAbilityFrom = (sources) => {
  for (const item of sources ?? []) {
    const ability = item?.system?.spellcasting?.ability;
    if (typeof ability === 'string' && ability) return ability;
  }
  return null;
};

/**
 * Preselect the remembered ability on a freshly shown select.
 * @returns {boolean} true when the select was changed (the caller sends its change event)
 */
export const applyRememberedSpellAbility = (key, select, fallback = null) => {
  // Nothing picked yet: start on the class's own spellcasting ability (a Cleric gets Wisdom, not the
  // first option in the list, Intelligence). The player can still change it.
  const value = remembered.get(key) ?? fallback;
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
 * @param {() => string|null} [getFallback] the ability to start on when nothing was picked yet
 */
export const watchSpellAbility = (root, getKey, getFallback = () => null) => {
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
    if (applyRememberedSpellAbility(getKey(), select, getFallback())) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => {
      // The advancement dialog was closed and its element dropped: stop watching.
      if (root.isConnected === false) {
        observer.disconnect();
        return;
      }
      apply();
    });
    observer.observe(root, { childList: true, subtree: true });
  }
  apply();
};
