SDD: 17tnjrabmxn · v3 · 2026-10-08

# Diseño — 17tnjrabmxn

## Decisiones

### D-01 · Modelo por variable, región `global`

`COUPON_GENERATOR_MODEL` y `SMS_GENERATOR_MODEL` dejan de ser la única fuente. Cada uno lee una variable y, si falta, usa `gemini-3.1-flash-lite`.

| Variable | Default |
|---|---|
| `AI_COUPON_MODEL` | `gemini-3.1-flash-lite` |
| `AI_SMS_MODEL` | `gemini-3.1-flash-lite` |
| `GOOGLE_CLOUD_LOCATION` | en producción: `global` |

Hoy la región por defecto del código es `us-central1`. [repo: rulett-app/src/lib/vertex-ai.ts] `gemini-3.1-flash-lite` respondió 404 ahí y sí respondió en `global`, con la misma cuenta y el mismo SDK. [repo: kb-rulett-app D-18] El default del código **no** se cambia a `global`: un entorno local que no toque la variable seguiría en `us-central1` y fallaría. T-02 documenta en `docs/ENV.md` que producción debe poner `global`, y el despliegue de la fase IA incluye esa variable en Vercel.

Temperatura, tope de salida y esquema JSON no se tocan hasta que T-01 lo pida. Si T-01 mide tokens de razonamiento que dejan el JSON del SMS cortado, la decisión (bajar `thinkingBudget` o subir el tope) se escribe en `decisions.md` antes de T-02. No se anticipa aquí.

Descartado: subir kb-rulett-app al mismo modelo. Fuera de alcance. [humano, 2026-10-05]

### D-02 · El aviso forzado no usa la clave única del automático

Hoy `@@unique([tenantId, kind, expiresOn])` hace idempotente el cron y también impide un segundo aviso del mismo tipo y la misma fecha. [repo: rulett-app/prisma/schema.prisma] [repo: prisma/migrations/20261001114819_subscription_reminders_discovery/migration.sql]

Se agrega `forcedByUserId String?` (null = lo encoló el cron). Se elimina el único de tres columnas y se crea uno parcial:

```sql
CREATE UNIQUE INDEX "SubscriptionReminder_cron_key"
  ON "SubscriptionReminder" ("tenantId", kind, "expiresOn")
  WHERE "forcedByUserId" IS NULL;
```

Prisma no modela índices parciales. El `schema.prisma` pierde el `@@unique` de esas tres columnas, documenta el índice en comentario y la migración SQL lo crea. El `P2002` del cron sigue cubriendo solo las filas automáticas.

`expiresOn` de un forzado es la fecha calendario de `TenantSubscription.expiresAt` en Bogotá, igual que el automático. [repo: rulett-app/src/lib/billing/subscription-reminder.ts] No es "hoy". Así el historial dice sobre qué vencimiento se avisó.

El botón **no** consulta `SUBSCRIPTION_REMINDERS_ENABLED`. [humano, 2026-10-08] Si lo consultara, no serviría para probar el aviso mientras el interruptor sigue apagado.

`reconcileSubscriptionRemindersSafely` sale de inmediato si el interruptor está apagado. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] Con Render el disparo responde antes de enviar, la reconciliación de la acción ve la fila todavía pendiente, y el pase de cada 15 minutos nunca la cierra: el forzado se queda en cola. [humano, 2026-10-08] Con el interruptor apagado, ese pase igual reconcilia las filas con `forcedByUserId` no nulo. Las automáticas siguen sin tocarse. La acción llama a `reconcileSubscriptionReminders` directo, sin mirar el interruptor.

Sin `TenantSubscription` no hay fecha de vencimiento. El botón queda deshabilitado y la acción responde que el comercio no tiene suscripción registrada. [humano, 2026-10-08]

La ficha de suscripción exporta `maxDuration = 120`, igual que las rutas de cron, porque la acción espera al worker. [humano, 2026-10-08]

Doble pulsación: si ya existe un aviso forzado del mismo comercio y el mismo `kind` en `QUEUED_WHATSAPP` creado hace menos de 2 minutos, la acción no inserta otro y responde éxito con el existente. [SUPUESTO — confirmar] No es un único eterno: pasado ese lapso, o ya cerrado el anterior, un reenvío deliberado sí crea otra fila.

