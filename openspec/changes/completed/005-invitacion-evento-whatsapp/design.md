# Diseño: 005 — plantilla invitacion_evento_exclusivo

## Mapeo Meta (`buildTemplateComponents`)

```typescript
if (templateName === 'invitacion_evento_exclusivo') {
  return [{
    type: 'body',
    parameters: [
      { parameter_name: 'nombre_usuario', ... },
      { parameter_name: 'nombre_tenant', ... },
      { parameter_name: 'nombre_evento', ... },
      { parameter_name: 'fecha_evento', ... },
    ],
  }];
}
```

**Sin header** — la plantilla Meta es body-only.

## Parse JSON (`db/queue.ts`)

`parseTemplateParams` debe preservar `nombre_evento` y `fecha_evento` al leer `templateParams` de PostgreSQL; sin esto el worker envía strings vacíos.

## Scripts

- `scripts/process-one-batch.ts` — procesa un lote PENDING (dev/debug con Neon).
- E2E coordinado desde rulett-app: `scripts/e2e-whatsapp-templates.ts`.

## Deploy

Render debe rebuild tras cambios en `services/whatsapp.ts` y `db/queue.ts`. Sin deploy, rulett-app encola correctamente pero Meta responde `#132000`.
