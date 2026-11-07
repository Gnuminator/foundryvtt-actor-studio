/**
 * Resume a character whose advancements were not finished (aitool.7).
 *
 * Create Character makes the world actor at once, but dnd5e adds the species, background, class and
 * subclass items only as each advancement finishes. Closing the window or losing the connection in
 * between leaves a bare actor. At creation we store the picks (compendium UUIDs) in an actor flag;
 * resuming replays the queue for the picks that are not on the actor yet. The flag is cleared when
 * the queue has run to its end.
 */
import { get } from 'svelte/store';
import { MODULE_ID } from '~/src/helpers/constants';

export const PENDING_FLAG = 'pendingCreation';
export const PICK_IDS = ['race', 'subRace', 'background', 'characterClass', 'characterSubClass'];

/** Reads the picks from the stores (documents with a uuid) into a plain object. */
export function collectPicks(stores) {
  const picks = {};
  for (const id of PICK_IDS) {
    const store = stores?.[id];
    if (!store) continue;
    const doc = get(store);
    if (doc && typeof doc === 'object' && doc.uuid) picks[id] = doc.uuid;
  }
  return picks;
}

/** Stores the picks on the actor. Never throws: a failure only costs the resume option. */
export async function savePendingCreation(actor, stores) {
  try {
    const picks = collectPicks(stores);
    if (!actor || Object.keys(picks).length === 0) return false;
    await actor.setFlag(MODULE_ID, PENDING_FLAG, {
      version: 1,
      userId: game.user?.id ?? null,
      savedAt: Date.now(),
      picks
    });
    return true;
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] could not save pending creation flag', error);
    return false;
  }
}

export async function clearPendingCreation(actor) {
  try {
    if (actor?.getFlag?.(MODULE_ID, PENDING_FLAG) !== undefined) {
      await actor.unsetFlag(MODULE_ID, PENDING_FLAG);
    }
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] could not clear pending creation flag', error);
  }
}

export function getPendingCreation(actor) {
  const flag = actor?.getFlag?.(MODULE_ID, PENDING_FLAG);
  if (!flag || typeof flag !== 'object' || !flag.picks) return null;
  return flag;
}

/** True when an owned item on the actor came from this compendium uuid. */
export function actorHasItemFrom(actor, uuid) {
  if (!actor?.items || !uuid) return false;
  return actor.items.some((item) => {
    const sources = [
      item?._stats?.compendiumSource,
      item?.flags?.core?.sourceId,
      item?.flags?.[MODULE_ID]?.sourceUuid
    ];
    return sources.includes(uuid);
  });
}

/** Queue ids whose item is already on the actor (finished before the interruption). */
export function finishedPickIds(actor, picks) {
  const done = new Set();
  for (const [id, uuid] of Object.entries(picks || {})) {
    if (actorHasItemFrom(actor, uuid)) done.add(id);
  }
  return done;
}

/** Actors the user may resume: their own unfinished builds (a GM sees every unfinished build). */
export function findResumableActors(user = game.user) {
  return (game.actors?.contents ?? []).filter((actor) => {
    if (actor.type !== 'character') return false;
    const pending = getPendingCreation(actor);
    if (!pending) return false;
    return actor.testUserPermission(user, 'OWNER');
  });
}

const RELOAD_KEY = 'gas-resume-actor-id';

/**
 * dnd5e keeps the advancement manager of a closed Studio window registered (hidden, same id as the
 * next one), and a fresh manager for the same actor then mixes up with it. Closing it from here is
 * not reliable, so a stale one means a page reload (done by resumeActorStudio).
 */
function hasStaleAdvancementApp(actorId) {
  const instances = foundry?.applications?.instances;
  if (!instances?.values) return false;
  return [...instances.values()].some((app) => /AdvancementManager/.test(app?.constructor?.name ?? '')
    && (!actorId || app?.actor?.id === actorId));
}

