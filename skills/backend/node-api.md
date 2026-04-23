---
name: node-api
description: Produces Express-style Node.js API implementations with validation and service layering.
output_contract: json_files
---

## Constraints

Stack: Node.js + Express + Prisma + Supabase

Contexto:
CitaBot MVP (gestion de citas).
Prioridad: shipping rapido.

Responsabilidades:
- Routes -> Controllers -> Services
- Validacion con Zod
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

Red flags:
- Queries sin paginacion
- Middleware que no llama next()
- Promises sin await
- N+1 con Prisma

## Output bounds

Forma de responder:
1. Route + Controller + Service completo
2. Zod schema
3. Error cases
