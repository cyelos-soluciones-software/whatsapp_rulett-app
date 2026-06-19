# ADR-002: Worker no calcula variables de plantilla

**Estado:** Aceptado (compartido)  
**Ver:** `rulett-app/openspec/changes/completed/002-whatsapp-template-params/adr.md`

## Decisión worker

El worker **no** hace JOIN a `User`/`Coupon` para inferir textos. Solo consume `templateParams` persistido por rulett-app.

## Consecuencia operativa

Deploy schema (`db:schema`) debe preceder o coincidir con deploy app que escribe JSON.
