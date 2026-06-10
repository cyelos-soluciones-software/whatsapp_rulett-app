# Design: `templateParams` en worker

**ID:** `002-whatsapp-template-params`

## Flujo

```mermaid
sequenceDiagram
  participant Q as queue.ts
  participant P as processor.ts
  participant W as whatsapp.ts
  participant M as Meta API

  Q->>Q: claimPendingBatch + parse templateParams
  P->>W: sendTemplateMessage(row)
  W->>W: buildTemplateComponents(row)
  alt params OK
    W->>M: POST template + components
    M-->>W: 200
  else params missing
    W-->>P: error (no throw)
    P->>Q: markFailed
  end
```

## Mapeo components

| JSON key | Componente Meta |
|----------|-----------------|
| `nombre_tenant` | `header` / `parameter_name` |
| Otras claves | `body` / `parameter_name` cada una |

Orden de body: estable según implementación en `whatsapp.ts`.

## Archivos

- `sql/schema.sql` — `templateParams JSONB`
- `src/db/queue.ts` — SELECT + JSON.parse
- `src/types.ts` — `WhatsappTemplateParams`
- `src/services/whatsapp.ts` — `buildTemplateComponents`

## ADR

Ver rulett-app ADR-002: app pre-calcula; worker solo entrega.