Cadena de entrega: la misma de `enqueueReminderForTenant` + `reconcileSubscriptionReminders`. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] La acción, después de encolar, llama `triggerWhatsappWorker` y enseguida `reconcileSubscriptionReminders`, para que un rechazo inmediato de Meta pase a SMS sin esperar 15 minutos. No toca `maxWhatsappPerMonth` ni `maxSmsPerMonth`.

Sin teléfono internacionalizable: no se crea fila de cola. Se crea `SubscriptionReminder` en `NOT_DELIVERED` con `forcedByUserId`, y la pantalla dice que no hay teléfono. El cron ya hace el equivalente. [repo: subscription-reminder-queue.ts]

### D-03 · El worker responde cuando terminó el lote

Hoy `POST /api/trigger` responde 200 y procesa después. [repo: whatsapp_rulett-app/src/server.ts] Cloud Run, con el CPU por defecto, casi no ejecuta nada después de responder. Por eso el handler nuevo hace `await` del lote y entonces responde `{ triggered: true, processed: <n> }`.

`rulett-app` solo mira `response.ok`. [repo: rulett-app/src/lib/whatsapp-worker-trigger.ts] El cuerpo nuevo no lo rompe. T-07 le pone timeout de 120 s al `fetch` y `maxDuration = 120` en las dos rutas de cron que disparan (`send-whatsapp` y `subscription-reminders`). [SUPUESTO — confirmar] El plan de Vercel admite al menos 60 s. Si no, el corte del cliente puede cancelar el request de Cloud Run y dejar filas en `PROCESSING`.

Se quita el bucle de 60 s **solo en el binario que corre en Cloud Run**. Render no recibe este build: sigue con el código actual hasta suspenderlo. Así no hay una ventana en la que producción se quede sin sondeo y sin Cloud Run.

Descartado: `min-instances=1`. Sale de la capa gratis y el analista pidió esa capa. [humano, 2026-10-05]

### D-04 · Dos secretos, y el de Cloudflare no lo conoce rulett-app

| Secreto | Quién lo pone | Quién lo comprueba |
|---|---|---|
| `WORKER_API_KEY` | rulett-app, header `Authorization: Bearer` | el worker, como hoy |
| `EDGE_SHARED_SECRET` | solo el Cloudflare Worker, header `X-Rulett-Edge-Secret` | el worker, solo en `/api/trigger` |

`GET /health` no lleva secretos. Lo usan el probe de Cloud Run y un chequeo manual.

Si `EDGE_SHARED_SECRET` no está definido, `/api/trigger` responde 503 y no procesa. Fallar cerrado. En Cloud Run la variable siempre está. Render no corre este build, así que no le afecta.

Ingress de Cloud Run: público. Cerrarlo a Cloudflare exige un balanceador (~US$18/mes). Fuera de alcance. [proyecto: historia.md]

### D-05 · Filas `PROCESSING` viejas vuelven a pendiente

Antes de reclamar, el worker devuelve a `PENDING` las filas `PROCESSING` con `updatedAt` de hace más de 15 minutos. [repo: whatsapp_rulett-app/docs/DEPLOYMENT.md] ya las nombra como señal de crash y nadie las reencola.

Riesgo aceptado: si Meta aceptó el mensaje y el proceso murió antes de `markSent`, el reclaim lo envía otra vez. Sin el reclaim, un timeout de Cloud Run deja el mensaje colgado para siempre. Se registra en el log cuántas filas se reclamaron.

## Alternativa descartada

Cloud Run con CPU siempre asignado y respuesta inmediata, sin cambiar el server. Conserva el código y se sale de la capa gratis en cuanto hay una instancia despierta el día entero. El cron de Vercel ya dispara cada 15 minutos entre 08:00 y 20:45 Bogotá. [repo: rulett-app/vercel.json] Con D-03 ese disparo alcanza.

## Componentes

