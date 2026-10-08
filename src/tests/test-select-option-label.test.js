import { describe, it, expect } from 'vitest';
import { stripSourceLabels } from '~/src/helpers/selectOptionLabel.js';

// aitool: the option label in IconSelect stripped ", subtitle" a second time, so the species list
// still showed "Elf, Drow" / "Elf, High" / "Elf, Wood" as three "Elf" entries after the pack
// extractor had kept them apart.

describe('stripSourceLabels', () => {
  it('keeps lineage names on labels the pack extractor already cleaned', () => {
    expect(stripSourceLabels('Elf, High', true)).toBe('Elf, High');
    expect(stripSourceLabels('Gnome, Forest', true)).toBe('Gnome, Forest');
  });

  it('still removes bracket tags on cleaned labels', () => {
    expect(stripSourceLabels('Elf, High (PHB)', true)).toBe('Elf, High');
  });

  it('strips ", subtitle" and bracket tags on other labels as before', () => {
    expect(stripSourceLabels("Fighter, Tasha's")).toBe('Fighter');
    expect(stripSourceLabels('Shield [GMO]')).toBe('Shield');
    expect(stripSourceLabels('Point Buy')).toBe('Point Buy');
  });

  it('returns an empty string for a missing label', () => {
    expect(stripSourceLabels(undefined, true)).toBe('');
    expect(stripSourceLabels('')).toBe('');
  });
});
