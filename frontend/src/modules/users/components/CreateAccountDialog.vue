<script setup lang="ts">
import { ref } from 'vue'
import { createAccount } from '../api/users-admin-api'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { ApiError } from '../../../shared/api/client'
const props = defineProps<{ userId: string; name: string }>()
defineEmits<{ close: [] }>()
const email = ref(''),
  password = ref(''),
  sending = ref(false),
  error = ref(''),
  confirmed = ref(''),
  uncertain = ref(false)
async function submit() {
  if (sending.value || confirmed.value || uncertain.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await createAccount({
      userId: props.userId,
      email: email.value.trim(),
      password: password.value,
    })
    confirmed.value = result.id
    password.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <ModalDialog title="Crear cuenta de acceso" :busy="sending" @close="$emit('close')"
    ><form class="stack" @submit.prevent="submit">
      <p>{{ name }} · usuario {{ userId }}</p>
      <p>
        La aprobación de la solicitud no crea una cuenta. Esta acción crea acceso con rol USUARIO,
        sin iniciar sesión como el solicitante.
      </p>
      <label
        >Correo institucional<input
          v-model="email"
          type="email"
          required
          autocomplete="off"
          :disabled="sending || !!confirmed" /></label
      ><label
        >Contraseña inicial<input
          v-model="password"
          type="password"
          minlength="8"
          required
          autocomplete="new-password"
          :disabled="sending || !!confirmed"
      /></label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="uncertain" class="error">Resultado incierto. Verifica la cuenta antes de repetir.</p>
      <p v-if="confirmed" role="status" class="notice">Cuenta confirmada: {{ confirmed }}</p>
      <div class="row">
        <button type="button" :disabled="sending" @click="$emit('close')">Cerrar</button
        ><button :disabled="sending || !!confirmed || uncertain">
          Confirmar creación de cuenta
        </button>
      </div>
    </form></ModalDialog
  >
</template>