| Pieza | Repo | Cambio |
|---|---|---|
| `vertex-ai.ts`, `ai-prompts.ts`, `sms-prompts.ts` | rulett-app | Modelo desde env. Región de producción `global`. |
| `subscription-reminder-queue.ts` | rulett-app | Inserción forzada que no choca con el cron. |
| Acción super admin | rulett-app | `requireSuperAdminMutation`. [repo: rulett-app/src/actions/superadmin/tenant.ts] |
| Página de suscripción | rulett-app | Elección, confirmación, historial, aviso sin teléfono. |
| `server.ts`, `index.ts` | whatsapp_rulett-app | Await del lote, header, reclaim, sin sondeo. |
| `whatsapp-worker-trigger.ts` | rulett-app | Timeout. No envía el header de borde. |
| Cloudflare Worker | consola, no repo | Agrega `X-Rulett-Edge-Secret` y reenvía a `run.app`. |
| Cloud Run | consola | W-04. |

## Contratos

### `POST /api/trigger`

Request: `Authorization: Bearer <WORKER_API_KEY>` y `X-Rulett-Edge-Secret: <EDGE_SHARED_SECRET>`.

| Caso | HTTP | Body | ¿Procesa? |
|---|---|---|---|
| Ambos secretos correctos | 200 | `{ "triggered": true, "processed": <n> }` | sí, antes de responder |
| Falta o sobra cualquiera | 401 | `{ "error": "No autorizado." }` | no |
| `EDGE_SHARED_SECRET` vacío en el proceso | 503 | `{ "error": "No configurado." }` | no |
| Ya hay un lote en curso | 200 | `{ "triggered": true, "processed": 0, "busy": true }` | no encadena otro |

`GET /health` sigue en 200 `{ "ok": true }` sin secretos.

### Acción de forzar

Entrada: `tenantId`, `kind` (`SEVEN_DAYS` | `DUE_DAY`). Sesión super admin + CSRF, igual que el resto de mutaciones del super admin.

Salida: `{ ok: true, reminderId }` o `{ error }` con texto para la pantalla. Errores de negocio: comercio inexistente, sin teléfono. Un fallo de red al despertar el worker no borra la fila: queda `QUEUED_WHATSAPP` y el cron de 15 minutos la reclama.

## Modelo de datos

Solo rulett-app. Una migración.

- Columna `SubscriptionReminder.forcedByUserId` nullable, FK a `User` `ON DELETE SET NULL`.
- Drop de `SubscriptionReminder_tenantId_kind_expiresOn_key`.
- Unique parcial `SubscriptionReminder_cron_key` como en D-02.
- Índice `(tenantId, createdAt)` para el historial.

Filas viejas quedan con `forcedByUserId` null y siguen cubiertas por el único parcial. No hay backfill.

Lab y producción: las aplica el humano, el mismo criterio que T-01 de `17tnjra85qn`. [repo: rulett-app/docs/sdd/17tnjra85qn/index.md]

## Seguridad — triage OWASP

API del worker (API Security Top 10) y la acción web (web Top 10).

| Ítem | Aplica | Control | Task |
|---|---|---|---|
| API1 Broken Object Level Authorization | No aplica al trigger: no recibe id de recurso del llamador. El lote sale de la base. | — | — |
| API2 Broken Authentication | Aplica | Bearer constante en tiempo (no `!==` corto-circuito sobre el secreto completo: comparar longitudes y luego un OR de bytes) y header de borde igual. 401 genérico. | W-01 |
| API3 Broken Object Property | No aplica | No hay escritura masiva de propiedades. | — |
| API4 Unrestricted Resource Consumption | Aplica | `concurrency=1`, `max-instances=2`, timeout 300 s, lote ya topado por `BATCH_SIZE`. | W-04 |
| API5 Broken Function Level Authorization | Aplica en la acción | `requireSuperAdminMutation`. Un admin de comercio no tiene esa sesión. | T-05 |
| API6 Unrestricted Access to Sensitive Business Flows | Aplica | Doble pulsación acotada a 2 minutos. El forzado no está en un endpoint público. | T-05 |
| API7 SSRF | No aplica | El worker no recibe URL del cliente. rulett-app llama una URL de entorno, no del usuario. | — |
| API8 Security Misconfiguration | Aplica | Secretos en Secret Manager, no en la imagen. Ingress público documentado. Fail closed si falta el secreto de borde. | W-01, W-04 |
| API9 Improper Inventory | Aplica | `run.app` queda en el inventario del runbook. No se publica en el cliente. | W-04 |
| API10 Unsafe Consumption of APIs | Aplica | Timeout de 120 s hacia Cloud Run. No se registra el Bearer ni el header. | T-07 |
| A01 Broken Access Control (web) | Aplica | Misma puerta que el resto del super admin. | T-05, T-06 |
| A03 Injection | Aplica en la migración y en el reclaim | SQL parametrizado, como el `claimPendingBatch` actual. Sin armar SQL con el id. | W-03, T-04 |
| A09 Logging | Aplica | No loguear teléfonos completos (el worker ya enmascara). [repo: whatsapp_rulett-app/src/processor.ts] El historial del super admin muestra el resultado, no el token de Meta. | T-06 |

