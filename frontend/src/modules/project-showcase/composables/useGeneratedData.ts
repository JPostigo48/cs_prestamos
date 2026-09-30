import { onMounted, shallowRef, ref } from 'vue'

export function useGeneratedData<T>(load: () => Promise<T | null>) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)

  onMounted(async () => {
    data.value = await load()
    loading.value = false
  })

  return { data, loading }
}
