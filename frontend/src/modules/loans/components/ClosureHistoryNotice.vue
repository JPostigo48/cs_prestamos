<script setup lang="ts">
import type { Loan } from '../api/loans-api'
import { closureHistoryMessage } from '../closure-history'
defineProps<{ loan: Loan }>()
</script>
<template>
  <p v-if="closureHistoryMessage(loan)" role="status">{{ closureHistoryMessage(loan) }}</p>
</template>
