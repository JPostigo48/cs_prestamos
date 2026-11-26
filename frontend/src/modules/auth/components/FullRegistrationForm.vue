<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import TermsPanel from './TermsPanel.vue'
import { requestFullRegistration } from '../api/access-flows-api'
import { errorMessage } from '../../../shared/composables/useRemote'
import { pendingMutation } from '../../../shared/api/mutation-guard'
import { readRegistrationEvidence } from '../registration-image'
import type { AuthSession } from '../api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { normalizeInstitutionalEmail, registrationErrors, isInstitutionalEmail } from '../registration-policy'
const fieldErrors = ref<Record<string, string>>({})
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
  if (sending.value || readingImage.value || uncertain.value || confirmed.value) return
  fieldErrors.value = registrationErrors({ name: name.value, email: email.value, password: password.value, userType: userType.value, institutionalId: institutionalId.value, phone: phone.value, evidence: evidence.value ? [evidence.value] : [], termsVersionId: version.value })
  if (Object.keys(fieldErrors.value).length) return
  sending.value = true
  error.value = ''
  try {
    const result = await requestFullRegistration({
      name: name.value.trim(),
      email: normalizeInstitutionalEmail(email.value),
      password: password.value,
      userType: userType.value,
      institutionalId: institutionalId.value.trim(),
      phone: phone.value.trim(),
      evidence: [evidence.value.trim()].filter(Boolean),
      termsVersionId: version.value!,
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
  <form class="full-registration space-y-4" novalidate @submit.prevent="submit">
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
          :aria-invalid="!!fieldErrors.name" aria-describedby="registration-name-error"
          required
          minlength="2"
          maxlength="180"
          autocomplete="name"
      /><span v-if="fieldErrors.name" id="registration-name-error" role="alert">{{ fieldErrors.name }}</span></label>
      <label
        >Correo institucional<input v-model="email" type="email" required maxlength="254" autocomplete="username" :aria-invalid="!!fieldErrors.email || (!!email && !isInstitutionalEmail(email))" aria-describedby="registration-email-error"
      /><span id="registration-email-error" :role="fieldErrors.email ? 'alert' : undefined">{{ fieldErrors.email || (email && !isInstitutionalEmail(email) ? 'Usa el dominio exacto @unsa.edu.pe.' : 'Correo institucional @unsa.edu.pe.') }}</span></label>
      <div class="password-field"><label
        >Contraseña<input
          v-model="password"
          :type="passwordVisible ? 'text' : 'password'"
          id="registration-password"
          :aria-invalid="!!fieldErrors.password" aria-describedby="registration-password-notice registration-password-error"
          required
           minlength="8"
           maxlength="128"
          autocomplete="new-password"
      /><span v-if="fieldErrors.password" id="registration-password-error" role="alert">{{ fieldErrors.password }}</span></label>
      <button type="button" aria-controls="registration-password" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">{{ passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</button></div>
      <label
        >Tipo institucional<select v-model="userType" required :aria-invalid="!!fieldErrors.userType" aria-describedby="registration-userType-error">
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Profesor</option>
          <option value="ADMINISTRATIVO">Personal administrativo</option>
        </select><span v-if="fieldErrors.userType" id="registration-userType-error" role="alert">{{ fieldErrors.userType }}</span></label
      >
      <label>Identificador institucional<input v-model="institutionalId" required maxlength="80" :aria-invalid="!!fieldErrors.institutionalId" aria-describedby="registration-institutionalId-error" /><span v-if="fieldErrors.institutionalId" id="registration-institutionalId-error" role="alert">{{ fieldErrors.institutionalId }}</span></label>
      <label>Teléfono<input v-model="phone" required type="tel" maxlength="20" autocomplete="tel" :aria-invalid="!!fieldErrors.phone" aria-describedby="registration-phone-error" /><span v-if="fieldErrors.phone" id="registration-phone-error" role="alert">{{ fieldErrors.phone }}</span></label>
      <p id="registration-evidence-hint" class="full-row text-sm text-slate-600">{{ userType === 'ESTUDIANTE' ? 'Estudiantes: adjunta tu carné o constancia de matrícula vigente.' : 'Adjunta un documento que acredite tu vinculación institucional.' }} PNG/JPEG hasta 60 KiB o PDF hasta 10 MiB.</p>
      <label class="full-row">Evidencia de vinculación<input type="file" accept="image/png,image/jpeg,application/pdf" :aria-invalid="!!fieldErrors.evidence" aria-describedby="registration-evidence-hint registration-evidence-error" required @change="selectImage" /><span v-if="fieldErrors.evidence" id="registration-evidence-error" role="alert">{{ fieldErrors.evidence }}</span></label>
      <p v-if="readingImage" class="full-row" role="status">Validando imagen…</p>
      <img v-if="evidence && !evidence.startsWith('data:application/pdf')" :src="evidence" alt="Vista previa de la evidencia seleccionada" class="full-row max-h-64 max-w-full object-contain" />
      <p v-if="evidence && evidence.startsWith('data:application/pdf')" class="full-row text-sm text-slate-600">PDF seleccionado y listo para enviar.</p>
      <div class="full-row"><TermsPanel :key="termsGeneration" @read="version = $event" /><p v-if="fieldErrors.termsVersionId" role="alert">{{ fieldErrors.termsVersionId }}</p></div>
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
