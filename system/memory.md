# Memory Log

## Formato de Entrada (Plantilla DinÃ¡mica)

### [{{task_id}}] [{{timestamp}}] â€” {{agent_name}}
**DecisiÃ³n:** {{decision_description}}
**RazÃ³n:** {{decision_rationale}}
**Alternativas descartadas:** {{discarded_alternatives}}
**Impacto en tareas futuras:** {{future_impact}}

---

## Log

### {{task_id}} {{timestamp}} â€” {{agent_name}}
**DecisiÃ³n:** {{decision_description}}
**RazÃ³n:** {{decision_rationale}}
**Alternativas descartadas:** {{discarded_alternatives}}
**Impacto en tareas futuras:** {{future_impact}}

### {{task_id}} {{timestamp}} â€” {{agent_name}}
**DecisiÃ³n:** {{decision_description}}
**RazÃ³n:** {{decision_rationale}}
**Alternativas descartadas:** {{discarded_alternatives}}
**Impacto en tareas futuras:** {{future_impact}}

---

## Variables Disponibles

| Variable | DescripciÃ³n | Ejemplo |
|----------|-------------|---------|
| `{{task_id}}` | Identificador de la tarea | T001, T002 |
| `{{timestamp}}` | Fecha y hora de la entrada | 2025-06-10 |
| `{{agent_name}}` | Agente que registra la decisiÃ³n | executor, planner |
| `{{decision_description}}` | DescripciÃ³n de la decisiÃ³n tÃ©cnica | Usar Vite 5 con SWC |
| `{{decision_rationale}}` | JustificaciÃ³n de la decisiÃ³n | Build 3x mÃ¡s rÃ¡pido |
| `{{discarded_alternatives}}` | Opciones descartadas | CRA, Next.js |
| `{{future_impact}}` | Impacto en tareas futuras | T02 debe usar eslint-plugin-react |

---

## Notas

- Este archivo es **append-only** (solo agregar)
- Cada agente escribe al terminar una tarea
- Las decisiones deben ser concisas pero informativas
- Incluir siempre el impacto en tareas futuras para mantener consistencia
