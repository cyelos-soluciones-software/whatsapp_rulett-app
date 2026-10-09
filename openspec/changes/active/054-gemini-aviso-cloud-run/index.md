SDD: 17tnjrabmxn · v8 · 2026-10-09

# Índice — 17tnjrabmxn

estado: v6 pendiente de que el implementador arranque. El delta de la revisión del 2026-10-09 quedó incorporado.

Ubicación: `openspec/changes/active/054-gemini-aviso-cloud-run/`. [humano, 2026-10-08]

v2. Superado por v5 en lo del botón. El esquema con `forcedByUserId` no se construye.

v3. El `gcloud run deploy` no usa `--no-cpu-throttling`. `WHATSAPP_PHONE_ID` y `WHATSAPP_ACCOUNT_ID` van en el mismo comando, exportados en la shell, porque el proceso no arranca sin ellos. [humano, 2026-10-08]

v4. La puerta deja de ser Cloudflare. Cloud Run exige IAM con la cuenta `whatsapp-worker-invoker`. rulett-app conoce la URL `run.app` y manda el token en `X-Serverless-Authorization`. [humano, 2026-10-08]

v5. El botón no está en la ficha de suscripción. Está en `/super-admin/tenants`, al lado de «Forzar reinicio de límites», y corre el mismo pase que el cron de las 08:00, sin mirar el interruptor. No hay columna nueva ni aviso por comercio. [humano, 2026-10-09] Cloud Run hoy lee la Neon de producción y el Preview de Vercel lee la de lab; el humano apunta Cloud Run a lab solo para la prueba.

v6. El pase de cada 15 minutos reconcilia aunque el interruptor esté apagado. El interruptor solo frena el encolado de las 08:00. La prueba en lab exige T-07 desplegado en el Preview, con la URL `run.app` y las dos variables de la cuenta de invocación. [humano, 2026-10-09]

v7. El plan de T-05 y T-06 queda en el contrato: `runSubscriptionReminderPass`, el log con `userId` y el texto del aviso en una función pura. Antes de llevar T-05 a producción, el conteo de `QUEUED_WHATSAPP` en Neon. Si es mayor que 0, se cierran como `NOT_DELIVERED` o se acepta el SMS por escrito. [humano, 2026-10-09]

v8. El segundo aviso deja de ser el día del vencimiento. `DUE_DAY` significa «falta 1 día», sin migración, y reutiliza `recordatorio_suscripcion_7d` con `dias` = `"1"`. `recordatorio_suscripcion_hoy` deja de usarse. El worker no cambia. [humano, 2026-10-09]

ClickUp: [Actualizar la IA a Gemini 3.1, poder forzar el aviso de renovación y mover el envío de WhatsApp a Google Cloud](https://app.clickup.com/t/9013064238/17tnjrabmxn)

Historia local: [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/historia.md]

ClickUp no se pudo leer en vivo. El árbol de subtareas sale de esa historia. Si la tarjeta contradice la historia, este SDD está mal y hay que parar.

El humano pidió un solo SDD para los tres frentes. [humano, 2026-10-08]

## Repos

| Repo | Qué hace | Tasks |
|---|---|---|
| rulett-app | Modelo Gemini, botón de avisos en el listado, aviso de 1 día, cierre del pase de 15 minutos, cambio de URL del worker | T-01 … T-09. T-04 no se hace. |
| whatsapp_rulett-app | El disparo procesa el lote antes de responder y solo exige el Bearer. IAM lo exige Cloud Run. | W-01 … W-05 |

## Orden de despliegue

La fase de IA no espera al resto. Fecha dura: producción antes del 16/10/2026.

1. **T-01** en local: una llamada real a `gemini-3.1-flash-lite` con región `global`, esquema JSON y medición de tokens de razonamiento. Si falla, se para la fase de IA y se registra en `decisions.md`. No se despliega.
2. **T-02** en rulett-app. En Vercel: `GOOGLE_CLOUD_LOCATION=global` y, si se usan, las variables de modelo. Redeploy. Esto solo cambia la IA.
3. **T-03** la hace el humano en Neon de producción (consultas del `tasks.md`). No es código. Cierra migración, interruptor y plantillas de `17tnjra85qn`, o deja constancia de cuál falta.
4. **T-04** no se despliega. No hay migración.
5. **T-09**, luego **T-05 y T-06**, en rulett-app. T-09 cambia la ventana a mañana y a 7 días. T-05 incluye el cambio de `reconcileSubscriptionRemindersSafely`. El botón encola en la base del proceso que atiende el clic (en lab, la Neon de lab). El worker solo envía esas filas si su `DATABASE_URL` es la misma base. El worker no se modifica por la plantilla.
6. **W-01 a W-03** en la imagen. No se redespliega este código en Render: Render sigue con el proceso actual hasta el apagado.
7. **W-05** quita el secreto de borde. **W-04** la ejecuta el humano: la cuenta de invocación y «Requerir autenticación», en el orden del runbook. No borrar `EDGE_SHARED_SECRET` antes de que sirva la revisión nueva.
8. **T-07** manda el token de identidad. El código está en local y sin commit hasta que se suba. Para la prueba en lab, el Preview de Vercel tiene que llevar ese deploy y, en el entorno Preview, `WHATSAPP_WORKER_TRIGGER_URL` = `https://<servicio>.run.app/api/trigger` más `WHATSAPP_WORKER_INVOKER_CLIENT_EMAIL` y `WHATSAPP_WORKER_INVOKER_PRIVATE_KEY`. Si falta el código o una variable, el botón encola y el aviso dice que el worker no respondió. Producción cambia la URL a `run.app` solo después de activar IAM. Render sigue encendido contra producción; `SKIP LOCKED` impide el doble envío mientras los dos conviven. [repo: whatsapp_rulett-app/src/db/queue.ts] Si se suspende Render antes de esta prueba, la cola de producción deja de drenarse.
9. Prueba con el botón (T-06) en lab, con Cloud Run apuntando a la Neon de lab y un comercio de prueba que venza mañana o en 7 días. Si el mensaje llega, se devuelve Cloud Run a la Neon de producción y después se suspende Render. No se borra el servicio el mismo día. Un comercio que vence hoy ya no entra en el pase.

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
