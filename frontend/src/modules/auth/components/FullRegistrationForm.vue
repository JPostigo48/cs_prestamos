<script setup lang="ts">
import { ref } from 'vue'
import TermsPanel from './TermsPanel.vue'
import { requestFullRegistration } from '../api/access-flows-api'
import { errorMessage } from '../../../shared/composables/useRemote'
const name = ref(''),
  email = ref(''),
  password = ref(''),
  userType = ref('ESTUDIANTE'),
  institutionalId = ref(''),
  evidence = ref('')
const version = ref<string | null>(null),
  sending = ref(false),
  error = ref(''),
  confirmed = ref('')
const passwordVisible = ref(false)
async function selectImage(event: Event) {
  evidence.value = ''
  error.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 60 * 1024) {
    error.value = 'Selecciona una imagen PNG o JPEG de hasta 60 KiB.'
    return
  }
  try {
    evidence.value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  } catch { error.value = 'No se pudo leer la imagen.' }
}
async function submit() {
  if (sending.value || !version.value || !evidence.value || confirmed.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await requestFullRegistration({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      userType: userType.value,
      ...(institutionalId.value.trim() ? { institutionalId: institutionalId.value.trim() } : {}),
      evidence: [evidence.value.trim()].filter(Boolean),
      termsVersionId: version.value,
    })
    confirmed.value = result.id
    password.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <form class="full-registration space-y-4" @submit.prevent="submit">
    <h2 class="text-xl font-bold">Crear cuenta</h2>
    <p>
      El alta queda pendiente de revisión. Al aprobarla, se creará tu cuenta de usuario.
      Adjunta una imagen de vinculación PNG o JPEG de hasta 60 KiB y acepta los términos vigentes.
    </p>
    <fieldset :disabled="sending || !!confirmed" class="space-y-3">
      <label
        >Nombre completo<input
          v-model="name"
          required
          minlength="2"
          maxlength="180"
          autocomplete="name"
      /></label>
      <label
        >Correo institucional<input v-model="email" type="email" required autocomplete="username"
      /></label>
      <label
        >Contraseña<input
          v-model="password"
          :type="passwordVisible ? 'text' : 'password'"
          id="registration-password"
          required
          minlength="8"
          autocomplete="new-password"
      /></label>
      <button type="button" aria-controls="registration-password" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">{{ passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</button>
      <label
        >Tipo institucional<select v-model="userType">
          <option>ESTUDIANTE</option>
          <option>DOCENTE</option>
          <option>ADMINISTRATIVO</option>
        </select></label
      >
      <label>Identificador institucional<input v-model="institutionalId" maxlength="80" /></label>
      <label>Evidencia de vinculación<input type="file" accept="image/png,image/jpeg" required @change="selectImage" /></label>
      <TermsPanel @read="version = $event" />
    </fieldset>
    <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-800">{{ error }}</p>
    <p v-if="confirmed" role="status">
      Solicitud {{ confirmed }} confirmada como PENDIENTE. No se ha iniciado sesión.
    </p>
    <button
      :disabled="sending || !version || !evidence || !!confirmed"
      class="rounded-lg bg-[#1e3a5f] px-5 py-3 text-white disabled:opacity-50"
    >
      Enviar alta integral
    </button>
  </form>
</template>
<style scoped>
.full-registration label {
  display: block;
}
.full-registration input,
.full-registration select,
.full-registration textarea {
  display: block;
  width: 100%;
  padding: 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-top: 0.4rem;
}
</style>
