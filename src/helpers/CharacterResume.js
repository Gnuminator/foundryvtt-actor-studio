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

/** Actor ids whose resume skipped a pick that could not be found: the build is not finished, so the flag stays (L6). */
const keepFlag = new Set();

export async function clearPendingCreation(actor) {
  try {
    if (actor?.id && keepFlag.has(actor.id)) return;
    if (actor?.getFlag?.(MODULE_ID, PENDING_FLAG) !== undefined) {
      await actor.unsetFlag(MODULE_ID, PENDING_FLAG);
    }
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] could not clear pending creation flag', error);
  }
}

/** True while a dnd5e advancement window is still on the page (it is removed from the DOM when it closes). */
export function advancementsStillOpen() {
  try {
    return !!document.querySelector('.application.dnd5e2.advancement.manager');
  } catch (error) { return false; }
}

const clearWatchers = new Set();

/**
 * The queue is empty: clear the flag, but not while advancement windows are still open (with
 * disableAdvancementCapture the queue runs through without waiting for them, L1). Then wait until
 * they are gone; if Actor Studio itself is closed first the flag stays, so the build can be resumed.
 */
export async function clearPendingCreationWhenIdle(actor, { intervalMs = 1000 } = {}) {
  if (!actor) return false;
  if (!advancementsStillOpen()) {
    await clearPendingCreation(actor);
    return true;
  }
  if (!actor.id || clearWatchers.has(actor.id)) return false;
  clearWatchers.add(actor.id);
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      const studioGone = !document.getElementById(STUDIO_ROOT_ID);
      if (advancementsStillOpen() && !studioGone) return;
      clearInterval(timer);
      clearWatchers.delete(actor.id);
      if (advancementsStillOpen()) { resolve(false); return; }
      await clearPendingCreation(actor);
      resolve(true);
    }, intervalMs);
  });
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

/** An owned item without a source marker (hand-added or migrated) that has the pick's name and type (L2). */
export function actorHasItemLike(actor, doc) {
  if (!actor?.items || !doc?.name || !doc?.type) return false;
  return actor.items.some((item) => item?.name === doc.name && item?.type === doc.type);
}

/**
 * Queue ids whose item is already on the actor (finished before the interruption). By source marker;
 * with the loaded pick documents also by name and type.
 */
export function finishedPickIds(actor, picks, docs = {}) {
  const done = new Set();
  for (const [id, uuid] of Object.entries(picks || {})) {
    if (actorHasItemFrom(actor, uuid) || actorHasItemLike(actor, docs[id])) done.add(id);
  }
  return done;
}

/** True when the user holds OWNER in the actor's ownership list (a GM's implicit ownership does not count). */
function ownsActor(actor, user) {
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  if (actor?.ownership && user?.id) return (actor.ownership[user.id] ?? 0) >= owner;
  return !!actor?.testUserPermission?.(user, 'OWNER');
}

/** Actors the user may resume: unfinished builds the user owns (a GM is not counted for other players' builds). */
export function findResumableActors(user = game.user) {
  return (game.actors?.contents ?? []).filter((actor) => {
    if (actor.type !== 'character') return false;
    const pending = getPendingCreation(actor);
    if (!pending) return false;
    return ownsActor(actor, user);
  });
}

const RELOAD_KEY = 'gas-resume-actor-id';
const STUDIO_ROOT_ID = 'foundryvtt-actor-studio-pc-sheet';

/**
 * Set when Studio was closed while a build was still unfinished. The closed window's queue loop keeps
 * polling and would mix with a new queue in this page, so a resume then always reloads the page first.
 */
let closedUnfinished = false;

