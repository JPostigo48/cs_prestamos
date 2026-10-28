<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { getCurrentTerms, acceptTerms } from '../api/access-flows-api'
import { getSession } from '../api/auth-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
const props = defineProps<{ allowAcceptance?: boolean }>()
const emit = defineEmits<{ read: [versionId: string | null] }>()
const terms = useRemote(getCurrentTerms, () => true, false)
const checked = ref(false),
  read = ref(false),
  sending = ref(false),
  error = ref(''),
  notice = ref('')
const content = ref<HTMLElement | null>(null)
async function load() {
  checked.value = false
  read.value = false
  notice.value = ''
  emit('read', null)
  await terms.refresh()
  await nextTick()
  if (content.value && content.value.scrollHeight <= content.value.clientHeight + 4)
    read.value = true
}
function scrolled(event: Event) {
  const el = event.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) read.value = true
}
function change() {
  emit('read', checked.value && read.value ? terms.data.value!.id : null)
}
async function accept() {
  if (!props.allowAcceptance || sending.value || !checked.value || !terms.data.value) return
  const session = getSession()
  if (!session) return
  sending.value = true
  error.value = ''
  try {
    await acceptTerms(session.user.id, terms.data.value.id)
    notice.value = 'Aceptación confirmada por el servidor.'
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <section class="terms-panel stack">
    <h2>Términos y condiciones</h2>
    <p>La consulta de la versión vigente depende del contrato provisional F02.</p>
    <button type="button" :disabled="terms.loading.value || sending" @click="load">
      Consultar términos actuales
    </button>
    <RemoteState :loading="terms.loading.value" :error="terms.error.value" @retry="load">
      <template v-if="terms.data.value"
        ><h3>{{ terms.data.value.title }} · versión {{ terms.data.value.number }}</h3>
        <div
          ref="content"
          class="terms-content"
          tabindex="0"
          aria-label="Contenido completo de los términos"
          @scroll="scrolled"
        >
          {{ terms.data.value.content }}
        </div>
        <p v-if="!read">Desplázate hasta el final del contenido para poder aceptar.</p>
        <label
          ><input v-model="checked" type="checkbox" :disabled="!read || sending" @change="change" />
          Acepto la versión leída</label
        >
        <button
          v-if="allowAcceptance"
          type="button"
          :disabled="!checked || sending || !!notice"
          @click="accept"
        >
          {{ sending ? 'Registrando…' : 'Registrar aceptación' }}
        </button>
      </template>
    </RemoteState>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  </section>
</template>
<style scoped>
.terms-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  margin: 1rem 0;
}
.terms-panel h2 {
  font-weight: 700;
}
.terms-panel button {
  border: 1px solid #94a3b8;
  border-radius: 8px;
  padding: 0.6rem;
  margin: 0.4rem 0;
}
.terms-panel label {
  display: block;
}
.terms-content {
  max-height: 16rem;
  overflow: auto;
  white-space: pre-wrap;
  padding: 1rem;
  border: 1px solid #cbd5e1;
  margin: 0.5rem 0;
}
</style>
