# Guía de contribución

Gracias por contribuir al worker de WhatsApp de Rulett. Esta guía aplica a desarrolladores humanos y agentes de IA.

## Antes de empezar

1. Lee [**AGENTS.md**](AGENTS.md) — contexto completo del proyecto.
2. Lee [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup local.
3. Lee [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — estándares de código.

## Flujo de trabajo

```bash
# 1. Crear rama
git checkout -b feat/descripcion-corta

# 2. Desarrollar
npm run dev

# 3. Verificar
npm run typecheck
npm run build

# 4. Commit (solo si el usuario lo solicita en sesiones con IA)
git add .
git commit -m "feat: descripción del cambio"
```

## Qué tipo de cambios son bienvenidos

- Corrección de bugs en el ciclo de polling o envío.
- Mejoras de resiliencia (reintentos, recovery de PROCESSING huérfanos).
- Soporte para templates con parámetros dinámicos.
- Tests unitarios e integración.
- Mejoras de observabilidad (métricas, health checks).
- Documentación.

## Qué evitar

- Convertir el worker en una API REST.
- Agregar Prisma u otro ORM.
- Cambiar nombres de tablas/columnas sin coordinar con la app Rulett.
- Commitear secretos o archivos `.env`.
- Cambios grandes sin discusión previa (abrir issue primero).

## Pull requests

1. Describir **qué** cambia y **por qué**.
2. Incluir test plan (aunque sea manual).
3. Actualizar documentación si el cambio afecta:
   - Variables de entorno → `.env.example`, `AGENTS.md`
   - Schema de BD → `docs/DATABASE.md`, `sql/schema.sql`
   - Scripts → `docs/DEVELOPMENT.md`
   - Arquitectura → `docs/ARCHITECTURE.md`

### Plantilla de PR

```markdown
## Summary
- Cambio 1
- Cambio 2

## Test plan
- [ ] npm run typecheck
- [ ] npm run build
- [ ] Probado localmente con npm run dev
- [ ] Verificado envío a Meta API (si aplica)
```

## Reportar bugs

Incluir:
- Logs JSON del worker (sin tokens).
- Estado del registro en `"WhatsappQueue"` (`status`, `errorLog`).
- Variables de entorno relevantes (sin secretos).
- Pasos para reproducir.

## Para agentes de IA

- Seguir [AGENTS.md](AGENTS.md) como fuente de verdad.
- Cambios mínimos y enfocados.
- No crear commits ni PRs sin solicitud explícita del usuario.
- Ejecutar `npm run build` tras modificar `src/`.
- Actualizar docs si el cambio altera comportamiento, schema o configuración.
