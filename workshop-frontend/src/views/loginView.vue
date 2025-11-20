<template>
  <div class="login" style="display:grid;gap:24px;max-width:520px;margin:40px auto; padding-bottom: 70px;">
    <section style="display:grid;gap:8px">
      <div style="display: flex; flex-direction: column; align-items: center;">
        <img src="~/assets/img/logo-1024.png" alt="logo" height="256"/>

        <h1 style="position: relative; top: -50px; margin-bottom: -20px;">Login</h1>

        <section style="display:grid; gap:16px; width: 300px">

          <div style="display: grid; gap: 4px;"> <p class="caption" style="padding-left: 6px; margin: 0;"> Email
          </p>
            <TextFieldEmail
                v-model="email"
                :disabled="loggingIn"
                :error="!!loginError"
                @clear-error="loginError = null"
            />
          </div>

          <div style="display: grid; gap: 4px;"><p class="caption" style="padding-left: 6px; margin: 0;"> Password
          </p>
            <TextFieldPassword
                v-model="password"
                :disabled="loggingIn"
                :error="!!loginError"
                @keyup.enter="onLogin"
                @clear-error="loginError = null"
            />
          </div>

          <Button :buttonStyle="{ size: 's' }" :loading="loggingIn" @click="onLogin">Login</Button>
        </section>
      </div>
    </section>

    <p class="caption" v-if="loginError" style="color:var(--colorError); text-align: center">{{ loginError }}</p>
  </div>

  <pre class="caption" v-if="loginResult" style="white-space:pre-wrap">{{ loginResult }}</pre>

  <footer style="
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 40px;
    background-color: var(--colorPrimaryVariant);
  ">
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '~/components/buttons/Button.vue'
import TextFieldEmail from '~/components/text-fields/TextFieldEmail.vue'
import TextFieldPassword from '~/components/text-fields/TextFieldPassword.vue'
import { login } from '~/domains/auth'

const email = ref('')
const password = ref('')

const loggingIn = ref(false)
const loginResult = ref<string | null>(null)
const loginError = ref<string | null>(null)

const router = useRouter()

const onLogin = async () => {
  if (!email.value || !password.value) {
    loginError.value = 'Please enter email and password'
    return
  }
  loggingIn.value = true
  loginError.value = null
  loginResult.value = null
  try {
    const res = await login(email.value, password.value)
    loginResult.value = JSON.stringify(res, null, 2)
    await router.push('/moderator') // or any protected route
  } catch (e: any) {
    loginError.value = e?.data?.message || e?.message || 'Failed to login'
  } finally {
    loggingIn.value = false
  }
}
</script>

<style scoped>
</style>
