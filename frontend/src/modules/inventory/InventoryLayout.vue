<template>
  <nav class="inventory-sections" aria-label="Secciones de inventario">
    <RouterLink to="/app/admin/inventory" :aria-current="$route.path === '/app/admin/inventory' ? 'page' : undefined">Recursos y ejemplares</RouterLink>
    <RouterLink to="/app/admin/inventory/categories" :aria-current="$route.path === '/app/admin/inventory/categories' ? 'page' : undefined">Categorías</RouterLink>
  </nav>
  <RouterView />
</template>
<style scoped>
.inventory-sections { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.inventory-sections a { padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; color: #475569; text-decoration: none; font-size: 14px; }
.inventory-sections [aria-current] { background: #1e3a5f; border-color: #1e3a5f; color: white; }
</style>
