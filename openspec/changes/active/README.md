# Cambios activos — worker

> **Único lugar del estado** de los cambios del worker. `AGENTS.md`, `CLAUDE.md` y `openspec/README.md` enlazan aquí y no lo repiten. Actualízalo al abrir y al cerrar cada cambio.

**En curso:** ninguno. **Reservado:** 071 (en `rulett-app`), que retoma W-01 (solo el log del pool) y W-02 de 070.

**Último cierre:** [070-endurecimiento-seguridad](../completed/070-endurecimiento-seguridad/) — sin código en el worker; cerrado el 2026-11-06 por declaración de Oscar. W-01 quedó cubierto en parte por 068 (el log «Procesando mensaje» ya no lleva nombre ni teléfono); el resto de W-01 y W-02 pasan a 071. Antes: [068-feedback-pedidos](../completed/068-feedback-pedidos/) — plantilla `calificar_pedido` con botón URL dinámico y logs sin datos personales (ClickUp `17tnjrajf9b`); cerrado el 2026-11-02 por declaración de Oscar. **Pendiente (W-04):** despliegue en Cloud Run con las variables y envío real en lab, después de corregir el botón de la plantilla en Meta (ver `closure.md`). Antes: [056-envios-automaticos-mensajes](../completed/056-envios-automaticos-mensajes/) — plantillas v2 con botón dinámico; cerrado el 2026-10-11, en producción.

**Numeración:** este repo no tiene números propios. Un cambio nuevo del worker toma el próximo número libre de `rulett-app` (ver `../../../rulett-app/openspec/changes/active/README.md`) y se registra allí también.

**Completados recientes:** [068-feedback-pedidos](../completed/068-feedback-pedidos/) (2026-11-02; despliegue pendiente), [056-envios-automaticos-mensajes](../completed/056-envios-automaticos-mensajes/) (2026-10-11), [051-recordatorio-juego-descubre](../completed/051-recordatorio-juego-descubre/) (aviso de suscripción, juego y Descubre; 2026-10-10), [054-gemini-aviso-cloud-run](../completed/054-gemini-aviso-cloud-run/) (worker en Cloud Run, sin sondeo; 2026-10-10), [005-invitacion-evento-whatsapp](../completed/005-invitacion-evento-whatsapp/) (deploy Render pendiente E2E invitación), [001-openspec-foundation](../completed/001-openspec-foundation/) (fundación SDD).

Historial completo: [completed/README.md](../completed/README.md).
