# Closure: Consumo `templateParams` (worker)

**ID:** `002-whatsapp-template-params`  
**Estado:** Completado  
**Fecha cierre PDN:** 2026-06-18  
**Par:** rulett-app `002-whatsapp-template-params`

## Verificación E2E

4 mensajes `recordatorio_cupon_vencer` procesados con `statusCode: 200` y `messageId: wamid...` en logs Render (2026-06-18).

## Fix crítico post-deploy

Error `132000` resuelto en [`src/services/whatsapp.ts`](../../../src/services/whatsapp.ts): body de `recordatorio_cupon_vencer` incluye 4 parámetros (`nombre_tenant` repetido en body según plantilla Meta).

## Incidentes Meta (referencia)

| Código | Resolución |
|--------|------------|
| `190` | Renovar `WHATSAPP_TOKEN` en Render |
| `131030` | Lista destinatarios modo Dev en Meta |
| `132000` | Alinear `buildTemplateComponents` con plantilla real |

Detalle completo: `rulett-app/openspec/changes/completed/002-whatsapp-template-params/closure.md`.

## Pendiente

- [ ] E2E `cumpleanos_regalo_tenant`
