# Arquitectura — whatsapp_rulett-app

estado: borrador — pendiente de validación humana
Actualizado: 2026-10-01

Worker HTTP en Render. Lee `WhatsappQueue` en la misma Neon que rulett-app, reclama `PENDING` y envía plantillas a Graph API v25.0. No inserta mensajes, no aplica cupo del comercio y no envía SMS. [repo: docs/ARCHITECTURE.md] [repo: openspec/specs/integrations.md]

## Límites

- El mapeo de parámetros está hardcodeado por `templateName` en `buildTemplateComponents`. Un nombre desconocido cae al header `nombre_tenant` y Meta responde `132000` si la plantilla no coincide. [repo: src/services/whatsapp.ts] [repo: openspec/specs/integrations.md]
- `TemplateComponent` solo admite `header` y `body`. Un botón URL estático aprobado en Meta no se manda en el POST. [repo: src/services/whatsapp.ts]
- `qrCampaignId` es nullable (null en filas `origin = PLATFORM`) y el worker no lo usa para armar el mensaje. El claim no filtra por campaña. [repo: sql/schema.sql] [repo: src/db/queue.ts]
- Los logs muestran solo los últimos 4 dígitos de `userPhone`. [repo: src/processor.ts]
- Éxito = HTTP OK de Meta (`SENT` + `wamid`). No hay webhook de entrega al teléfono. [repo: src/server.ts] [repo: src/processor.ts]
- Tras cambiar el mapeo hay que redesplegar Render. [repo: openspec/changes/completed/005-invitacion-evento-whatsapp/design.md]

## Orden de despliegue

Este repo no migra la base. Si rulett-app cambia columnas de la cola, esa migración va primero. El mapeo nuevo de plantillas se despliega aquí antes de encolar mensajes que lo usen.