/** Opens Actor Studio on an unfinished actor. */
export async function resumeActorStudio(actorId) {
  const actor = game.actors?.get(actorId);
  if (!actor || !getPendingCreation(actor)) {
    ui.notifications?.warn('This character has nothing to resume.');
    return false;
  }
  if (document.querySelector('#foundryvtt-actor-studio-pc-sheet')) {
    ui.notifications?.error('Actor Studio is already open. Close it first, then resume the character.');
    return false;
  }
  if (hasStaleAdvancementApp(actor.id)) {
    //- reload; offerResumeOnReady picks the actor up again straight away
    try { sessionStorage.setItem(RELOAD_KEY, actor.id); } catch (e) { /* ignore */ }
    ui.notifications?.info('Reloading the page to clear the unfinished advancement, then resuming ' + actor.name + '.');
    setTimeout(() => window.location.reload(), 600);
    return true;
  }
  const { resetStores } = await import('~/src/stores/index');
  const { default: PCApplication } = await import('~/src/app/PCApplication.js');
  resetStores();
  new PCApplication(actor, false, true).render(true, { focus: true });
  return true;
}

/**
 * Called by the Studio shell when it opens in resume mode. Fills the stores from the stored picks,
 * queues what is missing and returns the queue ids it queued (empty: nothing left to do).
 */
export async function applyResume({ actor, stores, dropItemRegistry }) {
  const pending = getPendingCreation(actor);
  if (!pending) return [];
  const { queueCreationItems } = await import('~/src/lib/workflow');
  const done = finishedPickIds(actor, pending.picks);

  for (const id of PICK_IDS) {
    const uuid = pending.picks[id];
    const store = stores[id];
    if (!uuid || !store) continue;
    try {
      const doc = await fromUuid(uuid);
      if (doc) store.set(doc);
    } catch (error) {
      window.GAS?.log?.w?.('[RESUME] could not load pick', id, uuid, error);
    }
  }

  stores.actorInGame.set(actor);
  const { workflowFSMContext } = await import('~/src/helpers/WorkflowStateMachine');
  workflowFSMContext.actor = actor;
  stores.isActorCreated?.set?.(true);

  const left = PICK_IDS.filter((id) => pending.picks[id] && !done.has(id));
  if (left.length === 0) {
    await clearPendingCreation(actor);
    return [];
  }
  queueCreationItems({ createdActor: actor, stores, dropItemRegistry, skipIds: done });
  return left;
}

/** Ask the player on login whether to resume each of their unfinished builds. */
export async function offerResumeOnReady() {
  try {
    let forced = null;
    try { forced = sessionStorage.getItem(RELOAD_KEY); sessionStorage.removeItem(RELOAD_KEY); } catch (e) { /* ignore */ }
    if (forced && game.actors?.get(forced) && getPendingCreation(game.actors.get(forced))) {
      await resumeActorStudio(forced);
      return;
    }
    const mine = findResumableActors().filter((actor) => {
      const pending = getPendingCreation(actor);
      return pending.userId === game.user.id;
    });
    if (mine.length === 0) return;
    const actor = mine[0];
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    const content = `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> was not finished. `
      + 'Resume building this character in Actor Studio? You will answer the unfinished choices again.</p>';
    let yes = false;
    if (DialogV2?.confirm) {
      yes = await DialogV2.confirm({
        window: { title: 'Resume your character' },
        content,
        yes: { label: 'Resume' },
        no: { label: 'Later' }
      });
    } else {
      yes = await Dialog.confirm({ title: 'Resume your character', content });
    }
    if (yes) await resumeActorStudio(actor.id);
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] ready offer failed', error);
  }
}

/** Adds a "Resume" bar to the top of a character sheet for an unfinished build. */
export function addResumeBanner(app, html) {
  try {
    const actor = app?.actor ?? app?.document;
    if (!actor || !getPendingCreation(actor)) return;
    if (!actor.testUserPermission(game.user, 'OWNER')) return;
    const root = html instanceof HTMLElement ? html : (html?.[0] ?? app?.element);
    const host = root?.querySelector?.('.window-content') ?? root;
    if (!host || host.querySelector('.gas-resume-banner')) return;
    const bar = document.createElement('div');
    bar.className = 'gas-resume-banner';
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 10px;margin:0 0 4px;background:#7a3b00;color:#fff;border-radius:4px;position:relative;z-index:1000;';
    const text = document.createElement('span');
    text.textContent = 'This character was not finished.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Resume in Actor Studio';
    button.style.cssText = 'width:auto;flex:none;';
    button.addEventListener('click', async (ev) => {
      ev.preventDefault();
      resumeActorStudio(actor.id);
      app.close?.();
    });
    bar.append(text, button);
    host.prepend(bar);
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] banner failed', error);
  }
}
