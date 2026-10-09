SDD: 17tnjrabmxn · v4 · 2026-10-08

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

### D-04 · IAM de Cloud Run, y el Bearer de siempre

[humano, 2026-10-08] Se descarta Cloudflare y el header `X-Rulett-Edge-Secret`. El servicio ya corre en Cloud Run y rulett-app sí conoce la URL `run.app`. La puerta de red es IAM: solo una cuenta de servicio nueva puede invocar el servicio. El worker sigue exigiendo `WORKER_API_KEY`.

| Credencial | Quién la pone | Quién la comprueba |
|---|---|---|
| Token de identidad de `whatsapp-worker-invoker` | rulett-app, header `X-Serverless-Authorization: Bearer <id_token>` | Cloud Run, antes de llegar al contenedor |
| `WORKER_API_KEY` | rulett-app, header `Authorization: Bearer` | el worker |

La cuenta no tiene roles de proyecto. Solo `roles/run.invoker` sobre el servicio `whatsapp-rulett-app`. La audiencia del token es el origen de `WHATSAPP_WORKER_TRIGGER_URL`, sin path y sin barra final. `google-auth-library` ya está en rulett-app. [repo: rulett-app/package.json]

Si la URL es de `run.app` y faltan `WHATSAPP_WORKER_INVOKER_CLIENT_EMAIL` o `WHATSAPP_WORKER_INVOKER_PRIVATE_KEY`, rulett-app no llama al worker. Con la URL de Render no se genera token: el comportamiento de hoy.

El worker ya no lee `EDGE_SHARED_SECRET`. Si la variable sigue en el servicio, se ignora. Un error de configuración no incluye el valor de la variable: `parsePositiveInt` y `parseBoolean` hoy lo imprimen. [repo: whatsapp_rulett-app/src/config.ts]

`GET /health` dentro del proceso no pide secretos. Con «Requerir autenticación», un curl público sin token recibe 403 de Google y no entra al contenedor. No configures un probe HTTP a `/health`: usa TCP al puerto 8080, o ninguno.

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
| `server.ts`, `index.ts` | whatsapp_rulett-app | Await del lote, solo Bearer, reclaim, sin sondeo. |
| `whatsapp-worker-trigger.ts` | rulett-app | Timeout y token de identidad en `X-Serverless-Authorization` cuando la URL es `run.app`. |
| Cloud Run | consola | W-04. IAM con `whatsapp-worker-invoker`. |

## Contratos

### `POST /api/trigger`

Request que llega al contenedor: `Authorization: Bearer <WORKER_API_KEY>`. Cloud Run, si «Requerir autenticación» está activo, exige antes `X-Serverless-Authorization: Bearer <id_token>` y responde 403 sin entrar al contenedor si falta o no es de `whatsapp-worker-invoker`.

| Caso | HTTP | Body | ¿Procesa? |
|---|---|---|---|
| IAM válido y Bearer correcto | 200 | `{ "triggered": true, "processed": <n> }` | sí, antes de responder |
| Bearer ausente, mal o sin esquema `Bearer` | 401 | `{ "error": "No autorizado." }` | no |
| Excepción del lote | 500 | `{ "error": "Error al procesar." }` | no encadena otro |
| Ya hay un lote en curso | 200 | `{ "triggered": true, "processed": 0, "busy": true }` | no encadena otro |
| Sin token de identidad, con IAM activo | 403 de Google | no llega al worker | no |

`GET` y `POST` en `/api/trigger` usan la misma puerta. `GET /health`, si la petición entra al proceso, responde 200 `{ "ok": true }` sin secretos de aplicación.

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
| API2 Broken Authentication | Aplica | IAM de Cloud Run más Bearer comparado con `timingSafeEqual` sobre el SHA-256. 401 genérico. El token de Google no lo valida el proceso. | W-05, T-07 |
| API3 Broken Object Property | No aplica | No hay escritura masiva de propiedades. | — |
| API4 Unrestricted Resource Consumption | Aplica | `concurrency=1`, `max-instances=2`, timeout 300 s, lote ya topado por `BATCH_SIZE`. | W-04 |
| API5 Broken Function Level Authorization | Aplica en la acción | `requireSuperAdminMutation`. Un admin de comercio no tiene esa sesión. | T-05 |
| API6 Unrestricted Access to Sensitive Business Flows | Aplica | Doble pulsación acotada a 2 minutos. El forzado no está en un endpoint público. | T-05 |
| API7 SSRF | No aplica | El worker no recibe URL del cliente. rulett-app llama una URL de entorno, no del usuario. | — |
| API8 Security Misconfiguration | Aplica | Secretos en Secret Manager. El servicio exige autenticación. La cuenta de invocación no tiene roles de proyecto. Los errores de configuración no imprimen el valor. | W-05, W-04 |
| API9 Improper Inventory | Aplica | La URL `run.app` vive en Vercel, no en el cliente. | T-07 |
| API10 Unsafe Consumption of APIs | Aplica | Timeout de 120 s hacia Cloud Run. No se registra el Bearer ni el token de identidad ni la clave privada. | T-07 |
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
| URL de Render | crons de Vercel | Sin las variables de la cuenta de invocación, y con la URL de Render, no se envía token. El corte es cambiar la URL después de activar IAM. |
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

