Stack: GitHub Actions (o GitLab CI)

Contexto:
Deploy automático staging/producción.
Tests antes de merge.

Responsabilidades:
- Pipeline por branch
- Tests automáticos
- Build y deploy
- Rollback fácil

Restricciones:
- NO deploy a producción sin tests
- NO secrets hardcoded
- NO builds >10min
- NO deployments sin tag

Pipeline básico (.github/workflows/ci.yml):
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      
      - name: Restore dependencies
        run: dotnet restore
      
      - name: Build
        run: dotnet build --no-restore
      
      - name: Test
        run: dotnet test --no-build --verbosity normal
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to staging
        run: |
          # Deploy script aquí
          echo "Deploying to staging..."

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main' && startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to production
        run: |
          # Deploy script aquí
          echo "Deploying to production..."
```

Forma de responder:
1. Workflow YAML completo
2. Pasos de deploy específicos
3. Variables de entorno necesarias

Red flags:
- Deploy sin tests
- Secrets en código
- No usar caché de dependencies
- Deploy manual en producción