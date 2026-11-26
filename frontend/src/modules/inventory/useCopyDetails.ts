import { onBeforeUnmount, ref, watch, type WatchSource } from 'vue'
import { getCopy, type CopyDetail } from './api/inventory-api'

// Los listados de préstamos y reservas comparten la resolución de ejemplares.
// Un fallo conserva el identificador original, nunca un nombre inventado.
export function useCopyDetails(source: WatchSource<readonly { copyId: string }[] | null>, options: { revalidateOnChange?: boolean } = {}) {
  const copies = ref<Record<string, CopyDetail>>({})
  let pending = new Set<string>()
  let controller = new AbortController()
  watch(source, list => {
    if (options.revalidateOnChange) {
      controller.abort()
      controller = new AbortController()
      pending = new Set<string>()
      // No stale READY capability while the refreshed details are unverified.
      copies.value = {}
    }
    const requestController = controller
    const requestPending = pending
    for (const id of new Set(list?.map(item => item.copyId))) {
      if (copies.value[id] || pending.has(id)) continue
      pending.add(id)
      void getCopy(id, requestController.signal)
        .then(copy => { if (!requestController.signal.aborted) copies.value[id] = copy })
        .catch(() => { /* El listado sigue disponible con el identificador del ejemplar. */ })
        .finally(() => requestPending.delete(id))
    }
  }, { immediate: true })
  onBeforeUnmount(() => controller.abort())
  return copies
}
