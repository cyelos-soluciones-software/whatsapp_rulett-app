# Spec Delta: templateParams (worker)

## Schema SQL

```sql
ALTER TABLE "WhatsappQueue"
  ADD COLUMN IF NOT EXISTS "templateParams" JSONB;
```

## `src/db/queue.ts`

- Incluir `templateParams` en SELECT de claim.
- Parsear a objeto; null permitido en fila pero envío falla.

## `src/services/whatsapp.ts`

**Antes:** body template sin `components`.  
**Después:** `components` con `parameter_name` v25.0.

## `openspec/specs/domain_model.md`

Documentar contrato JSON por plantilla (fusionado).
