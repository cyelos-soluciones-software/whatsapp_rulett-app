# Proposal: Consumo de `templateParams` (worker)

**ID:** `002-whatsapp-template-params`  
**Par:** rulett-app `002-whatsapp-template-params`  
**Estado:** En revisión (código implementado)

## Problema

Meta Graph API v25.0 requiere `components` con `parameter_name`. El worker enviaba solo `template.name` sin variables → envíos fallidos o genéricos.

## Objetivos

1. Leer `templateParams` JSONB de cada fila reclamada.
2. Mapear a header/body según contrato compartido con rulett-app.
3. Fallar explícitamente si faltan parámetros.

## Criterios de aceptación

- [ ] Columna `templateParams` aplicada vía `sql/schema.sql`
- [ ] `sendTemplateMessage` incluye `components` válidos
- [ ] Fila sin JSON → `FAILED` con mensaje claro en `errorLog`
- [ ] Deploy Render + prueba con mensaje real en staging/PDN

**Detalle de negocio y encolado:** ver proposal en rulett-app.