Hotspots: comparación de secretos, índice único parcial, reclaim de `PROCESSING`.

## Retrocompatibilidad

| Contrato | Consumidor | Estrategia |
|---|---|---|
| Nombre del modelo en código | tests que esperan `gemini-2.5-flash-lite` | Se actualizan en T-02. Producción sin las variables nuevas usa el default 3.1. Quien necesite volver atrás pone `AI_COUPON_MODEL` y `AI_SMS_MODEL` en `gemini-2.5-flash-lite` y redeploya. La región `global` tiene que seguir. |
| `GOOGLE_CLOUD_LOCATION` vacío | entornos que no generan IA | Siguen en `us-central1`. Producción que sí genera debe poner `global` en el mismo deploy de T-02. |
| Único de tres columnas | cron de la mañana | El único parcial conserva el mismo rechazo al segundo automático. |
| `POST /api/trigger` inmediato | rulett-app | Sigue siendo 200 con `triggered: true`. Tarda más. Render no corre este build. |
| Header nuevo | nadie hoy | Solo el proceso con `EDGE_SHARED_SECRET` lo exige. El corte es el cambio de URL, no un deploy ciego. |
| Sondeo cada 60 s | mensajes encolados de noche en Render | Render no cambia hasta suspenderlo. En Cloud Run, lo de después de las 20:45 sale a las 08:00. Aceptado. [humano, 2026-10-08] |

Rollback de IA: variables al modelo anterior y redeploy de Vercel. Rollback del worker: `WHATSAPP_WORKER_TRIGGER_URL` de vuelta a Render y se vuelve a encender ese servicio. La migración no se revierte: las filas forzadas no estorban al cron.

## Paso a paso — Cloud Run

Lo ejecuta el humano en W-04, después de que la imagen construida con W-01 exista. Proyecto: `project-72b19706-c033-47ed-a35`. [repo: rulett-app/docs/ENV.md] Región de Cloud Run y del registro: `us-central1`. [SUPUESTO — confirmar]

No pegar secretos en el shell history compartido. `gcloud` con la cuenta que ya administra ese proyecto.

### 1. APIs y registro

```bash
gcloud config set project project-72b19706-c033-47ed-a35
gcloud services enable artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create whatsapp-rulett \
  --repository-format=docker \
  --location=us-central1 \
  --description="Worker de WhatsApp de Rulett"
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 2. Imagen

Desde `whatsapp_rulett-app`, con el código de W-01 ya mergeado:

```bash
docker build -t us-central1-docker.pkg.dev/project-72b19706-c033-47ed-a35/whatsapp-rulett/worker:v1 .
docker push us-central1-docker.pkg.dev/project-72b19706-c033-47ed-a35/whatsapp-rulett/worker:v1
```

El Dockerfile actual ya escucha 8080 y corre como usuario sin privilegios. [repo: whatsapp_rulett-app/Dockerfile] Cloud Run inyecta `PORT`; el proceso ya lo lee. [repo: whatsapp_rulett-app/src/config.ts]

### 3. Secretos

Crear en Secret Manager, uno por valor, los mismos que hoy tiene Render más el nuevo:

- `whatsapp-database-url`
- `whatsapp-worker-api-key` (el mismo `WORKER_API_KEY` de Vercel)
- `whatsapp-edge-secret` (nuevo, largo, distinto del Bearer; el mismo valor va al Cloudflare Worker)
- `whatsapp-token`

No van a Secret Manager: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCOUNT_ID`, `WHATSAPP_LANGUAGE_CODE`, `BATCH_SIZE`. Van como env de texto.

### 4. Servicio

