SDD: 17tnjrabmxn · v9 · 2026-10-09
estado: cerrado el 2026-10-10 — en producción según Oscar

# Closure — 054 Worker de WhatsApp en Cloud Run (whatsapp_rulett-app)

| Campo | Valor |
|---|---|
| ID HU | `17tnjrabmxn` |
| Repos | `whatsapp_rulett-app` (este) y `rulett-app` (su `closure.md` lleva el QA completo) |
| PR | #4 (`main`, c80fb34) |
| Migración | Ninguna |
| Versión final del SDD | v9 (este repo no agregó tasks desde v8) |

## Qué se entregó
- **W-01:** `POST /api/trigger` espera un lote y responde `{ triggered, processed }`; si ya hay lote en curso responde 200 con `busy: true`. 500 genérico. `GET /health` sin secretos. El proceso ya no programa `POLL_INTERVAL_MS`: no hay sondeo. Antes de reclamar, las filas `PROCESSING` de más de 15 minutos vuelven a `PENDING` y se loguea el conteo (R-18).
- **W-05:** `/api/trigger` solo exige el Bearer, comparado con `timingSafeEqual` sobre SHA-256. `EDGE_SHARED_SECRET` se ignora si está en el entorno; los errores de configuración no incluyen el valor recibido. La puerta de red es IAM de Cloud Run (D-04), no Cloudflare.
- **W-02:** tests del server (Bearer bien, mal, ausente y sin esquema; el procesador no se llama en los fallos; health; reclaim a 1 y 16 minutos).
- **W-03:** sección «Cloud Run» en `docs/DEPLOYMENT.md`.
- **W-04 (lo ejecuta el humano):** cuenta `whatsapp-worker-invoker` y «Requerir autenticación» en Cloud Run.

## Verificación
- Worker: `typecheck` limpio y 59 tests verdes (ronda 1).
- Lab: las filas encoladas desde el Preview las tomó Cloud Run en la base de lab y quedaron `SENT` (R-12); ninguna fila `PROCESSING` ni `PENDING` de más de 15 minutos (R-18, R-19).
- Envíos reales de las cuatro plantillas de campaña y de los avisos de suscripción: declarados correctos por Oscar el 2026-10-09, sin evidencia adjunta de Claude. Antes de esa declaración se habían visto en lab `recordatorio_cupon_vencer` (23 `SENT`) e `invitacion_evento_exclusivo` (1 `SENT`).

## Pendientes operativos (cerrados)
Oscar declaró el 2026-10-10 que todo está en producción. Los puntos se dan por hechos por esa declaración; Claude no los verificó en Render, Cloud Run ni Vercel.

Lista original:
1. **Render:** `main` ya trae c80fb34. Confirmar commit desplegado y logs sin errores de arranque (NR-03). Render no debe recibir el build sin sondeo mientras siga atendiendo producción; sin disparo no drena la cola.
2. **Corte:** con Cloud Run apuntando a la Neon de producción y T-07 activo en rulett-app, suspender Render. No borrar el servicio el mismo día.
3. No borrar `EDGE_SHARED_SECRET` de Cloud Run antes de que sirva la revisión que lo ignora.
4. Confirmar y anotar el 403 de `run.app` sin token de identidad (CP-12) y el 401 sin Bearer.
5. Mover la carpeta a `completed/` y actualizar `docs/DEPLOYMENT.md`, `openspec/specs/integrations.md` y `completed/README.md`.

## No probado por Claude (deuda aceptada al cierre)
CP-12 en vivo, CP-13 (convivencia Render + Cloud Run sobre la misma base; `SKIP LOCKED` en `queue.ts` impide el doble envío), CP-08 en lab.

## Deuda y mejoras conocidas
- `tasks.md` de este repo todavía describe W-04 con Cloudflare y `worker.rulett.app`; quedó superado por D-04 (IAM).
