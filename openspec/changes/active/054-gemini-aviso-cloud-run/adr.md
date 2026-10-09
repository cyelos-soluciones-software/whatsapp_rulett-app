# ADR-054-1 — Gemini 3.1 se elige por variable y producción usa la región global

SDD: 17tnjrabmxn · v2 · 2026-10-08
Estado: pendiente de aprobación

## Contexto

Cupones, SMS y los cupones iniciales del alta usan `gemini-2.5-flash-lite`. [repo: rulett-app/src/config/ai-prompts.ts] Esa familia se retira "no antes del 16/10/2026", fecha no confirmada por Google. `gemini-3.1-flash-lite` respondió 404 en `us-central1` y sí respondió en `global`. [repo: kb-rulett-app/openspec/changes/active/001-kb-foundation/decisions.md D-18]

## Decisión

`AI_COUPON_MODEL` y `AI_SMS_MODEL`, default `gemini-3.1-flash-lite`. Producción pone `GOOGLE_CLOUD_LOCATION=global` en el mismo deploy. El default del código sigue en `us-central1` para no cambiar entornos que no generan IA. Temperatura y topes no se tocan hasta la llamada real de T-01.

## Alternativas

- Dejar el nombre fijo en código. Volver atrás exigiría otro deploy de código.
- Cambiar también el chat de kb-rulett-app. Fuera de alcance. [humano, 2026-10-05]

## Consecuencias

Sin `global` en Vercel, la IA de producción falla con 404. T-01 puede frenar el deploy si el JSON no cierra.

# ADR-054-2 — El aviso forzado no ocupa el candado del cron

SDD: 17tnjrabmxn · v2 · 2026-10-08
Estado: pendiente de aprobación

## Contexto

`SubscriptionReminder` tiene un único `(tenantId, kind, expiresOn)`. [repo: rulett-app/prisma/schema.prisma] Sirve para que el cron no duplique y también impide el reenvío que pidió el analista.

## Decisión

`forcedByUserId` nullable. El único pasa a ser parcial, solo donde esa columna es null. El botón no consulta `SUBSCRIPTION_REMINDERS_ENABLED`. Dos pulsaciones del mismo tipo en menos de 2 minutos, con la fila aún en cola, son un solo envío.

## Alternativas

- Borrar la fila anterior y crear otra. Pierde el historial.
- Un tipo de aviso nuevo. Obligaría a otra plantilla en Meta.

## Consecuencias

La migración la aplica el humano en lab y producción. El cron de la mañana sigue siendo idempotente.

# ADR-054-3 — Cloud Run procesa el lote antes de responder, detrás de Cloudflare

SDD: 17tnjrabmxn · v2 · 2026-10-08
Estado: pendiente de aprobación

## Contexto

El worker responde 200 y procesa después. [repo: whatsapp_rulett-app/src/server.ts] Cloud Run casi no ejecuta nada después de responder. Render está en plan gratis y se duerme. [humano, 2026-10-05] rulett-app no debe conocer la URL de `run.app`.

## Decisión

El disparo espera al lote y entonces responde. Cloudflare, en `worker.rulett.app`, agrega `X-Rulett-Edge-Secret`. El worker lo exige además del Bearer. `GET /health` no lleva secretos. Mínimo de instancias 0. Este build no se despliega en Render. El runbook está en `design.md`.

## Alternativas

- Instancia siempre encendida. Se sale de la capa gratis.
- Cerrar `run.app` con un balanceador de Google. Unos US$18 al mes. Fuera de alcance.

## Consecuencias

Un mensaje encolado de noche sale en el primer disparo de las 08:00. Si Vercel o Cloudflare cortan el request antes de tiempo, la fila puede quedar en `PROCESSING`; a los 15 minutos vuelve a pendiente, con riesgo de doble envío si Meta ya había aceptado.
