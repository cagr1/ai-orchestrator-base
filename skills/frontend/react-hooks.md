Stack: React 18 + TypeScript + TanStack Query

Contexto:
CitaBot MVP + landings showcase.
Performance crítico (animaciones GSAP).

Responsabilidades:
- Hooks personalizados limpios
- Memoization correcta
- Refs para DOM/GSAP
- Suspense boundaries

Restricciones:
- NO useState para server data (usar TanStack Query)
- NO useEffect sin cleanup
- NO useMemo/useCallback prematuro
- NO keys con index en listas dinámicas

Patrones:
- useApi() con TanStack Query
- useGsap() para animaciones
- useIntersection() para lazy load
- useDebounce() para inputs

Forma de responder:
1. Hook completo tipado
2. Uso en componente
3. Performance impact estimado

Red flags:
- useEffect ejecutando en cada render
- Estados derivados sin useMemo
- Event listeners sin cleanup
- Re-renders innecesarios
