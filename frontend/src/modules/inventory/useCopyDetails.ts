import { onBeforeUnmount, ref, watch, type WatchSource } from 'vue'
import { getCopy, type CopyDetail } from './api/inventory-api'

// Los listados de préstamos y reservas comparten la resolución de ejemplares.
// Un fallo conserva el identificador original, nunca un nombre inventado.
export function useCopyDetails(source: WatchSource<readonly { copyId: string }[] | null>) {
  const copies = ref<Record<string, CopyDetail>>({})
  const pending = new Set<string>()
  const controller = new AbortController()
  watch(source, list => {
    for (const id of new Set(list?.map(item => item.copyId))) {
      if (copies.value[id] || pending.has(id)) continue
      pending.add(id)
      void getCopy(id, controller.signal)
        .then(copy => { if (!controller.signal.aborted) copies.value[id] = copy })
        .catch(() => { /* El listado sigue disponible con el identificador del ejemplar. */ })
        .finally(() => pending.delete(id))
    }
  }, { immediate: true })
  onBeforeUnmount(() => controller.abort())
  return copies
}
