/**
 * Fork change: when a player finishes Create Character and has no character set yet, make the new
 * actor their own (`user.character`), so Foundry stops asking them to pick one in User Configuration.
 * Never overrides a character that is already set.
 *
 * @param {Actor} actor - The actor that was just created in the world
 * @param {User} [user] - Defaults to the current user
 * @returns {Promise<boolean>} true when the character was set
 */
export async function claimAsPlayerCharacter(actor, user = game?.user) {
  try {
    if (!actor || !user) return false;
    if (user.isGM) return false; // GMs have no player character
    if (user.character) return false;
    if (actor.type && actor.type !== 'character') return false;
    await user.update({ character: actor.id });
    return true;
  } catch (e) {
    // A refused update must never break character creation
    console.warn('[GAS] Could not set the player character:', e);
    return false;
  }
}
