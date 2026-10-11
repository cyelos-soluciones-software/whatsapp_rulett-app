SDD: 17tnjra7awa · v4 · 2026-10-10
estado: cerrado el 2026-10-11 — en producción según Oscar. QA aprobado por Oscar; Claude no ejecutó `/pruebas-lab`.

# Closure — 056 Envíos automáticos de WhatsApp/SMS (whatsapp_rulett-app)

Parte del worker: W-01…W-04. El cierre completo, la verificación funcional y la deuda están en `rulett-app/openspec/changes/completed/056-envios-automaticos-mensajes/closure.md`.

- **Qué cambió:** el worker acepta las 4 plantillas v2. Valida estrictamente los params y exige que `boton_comercio` sea un UUID. Agrega el componente `button` (`sub_type:url`) en el índice `WHATSAPP_V2_BUTTON_INDEX` (default `1`). La variable opcional `WHATSAPP_V2_BUTTON_PARAM_NAME` queda sin definir, porque Meta registró la variable de la URL como posicional. Las v1 y las de suscripción se envían igual que antes.
- **Qué ignora el worker:** las columnas nuevas de la cola (`trigger`, `reason`, `contactId`) y el estado `CANCELLED`. Solo reclama `PENDING`.
- **Pruebas:** 98 pruebas en verde (`node:test`), incluido el fixture de contrato compartido con rulett-app T-14 [implementador, 2026-10-10].
- **Despliegue:** Cloud Run sin variables nuevas obligatorias. Producción aprovisionada según Oscar el 2026-10-11.
- **Deuda:** D-10, AGENTS.md desactualizado sobre sondeo y Render (solo se actualizó la sección de plantillas).
