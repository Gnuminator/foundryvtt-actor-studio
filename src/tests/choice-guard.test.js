/**
 * Choice guard (fork): open "Chosen x of y" and "Select N more" counters are found in the advancement text,
 * satisfied ones are not, and a character named after the player is flagged.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findOpenCounters, patternFor, nameIsPlayerName, confirmCharacterName, guardChoiceButtons } from '~/src/helpers/ChoiceGuard';

beforeEach(() => {
  globalThis.game = { user: { name: 'Gnuminator' }, i18n: { localize: (k) => k } };
});

describe('findOpenCounters', () => {
  it('finds an unsatisfied Chosen counter', () => {
    const found = findOpenCounters('Divine Order\nChosen: 0 of 1\nProtector');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'chosen', current: 0, max: 1 });
  });

  it('ignores a satisfied Chosen counter', () => {
    expect(findOpenCounters('Chosen: 2 of 2')).toEqual([]);
  });

  it('finds "Select N more" and ignores zero', () => {
    const found = findOpenCounters('Select 2 more Languages');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'remaining', count: 2 });
    expect(findOpenCounters('Select 0 more Languages')).toEqual([]);
  });

  it('finds several open counters in one window', () => {
    expect(findOpenCounters('Chosen: 1 of 3 ... Select 1 more Skill Proficiency')).toHaveLength(2);
  });

  it('uses the localized template when there is one', () => {
    game.i18n.localize = (k) => (k.endsWith('ItemChoice.Chosen') ? 'Valgt: {current} af {max}' : k);
    expect(findOpenCounters('Valgt: 0 af 2')).toHaveLength(1);
  });

  it('never throws on empty text', () => {
    expect(findOpenCounters(undefined)).toEqual([]);
    expect(patternFor('x {a}').names).toEqual(['a']);
  });
});

describe('character name', () => {
  it('flags the player name, case insensitive', () => {
    expect(nameIsPlayerName(' gnuminator ', 'Gnuminator')).toBe(true);
    expect(nameIsPlayerName('Thorin', 'Gnuminator')).toBe(false);
    expect(nameIsPlayerName('', 'Gnuminator')).toBe(false);
  });

  it('lets a real name through without asking', async () => {
    expect(await confirmCharacterName('Thorin')).toBe(true);
  });

  it('asks when the name is the player name and honours the answer', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    globalThis.foundry = { applications: { api: { DialogV2: { confirm } } } };
    expect(await confirmCharacterName('Gnuminator')).toBe(false);
    confirm.mockResolvedValue(true);
    expect(await confirmCharacterName('Gnuminator')).toBe(true);
  });
});

describe('guardChoiceButtons', () => {
  // a minimal element: the guard only needs addEventListener, dataset and the window text
  const build = (text) => {
    const handlers = [];
    const button = { click: vi.fn() };
    const root = {
      dataset: {},
      innerText: text,
      addEventListener: (_type, fn) => handlers.push(fn),
      press: () => {
        const event = { target: { closest: () => button }, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
        handlers.forEach((fn) => fn(event));
        return event;
      }
    };
    return { root, button };
  };

  it('blocks Next while a counter is open until "Continue anyway"', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    globalThis.foundry = { applications: { api: { DialogV2: { confirm } } } };
    const { root, button } = build('Chosen: 0 of 1');
    guardChoiceButtons(root);
    const event = root.press();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(button.click).not.toHaveBeenCalled();

    confirm.mockResolvedValue(true);
    root.press();
    await vi.waitFor(() => expect(button.click).toHaveBeenCalledTimes(1));
  });

  it('does not interfere when nothing is open', () => {
    const { root } = build('Chosen: 1 of 1');
    guardChoiceButtons(root);
    expect(root.press().stopImmediatePropagation).not.toHaveBeenCalled();
  });
});
