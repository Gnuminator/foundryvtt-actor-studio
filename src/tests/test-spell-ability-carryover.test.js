import { beforeEach, describe, vi, expect, it } from 'vitest';
import {
  applyRememberedSpellAbility,
  recordSpellAbility,
  resetSpellAbilityCarry
} from '~/src/helpers/spellAbilityCarry';

const makeSelect = (value) => ({
  value,
  options: [{ value: 'int' }, { value: 'wis' }, { value: 'cha' }]
});

describe('spell ability carry-over', () => {
  beforeEach(() => resetSpellAbilityCarry());

  it('preselects the ability picked on the first step', () => {
    recordSpellAbility('feat-1', 'wis');
    const select = makeSelect('int');
    expect(applyRememberedSpellAbility('feat-1', select)).toBe(true);
    expect(select.value).toBe('wis');
  });

  it('leaves the select alone when nothing was picked or it already matches', () => {
    const fresh = makeSelect('int');
    expect(applyRememberedSpellAbility('feat-1', fresh)).toBe(false);
    recordSpellAbility('feat-1', 'int');
    expect(applyRememberedSpellAbility('feat-1', fresh)).toBe(false);
  });

  it('keeps separate feats apart', () => {
    recordSpellAbility('feat-1', 'wis');
    const select = makeSelect('int');
    expect(applyRememberedSpellAbility('feat-2', select)).toBe(false);
    expect(select.value).toBe('int');
  });

  it('ignores an ability the next select does not offer', () => {
    recordSpellAbility('feat-1', 'str');
    const select = makeSelect('int');
    expect(applyRememberedSpellAbility('feat-1', select)).toBe(false);
  });

  it('lets the player change it again, and the newest pick wins', () => {
    recordSpellAbility('feat-1', 'wis');
    recordSpellAbility('feat-1', 'cha');
    const select = makeSelect('int');
    applyRememberedSpellAbility('feat-1', select);
    expect(select.value).toBe('cha');
  });
});

describe('watchSpellAbility observer', () => {
  it('disconnects once the element is gone', async () => {
    const { watchSpellAbility } = await import('~/src/helpers/spellAbilityCarry');
    const disconnect = vi.fn();
    let callback;
    globalThis.MutationObserver = class {
      constructor(cb) { callback = cb; }
      observe() {}
      disconnect() { disconnect(); }
    };
    const root = { addEventListener() {}, querySelector: () => null, isConnected: true };
    watchSpellAbility(root, () => 'feat-1');
    callback();
    expect(disconnect).not.toHaveBeenCalled();
    root.isConnected = false;
    callback();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