Crear en Secret Manager, uno por valor, los mismos que hoy tiene Render:

- `whatsapp-database-url`
- `whatsapp-worker-api-key` (el mismo `WORKER_API_KEY` de Vercel)
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
  --set-secrets=DATABASE_URL=whatsapp-database-url:latest,WORKER_API_KEY=whatsapp-worker-api-key:latest,WHATSAPP_TOKEN=whatsapp-token:latest
```

No pases `--no-cpu-throttling`: no es una bandera válida y el CPU durante la request ya es el default. [humano, 2026-10-08]

Antes del comando, en la misma shell, exporta `WHATSAPP_PHONE_ID` y `WHATSAPP_ACCOUNT_ID` copiados de Render. `loadConfig()` los exige al arrancar: si faltan en el primer deploy, la revisión no levanta. No escribas esos valores en este archivo.

El primer deploy puede haber quedado con `--allow-unauthenticated`. El corte a IAM, más abajo, lo cierra. No uses un probe HTTP a `/health`.

Presupuesto: alerta en la cuenta de facturación de GCP al pasar de US$5 en el mes. La capa gratis de Cloud Run (solicitud, vCPU-segundo y GiB-segundo; confirmar cifras vigentes en la página de precios) cubre 96 disparos cortos al día. Si la alerta suena, no se sube `min-instances`.

### 5. Corte a IAM

El servicio ya está desplegado. No borres `EDGE_SHARED_SECRET` hasta que la revisión nueva, que lo ignora, esté sirviendo tráfico. Si lo borras antes, la revisión vieja responde 503.

1. Desplegar en Cloud Run la revisión de la rama `cloud-run` que ya no exige el secreto de borde. Render sigue con la URL de Vercel.
2. Crear la cuenta `whatsapp-worker-invoker` sin roles de proyecto.
3. Darle `roles/run.invoker` solo sobre el servicio `whatsapp-rulett-app` en `us-central1`.
4. Crear una clave JSON. En Vercel, `WHATSAPP_WORKER_INVOKER_CLIENT_EMAIL` y `WHATSAPP_WORKER_INVOKER_PRIVATE_KEY` (los saltos de línea como en la clave de Vertex). Todavía no cambies la URL.
5. Desplegar rulett-app con T-07. Con la URL de Render no envía token.
6. `gcloud run services update whatsapp-rulett-app --no-allow-unauthenticated --region=us-central1`
7. Cambiar `WHATSAPP_WORKER_TRIGGER_URL` a `https://<servicio>.run.app/api/trigger` y redesplegar Vercel.
8. Probar, en este orden: sin token, Google responde 403 y la cola no se mueve. Con token y sin Bearer, el worker responde 401. Con token y Bearer, 200.
9. Quitar `EDGE_SHARED_SECRET` del servicio y borrar el secreto en Secret Manager si existía.
10. Forzar un aviso al teléfono del analista. Si llega, suspender Render. No borrarlo el mismo día.

### 6. Rollback

`WHATSAPP_WORKER_TRIGGER_URL` de vuelta a `https://whatsapp-rulett-app.onrender.com/api/trigger` y redeploy de Vercel. Render sigue atendiendo. Cloud Run puede quedar exigiendo IAM: no afecta mientras nadie lo llame.

## Supuestos de esta planeación

- [SUPUESTO — confirmar] Vercel admite `maxDuration` de 120 s en esas rutas.
- [SUPUESTO — confirmar] El botón no mira `SUBSCRIPTION_REMINDERS_ENABLED`.
- [SUPUESTO — confirmar] Doble pulsación = mismo `kind` y mismo comercio en `QUEUED_WHATSAPP` hace menos de 2 minutos.
- [SUPUESTO — confirmar] Cloud Run en `us-central1`.
- Precios de 3.1 y el razonamiento por defecto no se asumen: los mide T-01.
