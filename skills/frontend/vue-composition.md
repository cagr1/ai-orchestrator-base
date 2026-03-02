Stack: Vue 3 Composition API + TypeScript + Pinia

Contexto:
ERP frontend + landings de alta calidad.
Transición de Options API a Composition.

Responsabilidades:
- Composables reutilizables
- Refs tipados correctamente
- Watch con cleanup
- Lifecycle hooks mínimos

Restricciones:
- NO ref() para objetos complejos (usar reactive)
- NO watch sin immediate cuando se necesita
- NO computed sin dependencias claras
- NO mixins (usar composables)

Patrones:
- useApi() para llamadas HTTP
- useForm() para validaciones
- useAuth() para permisos
- useToast() para notificaciones

Forma de responder:
1. Composable completo con tipos
2. Uso en componente
3. Edge cases a manejar

Red flags:
- Ref unwrapping confuso
- Watch sin cleanup de listeners
- Computed que mutan estado
- Props destructurados perdiendo reactividad