```bash
gcloud run deploy whatsapp-rulett \
  --image=us-central1-docker.pkg.dev/project-72b19706-c033-47ed-a35/whatsapp-rulett/worker:v1 \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=300 \
  --concurrency=1 \
  --max-instances=2 \
  --min-instances=0 \
  --set-env-vars=NODE_ENV=production,DATABASE_SSL=true,BATCH_SIZE=50,WHATSAPP_LANGUAGE_CODE=es_CO,WHATSAPP_PHONE_ID=$WHATSAPP_PHONE_ID,WHATSAPP_ACCOUNT_ID=$WHATSAPP_ACCOUNT_ID \
  --set-secrets=DATABASE_URL=whatsapp-database-url:latest,WORKER_API_KEY=whatsapp-worker-api-key:latest,EDGE_SHARED_SECRET=whatsapp-edge-secret:latest,WHATSAPP_TOKEN=whatsapp-token:latest
```

No pases `--no-cpu-throttling`: no es una bandera válida y el CPU durante la request ya es el default. [humano, 2026-10-08]

Antes del comando, en la misma shell, exporta `WHATSAPP_PHONE_ID` y `WHATSAPP_ACCOUNT_ID` copiados de Render. `loadConfig()` los exige al arrancar: si faltan en el primer deploy, la revisión no levanta. No escribas esos valores en este archivo.

`--allow-unauthenticated` es deliberado (D-04). La identidad de invocación de Google no sirve: rulett-app no debe conocer la URL de `run.app`, y quien llama esa URL es Cloudflare, que no firma con IAM de Google.

Probe: `GET /health`.

Presupuesto: alerta en la cuenta de facturación de GCP al pasar de US$5 en el mes. La capa gratis de Cloud Run (solicitud, vCPU-segundo y GiB-segundo; confirmar cifras vigentes en la página de precios) cubre 96 disparos cortos al día. Si la alerta suena, no se sube `min-instances`.

### 5. Cloudflare

Subdominio `worker.rulett.app`. El dominio ya está en Cloudflare. [humano, 2026-10-08]

Un Cloudflare Worker en la ruta de ese host:

1. Lee el secreto `EDGE_SHARED_SECRET` de Cloudflare (mismo valor que Secret Manager).
2. Reenvía método, path, query y header `Authorization` a `https://<servicio>.run.app`.
3. Agrega `X-Rulett-Edge-Secret`.
4. Devuelve el status y el body de Cloud Run.

No cachear `POST`. Timeout del Worker ≥ 120 s (límite del plan de Cloudflare: comprobarlo al crearlo; si el plan corta antes, el síntoma es 524 y filas `PROCESSING`, que el reclaim de D-05 devuelve a pendiente).

DNS del subdominio: ruta de Worker, proxy naranja activo.

### 6. Corte

1. Dejar Render encendido.
2. Probar `GET https://worker.rulett.app/health` → 200.
3. Probar `POST https://worker.rulett.app/api/trigger` sin Bearer → 401 y la cola no se mueve.
4. Probar `POST` directo a `run.app` con Bearer y sin el header → 401.
5. En Vercel, `WHATSAPP_WORKER_TRIGGER_URL=https://worker.rulett.app/api/trigger`. Redeploy (T-07).
6. Forzar un aviso al teléfono del analista desde el super admin.
7. Si llega, suspender el servicio en Render. No borrarlo hasta el día siguiente.
8. Anotar la URL de `run.app` solo en el runbook interno, no en Vercel.

### 7. Rollback

`WHATSAPP_WORKER_TRIGGER_URL` de vuelta a `https://whatsapp-rulett-app.onrender.com/api/trigger`, reanudar Render, redeploy de Vercel. Cloud Run puede quedar en cero instancias.

## Supuestos de esta planeación

- [SUPUESTO — confirmar] Vercel admite `maxDuration` de 120 s en esas rutas.
- [SUPUESTO — confirmar] El botón no mira `SUBSCRIPTION_REMINDERS_ENABLED`.
- [SUPUESTO — confirmar] Doble pulsación = mismo `kind` y mismo comercio en `QUEUED_WHATSAPP` hace menos de 2 minutos.
- [SUPUESTO — confirmar] Cloud Run en `us-central1`.
- Precios de 3.1 y el razonamiento por defecto no se asumen: los mide T-01.
