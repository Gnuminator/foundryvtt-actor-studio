/**
 * L145c cosmetics: level-1 advancement subtitle stays plain, award and loose @ tokens read as text.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAdvancementSubtitleLevel } from '../hooks/captureAdvancement.js';
import { resolveAwardTokens, resolveLooseTextTokens } from '../helpers/Utility.js';

const makeElement = (text) => {
  const node = { text };
  const wrapped = {
    text: (value) => {
      if (value === undefined) return node.text;
      node.text = value;
      return wrapped;
    }
  };
  globalThis.$ = () => wrapped;
  return {
    el: { length: 1, find: () => ({ length: 1, each: (fn) => fn(0, node) }) },
    node
  };
};

describe('advancement subtitle level', () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
  });

  it('leaves "Level 1" alone when a hero is created', () => {
    const { el, node } = makeElement('Wizard • Level 1 • Step 1 of 6');
    normalizeAdvancementSubtitleLevel(el, { app: { actor: { items: [{ type: 'class', name: 'Wizard', system: { levels: 1 } }] } } });
    expect(node.text).toBe('Wizard • Level 1 • Step 1 of 6');
  });

  it('still shows the progression on a level up', () => {
    const { el, node } = makeElement('Cleric • Level 2 • Step 1 of 4');
    normalizeAdvancementSubtitleLevel(el, { app: { actor: { items: [{ type: 'class', name: 'Cleric', system: { levels: 1 } }] } } });
    expect(node.text).toBe('Cleric • Level 1 -> 2 • Step 1 of 4');
  });
});

describe('loose description tokens', () => {
  it('turns an award enricher into plain text', () => {
    expect(resolveAwardTokens('Gold: [[/award 7GP]] or [[/award 110 gp]]')).toBe('Gold: 7 GP or 110 GP');
  });

  it('names the ability and the proficiency bonus', () => {
    expect(resolveLooseTextTokens('Uses your @abilities.wis.mod, plus @prof', { wis: 'Wisdom' }))
      .toBe('Uses your Wisdom modifier, plus your Proficiency Bonus');
    expect(resolveLooseTextTokens('Add your @prof twice', {})).toBe('Add your Proficiency Bonus twice');
  });

  it('leaves other text alone', () => {
    expect(resolveLooseTextTokens('No tokens here')).toBe('No tokens here');
  });
});
