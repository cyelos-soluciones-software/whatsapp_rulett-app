# Design: `templateParams` en worker

**ID:** `002-whatsapp-template-params`  
**Estado:** Completado (PDN 2026-06-18)

## Mapeo components por plantilla

### `recordatorio_cupon_vencer`

| Componente | Parámetros (orden) |
|------------|-------------------|
| `header` | `nombre_tenant` |
| `body` | `nombre_usuario`, `cupon`, `nombre_tenant`, `fecha_vencimiento` |

Fix 132000: `nombre_tenant` en header **y** body (plantilla Meta lo repite).

### `cumpleanos_regalo_tenant`

| Componente | Parámetros (orden) |
|------------|-------------------|
| `header` | `nombre_tenant` |
| `body` | `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` |

Pendiente E2E real.

## Archivos

- `sql/schema.sql` — `templateParams JSONB`
- `src/db/queue.ts` — SELECT + JSON.parse
- `src/types.ts` — `WhatsappTemplateParams`
- `src/services/whatsapp.ts` — `buildTemplateComponents`

## ADR

- ADR-002: app pre-calcula; worker solo entrega
- [ADR-003](./adr-003-template-component-order.md): mapeo según plantilla Meta real

Ver [closure.md](./closure.md).
