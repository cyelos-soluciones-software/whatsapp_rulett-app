SDD: 17tnjrabmxn · v8 · 2026-10-09

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

### D-02 · Descartado en v5

v2–v4 iban a partir la clave única para reenviar un aviso a un comercio aunque ya hubiera salido, con `forcedByUserId`. [humano, 2026-10-09] Eso no se construye. El botón del listado usa la función del cron y la clave única que ya existe. Un segundo clic el mismo día cuenta como duplicado y no manda otro mensaje.

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
| `subscription-reminder-queue.ts` | rulett-app | `runSubscriptionReminderPass`, compartido por el cron y el botón. El pase de 15 minutos reconcilia siempre. |
| Acción super admin | rulett-app | `requireSuperAdminMutation`. [repo: rulett-app/src/actions/superadmin/tenant.ts] |
| Listado de empresas | rulett-app | Botón al lado de «Forzar reinicio de límites». Confirmación y aviso con conteos. |
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

### D-08 · Un día antes, la misma plantilla de 7 días

[humano, 2026-10-09] Hoy `resolveReminderKind` devuelve `DUE_DAY` si el vencimiento cae en el día calendario de Bogotá, y `SEVEN_DAYS` si cae en hoy + 7. [repo: rulett-app/src/lib/billing/subscription-reminder.ts] `DUE_DAY` apunta a `recordatorio_suscripcion_hoy`. [repo: subscription-reminder.ts]

Pasa a: `DUE_DAY` si el vencimiento es mañana en Bogotá, `SEVEN_DAYS` si es hoy + 7. El mismo día calendario ya no es un día de aviso. El valor del enum no cambia y no hay migración. `expiresOn` sigue siendo la fecha calendario del vencimiento, no la del envío.

Los dos tipos encolan `recordatorio_suscripcion_7d`. `dias` es el texto `"7"` o `"1"`. `recordatorio_suscripcion_hoy` no se escribe en filas nuevas. El worker manda el nombre que ya está en la fila; no se toca. [repo: whatsapp_rulett-app]

Si el cuerpo aprobado en Meta dice «faltan {{dias}} días», el de 1 día se lee «faltan 1 días». Se acepta en este corte. Una plantilla nueva en Meta queda fuera. [humano, 2026-10-09]

Un vencimiento a medianoche de Bogotá (`05:00` UTC) ya pasó cuando corre el cron de esa mañana, así que `isSubscriptionActive` lo marca vencido y el aviso del mismo día nunca sale. [repo: rulett-app/src/lib/billing/subscription-access.ts] [repo: rulett-app/src/lib/__tests__/subscription-reminder.test.ts] Con la ventana en mañana, ese comercio sí entra el día anterior, mientras el instante sigue en el futuro. El día que ya pasó no se recupera.

El SMS de `DUE_DAY` deja «hoy vence…» y queda «manana vence…», sin tildes. [repo: rulett-app/src/lib/sms-charset.ts]

### D-07 · El botón del listado corre el pase del cron

[humano, 2026-10-09] El control va en la cabecera de `/super-admin/tenants`, en el mismo grupo que `TenantLimitsResetButton`. [repo: rulett-app/src/app/super-admin/tenants/page.tsx] [repo: rulett-app/src/components/super-admin/TenantLimitsResetButton.tsx]

Ese botón de límites no elige un comercio: llama `resetTenantLimitsBatch()`, la misma función que el cron. [repo: rulett-app/src/actions/superadmin/tenant-limits-reset.ts] El aviso hace lo mismo con `enqueueSubscriptionReminders` + disparo del worker + `reconcileSubscriptionReminders`. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]

No se construye el aviso por comercio ni la columna `forcedByUserId` de v2–v4. La clave única `(tenantId, kind, expiresOn)` se queda: un segundo clic el mismo día no manda otro WhatsApp.

### Acción del botón

Sin entrada de negocio. Sesión super admin, igual que `triggerTenantLimitsResetAction`.

