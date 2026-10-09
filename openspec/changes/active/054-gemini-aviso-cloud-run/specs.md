SDD: 17tnjrabmxn · v8 · 2026-10-09

# Spec — 17tnjrabmxn

## IA

### R-01 · Cupones con IA

Dado un comercio con suscripción activa, cuando su administrador pide cupones con IA, recibe propuestas que pasan las reglas de vigencia actuales (ninguna vence antes de hoy; las que el modelo fecha en el pasado se corrigen como hoy). [repo: rulett-app/openspec/changes/completed/043-ai-coupon-expiration-fix/specs.md]

El request a Vertex usa el modelo de `AI_COUPON_MODEL` (default `gemini-3.1-flash-lite`) y la región de `GOOGLE_CLOUD_LOCATION`.

### R-02 · SMS con IA

Las sugerencias salen en alfabeto GSM y en 160 caracteres o menos, igual que hoy. [repo: rulett-app/src/lib/ai/sms-prompts.ts] Modelo: `AI_SMS_MODEL`.

### R-03 · Alta

Autoregistro de 14 días y alta del super admin: si la IA responde, el comercio queda con 3 cupones iniciales inactivos. Si la IA no responde, el comercio queda creado, sin esos cupones, y el administrador puede entrar. [repo: rulett-app/src/lib/tenant-bootstrap-ai.ts]

### R-04 · Error visible

Si Vertex falla en "generar cupones" o "sugerir SMS", el administrador ve el mismo aviso de error que hoy y no se persiste un cupón ni se encola un SMS.

### R-05 · Comparación

Set fijo, armado por el analista el día de la prueba: 5 comercios de categorías distintas y 5 intenciones de SMS. Se corre una vez con 2.5 (antes del deploy, o con la variable apuntando al modelo viejo) y una vez con 3.1. Criterio: 100 % de JSON válido y de reglas R-01/R-02. La calidad del texto la aprueba el analista por escrito en `decisions.md`. Sin esa nota, la fase de IA no se da por cerrada.

## Aviso desde el listado

### R-06 · Dónde y qué corre

Solo super admin, en `/super-admin/tenants`, en el mismo grupo que «Forzar reinicio de límites». [humano, 2026-10-09] [repo: rulett-app/src/app/super-admin/tenants/page.tsx] El botón se llama «Forzar avisos de suscripción». Pide confirmación. No elige comercio ni plantilla.

Ejecuta `enqueueSubscriptionReminders` del día (vencen mañana o en 7 días, America/Bogota; ver R-20), luego el disparo del worker si encoló al menos uno, y luego `reconcileSubscriptionReminders`. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] Las exclusiones del cron se quedan: comercio inactivo, sin teléfono internacionalizable, pago manual en revisión, suscripción ya vencida.

### R-07 · Interruptor

El botón no consulta `SUBSCRIPTION_REMINDERS_ENABLED`. `runSubscriptionReminderCron` sí: con el interruptor apagado no encola. `reconcileSubscriptionRemindersSafely` tampoco lo consulta: cada 15 minutos cierra filas ya encoladas (`SENT_WHATSAPP`, SMS de respaldo, `SENT_SMS`, `NOT_DELIVERED`) y no crea avisos nuevos. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] [repo: rulett-app/src/app/api/cron/send-whatsapp/route.ts]

### R-08 · Nadie en la ventana

Si `queued` es 0, no llama al worker. El toast dice que no encoló avisos. No es un error.

### R-09 · Cadena

La misma del cron: WhatsApp primero; si esa fila queda `FAILED`, la reconciliación encola el SMS de plataforma. Origen `PLATFORM`. No incrementa el cupo mensual del comercio. El clic solo alcanza a ver el WhatsApp terminado si el worker responde al acabar el lote (Cloud Run). `SENT_SMS`, `NOT_DELIVERED` y el cierre cuando Render respondió antes de procesar los hace el pase de 15 minutos, también con el interruptor apagado.

### R-10 · Segundo clic

La clave única `(tenantId, kind, expiresOn)` sigue. Un segundo clic el mismo día no crea otra fila ni otro WhatsApp. El conteo de duplicados sube. No hay `forcedByUserId`.

### R-11 · Toast

Éxito: encolados, omitidos, duplicados, y si el disparo respondió. Error de sesión o de excepción: el texto de la acción. Sin teléfonos y sin `errorLog` de Meta. Mientras corre, el botón dice «Enviando…» y no acepta otro clic.

