<template>
  <div class="join" style="display:grid;gap:24px;max-width:520px;margin:40px auto; padding-bottom: 70px;">
    <section style="display:grid;gap:8px">
      <div style="display: flex; flex-direction: column; align-items: center;">
        <img src="~/assets/img/logo-1024.png" alt="logo" height="256"/>

        <h1 style="position: relative; top: -50px; margin-bottom: -20px;">Join session</h1>

        <section style="display:grid; gap:12px; width: 300px">
          <p class="caption" style="position: relative; top: 20px; padding-left: 6px">Join code</p>
          <TextFieldSession v-model="code" :disabled="joining" :error="!!joinError" @clear-error="joinError = null" />
          <Button :buttonStyle="{ size: 's' }" :loading="joining" @click="onJoin">Join</Button>
        </section>
      </div>
    </section>
    <p class="caption" v-if="joinError" style="color:var(--colorError); text-align: center">{{ joinError }}</p>
  </div>

  <pre class="caption"v-if="joinResult" style="white-space:pre-wrap">{{ joinResult }}</pre>

  <footer style="
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 40px;
    background-color: var(--colorPrimaryVariant);;
  ">
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { joinSession, createSession } from '~/domains/sessions'
import Button from "~/components/buttons/Button.vue";
import TextFieldSession from "~/components/text-fields/TextFieldSession.vue";

const code = ref('')
const colorHex = ref('#FF5733')
const displayName = ref('')

const joining = ref(false)
const joinResult = ref<string | null>(null)
const joinError = ref<string | null>(null)

const onJoin = async () => {
  joining.value = true
  joinError.value = null
  joinResult.value = null
  try {
    const res = await joinSession(code.value, colorHex.value.toUpperCase(), displayName.value || undefined)
    joinResult.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    joinError.value = e?.data?.message || e?.message || 'Failed to join'
  } finally {
    joining.value = false
  }
}
</script>

<style scoped>
</style>