No consulta `SUBSCRIPTION_REMINDERS_ENABLED`. `runSubscriptionReminderCron` sí: con el interruptor apagado no encola.

`reconcileSubscriptionRemindersSafely` hoy sale de inmediato si el interruptor está apagado. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] [repo: rulett-app/src/app/api/cron/send-whatsapp/route.ts] v6 quita esa salida. El pase de cada 15 minutos llama `reconcileSubscriptionReminders` siempre. Sin filas en cola, la consulta vuelve vacía. No encola avisos nuevos. Así un SMS de respaldo pasa a `SENT_SMS` o `NOT_DELIVERED` aunque el interruptor siga apagado, y una fila dejada en `QUEUED_WHATSAPP` por Render (que responde antes de procesar) se cierra en el siguiente pase. El botón reconcilia en el mismo request, pero solo ve el WhatsApp si el worker ya terminó el lote, que es el caso de Cloud Run.

Salida: el resultado de encolar (`queued`, `skipped`, `duplicates`, `notDelivered`, `errors`) y si el worker respondió. Si `queued` es 0, no llama al worker. Un fallo de red no borra filas: quedan `QUEUED_WHATSAPP`.

La pantalla pide confirmación antes de llamar. El toast no incluye teléfonos. La página exporta `maxDuration = 120` porque la acción espera al worker.

## Modelo de datos

v5 no cambia el esquema. T-04 no se ejecuta.

## Prueba en lab

[humano, 2026-10-09] Cloud Run (`whatsapp-rulett-app`) lee la Neon de producción. El Preview de Vercel (`lab.rulett.app`) lee la Neon de lab. El clic en lab encola en lab. El worker solo ve esas filas si el humano apunta `DATABASE_URL` de Cloud Run a esa misma base. Render sigue encendido contra producción y drena esa cola mientras no se suspenda. Volver Cloud Run a producción es paso del humano, antes de suspender Render. No se escribe la cadena de conexión en este SDD.

Antes del clic en lab tienen que estar desplegados en el Preview T-05, T-06 y T-07. T-07 está en el árbol local y sin commit hasta que se suba. En el entorno Preview de Vercel: `WHATSAPP_WORKER_TRIGGER_URL` con `https://<servicio>.run.app/api/trigger`, `WHATSAPP_WORKER_INVOKER_CLIENT_EMAIL` y `WHATSAPP_WORKER_INVOKER_PRIVATE_KEY`. Si falta el código o una variable, el botón encola y el aviso dice que el worker no respondió. El comercio de prueba tiene que vencer mañana o en 7 días.

## Seguridad — triage OWASP

API del worker (API Security Top 10) y la acción web (web Top 10).

| Ítem | Aplica | Control | Task |
|---|---|---|---|
| API1 Broken Object Level Authorization | No aplica al trigger: no recibe id de recurso del llamador. El lote sale de la base. | — | — |
| API2 Broken Authentication | Aplica | IAM de Cloud Run más Bearer comparado con `timingSafeEqual` sobre el SHA-256. 401 genérico. El token de Google no lo valida el proceso. | W-05, T-07 |
| API3 Broken Object Property | No aplica | No hay escritura masiva de propiedades. | — |
| API4 Unrestricted Resource Consumption | Aplica | `concurrency=1`, `max-instances=2`, timeout 300 s, lote ya topado por `BATCH_SIZE`. | W-04 |
| API5 Broken Function Level Authorization | Aplica en la acción | `requireSuperAdminMutation`. Un admin de comercio no tiene esa sesión. | T-05 |
| API6 Unrestricted Access to Sensitive Business Flows | Aplica | La clave única del cron impide un segundo WhatsApp el mismo día. La acción no es un endpoint público. | T-05 |
| API7 SSRF | No aplica | El worker no recibe URL del cliente. rulett-app llama una URL de entorno, no del usuario. | — |
| API8 Security Misconfiguration | Aplica | Secretos en Secret Manager. El servicio exige autenticación. La cuenta de invocación no tiene roles de proyecto. Los errores de configuración no imprimen el valor. | W-05, W-04 |
| API9 Improper Inventory | Aplica | La URL `run.app` vive en Vercel, no en el cliente. | T-07 |
| API10 Unsafe Consumption of APIs | Aplica | Timeout de 120 s hacia Cloud Run. No se registra el Bearer ni el token de identidad ni la clave privada. | T-07 |
| A01 Broken Access Control (web) | Aplica | Misma puerta que el resto del super admin. | T-05, T-06 |
| A03 Injection | Aplica en el reclaim | SQL parametrizado, como el `claimPendingBatch` actual. Sin armar SQL con el id. v5 no agrega migración. | W-03 |
| A09 Logging | Aplica | No loguear teléfonos completos (el worker ya enmascara). [repo: whatsapp_rulett-app/src/processor.ts] El toast del botón no lleva teléfonos. | T-06 |