### R-12 · Misma base

El clic en `lab.rulett.app` escribe en la Neon del Preview. Cloud Run solo envía esas filas si su `DATABASE_URL` es esa base. [humano, 2026-10-09] Si Cloud Run sigue en producción, el toast puede decir encolados y el worker responde que no hay pendientes: la fila está en la otra base.

### R-13 · Fuera de este corte

No hay botón por fila, ni elección de plantilla, ni historial en la ficha de suscripción. Un comercio que no vence mañana ni en 7 días no recibe mensaje por este botón. El que vence hoy tampoco.

### R-20 · Mañana y en 7 días, una sola plantilla

`resolveReminderKind` devuelve `DUE_DAY` si la fecha calendario de `expiresAt` en `America/Bogota` es mañana, y `SEVEN_DAYS` si es hoy + 7. El mismo día calendario devuelve null. [repo: rulett-app/src/lib/billing/subscription-reminder.ts] `expiresAtWindows` prefiltra esos dos días, ya no el día de hoy. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]

`isSubscriptionActive` no cambia: si el instante ya pasó, no hay aviso. [repo: rulett-app/src/lib/billing/subscription-access.ts] Con `now` = `2026-10-01T13:00:00.000Z` (08:00 Bogotá), `expiresAt` = `2026-10-02T05:00:00.000Z` (medianoche de Bogotá del día siguiente) es `DUE_DAY` y `expiresOn` = `2026-10-02`. El mismo instante evaluado el `2026-10-02T13:00:00.000Z` sale `expired` y no se avisa. Ese es el caso que hoy se pierde.

Los dos tipos encolan `recordatorio_suscripcion_7d`. `dias` es el texto `"7"` o `"1"`, según un mapa por tipo. `recordatorio_suscripcion_hoy` no se encola. La validación de esa plantilla acepta `nombre_comercio` no vacío y `dias` solo `"7"` o `"1"`. [repo: rulett-app/src/lib/whatsapp-template-params.ts]

El SMS de `DUE_DAY` termina en `, manana vence tu suscripcion en Rulett. Paga en https://www.rulett.app/admin/suscripcion`, sin tildes, y sigue cabiendo en 160 recortando solo el nombre. [repo: rulett-app/src/lib/sms-charset.ts]

No hay migración. Las filas viejas con `DUE_DAY` significan «el vencimiento era ese día calendario». Las nuevas significan «se avisó el día anterior». `expiresOn` es la fecha del vencimiento en los dos casos. No se reinterpretan las viejas.

Si el cuerpo en Meta dice «faltan {{dias}} días», el de 1 día se lee «faltan 1 días». Aceptado en este corte. No se pide otra plantilla. El worker no se modifica.

## Worker y corte

### R-14 · Disparo

Con el Bearer correcto, el worker reclama un lote, lo envía y después responde 200. Sin sondeo cada 60 s en ese proceso. Cloud Run, con autenticación requerida, no deja llegar la petición si falta el token de identidad.

### R-15 · Rechazos

Sin Bearer, con Bearer mal o sin el esquema `Bearer`: 401, la cola no cambia. Sin token de identidad, Google responde 403 y la cola no cambia. El proceso ya no tiene secreto de borde.

### R-16 · Mañana siguiente

Un mensaje encolado a las 22:00 Bogotá lo toma el primer disparo de las 08:00 (cron de Vercel), no un sondeo nocturno.

### R-17 · Convivencia

Con Render (código viejo, sondeo) y Cloud Run (código nuevo) a la vez, `FOR UPDATE SKIP LOCKED` hace que cada fila `PENDING` la tome uno solo. [repo: whatsapp_rulett-app/src/db/queue.ts] Criterio de la prueba: N mensajes pendientes, cada destinatario los recibe una vez, cero pendientes al final.

### R-18 · Reclaim

Una fila `PROCESSING` más de 15 minutos vuelve a `PENDING` y entra en el siguiente lote. Se loguea el conteo, sin teléfono.

### R-19 · Health

`GET /health`, si la petición entra al proceso, responde 200 sin secretos de aplicación. En público, con IAM activo, Google responde 403 antes.

## Errores y concurrencia

