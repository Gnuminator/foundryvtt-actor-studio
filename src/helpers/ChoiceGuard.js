/**
 * Choice guard (fork): the dnd5e advancement window lets Next and Complete through while a counter such as
 * "Chosen: 0 of 1" or "Select 2 more Languages" is still open. This reads those counters from the window's own
 * text and, when one is unsatisfied, asks before the click goes through. "Continue anyway" always works, so a
 * step that cannot be satisfied never traps anyone.
 */

const COUNTER_KEYS = {
  chosen: 'DND5E.ADVANCEMENT.ItemChoice.Chosen',
  remaining: 'DND5E.ADVANCEMENT.Trait.ChoicesRemaining'
};

const FALLBACK = {
  chosen: 'Chosen: {current} of {max}',
  remaining: 'Select {count} more {type}'
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const localized = (kind) => {
  try {
    const text = game?.i18n?.localize?.(COUNTER_KEYS[kind]);
    if (text && text !== COUNTER_KEYS[kind]) return text;
  } catch (e) {
    // fall through to the English text
  }
  return FALLBACK[kind];
};

/** Turn "Chosen: {current} of {max}" into a regex that captures each placeholder. */
export const patternFor = (template) => {
  const names = [];
  const source = escapeRegex(template)
    .replace(/\\\{(\w+)\\\}/g, (_, name) => {
      names.push(name);
      return name === 'type' ? '[^\\n]*?' : '(\\d+)';
    })
    .replace(/\s+/g, '\\s+');
  return { regex: new RegExp(source, 'gi'), names: names.filter((n) => n !== 'type') };
};

/**
 * Open counters in the text of one advancement window.
 * @returns {Array<{kind: string, current?: number, max?: number, count?: number, text: string}>}
 */
export const findOpenCounters = (text) => {
  const found = [];
  const source = String(text ?? '');
  for (const kind of ['chosen', 'remaining']) {
    const { regex, names } = patternFor(localized(kind));
    for (const match of source.matchAll(regex)) {
      const values = {};
      names.forEach((name, i) => { values[name] = Number(match[i + 1]); });
      if (kind === 'chosen' && values.current < values.max) {
        found.push({ kind, current: values.current, max: values.max, text: match[0].trim() });
      }
      if (kind === 'remaining' && values.count > 0) {
        found.push({ kind, count: values.count, text: match[0].trim() });
      }
    }
  }
  return found;
};

const askToContinue = async (counters) => {
  const lines = counters.map((c) => c.text).join('; ');
  const content = `<p>This step still has choices open: <strong>${lines.replace(/</g, '&lt;')}</strong>.</p>`
    + '<p>Go back and finish them, or continue anyway if there is nothing more to pick here.</p>';
  const title = 'Choices still open';
  try {
    const V2 = foundry?.applications?.api?.DialogV2;
    if (V2?.confirm) {
      return !!(await V2.confirm({
        window: { title },
        content,
        yes: { label: 'Continue anyway' },
        no: { label: 'Go back', default: true },
        rejectClose: false
      }));
    }
    return !!(await Dialog.confirm({ title, content, yes: () => true, no: () => false, defaultYes: false }));
  } catch (e) {
    // a dialog that cannot open must not trap the player
    return true;
  }
};

/**
 * Watch Next and Complete in a captured advancement window.
 * The click is stopped in the capture phase while a counter is open; "Continue anyway" replays it once.
 */
export const guardChoiceButtons = (element) => {
  const root = element?.[0] ?? element;
  if (!root || root.dataset?.gasChoiceGuard) return;
  root.dataset.gasChoiceGuard = '1';
  let override = false;
  root.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('button[data-action="next"], button[data-action="complete"]');
    if (!button || override) return;
    const counters = findOpenCounters(root.innerText ?? root.textContent);
    if (!counters.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (await askToContinue(counters)) {
      override = true;
      try {
        button.click();
      } finally {
        override = false;
      }
    }
  }, true);
};

/** True when the character still carries the player's own name, which Studio fills in by default. */
export const nameIsPlayerName = (name, userName) => {
  const a = String(name ?? '').trim().toLowerCase();
  const b = String(userName ?? '').trim().toLowerCase();
  return !!a && !!b && a === b;
};

/**
 * Create Character guard: ask once before creating a character named after the player.
 * @returns {Promise<boolean>} true to go on
 */
export const confirmCharacterName = async (name, userName = globalThis.game?.user?.name) => {
  if (!nameIsPlayerName(name, userName)) return true;
  const V2 = globalThis.foundry?.applications?.api?.DialogV2;
  const content = `<p>The character is still named after you (<strong>${String(name).replace(/</g, '&lt;')}</strong>).</p><p>Create it with that name, or go back and type the character's name?</p>`;
  try {
    if (V2?.confirm) {
      return !!(await V2.confirm({
        window: { title: 'Character name' },
        content,
        yes: { label: 'Create anyway' },
        no: { label: 'Go back', default: true },
        rejectClose: false
      }));
    }
    return !!(await Dialog.confirm({ title: 'Character name', content, yes: () => true, no: () => false, defaultYes: false }));
  } catch (e) {
    return true;
  }
};
