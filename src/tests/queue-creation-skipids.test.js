/**
 * queueCreationItems leaves out the queue ids in skipIds (resume of an unfinished build).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('~/src/helpers/WorkflowStateMachine', () => ({ getWorkflowFSM: vi.fn(), workflowFSMContext: {}, WORKFLOW_EVENTS: {} }));
vi.mock('~/src/helpers/LevelUpStateMachine', () => ({ getLevelUpFSM: vi.fn(), levelUpFSMContext: {}, LEVELUP_EVENTS: {} }));

vi.mock('~/src/helpers/AdvancementManager', () => ({ destroyAdvancementManagers: vi.fn() }));
vi.mock('~/src/stores/index', () => ({ tabs: {}, activeTab: {}, readOnlyTabs: {} }));
vi.mock('~/src/stores/index.js', () => ({ tabs: {}, activeTab: {}, readOnlyTabs: {} }));
vi.mock('~/src/stores/storeDefinitions', () => ({ goldRoll: {} }));
vi.mock('~/src/stores/goldChoices', () => ({ totalGoldFromChoices: vi.fn() }));
vi.mock('~/src/stores/spellSelection.js', () => ({ finalizeSpellSelection: vi.fn(), spellProgress: {}, selectedSpells: {} }));

import { queueCreationItems } from '~/src/lib/workflow';

const doc = (name) => ({ name, system: { advancement: [] } });
const mk = (value) => ({ value, update(fn) { this.value = fn(this.value); }, subscribe(run) { run(this.value); return () => {}; } });

describe('queueCreationItems skipIds', () => {
  it('queues only the picks that are not skipped', () => {
    global.window = global;
    global.window.GAS = { log: { d: vi.fn(), i: vi.fn(), w: vi.fn(), e: vi.fn() } };
    const stores = {
      race: mk(doc('Elf')), subRace: mk(null), background: mk(doc('Sage')),
      characterClass: mk(doc('Wizard')), characterSubClass: mk(null),
      isLevelUp: mk(false), isNewMultiClass: mk(false), preAdvancementSelections: mk({})
    };
    const added = [];
    const registry = { add: (e) => added.push(e.id) };
    queueCreationItems({ createdActor: { id: 'a', system: { details: { level: 0 }, attributes: {} }, items: [] }, stores, dropItemRegistry: registry, skipIds: new Set(['race', 'background']) });
    expect(added).toContain('characterClass');
    expect(added).not.toContain('race');
    expect(added).not.toContain('background');
  });
});
