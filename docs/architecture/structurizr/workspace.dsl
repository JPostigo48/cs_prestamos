workspace "Préstamos universitarios" "Modelo estratégico DDD del sistema de gestión de préstamos universitarios. Vista táctica de bounded contexts, agregados y conceptos clave — no representa una implementación ni un despliegue." {

    model {

        # ============================================================
        # BOUNDED CONTEXTS (vista estratégica)
        # ============================================================

        prestamos = element "Préstamos (loans)" "Bounded Context · central" "Registra préstamos y devoluciones; coordina las condiciones para ocupar un ejemplar." {
            tags "BoundedContext,Central"
        }

        inventario = element "Inventario (inventory)" "Bounded Context · soporte" "Gestiona recursos, ejemplares físicos y su disponibilidad." {
            tags "BoundedContext,Soporte"
        }

        usuarios = element "Usuarios (users)" "Bounded Context · soporte" "Gestiona solicitudes de registro, vinculación e identidad institucional del usuario." {
            tags "BoundedContext,Soporte"
        }

        confianza = element "Confianza (trust)" "Bounded Context · soporte" "Mantiene porcentaje, nivel, restricciones, sanciones y apelaciones del usuario." {
            tags "BoundedContext,Soporte"
        }

        reglas = element "Reglas y Términos" "Área de dominio · límite por validar" "Administra reglas vigentes, versiones, incumplimientos y términos aceptados." {
            tags "BoundedContext,AreaDominio"
        }

        autenticacion = element "Autenticación (auth)" "Bounded Context · genérico de apoyo" "Proporciona identidad autenticada, rol y control de acceso." {
            tags "BoundedContext,Generico"
        }


        # ============================================================
        # PRÉSTAMOS · elementos internos
        # ============================================================

        aggPrestamo = element "Agregado Préstamo" "Aggregate" "Límite de consistencia del préstamo y su devolución." {
            tags "Aggregate"
        }
        rootPrestamo = element "Préstamo" "Aggregate Root" "Referencia usuarioId y ejemplarId; controla el intervalo del préstamo." {
            tags "AggregateRoot"
        }
        estadoPrestamo = element "EstadoPrestamo" "Enumeración" "PLANIFICADO, ACTIVO o FINALIZADO." {
            tags "Enumeracion"
        }
        devolucionPrestamo = element "Devolución" "Value Object" "Cierra el préstamo; fecha >= fechaInicio del préstamo." {
            tags "ValueObject"
        }
        intervaloPrestamo = element "fechaInicio – fechaFin" "Concepto" "Intervalo temporal en el que el ejemplar queda ocupado." {
            tags "Concepto"
        }
        refUsuarioPrestamo = element "usuarioId (préstamo)" "Referencia externa" "Referencia a Usuario; no carga el agregado Usuarios." {
            tags "ExternalRef"
        }
        refEjemplarPrestamo = element "ejemplarId (préstamo)" "Referencia externa" "Referencia a Ejemplar; no carga el agregado Inventario." {
            tags "ExternalRef"
        }
        invIntervaloEjemplar = element "Invariante: sin superposición" "Regla de dominio" "Un ejemplar no puede tener intervalos activos o planificados superpuestos." {
            tags "Invariante"
        }


        # ============================================================
        # INVENTARIO · elementos internos
        # ============================================================

        aggCategoria = element "Agregado Categoría de Recurso" "Aggregate" "Clasifica recursos y define el tiempo máximo de préstamo." {
            tags "Aggregate"
        }
        rootCategoria = element "CategoriaRecurso" "Aggregate Root" "Categoría del recurso." {
            tags "AggregateRoot"
        }
        tiempoMaximoPrestamo = element "Tiempo máximo de préstamo" "Concepto" "Plazo máximo asociado a la categoría." {
            tags "Concepto"
        }
        aggRecurso = element "Agregado Recurso" "Aggregate" "Entrada del catálogo; agrupa la disponibilidad conceptual del recurso." {
            tags "Aggregate"
        }
        rootRecurso = element "Recurso" "Aggregate Root" "Libro, equipo u otro recurso académico registrado." {
            tags "AggregateRoot"
        }
        refCategoriaRecurso = element "categoriaId" "Referencia interna" "Referencia del recurso a su categoría." {
            tags "ExternalRef"
        }
        disponibilidadRecurso = element "Disponibilidad derivada" "Atributo derivado" "Existe al menos un ejemplar en estado DISPONIBLE." {
            tags "Invariante"
        }
        aggEjemplar = element "Agregado Ejemplar" "Aggregate" "Unidad física prestable de un recurso." {
            tags "Aggregate"
        }
        rootEjemplar = element "Ejemplar" "Aggregate Root" "Unidad física identificable." {
            tags "AggregateRoot"
        }
        estadoEjemplar = element "EstadoEjemplar" "Enumeración" "DISPONIBLE, PRESTADO o NO_DISPONIBLE." {
            tags "Enumeracion"
        }
        observacionEjemplar = element "ObservacionEjemplar" "Entity" "Registra observaciones o incidencias del ejemplar (0..*)." {
            tags "Entity"
        }


        # ============================================================
        # USUARIOS · elementos internos
        # ============================================================

        aggSolicitudRegistro = element "Agregado Solicitud de Registro" "Aggregate" "Gestiona la solicitud antes de habilitar una cuenta." {
            tags "Aggregate"
        }
        rootSolicitudRegistro = element "SolicitudRegistro" "Aggregate Root" "Solicitud pendiente, aprobada o rechazada." {
            tags "AggregateRoot"
        }
        evidenciasVinculacion = element "EvidenciaVinculacion" "Value Object" "Información para verificar vinculación institucional vigente." {
            tags "ValueObject"
        }
        estadoSolicitud = element "EstadoSolicitud" "Enumeración" "PENDIENTE, APROBADA o RECHAZADA." {
            tags "Enumeracion"
        }
        tipoUsuario = element "TipoUsuario" "Enumeración" "ESTUDIANTE, DOCENTE o ADMINISTRATIVO." {
            tags "Enumeracion"
        }
        aggUsuario = element "Agregado Usuario" "Aggregate" "Identidad institucional y vinculación vigente." {
            tags "Aggregate"
        }
        rootUsuario = element "Usuario" "Aggregate Root" "Raíz del usuario institucional." {
            tags "AggregateRoot"
        }


        # ============================================================
        # CONFIANZA · elementos internos
        # ============================================================

        aggPerfilConfianza = element "Agregado Perfil de Confianza" "Aggregate" "Porcentaje y nivel de confianza asociados a un usuario por usuarioId." {
            tags "Aggregate"
        }
        rootPerfilConfianza = element "PerfilConfianza" "Aggregate Root" "Mantiene el porcentaje y deriva el nivel de confianza." {
            tags "AggregateRoot"
        }
        porcentajeConfianza = element "PorcentajeConfianza" "Value Object" "Valor entre 0 y 100 asociado al perfil." {
            tags "ValueObject"
        }
        nivelConfianza = element "NivelConfianza" "Atributo derivado" "Cuatro niveles derivados del porcentaje; umbrales pendientes de definir." {
            tags "Concepto"
        }
        restriccionesConfianza = element "Restricciones por confianza" "Política de dominio" "Condiciones aplicables según el nivel o una sanción activa; detalle pendiente de definir." {
            tags "Concepto"
        }
        aggSancion = element "Agregado Sanción" "Aggregate" "Penalización aplicada con intervalo e historial propios." {
            tags "Aggregate"
        }
        rootSancion = element "Sanción" "Aggregate Root" "Conserva usuario, incumplimiento, versión, operador, intervalo y cambio de confianza." {
            tags "AggregateRoot"
        }
        estadoSancion = element "EstadoSancion" "Enumeración" "ACTIVA, FINALIZADA o ABSUELTA." {
            tags "Enumeracion"
        }
        aggApelacion = element "Agregado Apelación" "Aggregate" "Solicitud de revisión de una sanción activa." {
            tags "Aggregate"
        }
        rootApelacion = element "Apelación" "Aggregate Root" "Conserva sanción, usuario, motivo, estado y resolución administrativa." {
            tags "AggregateRoot"
        }
        estadoApelacion = element "EstadoApelacion" "Enumeración" "PENDIENTE, ACEPTADA o RECHAZADA." {
            tags "Enumeracion"
        }
        invApelacionSancion = element "Invariante: sanción apelable" "Regla de dominio" "El usuario afectado apela una sanción activa; solo un administrador la resuelve." {
            tags "Invariante"
        }
        refUsuarioConfianza = element "usuarioId (confianza)" "Referencia externa" "Referencia a Usuario sin cargar el agregado Usuarios." {
            tags "ExternalRef"
        }
        refReglasSancion = element "incumplimientoId · reglaId · versionReglaId" "Referencias externas" "Conservan el origen histórico de la sanción en Reglas y Términos." {
            tags "ExternalRef"
        }
        refCuentaResolucion = element "cuentaOperadorId · administradorId" "Referencias externas" "Identifican las cuentas que imponen la sanción o resuelven la apelación." {
            tags "ExternalRef"
        }


        # ============================================================
        # REGLAS Y TÉRMINOS · elementos internos
        # ============================================================

        aggReglaUso = element "Agregado Regla de Uso" "Aggregate" "Identidad estable de una regla de uso." {
            tags "Aggregate"
        }
        rootReglaUso = element "ReglaUso" "Aggregate Root" "Mantiene la referencia a su versión vigente." {
            tags "AggregateRoot"
        }
        versionVigente = element "versionVigenteId" "Referencia interna" "Identifica la versión actualmente vigente de una regla." {
            tags "ExternalRef"
        }
        aggVersionRegla = element "Agregado Versión de Regla" "Aggregate" "Versión histórica e inmutable de una regla." {
            tags "Aggregate"
        }
        rootVersionRegla = element "VersionRegla" "Aggregate Root" "Conserva contenido, penalización porcentual y consecuencia." {
            tags "AggregateRoot"
        }
        estadoRegla = element "EstadoRegla" "Enumeración" "ACTIVA o INACTIVA." {
            tags "Enumeracion"
        }
        aggIncumplimiento = element "Agregado Incumplimiento" "Aggregate" "Registro histórico e inmutable de una infracción." {
            tags "Aggregate"
        }
        rootIncumplimiento = element "Incumplimiento" "Aggregate Root" "Conserva la versión infringida y la penalización realmente aplicada." {
            tags "AggregateRoot"
        }
        invHistorialReglas = element "Invariante: historial estable" "Regla de dominio" "Cambios posteriores de reglas no alteran incumplimientos ya registrados." {
            tags "Invariante"
        }
        notaHistorialIncumplimientos = element "Historial de incumplimientos" "Aclaración" "Conserva la versión de la regla infringida y la penalización realmente aplicada, incluso si la regla cambia después." {
            tags "Aclaracion"
        }
        refUsuarioReglas = element "usuarioId (reglas)" "Referencia externa" "Referencia al usuario asociado al incumplimiento o la aceptación." {
            tags "ExternalRef"
        }
        aggVersionTerminos = element "Agregado Versión de Términos" "Aggregate" "Versión concreta y numerada de términos y condiciones." {
            tags "Aggregate"
        }
        rootVersionTerminos = element "VersionTerminos" "Aggregate Root" "Versión de términos identificada por número." {
            tags "AggregateRoot"
        }
        aggAceptacionTerminos = element "Agregado Aceptación de Términos" "Aggregate" "Registro de aceptación de una versión concreta." {
            tags "Aggregate"
        }
        rootAceptacionTerminos = element "AceptaciónTérminos" "Aggregate Root" "Aceptación de una versión de términos por un usuario." {
            tags "AggregateRoot"
        }


        # ============================================================
        # AUTENTICACIÓN · elementos internos
        # ============================================================

        aggCuentaAcceso = element "Agregado Cuenta de Acceso" "Aggregate" "Credenciales y control de acceso asociados a un usuario." {
            tags "Aggregate"
        }
        rootCuentaAcceso = element "CuentaAcceso" "Aggregate Root" "Cuenta asociada a usuarioId." {
            tags "AggregateRoot"
        }
        rolesAcceso = element "RolAcceso" "Enumeración" "USUARIO, OPERADOR o ADMINISTRADOR." {
            tags "Enumeracion"
        }
        refUsuarioAuth = element "usuarioId (autenticación)" "Referencia externa" "Vincula la cuenta con Usuario." {
            tags "ExternalRef"
        }
        tipoUsuarioReferencia = element "TipoUsuario pertenece a Usuarios" "Aclaración" "Estudiante, docente o administrativo describe la vinculación institucional, no un permiso de acceso." {
            tags "Aclaracion"
        }
        rolNoTipo = element "RolAcceso no es TipoUsuario" "Invariante conceptual" "Administrador es un rol de acceso; administrativo es un tipo institucional. No deben confundirse." {
            tags "Invariante"
        }


        # ============================================================
        # RELACIONES ESTRATÉGICAS (entre bounded contexts)
        # ============================================================

        prestamos -> usuarios "verifica habilitación del usuario" "" "Estrategica"
        prestamos -> confianza "consulta restricciones vigentes" "" "Estrategica"
        prestamos -> inventario "consulta disponibilidad y ocupa ejemplares" "" "Estrategica"
        prestamos -> autenticacion "requiere identidad y permisos" "" "Estrategica"
        reglas -> confianza "un incumplimiento puede originar una sanción" "" "Estrategica"
        confianza -> usuarios "referencia al usuario sancionado" "" "Estrategica"
        confianza -> reglas "conserva incumplimiento, regla y versión" "" "Estrategica"
        confianza -> autenticacion "identifica operador y administrador" "" "Estrategica"
        autenticacion -> usuarios "vincula cuenta con usuario" "" "Estrategica"


        # ============================================================
        # PRÉSTAMOS · relaciones internas
        # ============================================================

        prestamos -> aggPrestamo "contiene"
        aggPrestamo -> rootPrestamo "raíz"
        rootPrestamo -> estadoPrestamo "estado" "" "Derivacion"
        rootPrestamo -> intervaloPrestamo "usa"
        rootPrestamo -> refUsuarioPrestamo "usuarioId" "" "Derivacion"
        rootPrestamo -> refEjemplarPrestamo "ejemplarId" "" "Derivacion"
        rootPrestamo -> invIntervaloEjemplar "cumple"
        rootPrestamo -> devolucionPrestamo "contiene 0..1"


        # ============================================================
        # INVENTARIO · relaciones internas
        # ============================================================

        inventario -> aggCategoria "contiene"
        inventario -> aggRecurso "contiene"
        inventario -> aggEjemplar "contiene"
        aggCategoria -> rootCategoria "raíz"
        rootCategoria -> tiempoMaximoPrestamo "define"
        aggRecurso -> rootRecurso "raíz"
        rootRecurso -> refCategoriaRecurso "referencia" "" "Derivacion"
        rootCategoria -> rootRecurso "1 a muchos"
        rootRecurso -> disponibilidadRecurso "deriva" "" "Derivacion"
        aggEjemplar -> rootEjemplar "raíz"
        rootRecurso -> rootEjemplar "1 a muchos"
        rootEjemplar -> rootRecurso "pertenece a"
        rootEjemplar -> estadoEjemplar "estado" "" "Derivacion"
        rootEjemplar -> observacionEjemplar "observaciones"
        estadoEjemplar -> disponibilidadRecurso "al menos uno DISPONIBLE" "" "Derivacion"


        # ============================================================
        # USUARIOS · relaciones internas
        # ============================================================

        usuarios -> aggSolicitudRegistro "contiene"
        usuarios -> aggUsuario "contiene"
        aggSolicitudRegistro -> rootSolicitudRegistro "raíz"
        rootSolicitudRegistro -> evidenciasVinculacion "incluye"
        rootSolicitudRegistro -> estadoSolicitud "estado" "" "Derivacion"
        rootSolicitudRegistro -> tipoUsuario "tipoUsuario" "" "Derivacion"
        rootSolicitudRegistro -> rootUsuario "aprobada origina"
        aggUsuario -> rootUsuario "raíz"
        rootUsuario -> tipoUsuario "tipoUsuario" "" "Derivacion"


        # ============================================================
        # CONFIANZA · relaciones internas
        # ============================================================

        confianza -> aggPerfilConfianza "contiene"
        confianza -> aggSancion "contiene"
        confianza -> aggApelacion "contiene"
        aggPerfilConfianza -> rootPerfilConfianza "raíz"
        rootPerfilConfianza -> porcentajeConfianza "posee"
        porcentajeConfianza -> nivelConfianza "deriva" "" "Derivacion"
        nivelConfianza -> restriccionesConfianza "condiciona"
        rootPerfilConfianza -> refUsuarioConfianza "usuarioId" "" "Derivacion"
        aggSancion -> rootSancion "raíz"
        rootSancion -> estadoSancion "estado" "" "Derivacion"
        rootSancion -> refUsuarioConfianza "usuarioId" "" "Derivacion"
        rootSancion -> refReglasSancion "origen histórico" "" "Derivacion"
        rootSancion -> refCuentaResolucion "cuentaOperadorId" "" "Derivacion"
        rootSancion -> restriccionesConfianza "activa restricción"
        aggApelacion -> rootApelacion "raíz"
        rootApelacion -> rootSancion "apela"
        rootApelacion -> estadoApelacion "estado" "" "Derivacion"
        rootApelacion -> invApelacionSancion "cumple"
        rootApelacion -> refUsuarioConfianza "usuarioId" "" "Derivacion"
        rootApelacion -> refCuentaResolucion "administradorId" "" "Derivacion"


        # ============================================================
        # REGLAS Y TÉRMINOS · relaciones internas
        # ============================================================

        reglas -> aggReglaUso "contiene"
        reglas -> aggVersionRegla "contiene"
        reglas -> aggIncumplimiento "contiene"
        reglas -> aggVersionTerminos "contiene"
        reglas -> aggAceptacionTerminos "contiene"

        aggReglaUso -> rootReglaUso "raíz"
        rootReglaUso -> versionVigente "referencia" "" "Derivacion"
        aggVersionRegla -> rootVersionRegla "raíz"
        rootReglaUso -> rootVersionRegla "posee versiones"
        rootVersionRegla -> rootReglaUso "pertenece a"
        rootVersionRegla -> estadoRegla "estado" "" "Derivacion"

        aggIncumplimiento -> rootIncumplimiento "raíz"
        rootIncumplimiento -> rootVersionRegla "versión infringida"
        rootIncumplimiento -> invHistorialReglas "cumple"
        rootVersionRegla -> invHistorialReglas "histórica"
        rootIncumplimiento -> refUsuarioReglas "usuarioId" "" "Derivacion"
        notaHistorialIncumplimientos -> rootIncumplimiento "aclara"

        aggVersionTerminos -> rootVersionTerminos "raíz"
        aggAceptacionTerminos -> rootAceptacionTerminos "raíz"
        rootAceptacionTerminos -> rootVersionTerminos "versión aceptada"
        rootAceptacionTerminos -> refUsuarioReglas "usuarioId" "" "Derivacion"


        # ============================================================
        # AUTENTICACIÓN · relaciones internas
        # ============================================================

        autenticacion -> aggCuentaAcceso "contiene"
        aggCuentaAcceso -> rootCuentaAcceso "raíz"
        rootCuentaAcceso -> rolesAcceso "rol" "" "Derivacion"
        rootCuentaAcceso -> refUsuarioAuth "usuarioId" "" "Derivacion"
        rolesAcceso -> rolNoTipo "no equivale" "" "Derivacion"
        tipoUsuarioReferencia -> rolNoTipo "contrasta" "" "Derivacion"
    }

    views {

        custom "01_MapaContextosDDD" {
            title "Mapa general de contextos DDD — préstamos universitarios"
            description "Vista estratégica principal del dominio. Muestra solo bounded contexts y dependencias principales."
            include prestamos inventario usuarios confianza reglas autenticacion
            autoLayout lr 360 240
        }

        custom "02_InteraccionContextosDDD" {
            title "Interacción entre contextos — préstamos universitarios"
            description "Colaboración conceptual entre bounded contexts. No muestra agregados ni entidades internas."
            include prestamos inventario usuarios confianza reglas autenticacion
            autoLayout lr 360 260
        }

        custom "03_InternaPrestamos" {
            title "Préstamos — vista interna"
            description "Agregado, raíz, estado, intervalo, devolución y referencias externas por identificador."
            include prestamos aggPrestamo rootPrestamo estadoPrestamo devolucionPrestamo intervaloPrestamo refUsuarioPrestamo refEjemplarPrestamo invIntervaloEjemplar
            autoLayout lr 320 220
        }

        custom "04_InternaInventario" {
            title "Inventario — vista interna"
            description "Categorías, recursos y ejemplares físicos. La disponibilidad del recurso se deriva de sus ejemplares."
            include inventario aggCategoria rootCategoria tiempoMaximoPrestamo aggRecurso rootRecurso refCategoriaRecurso disponibilidadRecurso aggEjemplar rootEjemplar estadoEjemplar observacionEjemplar
            autoLayout lr 320 220
        }

        custom "05_InternaUsuarios" {
            title "Usuarios — vista interna"
            description "Solicitudes, evidencias e identidad institucional. Confianza referencia al usuario por identificador desde otro contexto."
            include usuarios aggSolicitudRegistro rootSolicitudRegistro evidenciasVinculacion estadoSolicitud tipoUsuario aggUsuario rootUsuario
            autoLayout lr 320 220
        }

        custom "06_InternaReglasTerminos" {
            title "Reglas y Términos — vista interna"
            description "Reglas versionadas, incumplimientos históricos, términos y aceptaciones por versión concreta."
            include reglas aggReglaUso rootReglaUso versionVigente aggVersionRegla rootVersionRegla estadoRegla aggIncumplimiento rootIncumplimiento invHistorialReglas notaHistorialIncumplimientos refUsuarioReglas aggVersionTerminos rootVersionTerminos aggAceptacionTerminos rootAceptacionTerminos
            autoLayout lr 320 220
        }

        custom "07_InternaConfianza" {
            title "Confianza — vista interna"
            description "Perfil, porcentaje, nivel, restricciones, sanciones y apelaciones con referencias externas por identificador."
            include confianza aggPerfilConfianza rootPerfilConfianza porcentajeConfianza nivelConfianza restriccionesConfianza aggSancion rootSancion estadoSancion aggApelacion rootApelacion estadoApelacion invApelacionSancion refUsuarioConfianza refReglasSancion refCuentaResolucion
            autoLayout lr 320 220
        }

        custom "08_InternaAutenticacion" {
            title "Autenticación — vista interna"
            description "Cuenta de acceso, rol y referencia a usuarioId. RolAcceso no equivale a TipoUsuario."
            include autenticacion aggCuentaAcceso rootCuentaAcceso rolesAcceso refUsuarioAuth tipoUsuarioReferencia rolNoTipo
            autoLayout lr 320 220
        }

        styles {

            element "Element" {
                shape RoundedBox
                background #334155
                color #ffffff
                fontSize 24
                width 360
                height 150
            }

            # --- Bounded contexts ---------------------------------------

            element "BoundedContext" {
                shape RoundedBox
                background #334155
                color #ffffff
                fontSize 28
                width 420
                height 170
                stroke #0f172a
                strokeWidth 3
            }
            element "Central" {
                background #075985
                stroke #082f49
                strokeWidth 5
            }
            element "Soporte" {
                background #166534
                stroke #14532d
            }
            element "Generico" {
                background #6b21a8
                stroke #581c87
            }
            element "AreaDominio" {
                background #92400e
                stroke #78350f
                strokeWidth 4
            }

            # --- Bloques tácticos (patrón DDD) --------------------------

            element "Aggregate" {
                shape RoundedBox
                background #fef3c7
                color #422006
                stroke #ca8a04
                strokeWidth 3
                width 360
                height 145
            }
            element "AggregateRoot" {
                shape RoundedBox
                background #f97316
                color #ffffff
                stroke #9a3412
                strokeWidth 4
                width 340
                height 135
            }
            element "Entity" {
                shape RoundedBox
                background #38bdf8
                color #082f49
                stroke #0369a1
                strokeWidth 3
                width 340
                height 130
            }
            element "ValueObject" {
                shape RoundedBox
                background #a78bfa
                color #2e1065
                stroke #6d28d9
                strokeWidth 3
                width 330
                height 125
            }
            element "Enumeracion" {
                shape Ellipse
                background #cbd5e1
                color #0f172a
                stroke #64748b
                width 300
                height 130
            }
            element "Concepto" {
                background #e2e8f0
                color #0f172a
                stroke #64748b
                width 340
                height 125
            }
            element "ExternalRef" {
                shape Box
                background #f8fafc
                color #334155
                stroke #94a3b8
                border dashed
                width 330
                height 120
            }
            element "Invariante" {
                shape Hexagon
                background #fef9c3
                color #422006
                stroke #a16207
                strokeWidth 3
                width 380
                height 140
            }
            element "Aclaracion" {
                shape Box
                background #f8fafc
                color #334155
                stroke #94a3b8
                border dashed
                width 380
                height 130
            }

            # --- Relaciones ----------------------------------------------

            relationship "Relationship" {
                color #475569
                fontSize 20
                thickness 2
            }
            relationship "Estrategica" {
                color #0ea5e9
                fontSize 20
                thickness 4
                style dashed
            }
            relationship "Derivacion" {
                color #94a3b8
                fontSize 18
                thickness 2
                style dotted
            }
        }
    }
}
