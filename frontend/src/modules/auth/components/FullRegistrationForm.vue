<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import TermsPanel from './TermsPanel.vue'
import { requestFullRegistration } from '../api/access-flows-api'
import { errorMessage } from '../../../shared/composables/useRemote'
import { pendingMutation } from '../../../shared/api/mutation-guard'
import { readRegistrationEvidence } from '../registration-image'
import type { AuthSession } from '../api/auth-api'
import { ApiError } from '../../../shared/api/client'
const name = ref(''),
  email = ref(''),
  password = ref(''),
  userType = ref<AuthSession['user']['userType']>('ESTUDIANTE'),
  institutionalId = ref(''),
  phone = ref(''),
  evidence = ref('')
const version = ref<string | null>(null),
  sending = ref(false),
  error = ref(''),
  confirmed = ref('')
const passwordVisible = ref(false)
const termsGeneration = ref(0)
const readingImage = ref(false)
const uncertain = computed(() => pendingMutation('full-registration'))
let imageGeneration = 0
onBeforeUnmount(() => { imageGeneration++ })
async function selectImage(event: Event) {
  const generation = ++imageGeneration
  evidence.value = ''
  error.value = ''
  readingImage.value = false
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  readingImage.value = true
  try {
    const source = await readRegistrationEvidence(file)
    if (generation === imageGeneration) evidence.value = source
  } catch (cause) {
    if (generation === imageGeneration) error.value = errorMessage(cause)
  } finally {
    if (generation === imageGeneration) readingImage.value = false
  }
}
async function submit() {
  if (sending.value || readingImage.value || uncertain.value || !version.value || !evidence.value || confirmed.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await requestFullRegistration({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      userType: userType.value,
      ...(institutionalId.value.trim() ? { institutionalId: institutionalId.value.trim() } : {}),
      ...(phone.value.trim() ? { phone: phone.value.trim() } : {}),
      evidence: [evidence.value.trim()].filter(Boolean),
      termsVersionId: version.value,
    })
    confirmed.value = result.id
    password.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
    if (cause instanceof ApiError && cause.status === 409) {
      version.value = null
      termsGeneration.value++
    }
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <form class="full-registration space-y-4" @submit.prevent="submit">
    <h2 class="text-xl font-bold">Datos para tu cuenta</h2>
    <p>
      El alta queda pendiente de revisión. Al aprobarla, se creará tu cuenta de usuario.
      Adjunta una imagen PNG/JPEG de hasta 60 KiB o un PDF de hasta 10 MiB y acepta los términos vigentes.
    </p>
    <p id="registration-password-notice" class="text-sm text-slate-600">Todos los solicitantes eligen su contraseña. El servidor almacena únicamente su hash Argon2id; la contraseña no será visible para operadores ni administradores, ni se les enviará. Tras la aprobación podrás acceder con el correo y la contraseña que elegiste.</p>
    <fieldset :disabled="sending || !!confirmed || uncertain" class="registration-fields">
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
      <div class="password-field"><label
        >Contraseña<input
          v-model="password"
          :type="passwordVisible ? 'text' : 'password'"
          id="registration-password"
          aria-describedby="registration-password-notice"
          required
           minlength="8"
           maxlength="128"
          autocomplete="new-password"
      /></label>
      <button type="button" aria-controls="registration-password" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">{{ passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</button></div>
      <label
        >Tipo institucional<select v-model="userType">
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Profesor</option>
          <option value="ADMINISTRATIVO">Personal administrativo</option>
        </select></label
      >
      <label>Identificador institucional<input v-model="institutionalId" maxlength="80" /></label>
      <label>Teléfono<input v-model="phone" type="tel" maxlength="20" autocomplete="tel" /></label>
      <p id="registration-evidence-hint" class="full-row text-sm text-slate-600">{{ userType === 'ESTUDIANTE' ? 'Estudiantes: adjunta tu carné o constancia de matrícula vigente.' : 'Adjunta un documento que acredite tu vinculación institucional.' }} PNG/JPEG hasta 60 KiB o PDF hasta 10 MiB.</p>
      <label class="full-row">Evidencia de vinculación<input type="file" accept="image/png,image/jpeg,application/pdf" aria-describedby="registration-evidence-hint" required @change="selectImage" /></label>
      <p v-if="readingImage" class="full-row" role="status">Validando imagen…</p>
      <img v-if="evidence && !evidence.startsWith('data:application/pdf')" :src="evidence" alt="Vista previa de la evidencia seleccionada" class="full-row max-h-64 max-w-full object-contain" />
      <p v-if="evidence && evidence.startsWith('data:application/pdf')" class="full-row text-sm text-slate-600">PDF seleccionado y listo para enviar.</p>
      <div class="full-row"><TermsPanel :key="termsGeneration" @read="version = $event" /></div>
    </fieldset>
    <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-800">{{ error }}</p>
    <p v-if="confirmed" role="status">
      Solicitud {{ confirmed }} confirmada como PENDIENTE. La aprobación creará tu cuenta con los datos enviados. Aún no puedes iniciar sesión.
    </p>
    <p v-if="uncertain && !sending" role="alert">Hay un envío pendiente o de resultado incierto. Consulta con el personal antes de repetir. No se reintentará automáticamente.</p>
    <button
      :disabled="sending || readingImage || uncertain || !version || !evidence || !!confirmed"
      class="rounded-lg bg-[#1e3a5f] px-5 py-3 text-white disabled:opacity-50"
    >
      {{ sending ? 'Enviando…' : 'Enviar solicitud' }}
    </button>
  </form>
</template>
<style scoped>
.full-registration fieldset label {
  display: block;
}
.full-registration fieldset label input,
.full-registration fieldset label select {
  display: block;
  width: 100%;
  padding: 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-top: 0.4rem;
}
.full-registration { color: #334155; line-height: 1.6; overflow-wrap: anywhere; }
.full-registration button { cursor: pointer; }
.full-registration button:disabled { cursor: not-allowed; }
.full-registration :is(input, select, button):focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
.registration-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
.registration-fields > *, .password-field { min-width: 0; }
.password-field button { margin-top: 6px; font-size: 13px; color: #1d4ed8; }
.full-row { grid-column: 1 / -1; }
@media (min-width: 700px) { .registration-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
