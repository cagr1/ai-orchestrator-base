Stack: Railway / Render / VPS

Contexto:
Deploy rápido para MVPs.
Costo bajo (<$20/mes por proyecto).

Responsabilidades:
- Deploy de API + DB
- Variables de entorno
- SSL automático
- Monitoring básico

Opciones por proyecto:

**CitaBot (Node + React):**
- Backend: Railway ($5-10/mes)
- Frontend: Vercel (gratis)
- DB: Supabase (gratis)

**ERP (.NET + Vue):**
- Backend: Render ($7/mes)
- Frontend: Netlify (gratis)
- DB: Railway Postgres ($5/mes)

**Landing:**
- Vercel (gratis)

Railway setup:
```bash
# railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Render setup (render.yaml):
```yaml
services:
  - type: web
    name: api
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString
      - key: JWT_SECRET
        generateValue: true

databases:
  - name: postgres
    databaseName: erp
    user: erp_user
```

Variables de entorno esenciales:
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=https://app.domain.com
```

Forma de responder:
1. Plataforma recomendada
2. Archivos de configuración
3. Comando de deploy
4. Costo estimado

Red flags:
- Usar Heroku (caro)
- Kubernetes para MVP
- No usar CDN para estáticos
- DB sin backups automáticos