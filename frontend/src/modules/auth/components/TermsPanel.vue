<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { getCurrentTerms, acceptTerms, getMyAcceptances } from '../api/access-flows-api'
import { getSession } from '../api/auth-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import { dateTime } from '../../../shared/format'
import RemoteState from '../../../shared/components/RemoteState.vue'
import TermsDocument from './TermsDocument.vue'
const props = defineProps<{ allowAcceptance?: boolean }>()
const emit = defineEmits<{ read: [versionId: string | null] }>()
const terms = useRemote(getCurrentTerms, () => true, false)
const acceptances = useRemote(
  async (signal) => {
    const session = getSession()
    return session ? getMyAcceptances(session.user.id, signal) : []
  },
  () => true,
  false,
)
const checked = ref(false),
  read = ref(false),
  sending = ref(false),
  error = ref(''),
  showTerms = ref(false)
const content = ref<HTMLElement | null>(null)
const loading = computed(() => terms.loading.value || acceptances.loading.value)
const loadError = computed(() => terms.error.value || acceptances.error.value)
const currentAcceptance = computed(() => {
  const current = terms.data.value
  const list = acceptances.data.value
  if (!current || !list) return null
  return list.find((item) => item.termsVersionId === current.id) ?? null
})
const acceptedNotice = computed(() => {
  const acceptance = currentAcceptance.value
  const current = terms.data.value
  if (!acceptance || !current) return null
  return `Ya aceptaste los términos y condiciones el ${dateTime(acceptance.acceptedAt)}`
})
async function markReadIfFits() {
  await nextTick()
  if (content.value && content.value.scrollHeight <= content.value.clientHeight + 4)
    read.value = true
}
async function load() {
  checked.value = false
  read.value = false
  showTerms.value = true
  emit('read', null)
  const tasks = [terms.refresh()]
  if (props.allowAcceptance) tasks.push(acceptances.refresh())
  await Promise.all(tasks)
  await markReadIfFits()
}
async function toggleTerms() {
  if (showTerms.value) {
    showTerms.value = false
    return
  }
  showTerms.value = true
  if (terms.data.value) {
    await markReadIfFits()
    return
  }
  await load()
}
onMounted(() => {
  if (!props.allowAcceptance) return
  void Promise.all([terms.refresh(), acceptances.refresh()])
})
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
    const result = await acceptTerms(session.user.id, terms.data.value.id)
    acceptances.data.value = [...(acceptances.data.value ?? []), result]
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
    <p class="muted">Lee la versión vigente antes de registrar tu aceptación. Conoce las condiciones de préstamo y las posibles penalizaciones.</p>
    <button
      type="button"
      :disabled="loading || sending"
      :aria-expanded="showTerms"
      @click="toggleTerms"
    >
      {{ showTerms ? 'Ocultar términos' : 'Consultar términos actuales' }}
    </button>
    <RemoteState :loading="loading" :error="loadError" @retry="load">
      <template v-if="terms.data.value">
        <template v-if="showTerms">
          <h3>{{ terms.data.value.title }} · versión {{ terms.data.value.number }}</h3>
          <div
            ref="content"
            class="terms-content"
            tabindex="0"
            aria-label="Contenido completo de los términos"
            @scroll="scrolled"
          >
            <TermsDocument :content="terms.data.value.content" />
          </div>
          <template v-if="!acceptedNotice">
            <p v-if="!read">Desplázate hasta el final del contenido para poder aceptar.</p>
            <label
              ><input v-model="checked" type="checkbox" :disabled="!read || sending" @change="change" />
              Acepto la versión leída</label
            >
            <button
              v-if="allowAcceptance"
              type="button"
              :disabled="!checked || sending"
              @click="accept"
            >
              {{ sending ? 'Registrando…' : 'Registrar aceptación' }}
            </button>
          </template>
        </template>
        <p v-if="acceptedNotice" role="status" class="notice">{{ acceptedNotice }}</p>
      </template>
    </RemoteState>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
<style scoped>
.terms-panel {
  font-size: 14px;
  line-height: 1.6;
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
  display: flex;
  align-items: start;
  gap: 10px;
}
.terms-panel input[type='checkbox'] { width: 16px; height: 16px; flex-shrink: 0; margin-top: 4px; accent-color: #1e3a5f; }
.terms-content {
  max-height: 16rem;
  overflow: auto;
  padding: 1rem;
  border: 1px solid #cbd5e1;
  margin: 0.5rem 0;
}
</style>
