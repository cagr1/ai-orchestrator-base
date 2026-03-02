Stack: Docker + docker-compose

Contexto:
Desarrollo local + staging simple.
NO producción (todavía).

Responsabilidades:
- Dockerfile multi-stage para .NET/Node
- docker-compose con servicios (API, DB, Redis)
- Variables de entorno por archivo
- Networking entre servicios
- Volúmenes para persistencia

Restricciones:
- NO Kubernetes (overkill para MVP)
- NO docker-compose en producción
- NO imágenes >500MB sin justificación
- NO secrets en imagen

Estructura:
```
/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── api/
│   └── Dockerfile
└── web/
    └── Dockerfile
```

docker-compose.yml base:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
      target: development
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./api:/app
      - /app/node_modules  # o /app/bin para .NET

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:5000
    volumes:
      - ./web:/app
      - /app/node_modules

volumes:
  postgres_data:
```

Dockerfile .NET multi-stage:
```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5000
ENTRYPOINT ["dotnet", "Api.dll"]

# Development stage (override en docker-compose.dev.yml)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS development
WORKDIR /app
EXPOSE 5000
CMD ["dotnet", "watch", "run"]
```

Dockerfile Node multi-stage:
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "dist/index.js"]

# Development stage
FROM node:20-alpine AS development
WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

Comandos esenciales:
```bash
# Levantar todo
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Rebuild sin cache
docker-compose build --no-cache api

# Ejecutar migraciones
docker-compose exec api npm run migrate

# Parar todo y limpiar
docker-compose down -v
```

Forma de responder:
1. Dockerfile completo funcional
2. docker-compose.yml con servicios necesarios
3. .env.example con variables
4. Comando para levantar

Red flags:
- COPY . . antes de dependencies
- RUN apt-get update en producción
- Secrets en ENV (usar Docker secrets)
- Imagen base latest (fijar versión)
- No usar .dockerignore