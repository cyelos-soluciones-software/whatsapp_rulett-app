# ADR-054-1 — Gemini 3.1 se elige por variable y producción usa la región global

SDD: 17tnjrabmxn · v8 · 2026-10-09
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

# ADR-054-2 — Descartado: partir la clave única del aviso

SDD: 17tnjrabmxn · v8 · 2026-10-09
Estado: descartado [humano, 2026-10-09]

## Decisión vigente

No hay `forcedByUserId` ni índice parcial. El botón reutiliza `enqueueSubscriptionReminders` y la clave única `(tenantId, kind, expiresOn)`. Un segundo clic, o el cron de las 08:00 el mismo día, no manda otro mensaje. El interruptor solo frena ese cron. `reconcileSubscriptionRemindersSafely` reconcilia aunque el interruptor esté apagado.

## Alternativa descartada

Partir el único con `forcedByUserId` para reenviar fuera de la ventana y elegir la plantilla. El analista no lo necesita para este corte: en lab ajusta `expiresAt` de un comercio de prueba.

# ADR-054-3 — Cloud Run procesa el lote antes de responder, y solo lo invoca una cuenta de servicio

SDD: 17tnjrabmxn · v8 · 2026-10-09
Estado: aprobado [humano, 2026-10-08]

## Contexto

El worker responde 200 y procesa después. [repo: whatsapp_rulett-app/src/server.ts] Cloud Run casi no ejecuta nada después de responder. Render está en plan gratis y se duerme. [humano, 2026-10-05] La historia pedía Cloudflare y un header que rulett-app no conocería. El servicio ya corre en Cloud Run y el humano cambió la puerta a IAM para no mantener ese proxy. [humano, 2026-10-08]

## Decisión

El disparo espera al lote y entonces responde. Cloud Run exige autenticación. La única identidad que puede invocar es `whatsapp-worker-invoker`, sin roles de proyecto, con `roles/run.invoker` solo sobre `whatsapp-rulett-app`. rulett-app manda el token en `X-Serverless-Authorization: Bearer`, con audiencia igual al origen de la URL. El worker sigue exigiendo `WORKER_API_KEY` en `Authorization`. No hay secreto de borde ni Cloudflare. Mínimo de instancias 0. Este build no se despliega en Render.

## Alternativas

- Header secreto detrás de Cloudflare. Era el diseño anterior. El humano lo descartó.
- Instancia siempre encendida. Se sale de la capa gratis.
- Cerrar `run.app` con un balanceador de Google. Unos US$18 al mes.

## Consecuencias

rulett-app guarda la URL `run.app` en Vercel. Un mensaje encolado de noche sale en el primer disparo de las 08:00. Si el cliente corta el request, la fila puede quedar en `PROCESSING`; a los 15 minutos vuelve a pendiente, con riesgo de doble envío si Meta ya había aceptado. Hay que desplegar el código que ignora `EDGE_SHARED_SECRET` antes de borrar esa variable.
