import { describe, it, expect } from 'vitest';
import { hideSupersededItems, nameKey } from '~/src/helpers/editionFilter';

const mk = (label, identifier, rules, packId = 'world.player-species') => ({
  label,
  system: { identifier, source: { rules } },
  packId
});
const labels = (items) => items.map((i) => i.label);

describe('nameKey', () => {
  it('ignores word order, punctuation, "the" and case', () => {
    expect(nameKey('High Elf')).toBe(nameKey('Elf, High'));
    expect(nameKey('Tiefling (Abyssal)')).toBe(nameKey('Tiefling, Abyssal'));
    expect(nameKey('Circle of Stars')).toBe(nameKey('Circle of the Stars'));
    expect(nameKey("Tasha's Hideous Laughter")).toBe(nameKey('Tashas Hideous Laughter'));
  });
});

describe('hideSupersededItems', () => {
  it('hides a 2014 entry with the same identifier as a 2024 entry', () => {
    const out = hideSupersededItems([mk('Bless', 'bless', '2014'), mk('Bless', 'bless', '2024')]);
    expect(out).toHaveLength(1);
    expect(out[0].system.source.rules).toBe('2024');
  });

  it('hides a 2014 entry whose name matches after normalising', () => {
    const out = hideSupersededItems([
      mk('Forest Gnome', 'forest-gnome', '2014'),
      mk('Gnome, Forest', 'gnome-forest', '2024')
    ]);
    expect(labels(out)).toEqual(['Gnome, Forest']);
  });

  it('keeps a 2014 entry that has no 2024 version', () => {
    const items = [mk('Grave Domain', 'grave', '2014'), mk('Life Domain', 'life', '2024')];
    expect(hideSupersededItems(items)).toEqual(items);
  });

  it('keeps both when the 2024 twin is in another pack', () => {
    const items = [mk('Bless', 'bless', '2014', 'a'), mk('Bless', 'bless', '2024', 'b')];
    expect(hideSupersededItems(items)).toHaveLength(2);
  });

  it('keeps a 2014 entry when its 2024 twin was already narrowed out of the list', () => {
    const items = [mk('Shield', 'shield', '2014')];
    expect(hideSupersededItems(items)).toEqual(items);
  });

  it('keeps entries without a rules edition', () => {
    const items = [mk('Bless', 'bless', ''), mk('Bless', 'bless', '2024')];
    expect(hideSupersededItems(items)).toHaveLength(2);
  });

  it('hides renamed subclasses through the explicit pair list', () => {
    const out = hideSupersededItems(
      [
        mk('Aberrant Mind', 'aberrant-mind', '2014'),
        mk('Aberrant Sorcery', 'aberrant', '2024'),
        mk('Clockwork Soul', 'clockwork-soul', '2014'),
        mk('Clockwork Sorcery', 'clockwork', '2024'),
        mk('Way of Mercy', 'way-of-mercy', '2014'),
        mk('Warrior of Mercy', 'mercy', '2024'),
        mk('Draconic Sorcery', 'draconic', '2024')
      ],
      undefined
    );
    expect(labels(out)).toEqual(['Aberrant Sorcery', 'Clockwork Sorcery', 'Warrior of Mercy', 'Draconic Sorcery']);
  });

  it('a pair only fires when its replacement is in the list', () => {
    const items = [mk('Aberrant Mind', 'aberrant-mind', '2014')];
    expect(hideSupersededItems(items)).toEqual(items);
  });

  it('hides the duplicate 2024 Warrior of the Open Hand', () => {
    const out = hideSupersededItems([
      mk('Warrior of the Open Hand', 'open-hand', '2024'),
      mk('Warrior of the Open Hand', 'hand', '2024')
    ]);
    expect(out.map((i) => i.system.identifier)).toEqual(['hand']);
  });

  it('does not treat a shared identifier across different classes as a twin when lists are class narrowed', () => {
    const barbarian = [mk('Path of the Beast', 'beast', '2014')];
    expect(hideSupersededItems(barbarian)).toEqual(barbarian);
  });

  it('passes short or invalid input through', () => {
    expect(hideSupersededItems([])).toEqual([]);
    expect(hideSupersededItems(null)).toBeNull();
  });
});

describe('Ebbe (Grave cleric) picks stay offered', () => {
  it('keeps Grave Domain next to 2024 domains and the 2024 Forest Gnome', () => {
    const subclasses = [
      mk('Grave Domain', 'grave', '2014', 'world.player-subclasses'),
      mk('Life Domain', 'life', '2024', 'world.player-subclasses'),
      mk('Life Domain', 'life', '2014', 'world.player-subclasses'),
      mk('Light Domain', 'light', '2024', 'world.player-subclasses')
    ];
    expect(labels(hideSupersededItems(subclasses))).toEqual(['Grave Domain', 'Life Domain', 'Light Domain']);
    const species = [mk('Forest Gnome', 'forest-gnome', '2014'), mk('Gnome, Forest', 'gnome-forest', '2024')];
    expect(labels(hideSupersededItems(species))).toEqual(['Gnome, Forest']);
  });

  it('never hides anything when no entry carries rules 2024', () => {
    const items = [mk('Shield', 'shield', '2014'), mk('Shield', 'shield', undefined), mk('Mind Sliver', 'mind-sliver', '')];
    expect(hideSupersededItems(items)).toEqual(items);
  });
});

describe('requireName (feats)', () => {
  it('keeps a 2014 feat whose identifier matches a 2024 feat of another name', () => {
    const items = [mk('Magic Initiate', 'magic-initiate', '2014', 'p'), mk('Magic Initiate (Wizard)', 'magic-initiate', '2024', 'p')];
    expect(hideSupersededItems(items, { requireName: true })).toEqual(items);
    expect(labels(hideSupersededItems(items))).toEqual(['Magic Initiate (Wizard)']);
  });
});

describe('cleaned labels (M4)', () => {
  it('does not match a 2014 entry through a cleaned label that equals a 2024 name', () => {
    const items = [
      { label: 'Aasimar', rawLabel: 'Aasimar (MotM)', system: { identifier: 'aasimar-motm', source: { rules: '2014' } }, packId: 'p' },
      { label: 'Aasimar', rawLabel: 'Aasimar', system: { identifier: 'aasimar', source: { rules: '2024' } }, packId: 'p' }
    ];
    expect(hideSupersededItems(items)).toEqual(items);
  });
});
