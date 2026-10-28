<script setup lang="ts">
import { getSession } from '../api/auth-api'
import { homeFor } from '../access-policy'
const home = homeFor(getSession()!.user.role)
</script>
<template><section class="panel"><h1>Acceso denegado</h1><p>No tienes permiso para acceder a esta sección. Tu sesión sigue abierta.</p><RouterLink :to="home">Volver a mi panel</RouterLink></section></template>
