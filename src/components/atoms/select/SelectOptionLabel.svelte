<script>
  import { stripSourceLabels } from "~/src/helpers/selectOptionLabel.js";

  export let label;
  export let enrichedLabel = undefined;
  export let enableEnrichment = false;
  export let showPackLabel = false;
  export let sourceBook = undefined;
  export let labelCleaned = false;

  const displayLabel = stripSourceLabels(label, labelCleaned);
  $: displaySourceBook = typeof sourceBook === 'string' && sourceBook
    ? sourceBook.split('.')[0].replace(/^Compendium\./, '').replace(/-/g, ' ')
    : '';
</script>

<template lang="pug">
+if("showPackLabel && displaySourceBook")
  .gas-pack-badge {displaySourceBook}
div.option-label
  +if("enableEnrichment")
    | {@html enrichedLabel}
    +else
      | {displayLabel}
</template>

<style lang="sass">
.gas-pack-badge
  display: inline-block
  padding: 0.125rem 0.375rem
  margin-right: 0.375rem
  font-size: 0.65rem
  font-weight: 600
  line-height: 1.4
  color: var(--color-text-light)
  background: rgba(255, 255, 255, 0.15)
  border-radius: 3px
  text-transform: uppercase
  letter-spacing: 0.025em
  vertical-align: middle

.option-label
  display: inline-block
  margin-left: 0.375rem
</style>
