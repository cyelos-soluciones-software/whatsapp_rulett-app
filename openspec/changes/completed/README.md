# Cambios completados

| ID | Nombre | Notas |
|----|--------|-------|
| `001-openspec-foundation` | Fundación OpenSpec SDD (worker + app) | Estructura `specs/`, punteros docs — cerrado 2026-06-20 |
| `002-whatsapp-template-params` | Consumo templateParams + fix 132000 | PDN 2026-06-18 |
| `005-invitacion-evento-whatsapp` | `invitacion_evento_exclusivo` body-only | Código listo; deploy Render pendiente E2E |
| `051-recordatorio-juego-descubre` | Aviso de suscripción de la plataforma (WhatsApp + SMS de respaldo), juego en una pantalla y filtros de Descubre; en el worker: plantillas sin header, campaña nula, log enmascarado, `npm test` | Mismo número que en rulett-app (ClickUp `17tnjra85qn`). Cerrado el 2026-10-10 y en producción según Oscar. QA de lab Incompleto, aceptado por Oscar. Parte del aviso la cambió el 054 |
| `054-gemini-aviso-cloud-run` | Worker en Cloud Run: el disparo espera el lote, solo Bearer (IAM en Cloud Run), sin sondeo, reclaim de `PROCESSING` > 15 min | Mismo número que en rulett-app (ClickUp `17tnjrabmxn`). Cerrado el 2026-10-10 y en producción según Oscar. Sin migración |

Ver detalle: [001](./001-openspec-foundation/closure.md), [002](./002-whatsapp-template-params/closure.md), [005](./005-invitacion-evento-whatsapp/closure.md), [051](./051-recordatorio-juego-descubre/closure.md), [054](./054-gemini-aviso-cloud-run/closure.md).
