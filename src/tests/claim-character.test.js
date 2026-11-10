/**
 * Quiet start (fork): a player without a character gets the new actor as `user.character`;
 * a set character is never overridden; a GM is left alone; a refused update does not throw.
 */
import { describe, it, expect, vi } from 'vitest';
import { claimAsPlayerCharacter } from '~/src/helpers/claimCharacter';

const actor = { id: 'new1', type: 'character' };

function fakeUser({ character = null, isGM = false, update } = {}) {
  return { isGM, character, update: update ?? vi.fn().mockResolvedValue(undefined) };
}

describe('claimAsPlayerCharacter', () => {
  it('sets the new actor when the player has no character', async () => {
    const user = fakeUser();
    expect(await claimAsPlayerCharacter(actor, user)).toBe(true);
    expect(user.update).toHaveBeenCalledWith({ character: 'new1' });
  });

  it('never overrides a character that is already set', async () => {
    const user = fakeUser({ character: { id: 'old' } });
    expect(await claimAsPlayerCharacter(actor, user)).toBe(false);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('leaves a GM alone', async () => {
    const user = fakeUser({ isGM: true });
    expect(await claimAsPlayerCharacter(actor, user)).toBe(false);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('ignores a non-character actor', async () => {
    const user = fakeUser();
    expect(await claimAsPlayerCharacter({ id: 'n', type: 'npc' }, user)).toBe(false);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('does not throw when the update is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = fakeUser({ update: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await claimAsPlayerCharacter(actor, user)).toBe(false);
    warn.mockRestore();
  });

  it('does nothing without an actor or user', async () => {
    expect(await claimAsPlayerCharacter(null, fakeUser())).toBe(false);
    expect(await claimAsPlayerCharacter(actor, null)).toBe(false);
  });
});
