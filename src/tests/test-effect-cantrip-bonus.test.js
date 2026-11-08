import { describe, expect, it } from 'vitest';
import { getEffectCantripBonus } from '~/src/helpers/spellProgression.js';

const cantripAdvancement = {
  type: 'ScaleValue',
  title: 'Cantrips Known',
  level: 1,
  configuration: { identifier: 'cantrips-known', type: 'number', scale: { 1: { value: 3 }, 4: { value: 4 } } }
};

const classItem = { system: { identifier: 'cleric', advancement: [cantripAdvancement] } };

const makeActor = (liveValue, levels = 1) => ({
  system: { scale: { cleric: { 'cantrips-known': { value: liveValue } } } },
  items: [{ type: 'class', name: 'Cleric', system: { identifier: 'cleric', levels, advancement: [cantripAdvancement] } }]
});

describe('getEffectCantripBonus', () => {
  it('is 1 for a Thaumaturge (effect adds +1 to cantrips known)', () => {
    expect(getEffectCantripBonus({ actor: makeActor(4), classIdentifier: 'cleric', classItem })).toBe(1);
  });

  it('is 0 when the live value equals the class advancement', () => {
    expect(getEffectCantripBonus({ actor: makeActor(3), classIdentifier: 'cleric', classItem })).toBe(0);
  });

  it('counts any effect, here +2, and reads the class level the actor has', () => {
    expect(getEffectCantripBonus({ actor: makeActor(6, 4), classIdentifier: 'cleric', classItem })).toBe(2);
  });

  it('is 0 when the actor has no class item yet or no scale group', () => {
    expect(getEffectCantripBonus({ actor: { system: { scale: {} }, items: [] }, classIdentifier: 'cleric', classItem })).toBe(0);
    expect(getEffectCantripBonus({ actor: null, classIdentifier: 'cleric', classItem })).toBe(0);
  });
});
