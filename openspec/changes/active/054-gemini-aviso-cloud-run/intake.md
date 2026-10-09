# Intake — 17tnjrabmxn · Gemini 3.1, aviso forzado y Cloud Run
Estado: aprobado (v8)
ClickUp: https://app.clickup.com/t/9013064238/17tnjrabmxn · Subtareas: 8 · Dependencias: 17tnjra85qn (pendientes de producción)
Repos involucrados: rulett-app, whatsapp_rulett-app
Actualizado: 2026-10-09

## Historia
Una sola historia. Tres frentes: Gemini 3.1 Flash-Lite en rulett-app antes del 16/10/2026; diagnosticar el aviso de vencimiento y poder forzarlo desde el super admin; mover el worker de WhatsApp de Render (plan gratis) a Cloud Run detrás de Cloudflare.

## Contexto recibido
- [humano, 2026-10-09] `DUE_DAY` significa «falta 1 día». Reutiliza `recordatorio_suscripcion_7d` con `dias` = `"1"`. Sin migración y sin cambio en el worker. «faltan 1 días» se acepta si el cuerpo de Meta está en plural.
- [humano, 2026-10-09] Revisión de la v5: el pase de 15 minutos reconcilia siempre; la prueba en lab exige T-07 en el Preview; se borró el texto de la v2 que contradecía el botón del listado.
- [humano, 2026-10-09] Cloud Run lee la Neon de producción y el Preview de Vercel lee la de lab. El humano apunta Cloud Run a lab para probar. El botón va en `https://lab.rulett.app/super-admin/tenants`, al lado de «Forzar reinicio de límites».
- [humano, 2026-10-08] Pidió el SDD para rulett-app y whatsapp_rulett-app, con el paso a paso de Cloud Run (Artifact Registry). Memoria en `openspec/`.
- [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/] Historia publicada. Supuestos de negocio aceptados el 2026-10-08.
- [repo: rulett-app/docs/sdd/17tnjra85qn/index.md] Cerrado en código. Fuera de ese cierre: migraciones en lab y producción, W-04 en Render, flag apagado, plantillas en Meta.
- [repo: rulett-app/docs/ENV.md] Proyecto GCP `project-72b19706-c033-47ed-a35`. Región Vertex por defecto `us-central1`.
- [repo: whatsapp_rulett-app/docs/DEPLOYMENT.md] Hoy el canon de despliegue es Render. Dockerfile ya existe.
- [repo: whatsapp_rulett-app/docs/sdd/README.md] Dice que no se vuelve a escribir un SDD ahí y que el canon es `openspec/`. Esta historia se escribe igual porque el humano invocó el skill de SDD. `openspec/` no se reemplaza.

## Brechas abiertas
- [DESEABLE] ClickUp no se pudo leer en vivo (sin herramienta). Si la tarjeta contradice `historia.md`, hay que parar.
- [DESEABLE] Plan de Vercel (duración máxima de la función del cron). Supuesto: admite al menos 60 s.
- [DESEABLE] El botón corre el pase aunque `SUBSCRIPTION_REMINDERS_ENABLED` esté apagado. Quedó en v5.

## Supuestos vigentes
- Ver `design.md` sección Supuestos. Precios de Vertex y razonamiento del modelo 3.x se verifican en T-01, no se dan por ciertos.

## Dónde está el SDD
[humano, 2026-10-08] La memoria vive en `openspec/`, no en `docs/sdd/`.

- `rulett-app/openspec/changes/active/054-gemini-aviso-cloud-run/`
- `whatsapp_rulett-app/openspec/changes/active/054-gemini-aviso-cloud-run/`

`proposal.md`, `design.md`, `specs.md` y `adr.md` son el mismo texto en los dos. `tasks.md` solo trae las tasks de ese repo.
