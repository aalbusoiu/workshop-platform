<template>
  <div style="min-height: 100vh; background: var(--colorPrimary); display:grid; gap:24px; padding-bottom: 70px;">
    <section style="display:grid; place-items:center; margin-top: 80px;">
      <ButtonLogout />
    </section>
    <footer style="position: fixed; bottom: 0; left: 0; width: 100%; height: 40px; background-color: var(--colorPrimaryVariant);"></footer>
  </div>
</template>

<script setup lang="ts">
import ButtonLogout from '~/components/buttons/ButtonLogout.vue'
</script>

<style scoped>
</style>