# OpenSpec — whatsapp-rulett-worker

Memoria técnica viva del **worker de cola WhatsApp** (companion de rulett.app). **Esta carpeta es la única memoria técnica del repo.** Trabajamos con SDD (Spec-Driven Development) usando la estructura de OpenSpec, sin su herramienta de línea de comandos.

## Estructura

```
openspec/
├── README.md        ← este archivo
├── specs/           ← estado ACTUAL del worker (fuente canónica)
│   ├── system_architecture.md
│   ├── domain_model.md       contrato WhatsappQueue / templateParams
│   ├── integrations.md       Meta Graph API, plantillas
│   └── operations.md
├── runbooks/        ← guías operativas
│   ├── DEPLOYMENT.md         Cloud Run / Render / Docker
│   ├── DATABASE.md           runbook SQL (el contrato manda en specs/domain_model.md)
│   ├── DEVELOPMENT.md        setup local, scripts, debugging
│   ├── CONVENTIONS.md        estándares TypeScript, SQL, logging
│   └── ARCHITECTURE.md       referencia extendida (puede describir Render y sondeo; manda specs/)
└── changes/
    ├── active/README.md      ← ÚNICO lugar del estado (en curso, último cierre)
    └── completed/            ← cambios cerrados + README con el historial
```

Fuera de `openspec/` solo quedan `AGENTS.md` (reglas + puntero aquí), `CLAUDE.md` (importa `AGENTS.md`), `.cursor/rules/` (apuntan aquí), `README.md` y `CONTRIBUTING.md`.

## Relación con rulett-app

- **Base de datos compartida** (Neon): tabla `"WhatsappQueue"` escrita por rulett-app, consumida por este worker.
- Un cambio que cruza repos (contrato de la cola, plantillas nuevas) usa **el mismo número en ambos repos, y ese número lo asigna rulett-app** (`../../rulett-app/openspec/changes/active/README.md`). Por eso la numeración de este repo tiene huecos.
- Memoria de la app: `../../rulett-app/openspec/`.

## Flujo

Mismas reglas que [`rulett-app/openspec/README.md`](../../rulett-app/openspec/README.md): archivos por tamaño de cambio, encabezado `SDD: <ID HU> · v<N> · <fecha>`, orden de verdad y cierre. Resumen:

1. Leer `specs/` antes de modificar `src/`.
2. Crear `changes/active/NNN-slug/` y actualizar `changes/active/README.md`.
3. Tras el despliegue: `closure.md`, fusionar el delta en `specs/`, mover a `completed/`, agregar la fila en `completed/README.md` y actualizar `changes/active/README.md`.

Pruebas del worker: `node:test` + `tsx` (`npm test`, `npm run test:coverage`), no Vitest.

Estado actual: [changes/active/README.md](./changes/active/README.md).
