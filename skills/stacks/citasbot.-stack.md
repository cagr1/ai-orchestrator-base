Proyecto: CitasBot - SaaS Multi-tenant

Tech Stack:
- Fullstack: Next.js 16 (App Router) + React 19
- Styling: TailwindCSS + Radix UI + Lucide React
- DB: PostgreSQL + Prisma ORM
- Auth: NextAuth.js (JWT + RBAC)
- Payments: Paddle (MoR for LATAM compliance)
- Integrations: Twilio (WhatsApp bot)
- Deploy: Vercel + Supabase PostgreSQL

Agentes activos por fase:

**Fase 1 - Multi-tenancy Core (✅ Completado):**
- multitenancy.md (schema + queries)
- nextauth.md (auth + roles)
- nextjs-api.md (API routes)
- prisma-queries.md (optimizaciones)

**Fase 2 - SaaS Features (✅ Completado):**
- paddle-integration.md (billing LATAM-compliant)
- rbac.md (permisos granulares STAFF)
- api-security.md (rate limiting)

**Fase 3 - WhatsApp Bot (✅ Completado):**
- twilio-whatsapp.md (bot conversacional)
- react-nextjs.md (dashboard business)

**Fase 4 - Polish (🚧 En progreso):**
- frontend-perf.md (optimizaciones)
- deployment.md (Vercel + Supabase)
- ci-cd.md (GitHub Actions)
- backend-tests.md (tests críticos)

**Fase 5 - Growth (⏳ Pendiente):**
- analytics.md (métricas negocio)
- email-notifications.md (Resend/SendGrid)
- mobile-app.md (React Native - futuro)

Arquitectura actual:
````
citasbot/
├── app/
│   ├── api/
│   │   ├── appointments/
│   │   ├── paddle/          # Billing
│   │   ├── webhooks/
│   │   │   └── whatsapp/
│   │   └── cron/            # Reset límites
│   ├── dashboard/           # Business dashboard
│   ├── admin/               # Super admin
│   └── (auth)/
├── components/
│   ├── ui/                  # Radix UI
│   └── dashboard/
├── lib/
│   ├── prisma.ts
│   ├── paddle.ts
│   ├── twilio.ts
│   ├── permissions.ts
│   └── plan-limits.ts
└── prisma/
    └── schema.prisma

Roles y permisos:
┌─────────────────┬──────────┬───────┬───────┐
│ Permiso         │ SUPER_   │ ADMIN │ STAFF │
│                 │ ADMIN    │       │       │
├─────────────────┼──────────┼───────┼───────┤
│ Platform admin  │    ✅    │   ❌  │   ❌  │
│ Manage billing  │    ✅    │   ✅  │   ❌  │
│ Manage users    │    ✅    │   ✅  │   ❌  │
│ Manage services │    ✅    │   ✅  │   🔧  │
│ View reports    │    ✅    │   ✅  │   🔧  │
│ Manage appts    │    ✅    │   ✅  │   🔧  │
│ Manage clients  │    ✅    │   ✅  │   🔧  │
└─────────────────┴──────────┴───────┴───────┘
🔧 = Configurable por ADMIN

Planes implementados:
FREE:
  - 50 appointments/mes
  - 1 staff
  - 100 mensajes WhatsApp/mes
  - Sin soporte prioritario

PRO ($29/mes):
  - Appointments ilimitadas
  - 10 staff
  - Mensajes WhatsApp ilimitados
  - Soporte email
  - Analytics básico

ENTERPRISE (Custom):
  - Todo ilimitado
  - Soporte dedicado
  - White-label (futuro)

Prioridades sprint actual:
- [✅] WhatsApp bot funcional
- [✅] Paddle checkout working
- [✅] RBAC granular para STAFF
- [🚧] Dashboard analytics básico
- [⏳] Email notifications (Resend)
- [⏳] 5 negocios beta testing

Métricas objetivo:
- Response time API <200ms
- WhatsApp response <3s
- Lighthouse 90+
- Uptime 99.5%

Stack decisiones:
- Paddle over Stripe: LATAM compliance + MoR
- Supabase over Railway: Postgres managed + auth helpers
- Vercel over Render: Edge functions + caching
- Prisma over raw SQL: Type safety + migrations
````

---

## README.md Actualizado
````markdown
# Sistema de Agentes - CitasBot Actualizado

## CitasBot SaaS (Next.js + Prisma + Paddle)

### Setup completo
```bash
@citasbot-stack @multitenancy "revisar schema multi-tenant"
@nextauth "verificar RBAC con 3 roles"
@paddle-integration "configurar webhooks"
```

### Features principales

**Billing con Paddle:**
```bash
@paddle-integration "crear checkout plan PRO"
@paddle-integration "manejar webhook subscription.canceled"
@rbac "verificar límites antes de crear appointment"
```

**WhatsApp Bot:**
```bash
@twilio-whatsapp "bot no responde a 'menu'"
@twilio-whatsapp "agregar intent para cancelar cita"
```

**Permisos granulares:**
```bash
@rbac "staff puede ver reportes pero no modificar servicios"
@rbac "audit log de actions críticas"
```

**API Endpoints:**
```bash
@nextjs-api "endpoint con rate limiting"
@nextjs-api "server action para crear appointment"
```

### Casos de uso

**"Límite de plan alcanzado"**
```bash
@paddle-integration "verificar lógica de límites"
@rbac "mostrar upgrade prompt cuando limite reached"
```

**"Webhook Paddle falla"**
```bash
@paddle-integration "debug signature verification"
[pegar logs de Paddle]
```

**"Staff no puede hacer X"**
```bash
@rbac "configurar permiso canManageServices para user ID"
```

**"Reset mensual de contadores"**
```bash
@paddle-integration "verificar cron job reset-limits"
```

## Diferencias clave vs versión anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Billing | Stripe | Paddle (MoR LATAM) |
| Permisos STAFF | Binarios (puede/no puede) | Granulares configurables |
| Límites | Hardcoded | Business logic desacoplada |
| Usage tracking | No implementado | Contadores mensuales |
| Audit | No | Sí (AuditLog table) |

## Prioridades actuales

1. **Beta testing**: 5 negocios reales
2. **Analytics**: Dashboard con métricas básicas
3. **Notifications**: Email confirmaciones (Resend)
4. **Performance**: Optimizar queries N+1
5. **Tests**: Coverage >80% endpoints críticos
````

---