/** Hook for gas.close: remember that a window closed with an unfinished build behind it. */
export function noteStudioClosed() {
  try {
    const open = findResumableActors();
    if (open.length > 0) closedUnfinished = true;
    //- the sheet may render while the Studio window is still in the page (the bar stays hidden then): draw it again
    setTimeout(() => {
      for (const actor of open) {
        try { if (actor.sheet?.rendered) actor.sheet.render(); } catch (e) { /* ignore */ }
      }
    }, 800);
  } catch (error) { /* ignore */ }
}

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
export async function resumeActorStudio(actorId, { afterReload = false } = {}) {
  const actor = game.actors?.get(actorId);
  if (!actor || !getPendingCreation(actor)) {
    ui.notifications?.warn('This character has nothing to resume.');
    return false;
  }
  if (!actor.testUserPermission?.(game.user, 'OWNER')) {
    ui.notifications?.warn('You do not own this character, so you cannot resume it.');
    return false;
  }
  if (document.querySelector('#foundryvtt-actor-studio-pc-sheet')) {
    ui.notifications?.error('Actor Studio is already open. Close it first, then resume the character.');
    return false;
  }
  //- afterReload: this page was just reloaded for this resume; reloading again could loop (L3)
  if (!afterReload && (closedUnfinished || hasStaleAdvancementApp(actor.id))) {
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
  const docs = {};
  const unresolved = [];

  for (const id of PICK_IDS) {
    const uuid = pending.picks[id];
    const store = stores[id];
    if (!uuid || !store) continue;
    let doc = null;
    try {
      doc = await fromUuid(uuid);
    } catch (error) {
      window.GAS?.log?.w?.('[RESUME] could not load pick', id, uuid, error);
    }
    if (doc) {
      docs[id] = doc;
      store.set(doc);
    } else {
      unresolved.push(id);
    }
  }
  const done = finishedPickIds(actor, pending.picks, docs);
  //- an item that is already on the actor needs no document; only a missing one is a problem (L6)
  const missing = unresolved.filter((id) => !done.has(id));
  if (missing.length) {
    if (actor.id) keepFlag.add(actor.id);
    ui.notifications?.warn('Could not find the saved choice for: ' + missing.join(', ')
      + '. It was skipped, and this character stays open to resume. Ask the GM to add it by hand.');
  }

  stores.actorInGame.set(actor);
  const { workflowFSMContext } = await import('~/src/helpers/WorkflowStateMachine');
  workflowFSMContext.actor = actor;
  stores.isActorCreated?.set?.(true);

  const left = PICK_IDS.filter((id) => pending.picks[id] && !done.has(id) && !missing.includes(id));
  if (left.length === 0) {
    await clearPendingCreation(actor);
    return Object.assign([], { unresolved: missing });
  }
  //- do not queue what cannot be found: skip it like a finished item
  queueCreationItems({ createdActor: actor, stores, dropItemRegistry, skipIds: new Set([...done, ...missing]) });
  return Object.assign(left, { unresolved: missing });
}

const OFFER_FLAG = 'resumeOffer';
const OFFER_WINDOW_MS = 60000;
const OFFER_SETTLE_MS = 800;

/**
 * The same user may be logged in from two browsers; only one of them shows the dialog (L4). Each writes
 * a claim with its own session id; after a short wait the browser whose id is in the flag shows it.
 */
export async function claimOffer(actor, { settleMs = OFFER_SETTLE_MS } = {}) {
  try {
    const user = game.user;
    const sid = game.sessionId ?? null;
    if (!user?.getFlag || !user?.setFlag || !sid) return true;
    const now = Date.now();
    const existing = user.getFlag(MODULE_ID, OFFER_FLAG);
    if (existing && existing.actorId === actor.id && existing.sessionId !== sid && now - existing.at < OFFER_WINDOW_MS) {
      return false;
    }
    await user.setFlag(MODULE_ID, OFFER_FLAG, { actorId: actor.id, sessionId: sid, at: now });
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    return user.getFlag(MODULE_ID, OFFER_FLAG)?.sessionId === sid;
  } catch (error) {
    return true;
  }
}

/** Ask the player on login whether to resume each of their unfinished builds. */
export async function offerResumeOnReady() {
  try {
    let forced = null;
    try { forced = sessionStorage.getItem(RELOAD_KEY); sessionStorage.removeItem(RELOAD_KEY); } catch (e) { /* ignore */ }
    if (forced && game.actors?.get(forced) && getPendingCreation(game.actors.get(forced))) {
      await resumeActorStudio(forced, { afterReload: true });
      return;
    }
    const mine = findResumableActors().filter((actor) => {
      const pending = getPendingCreation(actor);
      return pending.userId === game.user.id;
    });
    if (mine.length === 0) return;
    const actor = mine[0];
    if (!(await claimOffer(actor))) return;
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
    const root = html instanceof HTMLElement ? html : (html?.[0] ?? app?.element);
    const host = root?.querySelector?.('.window-content') ?? root;
    //- no bar while Studio is building this character, and none once the saved picks are gone
    const hide = !actor || !getPendingCreation(actor)
      || !actor.testUserPermission(game.user, 'OWNER')
      || !!document.getElementById(STUDIO_ROOT_ID);
    if (hide) {
      host?.querySelectorAll?.('.gas-resume-banner').forEach((el) => el.remove());
      return;
    }
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
      if (await resumeActorStudio(actor.id)) app.close?.();
    });
    bar.append(text, button);
    host.prepend(bar);
  } catch (error) {
    window.GAS?.log?.w?.('[RESUME] banner failed', error);
  }
}
