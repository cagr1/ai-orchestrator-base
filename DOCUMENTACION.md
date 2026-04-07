# Documentación Operativa - Actualización v5 (Día 1)

Este documento complementa `USAGE.md` con el alcance de la actualización v5 del Día 1: memoria persistente + autoskills + CLI.

## ✅ Alcance Implementado

1. **Memoria automática (Engram)**
   - El runner escribe checkpoints en Engram cuando `memory.provider = "engram"`.
   - Fallback automático a `system/memory.md` si Engram no está disponible.

2. **Skill detection (Autoskills)**
   - Detección de tecnologías y sugerencias de skills.
   - Output persistido en `system/autoskills.last.txt`.
   - Sugerencias persistidas en `system/skill_suggestions.json`.

3. **Skill suggestions**
   - Visualización de sugerencias mediante CLI.

4. **CLI Commands (alineado al plan v5)**
   ```bash
   node runner.js memory search "auth middleware"
   node runner.js skills detect
   node runner.js skills install
   node runner.js skills suggest
   ```

## 📦 Archivos y Carpetas Clave

- `system/autoskills.last.txt`: output de Autoskills.
- `system/skill_suggestions.json`: sugerencias parseadas.
- `skills/vendor/`: espejo organizado por categoría (symlinks).
- `.agents/skills/`: fuente instalada por Autoskills (vendor).

## 🔧 Configuración mínima (Engram)

```json
{
  "memory": { "provider": "engram" },
  "engram": { "enabled": true, "base_url": "http://127.0.0.1:7437" }
}
```

## 🧪 Pruebas Recomendadas

1. **Memoria**
   ```bash
   node runner.js memory search "Checkpoint"
   ```

2. **Autoskills**
   ```bash
   node runner.js skills detect
   node runner.js skills suggest
   node runner.js skills install
   ```

## ✅ Estado

- Día 1 completado según plan: memoria + autoskills + sugerencias + CLI.

