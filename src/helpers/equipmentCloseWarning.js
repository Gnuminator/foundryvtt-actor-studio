/** True when closing Studio would drop unconfirmed equipment picks. */
export const shouldWarnOnEquipmentClose = (tab, readOnlyTabs, progress) =>
  tab === 'equipment' && !(readOnlyTabs ?? []).includes('equipment') && Number(progress) > 0;
