/**
 * Subclass guard (aitool.13). Going from level 2 to 3 the level goes up with the class step; the
 * subclass item is added by a second advancement afterwards. Closing Actor Studio in between leaves a
 * level-3 hero with no subclass and no subclass features. When a level-up queues a subclass we keep
 * its uuid on the actor; a banner on the sheet offers to add it until the subclass item is there.
 */
import { MODULE_ID } from '~/src/helpers/constants';

export const PENDING_SUBCLASS_FLAG = 'pendingSubclass';
const RELOAD_KEY = 'gas-subclass-actor-id';
const STUDIO_ROOT_ID = 'foundryvtt-actor-studio-pc-sheet';

/** Stores the queued subclass on the actor. Never throws: a failure only costs the recovery bar. */
export async function savePendingSubclass(actor, subclassDoc) {
  try {
    if (!actor?.setFlag || !subclassDoc?.uuid) return false;
    await actor.setFlag(MODULE_ID, PENDING_SUBCLASS_FLAG, {
      uuid: subclassDoc.uuid,
      name: subclassDoc.name ?? '',
      userId: game.user?.id ?? null,
      savedAt: Date.now()
    });
    return true;
  } catch (error) {
    window.GAS?.log?.w?.('[SUBCLASS GUARD] could not save pending subclass', error);
    return false;
  }
}

/** True when the actor already has a subclass item for this pending record (by source or name). */
export function hasPendingSubclassItem(actor, pending) {
  if (!actor?.items || !pending) return false;
  return actor.items.some((item) => {
    if (item?.type !== 'subclass') return false;
    const sources = [item?._stats?.compendiumSource, item?.flags?.core?.sourceId, item?.flags?.[MODULE_ID]?.sourceUuid];
    return sources.includes(pending.uuid) || (!!pending.name && item.name === pending.name);
  });
}

/** The pending record while the subclass is still missing (null once it is on the actor). */
export function getPendingSubclass(actor) {
  const flag = actor?.getFlag?.(MODULE_ID, PENDING_SUBCLASS_FLAG);
  if (!flag || typeof flag !== 'object' || !flag.uuid) return null;
  return hasPendingSubclassItem(actor, flag) ? null : flag;
}

/** Removes the flag once the subclass item is on the actor. Never throws. */
export async function clearPendingSubclassIfDone(actor) {
  try {
    const flag = actor?.getFlag?.(MODULE_ID, PENDING_SUBCLASS_FLAG);
    if (flag && hasPendingSubclassItem(actor, flag)) await actor.unsetFlag(MODULE_ID, PENDING_SUBCLASS_FLAG);
  } catch (error) {
    window.GAS?.log?.w?.('[SUBCLASS GUARD] could not clear pending subclass', error);
  }
}

/** dnd5e keeps the advancement manager of a closed Studio window registered; a fresh one then mixes with it. */
function hasStaleAdvancementApp(actorId) {
  const instances = globalThis.foundry?.applications?.instances;
  if (!instances?.values) return false;
  return [...instances.values()].some((app) => /AdvancementManager/.test(app?.constructor?.name ?? '')
    && (!actorId || app?.actor?.id === actorId));
}

/**
 * Adds the missing subclass: drops it on the actor so dnd5e opens its own advancement window, where the
 * player presses Complete. A stale window from the closed Studio means a page reload first (same as Resume).
 */
export async function recoverSubclass(actorId, { afterReload = false } = {}) {
  const actor = game.actors?.get(actorId);
  const pending = getPendingSubclass(actor);
  if (!actor || !pending) {
    ui.notifications?.warn('This character is not missing a subclass.');
    return false;
  }
  if (!actor.testUserPermission?.(game.user, 'OWNER')) {
    ui.notifications?.warn('You do not own this character, so you cannot add its subclass.');
    return false;
  }
  if (document.getElementById(STUDIO_ROOT_ID)) {
    ui.notifications?.error('Actor Studio is open. Close it first, then add the subclass.');
    return false;
  }
  if (!afterReload && hasStaleAdvancementApp(actor.id)) {
    try { sessionStorage.setItem(RELOAD_KEY, actor.id); } catch (e) { /* ignore */ }
    ui.notifications?.info('Reloading the page to clear the unfinished window, then adding the subclass for ' + actor.name + '.');
    setTimeout(() => window.location.reload(), 600);
    return true;
  }
  try {
    const doc = await fromUuid(pending.uuid);
    if (!doc) {
      ui.notifications?.warn('Could not find the subclass "' + (pending.name || pending.uuid) + '". Ask the GM to add it by hand.');
      return false;
    }
    const { dropItemOnCharacter, prepareItemForDrop } = await import('~/src/helpers/Utility');
    const item = await prepareItemForDrop({ itemData: doc, isLevelUp: true });
    await dropItemOnCharacter(actor, item ?? doc);
    return true;
  } catch (error) {
    window.GAS?.log?.e?.('[SUBCLASS GUARD] recovery failed', error);
    ui.notifications?.error('Could not add the subclass. Ask the GM to add it by hand.');
    return false;
  }
}

/** After a reload that recoverSubclass asked for: carry on with the same actor. */
export async function continueSubclassRecoveryOnReady() {
  try {
    let id = null;
    try { id = sessionStorage.getItem(RELOAD_KEY); sessionStorage.removeItem(RELOAD_KEY); } catch (e) { /* ignore */ }
    if (id) await recoverSubclass(id, { afterReload: true });
  } catch (error) {
    window.GAS?.log?.w?.('[SUBCLASS GUARD] ready step failed', error);
  }
}

/** Adds an "add your subclass" bar to the top of a character sheet whose subclass is missing. */
export function addSubclassBanner(app, html) {
  try {
    const actor = app?.actor ?? app?.document;
    const root = html instanceof HTMLElement ? html : (html?.[0] ?? app?.element);
    const host = root?.querySelector?.('.window-content') ?? root;
    const pending = actor ? getPendingSubclass(actor) : null;
    const hide = !pending
      || !actor.testUserPermission(game.user, 'OWNER')
      || !!document.getElementById(STUDIO_ROOT_ID);
    if (hide) {
      host?.querySelectorAll?.('.gas-subclass-banner').forEach((el) => el.remove());
      return;
    }
    if (!host || host.querySelector('.gas-subclass-banner')) return;
    const bar = document.createElement('div');
    bar.className = 'gas-subclass-banner';
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 10px;margin:0 0 4px;background:#7a3b00;color:#fff;border-radius:4px;position:relative;z-index:1000;';
    const text = document.createElement('span');
    text.textContent = 'The level-up is not finished: ' + (pending.name || 'the subclass') + ' was not added.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Add the subclass';
    button.style.cssText = 'width:auto;flex:none;';
    button.addEventListener('click', async (ev) => {
      ev.preventDefault();
      await recoverSubclass(actor.id);
    });
    bar.append(text, button);
    host.prepend(bar);
  } catch (error) {
    window.GAS?.log?.w?.('[SUBCLASS GUARD] banner failed', error);
  }
}
