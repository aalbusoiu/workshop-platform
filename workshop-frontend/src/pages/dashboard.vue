<script setup lang="ts">
definePageMeta({ requiresAuth: true, middleware: ['guard'] });
import DashboardView from '~/views/dashboardView.vue'
</script>

<template>
  <DashboardView />
</template>