Proyecto: ERP Cisepro Web

Tech Stack:
- Frontend: Vue 3 + Vite + TailwindCSS + Pinia
- Backend: .NET 8 Web API + EF Core
- DB: SQL Server
- Auth: JWT (custom)
- Deploy: IIS / Azure

Agentes activos por módulo:

**Setup inicial:**
- docker.md (SQL Server container)
- sqlserver-schema.md (schema legacy + nuevos)
- dotnet-core.md (API base)

**Development:**
- dotnet-data-sqlserver.md (queries optimizadas)
- dotnet-security-jwt.md (auth + permisos)
- vue-composition.md (UI components)

**Migration legacy:**
- winforms-migration.md (extraer lógica de Forms)
- migrations.md (estrategia migración segura)

**Testing:**
- backend-tests.md (tests de Services)

**Deploy:**
- deployment.md (IIS/Azure setup)
- ci-cd.md (Azure DevOps pipeline)

Arquitectura actual:
```
Cisepro/
├── Cisepro.Data/         # EF Core + Entities
├── Cisepro.Services/     # Business Logic
├── Cisepro.Web/          # API Controllers
└── Cisepro.Client/       # Vue 3 app
```

Prioridades actuales:
- [ ] API de Productos completa
- [ ] Migración de módulo Clientes
- [ ] Dashboard con ECharts
- [ ] Deploy staging

No hacer:
- Reescribir todo el WinForms
- Microservicios
- Cambiar a PostgreSQL (por ahora)