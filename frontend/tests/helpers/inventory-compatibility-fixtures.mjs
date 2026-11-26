export function compatibility(ready = true, capabilities = {}) {
  return {
    status: ready ? 'READY' : 'UPDATE_PENDING',
    message: ready ? null : 'Actualización de inventario pendiente. La disponibilidad no se puede verificar y las operaciones de circulación están deshabilitadas.',
    capabilities: { physicalCondition: ready, administrativeEnablement: ready, verifiedAvailability: ready, ...capabilities },
    actions: { descriptiveEdits: true, create: ready, activate: ready, release: ready, rehabilitate: ready, manageCopy: ready },
  }
}
export function inventoryResource(ready = true, extra = {}) {
  return {
    id: 'r1', categoriaId: 'cat1', nombre: 'Multímetro', descripcion: null, activo: true, durationHours: null,
    available: ready ? true : null, availableCopies: ready ? 1 : null, totalCopies: 4,
    registeredStock: { libres: 1, prestados: 1, retenidos: 1, reservados: 1 }, compatibility: compatibility(ready),
    ...extra,
  }
}
export function inventoryCopy(ready = true, extra = {}) {
  return { id: 'c1', recursoId: 'r1', codigoInventario: 'INV-1', estado: 'DISPONIBLE',
    condicionFisica: ready ? 'APTO' : null, habilitado: ready ? true : null, compatibility: compatibility(ready), ...extra }
}
