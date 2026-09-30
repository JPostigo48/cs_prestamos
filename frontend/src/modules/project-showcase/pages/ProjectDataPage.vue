<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Modelos</p>
    <h1 class="mt-2 text-3xl font-bold">Datos y dominio</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Estos modelos responden a preguntas diferentes y no deben interpretarse como una sola representación.</p>

    <div class="mt-8 grid gap-5 lg:grid-cols-3">
      <article class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-bold">Modelo de dominio</h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">Conceptos y reglas del negocio: Usuario, Recurso, Ejemplar y Préstamo, entre otros agregados documentados.</p>
        <p class="mt-5 text-xs text-slate-500">Fuente: docs/architecture/uml/modelo-dominio.puml</p>
        <RouterLink to="/project/architecture" class="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline">Ver diagrama →</RouterLink>
      </article>
      <article class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-bold">Modelo de persistencia</h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">Describe cómo se almacenan los datos mediante Prisma y PostgreSQL. No sustituye las invariantes del modelo conceptual.</p>
        <p class="mt-5 text-xs text-slate-500">Fuente: backend/prisma/contract.prisma y migraciones</p>
        <span class="mt-4 inline-block text-sm text-slate-500">Visualización relacional pendiente</span>
      </article>
      <article class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-bold">Arquitectura</h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">Organiza frontend, backend, módulos, capas y persistencia; no representa tablas ni atributos de entidades.</p>
        <p class="mt-5 text-xs text-slate-500">Fuentes: PlantUML y Structurizr</p>
        <RouterLink to="/project/architecture" class="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline">Ver arquitectura →</RouterLink>
      </article>
    </div>
  </section>
</template>
