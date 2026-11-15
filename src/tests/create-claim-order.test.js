/**
 * Quiet start (fork): the player claim runs after the resume flag is saved (PR 11 L1).
 */
import { describe, it, expect, vi } from 'vitest';

describe('createActorInGameAndEmbedItems: claim after savePendingCreation', () => {
  it('saves the pending creation before claiming the character', async () => {
    vi.resetModules();
    const order = [];
    vi.doMock('~/src/helpers/CharacterResume', () => ({
      savePendingCreation: vi.fn(async () => { order.push('save'); })
    }));
    vi.doMock('~/src/helpers/claimCharacter', () => ({
      claimAsPlayerCharacter: vi.fn(async () => { order.push('claim'); })
    }));
    const created = { id: 'new1', type: 'character' };
    global.Actor = { create: vi.fn(async () => created) };
    const { createActorInGameAndEmbedItems } = await import('~/src/lib/workflow.js');
    // tests/setup.js mocks svelte/store: get() returns whatever the test sets
    const { get } = await import('svelte/store');
    get.mockReturnValue({ toObject: () => ({ name: 'Hero' }) });
    const actor = {};
    const stores = { actorInGame: { set: vi.fn() } };
    // queueCreationItems reads the stores for picks; empty stores queue nothing
    await createActorInGameAndEmbedItems({ actor, stores, dropItemRegistry: { add: vi.fn(), queue: [] } }).catch((e) => e);
    expect(order).toEqual(['save', 'claim']);
  });
});
