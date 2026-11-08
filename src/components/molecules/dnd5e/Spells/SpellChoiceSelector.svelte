<script>
  import { onMount } from "svelte";
  import { getFilteredSpellChoices } from "~/src/helpers/Utility.js";
  import { localize as t } from "~/src/helpers/Utility";
  import { get } from "svelte/store";
  import { background } from "~/src/stores/index";

  export let flow = null;
  export let maxPicks = 1;
  export let onSelect = () => {};
  export let onClose = () => {};

  let spells = [];
  let searchTerm = "";
  let loading = true;
  let picked = new Set();

  onMount(async () => {
    try {
      spells = await getFilteredSpellChoices(flow, { fallbackBackground: get(background) });
    } catch (error) {
      window.GAS.log.e('[SpellChoiceSelector] Error loading spells:', error);
    } finally {
      loading = false;
    }
  });

  $: visible = searchTerm
    ? spells.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : spells;
  $: full = picked.size >= maxPicks;

  function toggle(spell) {
    const next = new Set(picked);
    if (next.has(spell.uuid)) next.delete(spell.uuid);
    else if (next.size < maxPicks) next.add(spell.uuid);
    picked = next;
  }

  const levelLabel = (spell) => {
    const level = Number(spell.system?.level ?? 0);
    return level === 0 ? t('SpellChoiceSelector.Cantrip', 'Cantrip') : `${t('SpellChoiceSelector.Level', 'Level')} ${level}`;
  };

  function handleConfirm() {
    if (!picked.size) return;
    onSelect(Array.from(picked));
    onClose();
  }
</script>

<template lang="pug">
.spell-choice-overlay
  .spell-choice-modal
    .spell-choice-header
      h2 {t('SpellChoiceSelector.Title', 'Select Spells')}
      button.close-button(type="button" on:click="{onClose}")
        i.fa-solid.fa-times

    .spell-choice-content
      +if("loading")
        .state
          i.fa-solid.fa-spinner.fa-spin
          p {t('SpellChoiceSelector.Loading', 'Loading spells...')}

        +else
          +if("spells.length === 0")
            .state
              i.fa-solid.fa-exclamation-triangle
              p {t('SpellChoiceSelector.NoSpells', 'No spells available. Check your compendium sources in settings.')}

            +else
              input.search-input(
                type="text"
                placeholder="{t('SpellChoiceSelector.Search', 'Search spells...')}"
                bind:value="{searchTerm}"
              )
              .spell-list
                +each("visible as spell")
                  label.spell-item(
                    class:selected!="{picked.has(spell.uuid)}"
                    class:disabled!="{full && !picked.has(spell.uuid)}"
                  )
                    input(
                      type="checkbox"
                      checked!="{picked.has(spell.uuid)}"
                      disabled!="{full && !picked.has(spell.uuid)}"
                      on:change!="{() => toggle(spell)}"
                    )
                    img(src!="{spell.img || '/icons/svg/mystery-man.svg'}" alt!="{spell.name}")
                    span.spell-name {spell.name}
                    span.spell-level {levelLabel(spell)}

    .spell-choice-footer
      span.count {picked.size} / {maxPicks}
      button.confirm-button(type="button" disabled!="{!picked.size}" on:click="{handleConfirm}") {t('SpellChoiceSelector.Select', 'Add Selected')}
      button.cancel-button(type="button" on:click="{onClose}") {t('SpellChoiceSelector.Cancel', 'Cancel')}
</template>

<style lang="sass">
.spell-choice-overlay
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background: rgba(0, 0, 0, 0.8)
  display: flex
  align-items: center
  justify-content: center
  z-index: 10000

.spell-choice-modal
  background: var(--tabs-content-background)
  border: 1px solid #000
  border-radius: 12px
  width: 90%
  max-width: 600px
  max-height: 80vh
  display: flex
  flex-direction: column
  box-shadow: 0 0px 20px 2px var(--color-shadow-primary)

.spell-choice-header
  display: flex
  justify-content: space-between
  align-items: center
  padding: 0.5rem 1rem
  background: rgba(0, 0, 0, 0.2)
  border-bottom: 1px solid rgba(0, 0, 0, 0.5)

  h2
    margin: 0
    color: var(--color-highlight)
    font-size: 2rem
    font-weight: normal
    font-family: "Modesto Condensed"

  .close-button
    background: transparent
    border: none
    color: var(--gas-color-text, #f0f0e0)
    cursor: pointer
    width: 24px
    height: 24px

.spell-choice-content
  flex: 1
  overflow-y: auto
  padding: 0.5rem

.search-input
  width: 100%
  margin-bottom: 0.5rem
  padding: 0.35rem 0.5rem
  border: 1px solid #7a7971
  border-radius: 3px
  background: rgba(0, 0, 0, 0.25)
  color: var(--gas-color-text, #f0f0e0)
  font-family: "Signika", sans-serif

.spell-list
  max-height: 400px
  overflow-y: auto
  background: rgba(0, 0, 0, 0.2)
  border: 1px solid #7a7971

.spell-item
  display: flex
  align-items: center
  gap: 0.5rem
  padding: 0.25rem 0.5rem
  margin-bottom: 2px
  cursor: pointer
  background: rgba(255, 255, 255, 0.05)
  border: 1px solid transparent
  color: var(--gas-color-text, #f0f0e0)
  font-family: "Signika", sans-serif

  &:hover
    background: rgba(255, 255, 255, 0.1)

  &.selected
    background: var(--select-option-highlight-color, #5e5437)
    border-color: var(--dnd5e-color-gold, #c9c9c9)

  &.disabled
    opacity: 0.4
    cursor: not-allowed

  img
    width: 24px
    height: 24px
    border: 1px solid rgba(0, 0, 0, 0.3)
    border-radius: 2px

  .spell-name
    flex: 1

  .spell-level
    font-size: 0.8rem
    opacity: 0.8

.spell-choice-footer
  display: flex
  justify-content: flex-end
  align-items: center
  gap: 0.75rem
  padding: 0.5rem 1rem
  background: rgba(0, 0, 0, 0.2)
  border-top: 1px solid rgba(0, 0, 0, 0.5)

  .count
    flex: 1
    color: var(--gas-color-text, #f0f0e0)
    font-family: "Signika", sans-serif

  button
    padding: 0.35rem 0.75rem
    border-radius: 3px
    cursor: pointer
    font-family: "Signika", sans-serif
    border: 1px solid #7a7971
    color: #f0f0e0

  .confirm-button
    background: linear-gradient(180deg, #5e5437 0%, #4a4229 100%)

    &:disabled
      opacity: 0.4
      cursor: not-allowed

  .cancel-button
    background: transparent

.state
  text-align: center
  padding: 2rem
  color: var(--gas-color-text, #f0f0e0)
  font-family: "Signika", sans-serif

  i
    font-size: 2rem
    margin-bottom: 1rem
    display: block
    color: var(--dnd5e-color-gold, #c9c9c9)
</style>
