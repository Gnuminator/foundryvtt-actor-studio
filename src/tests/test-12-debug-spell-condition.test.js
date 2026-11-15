import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

let stateMachinePromise;
// one import for the whole file, made while the mocks below are registered
const loadStateMachine = () => (stateMachinePromise ??= import('~/src/helpers/WorkflowStateMachine.js'));

describe('Debug Shopping Spell Selection Condition', () => {
  let mockGame, mockActor, mockBardClass, mockGet;

  beforeEach(() => {
    // Set up FoundryVTT globals
    global.game = {
      settings: {
        get: vi.fn((module, key) => {
          if (key === 'enableSpellSelection') return true;
          return false;
        })
      }
    };

    global.window = global;
    global.window.GAS = { log: { d: vi.fn() } };

    // Mock a complete bard actor exactly as it would be persisted
    mockBardClass = {
      name: 'Bard',
      system: {
        spellcasting: {
          progression: 'full'
        }
      }
    };

    mockActor = {
      name: 'Test Bard Character',
      id: 'actor-123',
      type: 'character',
      classes: {
        bard: mockBardClass
      },
      sheet: { render: vi.fn() }
    };

    // Mock get function to return our actor from actorInGame store
    mockGet = vi.fn((store) => {
      return mockActor;
    });

    const mockWritable = (value) => ({ 
      set: vi.fn(), 
      update: vi.fn(), 
      subscribe: vi.fn(),
      toString: () => `writable(${JSON.stringify(value)})`
    });

    vi.doMock('svelte/store', () => ({ 
      writable: mockWritable,
      derived: vi.fn(() => ({ subscribe: vi.fn() })),
      get: mockGet
    }));

    // Partial mock: other modules in the import graph (equipmentGold) read more stores from here, and which
    // of them get loaded varies with timing in a full run (the flake was a missing export)
    vi.doMock('~/src/stores/storeDefinitions', async (importOriginal) => ({
      ...(await importOriginal()),
      actorInGame: mockWritable(mockActor)
    }));

    // Mock other required modules
    vi.doMock('~/src/stores/index', () => ({
      preAdvancementSelections: mockWritable({}),
      dropItemRegistry: { advanceQueue: vi.fn(() => Promise.resolve()) },
      tabs: mockWritable([]),
      readOnlyTabs: mockWritable([]),
      activeTab: mockWritable('shop'),
      getCoreCreationReadOnlyTabs: vi.fn((includeBiography = false) => (
        includeBiography
          ? ['race', 'class', 'background', 'abilities', 'biography']
          : ['race', 'class', 'background', 'abilities']
      ))
    }));
    vi.doMock('~/src/stores/startingEquipment', () => ({ compatibleStartingEquipment: mockWritable([]) }));
    vi.doMock('~/src/lib/workflow.js', () => ({ handleAdvancementCompletion: vi.fn() }));
    vi.doMock('~/src/helpers/AdvancementManager', () => ({ destroyAdvancementManagers: vi.fn() }));
    vi.doMock('~/src/helpers/constants', () => ({ MODULE_ID: 'foundryvtt-actor-studio' }));
  });

  afterEach(() => {
    vi.resetAllMocks();
    // The mocks stay registered (no doUnmock, no resetModules): the state machine is imported once and its
    // import graph may still be loading lazily; unmocking between tests made the second test see real modules (the full-run flake)
  });

  it('should debug exactly what happens in the _shouldShowSpellSelection function', async () => {
    const { workflowFSMContext } = await loadStateMachine();
    // the mocked get itself: importing svelte/store here sometimes returned the real module in a full run (the flake)
    const get = mockGet;
    const { actorInGame } = await import('~/src/stores/storeDefinitions');

    // Step 1: Check if enableSpellSelection is working
    const enableSpellSelection = global.game.settings.get('foundryvtt-actor-studio', 'enableSpellSelection');
    console.log('enableSpellSelection:', enableSpellSelection);
    expect(enableSpellSelection).toBe(true);

    // Step 2: Check if get(actorInGame) returns our mock actor
    const currentActor = get(actorInGame);
    console.log('currentActor from get(actorInGame):', currentActor);
    expect(currentActor).toBeDefined();
    expect(currentActor.id).toBe('actor-123');

    // Step 3: Test the _shouldShowSpellSelection function directly
    const shouldShow = workflowFSMContext._shouldShowSpellSelection(currentActor);
    console.log('shouldShow result:', shouldShow);
    
    // Debug the function step by step
    console.log('currentActor.classes:', currentActor.classes);
    console.log('Object.keys(currentActor.classes):', Object.keys(currentActor.classes || {}));
    
    const classes = currentActor.classes || {};
    const classKeys = Object.keys(classes);
    console.log('classKeys:', classKeys);
    
    if (classKeys.length > 0) {
      const spellcastingInfo = Object.entries(classes).map(([className, classData]) => {
        const progression = classData?.system?.spellcasting?.progression;
        console.log(`Class ${className} progression:`, progression);
        return { className, progression, isSpellcaster: progression && progression !== "none" };
      });
      console.log('spellcastingInfo:', spellcastingInfo);
      
      const isSpellcaster = spellcastingInfo.some(info => info.isSpellcaster);
      console.log('isSpellcaster from progression:', isSpellcaster);
      
      if (!isSpellcaster) {
        const knownSpellcastingClasses = [
          'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
          'artificer', 'aberrantmind', 'arcanetrickster', 'eldritchknight', 'trickster'
        ];
        const hasKnownSpellcastingClass = classKeys.some(className => knownSpellcastingClasses.includes(className.toLowerCase()));
        console.log('hasKnownSpellcastingClass:', hasKnownSpellcastingClass);
      }
    }

    // This should be true for a bard
    expect(shouldShow).toBe(true);
  }, 20000); // the first import of the state machine is slow when the whole suite runs in parallel

  it('should test the exact condition as used in the shopping state', async () => {
    const { workflowFSMContext } = await loadStateMachine();
    // the mocked get itself: importing svelte/store here sometimes returned the real module in a full run (the flake)
    const get = mockGet;
    const { actorInGame } = await import('~/src/stores/storeDefinitions');

    // This is the exact condition from the shopping state
    const currentActor = get(actorInGame);
    const shouldShow = workflowFSMContext._shouldShowSpellSelection(currentActor);
    
    console.log('Shopping state condition - currentActor:', currentActor);
    console.log('Shopping state condition - shouldShow:', shouldShow);
    
    // Debug the mockGet function behavior
    expect(mockGet).toHaveBeenCalled();
    console.log('mockGet call count:', mockGet.mock.calls.length);
    console.log('mockGet calls:', mockGet.mock.calls);

    expect(shouldShow).toBe(true);
  });
});
