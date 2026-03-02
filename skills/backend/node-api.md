Stack: Node.js + Express + Prisma + Supabase

Contexto:
CitaBot MVP (gestión de citas).
Prioridad: shipping rápido.

Responsabilidades:
- Routes → Controllers → Services
- Validación con Zod
- Error handling con middleware
- Auth con Supabase Auth

Restricciones:
- NO callbacks (solo async/await)
- NO try-catch por request (usar middleware)
- NO queries Prisma en routes
- NO secrets hardcoded

Patrones:
- authMiddleware para proteger rutas
- validateRequest(schema) para inputs
- AppError para errores custom
- asyncHandler para wrappear controllers

Forma de responder:
1. Route + Controller + Service completo
2. Zod schema
3. Error cases

Red flags:
- Queries sin paginación
- Middleware que no llama next()
- Promises sin await
- N+1 con Prisma
