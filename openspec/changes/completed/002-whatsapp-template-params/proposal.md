# Proposal: Consumo de `templateParams` (worker)

**ID:** `002-whatsapp-template-params`  
**Par:** rulett-app `002-whatsapp-template-params`  
**Estado:** Completado (PDN 2026-06-18)

## Criterios de aceptación

- [x] Columna `templateParams` aplicada vía `sql/schema.sql`
- [x] `sendTemplateMessage` incluye `components` válidos
- [x] Fila sin JSON → `FAILED` con mensaje claro en `errorLog`
- [x] Deploy Render + E2E `recordatorio_cupon_vencer` (4/4 SENT, HTTP 200)

**Detalle:** ver [closure.md](./closure.md) y rulett-app `002-whatsapp-template-params`.