Hotspots: comparación de secretos, reclaim de `PROCESSING`.

## Retrocompatibilidad

| Contrato | Consumidor | Estrategia |
|---|---|---|
| Nombre del modelo en código | tests que esperan `gemini-2.5-flash-lite` | Se actualizan en T-02. Producción sin las variables nuevas usa el default 3.1. Quien necesite volver atrás pone `AI_COUPON_MODEL` y `AI_SMS_MODEL` en `gemini-2.5-flash-lite` y redeploya. La región `global` tiene que seguir. |
| `GOOGLE_CLOUD_LOCATION` vacío | entornos que no generan IA | Siguen en `us-central1`. Producción que sí genera debe poner `global` en el mismo deploy de T-02. |
| Único de tres columnas | cron de la mañana y el botón | No se toca. El segundo pase del mismo día no inserta otra fila. |
| `POST /api/trigger` inmediato | rulett-app | Sigue siendo 200 con `triggered: true`. Tarda más. Render no corre este build. |
| URL de Render | crons de Vercel | Sin las variables de la cuenta de invocación, y con la URL de Render, no se envía token. El corte es cambiar la URL después de activar IAM. |
| Sondeo cada 60 s | mensajes encolados de noche en Render | Render no cambia hasta suspenderlo. En Cloud Run, lo de después de las 20:45 sale a las 08:00. Aceptado. [humano, 2026-10-08] |

Rollback de IA: variables al modelo anterior y redeploy de Vercel. Rollback del worker: `WHATSAPP_WORKER_TRIGGER_URL` de vuelta a Render y se vuelve a encender ese servicio. Rollback del botón: quitar el componente; no hay migración que revertir. Si Cloud Run quedó apuntando a lab, el humano lo devuelve a la Neon de producción.

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
10. Probar el botón en lab, con Cloud Run en la Neon de lab, el Preview con T-07 y las variables del paso 7, y un comercio que venza mañana o en 7 días. Si el mensaje llega, devolver Cloud Run a la Neon de producción y después suspender Render. No borrarlo el mismo día.

### 6. Rollback

`WHATSAPP_WORKER_TRIGGER_URL` de vuelta a `https://whatsapp-rulett-app.onrender.com/api/trigger` y redeploy de Vercel. Render sigue atendiendo. Cloud Run puede quedar exigiendo IAM: no afecta mientras nadie lo llame.

## Supuestos de esta planeación

- [SUPUESTO — confirmar] Vercel admite `maxDuration` de 120 s en esas rutas.
- [SUPUESTO — confirmar] Cloud Run en `us-central1`.
- Decidido en v6: el botón no mira el interruptor. El pase de 15 minutos reconcilia siempre. La clave única impide el segundo mensaje del mismo día; no hay ventana de 2 minutos.
- Precios de 3.1 y el razonamiento por defecto no se asumen: los mide T-01.
