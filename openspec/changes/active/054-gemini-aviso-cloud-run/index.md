SDD: 17tnjrabmxn · v4 · 2026-10-08

# Índice — 17tnjrabmxn

estado: aprobado [humano, 2026-10-08]

Ubicación: `openspec/changes/active/054-gemini-aviso-cloud-run/`. [humano, 2026-10-08]

v2. El pase de cada 15 minutos cierra avisos forzados aunque el interruptor esté apagado. Sin suscripción el botón no envía. La ficha de suscripción espera hasta 120 s. [humano, 2026-10-08]

v3. El `gcloud run deploy` no usa `--no-cpu-throttling`. `WHATSAPP_PHONE_ID` y `WHATSAPP_ACCOUNT_ID` van en el mismo comando, exportados en la shell, porque el proceso no arranca sin ellos. [humano, 2026-10-08]

v4. La puerta deja de ser Cloudflare. Cloud Run exige IAM con la cuenta `whatsapp-worker-invoker`. rulett-app conoce la URL `run.app` y manda el token en `X-Serverless-Authorization`. [humano, 2026-10-08]

ClickUp: [Actualizar la IA a Gemini 3.1, poder forzar el aviso de renovación y mover el envío de WhatsApp a Google Cloud](https://app.clickup.com/t/9013064238/17tnjrabmxn)

Historia local: [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/historia.md]

ClickUp no se pudo leer en vivo. El árbol de subtareas sale de esa historia. Si la tarjeta contradice la historia, este SDD está mal y hay que parar.

El humano pidió un solo SDD para los tres frentes. [humano, 2026-10-08]

## Repos

| Repo | Qué hace | Tasks |
|---|---|---|
| rulett-app | Modelo Gemini, esquema del aviso forzado, acción y pantalla del super admin, cambio de URL del worker | T-01 … T-08 |
| whatsapp_rulett-app | El disparo procesa el lote antes de responder y solo exige el Bearer. IAM lo exige Cloud Run. | W-01 … W-05 |

## Orden de despliegue

La fase de IA no espera al resto. Fecha dura: producción antes del 16/10/2026.

1. **T-01** en local: una llamada real a `gemini-3.1-flash-lite` con región `global`, esquema JSON y medición de tokens de razonamiento. Si falla, se para la fase de IA y se registra en `decisions.md`. No se despliega.
2. **T-02** en rulett-app. En Vercel: `GOOGLE_CLOUD_LOCATION=global` y, si se usan, las variables de modelo. Redeploy. Esto solo cambia la IA.
3. **T-03** la hace el humano en Neon de producción (consultas del `tasks.md`). No es código. Cierra migración, interruptor y plantillas de `17tnjra85qn`, o deja constancia de cuál falta.
4. **T-04** migración solo en Docker local por el implementador. Lab y producción las aplica el humano, antes de usar el botón.
5. **T-05 y T-06** en rulett-app. El botón puede apuntar todavía a Render.
6. **W-01 a W-03** en la imagen. No se redespliega este código en Render: Render sigue con el proceso actual hasta el apagado.
7. **W-05** quita el secreto de borde. **W-04** la ejecuta el humano: la cuenta de invocación y «Requerir autenticación», en el orden del runbook. No borrar `EDGE_SHARED_SECRET` antes de que sirva la revisión nueva.
8. **T-07** manda el token de identidad y cambia `WHATSAPP_WORKER_TRIGGER_URL` a la URL `run.app` solo después de activar IAM. Render y Cloud Run pueden estar encendidos; `SKIP LOCKED` impide el doble envío. [repo: whatsapp_rulett-app/src/db/queue.ts]
9. Prueba con el botón (T-06) contra el teléfono del analista. Si pasa, se suspende Render. No se borra el servicio el mismo día.

## Documentos consultados

- [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/historia.md]
- [repo: rulett-app/docs/sdd/17tnjra85qn/index.md]
- [repo: rulett-app/docs/sdd/_base/architecture.md]
- [repo: rulett-app/docs/ENV.md]
- [repo: rulett-app/prisma/schema.prisma]
- [repo: rulett-app/src/lib/vertex-ai.ts]
- [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]
- [repo: rulett-app/src/lib/whatsapp-worker-trigger.ts]
- [repo: rulett-app/vercel.json]
- [repo: whatsapp_rulett-app/docs/DEPLOYMENT.md]
- [repo: whatsapp_rulett-app/src/server.ts]
- [repo: whatsapp_rulett-app/src/index.ts]
- [repo: whatsapp_rulett-app/Dockerfile]
- [repo: kb-rulett-app/openspec/changes/active/001-kb-foundation/decisions.md] D-18
