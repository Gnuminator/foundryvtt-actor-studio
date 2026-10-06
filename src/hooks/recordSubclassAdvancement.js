import { MODULE_ID } from '~/src/helpers/constants';

/**
 * Records a subclass that Actor Studio added to an actor on the class item's Subclass advancement.
 *
 * Studio adds the subclass item through the actor sheet's drop handler. That creates the subclass item
 * (linked to its class by system.classIdentifier) but never touches the class's Subclass advancement, so
 * the advancement stays unset and dnd5e still thinks the class is missing a subclass. dnd5e's own
 * SubclassFlow stores { document: <embedded item id>, uuid: <source uuid> } on the advancement; this does the same.
 *
 * Only acts for subclasses Studio dropped (it tracks them in the actor's droppedItems.subclass flag),
 * only for the user who created the item, and never overwrites a value that is already set.
 *
 * @param {Item} item  The newly created item.
 * @param {object} options  Creation options (unused).
 * @param {string} userId  The user who created the item.
 * @returns {Promise<boolean>} True when the advancement was updated.
 */
export async function recordSubclassOnClassAdvancement(item, options, userId) {
  try {
    if (userId !== game.user?.id) return false;
    if (item?.type !== 'subclass') return false;

    const actor = item.parent;
    if (!actor || actor.documentName !== 'Actor') return false;

    // Only subclasses that Actor Studio dropped on this actor.
    const dropped = actor.getFlag?.(MODULE_ID, 'droppedItems.subclass');
    if (!Array.isArray(dropped) || dropped.length === 0) return false;

    const classIdentifier = item.system?.classIdentifier;
    const classItem = actor.items.find((i) => i.type === 'class' && i.identifier === classIdentifier);
    if (!classItem || typeof classItem.updateAdvancement !== 'function') return false;

    const advancement = classItem.advancement?.byType?.Subclass?.[0];
    if (!advancement) return false;
    if (advancement.value?.document) return false; // already recorded

    const uuid = item._stats?.compendiumSource ?? item.flags?.dnd5e?.sourceId ?? item.uuid;
    await classItem.updateAdvancement(advancement.id, { value: { document: item.id, uuid } });
    window.GAS?.log?.i?.('[SUBCLASS] Recorded subclass on class Subclass advancement', classItem.name, item.name);
    return true;
  } catch (error) {
    window.GAS?.log?.w?.('[SUBCLASS] Could not record subclass on class advancement', error);
    return false;
  }
}
