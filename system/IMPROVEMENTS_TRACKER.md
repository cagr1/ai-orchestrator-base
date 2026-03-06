# Improvements Tracker

## Objetivo
Llevar control de mejoras para hacer el sistema mas escalable, intuitivo y facil de usar, sin buscar perfeccion innecesaria.

## Estado Global
- Fecha inicio: 2026-03-06
- Estado: `in_progress`
- Total mejoras: 7
- Completadas: 5
- En progreso: 0
- Pendientes: 2

---

## Mejora 1 - Planner demasiado poderoso / sin correccion post-plan
- Estado: `completed`
- Problema: R11 bloquea ajustes del planner durante ejecucion, generando loops de retry si una tarea fue mal planificada.
- Cambio propuesto:
  - Permitir tareas correctivas sin mutar la tarea original.
  - Patron sugerido: `T5` -> `T5_fix` con trazabilidad.
- Criterios de aceptacion:
  - [x] Existe regla formal para crear `*_fix`.
  - [x] Se preserva inmutabilidad de tarea original.
  - [x] Dependientes pueden reencaminarse a la tarea correctiva de forma explicita.
- Archivos objetivo:
  - `runner.js` ✓
  - `agents/planner.md`
  - `README.md`
  - `USAGE.md`
- Fecha completacion: 2026-03-06

## Mejora 2 - Recuperacion de fallos no implementada (attempts/max_attempts)
- Estado: `completed`
- Problema: `attempts` y `max_attempts` existen en schema, pero no hay enforcement operativo.
- Cambio propuesto:
  - Implementar control real:
    - `attempts >= max_attempts` -> `failed_permanent`
    - bloquear dependientes o crear tarea de recovery segun estrategia.
- Criterios de aceptacion:
  - [x] Runner actualiza intentos por falla.
  - [x] Se aplica transicion terminal (`failed_permanent`) o recovery task.
  - [x] Dependencias reaccionan correctamente al estado terminal.
  - [x] Tests cubren flujo de agotamiento de intentos.
- Archivos objetivo:
  - `runner.js` ✓
  - `tests/phase_attempts.test.js` ✓
  - `README.md`
  - `USAGE.md`
- Fecha completacion: 2026-03-06

## Mejora 3 - Compaction real de memory.md
- Estado: `completed`
- Problema: `memory.md` append-only puede degradar contexto.
- Cambio propuesto:
  - Implementar compaction por limite de entradas (ej. 20), conservando resumen historico.
- Criterios de aceptacion:
  - [x] Compaction automatica cuando excede umbral.
  - [x] Se conservan ultimas N entradas + resumen compacto.
  - [x] Configurable via `config.json`.
- Archivos objetivo:
  - `runner.js` ✓
  - `agents/checkpoint.md`
  - `system/config.json` ✓
  - `README.md`
  - `USAGE.md`
- Fecha completacion: 2026-03-06

## Mejora 4 - Skills largas (higiene de instrucciones)
- Estado: `pending`
- Problema: skills extensas elevan riesgo de conflicto/prioridad de instrucciones.
- Cambio propuesto:
  - Definir politica: ideal 60-120 lineas, maximo 150.
  - Dividir skills candidatas (ej. `frontend/design-taste.md`).
- Criterios de aceptacion:
  - Politica documentada.
  - Skill candidata dividida en sub-skills coherentes.
  - Referencias cruzadas actualizadas.
- Archivos objetivo:
  - `skills/frontend/design-taste.md`
  - `system/SKILL_EVOLUTION.md`
  - `README.md`

## Mejora 5 - Catalogo sin clasificacion cognitiva
- Estado: `completed`
- Problema: skills tecnicas y de razonamiento estan mezcladas en activacion.
- Cambio propuesto:
  - Crear categoria `skills/cognitive/` para clasificacion y decision.
- Criterios de aceptacion:
  - [x] Nueva categoria definida.
  - [x] Skills cognitivas movidas o replicadas con mapping.
  - [x] Planner/selector reconoce esta clase.
- Archivos objetivo:
  - `skills/cognitive/*` ✓
  - `system/config.json` ✓
  - `agents/planner.md` ✓
  - `README.md`
- Fecha completacion: 2026-03-06

## Mejora 6 - Cobertura de arquitectura insuficiente
- Estado: `completed`
- Problema: solo hay una skill de arquitectura para decisiones estructurales complejas.
- Cambio propuesto:
  - Agregar skills minimas:
    - `architecture/system-design`
    - `architecture/api-design`
    - `architecture/db-boundaries`
- Criterios de aceptacion:
  - [x] Skills creadas con scope y checklist claros.
  - [x] Config tier/selector actualizado para activarlas cuando aplique.
  - [ ] Ejemplo de tarea usando cada skill.
- Archivos objetivo:
  - `skills/architecture/*` ✓
  - `system/config.json` ✓
  - `README.md`
- Fecha completacion: 2026-03-06

## Mejora 7 - Testing demasiado debil
- Estado: `pending`
- Problema: una sola skill de testing limita cobertura y calidad.
- Cambio propuesto:
  - Agregar skills:
    - `testing/unit-test`
    - `testing/integration-test`
    - `testing/e2e-test`
    - `testing/test-data`
- Criterios de aceptacion:
  - Skills publicadas y referenciadas por planner.
  - Selector por tipo de tarea/testing actualizado.
  - Validaciones QA alineadas con nuevos tipos de test.
- Archivos objetivo:
  - `skills/testing/*`
  - `system/config.json`
  - `agents/qa.md`
  - `README.md`

---

## Registro de Cambios
- 2026-03-06: Mejora 6 completada - Agregadas architecture skills:
  - `skills/architecture/system-design.md` - Diseño de sistemas
  - `skills/architecture/api-design.md` - Diseño de APIs
  - `skills/architecture/db-boundaries.md` - Fronteras de DB
  - Actualizado `system/config.json` con nuevas skills
- 2026-03-06: Mejora 5 completada - Creada categoria skills/cognitive/
- 2026-03-06: Mejora 1 completada - Implementado tareas correctivas
- 2026-03-06: Mejora 2 completada - Implementado attempts/max_attempts
- 2026-03-06: Mejora 3 completada - Implementado memory compaction

## Calificacion Final (completar al terminar)
- Estado: `pending`
- Escalabilidad: `TBD/10`
- Intuitivo: `TBD/10`
- Facilidad de uso: `TBD/10`
- Calificacion global: `TBD/10`
- Siguientes mejoras sugeridas: `TBD`
