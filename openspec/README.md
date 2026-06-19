# OpenSpec — whatsapp-rulett-worker

Documentación viva del **worker de cola WhatsApp** (companion de rulett.app).

## Estructura

```
openspec/
├── README.md
├── specs/                    ← estado actual del worker
│   ├── system_architecture.md
│   ├── domain_model.md
│   ├── integrations.md
│   └── operations.md
└── changes/
    ├── active/
    └── completed/
```

## Relación con rulett-app

- **Base de datos compartida** (Neon): tabla `"WhatsappQueue"` escrita por rulett-app, consumida por este worker.
- Cambios de contrato (ej. `templateParams`, nuevas plantillas) deben numerarse igual en ambos repos (`002-whatsapp-template-params`, `005-invitacion-evento-whatsapp`).
- OpenSpec app: `rulett-app/openspec/`.

## Flujo

1. Leer `specs/` antes de modificar `src/`.
2. Proponer cambio en `changes/active/NNN-feature/` (5 documentos SDD).
3. Tras deploy, fusionar delta en `specs/` y mover a `completed/`.

## Documentos legacy

| Archivo | Rol tras OpenSpec |
|---------|-------------------|
| [AGENTS.md](../AGENTS.md) | Reglas de código worker |
| [docs/DATABASE.md](../docs/DATABASE.md) | Runbook SQL — puntero a `specs/domain_model.md` |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Puntero a `specs/system_architecture.md` |
