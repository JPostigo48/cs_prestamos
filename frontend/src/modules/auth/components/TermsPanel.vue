<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getCurrentTerms, acceptTerms, getMyAcceptances } from '../api/access-flows-api'
import { getSession } from '../api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import { dateTime } from '../../../shared/format'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import RemoteState from '../../../shared/components/RemoteState.vue'
import TermsDocument from './TermsDocument.vue'

const props = defineProps<{ allowAcceptance?: boolean }>()
const emit = defineEmits<{ read: [versionId: string | null] }>()
const terms = useRemote(getCurrentTerms, () => true, false)
const acceptances = useRemote(async (signal) => {
  const session = getSession()
  return session ? getMyAcceptances(session.user.id, signal) : []
}, () => true, false)
const checked = ref(false)
const displayedVersion = ref<string | null>(null)
const sending = ref(false)
const error = ref('')
const uncertain = ref(false)
const showTerms = ref(false)
const content = ref<HTMLElement | null>(null)
const loading = computed(() => terms.loading.value || acceptances.loading.value)
const loadError = computed(() => terms.error.value || acceptances.error.value)
const ready = computed(() => !!displayedVersion.value && displayedVersion.value === terms.data.value?.id && !loading.value && !loadError.value)
const currentAcceptance = computed(() => acceptances.data.value?.find((item) => item.termsVersionId === terms.data.value?.id))
const acceptedNotice = computed(() => currentAcceptance.value ? `Ya aceptaste los términos y condiciones el ${dateTime(currentAcceptance.value.acceptedAt)}` : null)

function invalidate() {
  checked.value = false
  displayedVersion.value = null
  emit('read', null)
}
// También invalida cambios de contenido/versión y fallos fuera de la apertura inicial.
watch([terms.data, loading, loadError], invalidate, { flush: 'sync' })
async function load() {
  invalidate()
  error.value = ''
  const tasks = [terms.refresh()]
  if (props.allowAcceptance) tasks.push(acceptances.refresh())
  await Promise.all(tasks)
  await nextTick()
  if (showTerms.value && content.value && terms.data.value && !loading.value && !loadError.value)
    displayedVersion.value = terms.data.value.id
  if (currentAcceptance.value) uncertain.value = false
}
async function open() {
  showTerms.value = true
  await load()
}
onMounted(() => { if (props.allowAcceptance) void load() })
function change() {
  emit('read', checked.value && ready.value ? displayedVersion.value : null)
}
async function accept() {
  if (!props.allowAcceptance || sending.value || uncertain.value || !checked.value || !ready.value || !terms.data.value) return
  const session = getSession()
  if (!session) return
  const versionId = terms.data.value.id
  sending.value = true
  error.value = ''
  try {
    const result = await acceptTerms(session.user.id, versionId)
    acceptances.data.value = [...(acceptances.data.value ?? []), result]
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
    invalidate()
  } finally { sending.value = false }
}
</script>

<template>
  <section class="terms-panel" aria-label="Términos y condiciones">
    <h2>Términos y condiciones</h2>
    <p>Consulta la versión vigente antes de aceptar las condiciones de préstamo y las posibles penalizaciones.</p>
    <button type="button" aria-haspopup="dialog" :disabled="loading || sending" @click="open">Consultar términos actuales</button>
    <p v-if="acceptedNotice" role="status" class="notice">{{ acceptedNotice }}</p>
    <template v-else>
      <p class="terms-hint">Abre el documento y espera su carga completa para habilitar la casilla. Esto no comprueba la lectura ni la comprensión humana.</p>
      <label class="terms-consent"><input v-model="checked" type="checkbox" :disabled="!ready || sending || uncertain" @change="change" />He leído y acepto los términos y condiciones de la versión consultada.</label>
      <button v-if="allowAcceptance" type="button" :disabled="!checked || !ready || sending || uncertain" @click="accept">{{ sending ? 'Registrando…' : 'Registrar aceptación' }}</button>
    </template>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="uncertain" role="alert" class="error">Resultado incierto. Consulta tu historial antes de repetir la aceptación.</p>
    <ModalDialog v-if="showTerms" title="Términos y condiciones" class="registration-terms-dialog" :busy="sending" @close="showTerms = false">
      <RemoteState :loading="loading" :error="loadError" @retry="load">
        <template v-if="terms.data.value">
          <h3>{{ terms.data.value.title }} · versión {{ terms.data.value.number }}</h3>
          <div ref="content" class="terms-content" tabindex="0" aria-label="Contenido completo de los términos">
            <TermsDocument :content="terms.data.value.content" />
          </div>
        </template>
      </RemoteState>
      <button type="button" :disabled="loading || sending" @click="load">Actualizar versión</button>
      <button type="button" :disabled="sending" @click="showTerms = false">Cerrar documento</button>
    </ModalDialog>
  </section>
</template>

<style scoped>
.terms-panel { font-size: 14px; line-height: 1.6; color: #334155; }
.terms-panel h2, .registration-terms-dialog h3 { font-weight: 700; }
.terms-panel button { border: 1px solid #94a3b8; border-radius: 8px; padding: .6rem; margin: .5rem .5rem .5rem 0; background: white; color: #17375e; }
.terms-panel button:disabled { opacity: .5; cursor: not-allowed; }
.terms-panel :is(button, input):focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
.terms-consent { display: flex; align-items: start; gap: 10px; }
.terms-consent input { width: 17px; height: 17px; flex-shrink: 0; margin-top: 4px; accent-color: #1e3a5f; }
.terms-hint { margin: .5rem 0; color: #64748b; font-size: 12px; }
.registration-terms-dialog { max-width: min(820px, calc(100vw - 2rem)); }
.terms-content { max-height: 54dvh; overflow: auto; overscroll-behavior: contain; padding: 1rem .5rem; margin: .5rem 0; }
.error { padding: .75rem; border-radius: 8px; background: #fef2f2; color: #991b1b; }
.notice { color: #15803d; }
</style>
