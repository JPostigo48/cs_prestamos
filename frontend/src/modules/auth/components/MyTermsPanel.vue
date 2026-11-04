<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { CheckCircle2, ChevronRight, FileText } from '@lucide/vue'
import { acceptTerms, getCurrentTerms, getMyAcceptances, getTermsVersion, type Terms } from '../api/access-flows-api'
import { getSession } from '../api/auth-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import RemoteState from '../../../shared/components/RemoteState.vue'
import TermsDocument from './TermsDocument.vue'

const session = getSession()
const history = useRemote(async (signal) => {
  if (!session) throw new Error('Inicia sesión para consultar tus términos.')
  const [current, acceptances] = await Promise.all([
    getCurrentTerms(signal), getMyAcceptances(session.user.id, signal),
  ])
  const ids = [...new Set(acceptances.map((item) => item.termsVersionId))].filter((id) => id !== current.id)
  const previous = await Promise.allSettled(ids.map((id) => getTermsVersion(id, signal)))
  const versions: Terms[] = [current]
  const unavailable: string[] = []
  previous.forEach((result, index) => {
    if (result.status === 'fulfilled') versions.push(result.value)
    else unavailable.push(ids[index]!)
  })
  versions.sort((a, b) => b.number - a.number)
  return { current, acceptances, versions, unavailable }
})
const selected = ref<Terms | null>(null)
const content = ref<HTMLElement | null>(null)
const read = ref(false)
const checked = ref(false)
const sending = ref(false)
const error = ref('')
const acceptanceByVersion = computed(() => new Map((history.data.value?.acceptances ?? []).map((item) => [item.termsVersionId, item])))
const canAccept = computed(() => selected.value?.id === history.data.value?.current.id && !acceptanceByVersion.value.has(selected.value?.id ?? ''))
function dateOnly(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' })
}
async function open(version: Terms) {
  selected.value = version
  checked.value = false
  read.value = false
  error.value = ''
  await nextTick()
  if (content.value && content.value.scrollHeight <= content.value.clientHeight + 4) read.value = true
}
function scrolled(event: Event) {
  const element = event.target as HTMLElement
  if (element.scrollTop + element.clientHeight >= element.scrollHeight - 4) read.value = true
}
async function accept() {
  if (!session || !selected.value || !history.data.value || !canAccept.value || !read.value || !checked.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await acceptTerms(session.user.id, selected.value.id)
    history.data.value = { ...history.data.value, acceptances: [...history.data.value.acceptances, result] }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="my-terms" aria-label="Versiones de términos y condiciones">
    <RemoteState :loading="history.loading.value" :error="history.error.value" @retry="history.refresh">
      <template v-if="history.data.value">
        <div v-if="history.data.value.unavailable.length" class="terms-warning" role="alert">
          <p>No pudimos cargar algunas versiones anteriores. Tus aceptaciones se conservan.</p>
          <button type="button" @click="history.refresh">Volver a consultar</button>
        </div>
        <div class="terms-cards">
          <button v-for="version in history.data.value.versions" :key="version.id" type="button" class="terms-card" aria-haspopup="dialog" @click="open(version)">
            <span class="terms-card-icon"><FileText :size="24" aria-hidden="true" /></span>
            <span class="terms-card-copy">
              <span class="terms-version">Versión {{ version.number }}<span v-if="version.id === history.data.value.current.id" class="current-version">Actual</span></span>
              <span class="terms-card-title">{{ version.title }}</span>
              <span v-if="version.publishedAt" class="terms-publication">{{ dateOnly(version.publishedAt) }}</span>
            </span>
            <span v-if="acceptanceByVersion.has(version.id)" class="terms-accepted">
              <CheckCircle2 :size="28" aria-hidden="true" /><span class="sr-only">Aceptado el</span>
              <time :datetime="acceptanceByVersion.get(version.id)!.acceptedAt">{{ dateOnly(acceptanceByVersion.get(version.id)!.acceptedAt) }}</time>
            </span>
            <ChevronRight v-else :size="22" class="terms-open-icon" aria-hidden="true" />
          </button>
        </div>
      </template>
    </RemoteState>

    <ModalDialog v-if="selected" class="terms-version-dialog" :title="selected.title" :subtitle="`Versión ${selected.number}${selected.id === history.data.value?.current.id ? ' · Actual' : ''}`" :busy="sending" @close="selected = null">
      <div ref="content" class="terms-document-scroll" tabindex="0" aria-label="Contenido de los términos y condiciones" @scroll="scrolled">
        <TermsDocument :content="selected.content" />
      </div>
      <footer class="terms-dialog-footer">
        <p v-if="acceptanceByVersion.has(selected.id)" class="accepted-message" role="status"><CheckCircle2 :size="20" aria-hidden="true" />Aceptado el {{ dateOnly(acceptanceByVersion.get(selected.id)!.acceptedAt) }}</p>
        <template v-else-if="canAccept">
          <p v-if="!read" class="terms-read-hint">Lee hasta el final para poder aceptar esta versión.</p>
          <label class="terms-consent"><input v-model="checked" type="checkbox" :disabled="!read || sending" />He leído y acepto estos términos y condiciones.</label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary" type="button" :disabled="!read || !checked || sending" @click="accept">{{ sending ? 'Registrando…' : 'Aceptar términos' }}</button>
        </template>
      </footer>
    </ModalDialog>
  </section>
</template>

<style scoped>
.my-terms, .terms-cards { width: 100%; min-width: 0; }
.terms-cards { display: flex; flex-direction: column; gap: 16px; }
.terms-card { display: flex; align-items: center; gap: 20px; width: 100%; padding: 24px; border: 1px solid #dce4ef; border-radius: 14px; background: white; text-align: left; box-shadow: 0 3px 12px #17375e05; }
.terms-card:hover { background: #f8fbff; border-color: #93b4df; box-shadow: 0 5px 18px #17375e0a; }
.terms-card-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 48px; height: 56px; border-radius: 12px; background: #eff6ff; color: #24548a; }
.terms-card-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 7px; }
.terms-version { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12px; color: #64748b; }
.current-version { padding: 2px 9px; border-radius: 20px; background: #eaf2ff; color: #24548a; font-size: 11px; font-weight: 700; }
.terms-card-title { font-size: 17px; font-weight: 700; line-height: 1.5; color: #17375e; overflow-wrap: anywhere; }
.terms-publication { font-size: 12px; color: #64748b; }
.terms-accepted { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; color: #16a34a; }
.terms-accepted time { font-size: 11px; font-weight: 500; color: #64748b; }
.terms-open-icon { color: #94a3b8; }
.terms-warning { padding: 16px; border: 1px solid #fde68a; border-radius: 10px; background: #fffbeb; margin-bottom: 20px; font-size: 14px; color: #92400e; }
.terms-warning button { margin-top: 10px; }
.terms-version-dialog { max-width: min(820px, calc(100vw - 2rem)); padding: 28px; }
.terms-document-scroll { max-height: 54dvh; overflow-y: auto; overscroll-behavior: contain; padding: 4px 20px 8px 4px; scrollbar-gutter: stable; }
.terms-dialog-footer { padding-top: 20px; margin-top: 20px; border-top: 1px solid #e2e8f0; }
.accepted-message { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #15803d; }
.terms-read-hint { margin-bottom: 12px; color: #64748b; font-size: 13px; }
.terms-dialog-footer .terms-consent { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.terms-consent input { width: 17px; height: 17px; flex-shrink: 0; margin-top: 3px; accent-color: #1e3a5f; }
.terms-dialog-footer .error { margin-bottom: 12px; }
@media (max-width: 600px) {
  .terms-card { padding: 18px 14px; gap: 12px; }
  .terms-card-icon { display: none; }
  .terms-card-title { font-size: 15px; }
  .terms-version-dialog { padding: 20px; }
  .terms-document-scroll { padding-right: 12px; }
}
</style>
