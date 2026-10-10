SDD: 17tnjra85qn · v11 · 2026-10-01
estado: cerrado el 2026-10-10 — en producción según Oscar. QA de lab de Claude: Incompleto; lo no probado quedó aceptado por Oscar.

# Closure — 051 Recordatorio de suscripción, juego en una pantalla y filtros de Descubre

| Campo | Valor |
|---|---|
| ID HU | `17tnjra85qn` (ClickUp: «Recordar el pago de la suscripción, caber el juego en una pantalla y filtrar lo que hay cerca») |
| Repos | `rulett-app` (T-01 a T-17; su contrato por tarea está en `docs/sdd/17tnjra85qn/`) y `whatsapp_rulett-app` (W-00 a W-04; esta carpeta es la memoria de la historia) |
| Migraciones | `20261001114819_subscription_reminders_discovery` y `20261001230527_discovery_listed_default_true` (la segunda con el `WHERE` de T-17). Aplicación en lab y producción: declarada por Oscar |
| QA | `test-report.md`: laboratorio `lab.rulett.app`, 2026-10-01, veredicto **Incompleto** |
| Versión final del SDD | v11 |

## Qué se entregó
- **Aviso de suscripción de la plataforma:** cron de las 08:00 Bogotá que encola WhatsApp `PLATFORM` al contacto del comercio (a 7 días y el día del vencimiento), con SMS de respaldo si Meta rechaza, sin consumir el cupo del comercio, con `SUBSCRIPTION_REMINDERS_ENABLED` como interruptor y exclusión si hay recibo `MANUAL` pendiente. Código de país del contacto (+57 por defecto).
- **Worker (W-00 a W-03):** `npm test` con `node:test`; validación y armado por plantilla (las dos de suscripción sin header, solo body); `qrCampaignId` nulo tolerado; log sin teléfono completo (últimos 4 dígitos); specs y docs al día.
- **Juego en una pantalla** (4 pasos, 390×844) y **Descubre** con fichas de ruleta y de página, filtros por tipo y categoría, tope de 12, «Cómo llegar», línea de ofertas, casilla «Publicar esta página en Descubre» marcada por defecto, y los mismos filtros en la billetera.

## Cambios posteriores (054, 2026-10-09)
El 054 modificó parte de lo anterior: `DUE_DAY` pasó a «falta 1 día» (con `recordatorio_suscripcion_7d` y `dias` `"1"`), `recordatorio_suscripcion_hoy` dejó de encolarse, los crons pasaron a hora y a 09:00/18:00, y el worker perdió el sondeo. Donde esta carpeta describe el aviso «del día», manda [054](../054-gemini-aviso-cloud-run/closure.md).

## Verificación
- rulett-app: 1.400 tests, `next build` y `src/lib` al 84 % (v10); SonarCloud con quality gate en verde y 1 issue nuevo que no lo tumba (v11).
- Lab: R-21, R-22, R-23, R-28, R-29, R-30, R-33, R-34, R-36 y R-09 cumplen en navegador; R-26 aprobado por el analista antes.
- Declarado por Oscar el 2026-10-10: el cambio está en producción. Claude no lo verificó.

## No probado por Claude (deuda aceptada al cierre)
Envío al teléfono, SMS de respaldo y cupo (R-01 a R-14, R-16, R-32); R-15 con el secreto real (solo se vio el 401); R-17 parcial y R-18 a R-20 del juego (pasos 2 a 4); R-24, R-25, R-27, R-31 y R-35. La corrida de lab se cerró sin reabrirse.

## Pendientes que el cierre da por hechos (por declaración de Oscar)
Migraciones en lab y producción; W-04 (redespliegue en Render, anotar la versión de Node, `/health` y una fila de plataforma de prueba); encender `SUBSCRIPTION_REMINDERS_ENABLED`; plantillas aprobadas en Meta.

## A revisar
- `engines.node` en `package.json` del worker sigue en `>=20.0.0` en el árbol local. El SDD pedía `>=22.5.0` antes del merge (`--test-coverage-include` existe desde Node 22.5.0). Si no se subió, `npm run test:coverage` puede fallar en Node 22.0 a 22.4; con Cloud Run el runtime lo fija el Dockerfile.
- `AGENTS.md` del worker marca `POLL_INTERVAL_MS` como requerida; tras 054 ya no se usa.
- La referencia `docs/sdd/17tnjra85qn/` en los specs del worker apunta a una carpeta que se va a retirar; este closure la sustituye. El contrato por tarea de rulett-app (T-01 a T-17) sigue en `rulett-app/docs/sdd/17tnjra85qn/`, que no tiene su carpeta `051` en `openspec/changes/completed/` de ese repo.
