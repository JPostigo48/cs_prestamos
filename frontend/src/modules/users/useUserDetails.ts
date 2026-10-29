import { onBeforeUnmount, ref, watch, type WatchSource } from 'vue'
import { getUser, type UserProfile } from './api/student-api'

// Las vistas de personal resuelven los titulares sin duplicar consultas entre filas.
export function useUserDetails(source: WatchSource<readonly { userId: string }[] | null>) {
  const users = ref<Record<string, UserProfile>>({})
  const pending = new Set<string>()
  const controller = new AbortController()
  watch(source, list => {
    for (const id of new Set(list?.map(item => item.userId))) {
      if (users.value[id] || pending.has(id)) continue
      pending.add(id)
      void getUser(id, controller.signal)
        .then(user => { if (!controller.signal.aborted) users.value[id] = user })
        .catch(() => { /* Se conserva el identificador del titular, sin datos inferidos. */ })
        .finally(() => pending.delete(id))
    }
  }, { immediate: true })
  onBeforeUnmount(() => controller.abort())
  return users
}