| Situación | Resultado |
|---|---|
| Vertex 404 por región | T-01 para el deploy. En producción, el administrador ve R-04. El alta cumple R-03. |
| Meta rechaza la plantilla | R-09. No se reintenta el WhatsApp de esa fila. |
| `triggerWhatsappWorker` falla por red | La fila queda `QUEUED_WHATSAPP`. El pase de 15 minutos la cierra. La pantalla dice que quedó en cola y sale en el siguiente ciclo. |
| Botón y cron de las 08:00 el mismo día | La clave única deja una sola fila. No hay una segunda fila «forzada». El claim reparte las colas de WhatsApp. |
| Timeout de Cloud Run a mitad de lote | Lo ya marcado `SENT` no se repite. Lo que quedó `PROCESSING` lo recoge R-18, con el riesgo de doble envío descrito en D-05. |

## Matriz

| Criterio de la historia | Requisito | Task | Prueba |
|---|---|---|---|
| Cupones IA válidos | R-01 | T-02 | Vitest del cliente mockeado + prueba manual del set |
| SMS IA válidos | R-02 | T-02 | Igual |
| Alta con 3 cupones, por los dos orígenes | R-03 | T-02 | Tests de bootstrap ya existentes, siguen verdes |
| IA caída, alta no falla, error visible | R-04 | T-02 | Tests de bootstrap y de las actions |
| Set de referencia | R-05 | T-01, T-02 | Nota del analista en `decisions.md` |
| El listado dispara el pase del día | R-06, R-07 | T-05, T-06 | Test: interruptor apagado igual encola; el cron de la mañana con interruptor apagado no; el pase seguro con interruptor apagado sí consulta la cola |
| Aviso mañana y a 7 días, una plantilla | R-20 | T-09 | Test: medianoche Bogotá del día siguiente → `DUE_DAY`; el mismo instante al día siguiente → `expired`; `dias` `"1"` y `"7"`; SMS «manana» |
| Nadie en la ventana | R-08 | T-05 | Test: `queued` 0 y cero llamadas al trigger |
| SMS si Meta rechaza, sin gastar cupo | R-09 | T-05 | Test: cola WhatsApp `FAILED` → fila SMS `PLATFORM`; contadores intactos |
| Segundo clic | R-10 | T-05 | Test: el duplicado de la clave única no inserta otra fila |
| Toast sin teléfono | R-11 | T-06 | Test del texto armado |
| Otra base, el worker no ve la fila | R-12 | — | Prueba manual en lab, después de apuntar Cloud Run |
| Sin aviso por comercio | R-13 | — | No hay task |
| Campaña y aviso de las 08:00 en Cloud Run | R-14, R-16 | W-01, W-04, T-07 | Prueba manual del corte |
| Rechazo sin clave | R-15 | W-05, T-07 | Test del server y del trigger |
| Sin duplicar en la convivencia | R-17 | W-04 | Prueba manual con N filas |
| Mensaje de noche | R-16 | W-01 | No hay sondeo en el binario nuevo; lo cubre el test de que `index` no programa intervalo |
| Health | R-19 | W-02 | Test |

## Diagnóstico de producción (no es comportamiento nuevo)

T-03. El humano corre en Neon de producción, en este orden, y pega el resultado en `decisions.md` sin teléfonos completos:

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '20261001%';

SELECT t.name, s."expiresAt" AT TIME ZONE 'America/Bogota' AS vence_bogota
FROM "TenantSubscription" s
JOIN "Tenant" t ON t.id = s."tenantId"
ORDER BY s."expiresAt";

SELECT kind, "expiresOn", status, "createdAt"
FROM "SubscriptionReminder"
ORDER BY "createdAt" DESC
LIMIT 20;

SELECT count(*) AS queued
FROM "SubscriptionReminder"
WHERE status = 'QUEUED_WHATSAPP';

SELECT "templateName", status, "errorLog", "createdAt"
FROM "WhatsappQueue"
WHERE origin = 'PLATFORM'
ORDER BY "createdAt" DESC
LIMIT 20;
```

Lectura: sin esas migraciones, faltó aplicarlas. Tabla vacía de avisos: interruptor apagado o no era día de aviso. `FAILED`: el `errorLog` dice si fue plantilla o worker. Si `queued` es mayor que 0, antes de desplegar T-05 a producción el humano cierra esas filas como `NOT_DELIVERED` o anota en `decisions.md` que acepta el SMS de respaldo. Lab no espera esa consulta. Esto no se automatiza.
