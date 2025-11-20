<template>
  <Button :buttonStyle="{ size: 'm' }" :loading="loading" @click="onLogout">Logout</Button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from '#imports'
import Button from '~/components/buttons/Button.vue'
import { logout } from '~/domains/auth'

const loading = ref(false)
const router = useRouter()

const onLogout = async () => {
  if (loading.value) return
  loading.value = true
  try {
    await logout()
  } finally {
    loading.value = false
    await router.push('/login')
  }
}
</script>