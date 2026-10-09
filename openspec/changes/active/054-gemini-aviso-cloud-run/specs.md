SDD: 17tnjrabmxn · v2 · 2026-10-08

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

## Aviso forzado

### R-06 · Elección

Solo super admin, en la ficha de suscripción del comercio. Elige `SEVEN_DAYS` o `DUE_DAY`. El WhatsApp usa la plantilla que ya corresponde a ese tipo. [repo: rulett-app/src/lib/billing/subscription-reminder.ts] El texto es el de la plantilla: forzar "7 días" cuando faltan 3 sigue diciendo que faltan 7. La pantalla lo dice antes de confirmar.

### R-07 · Cuándo se puede

Hay teléfono de contacto internacionalizable y hay suscripción, para saber la fecha de vencimiento. No importa si ese aviso ya salió en el ciclo, si la suscripción venció, si hay un pago manual en revisión, ni si el comercio está inactivo. Esas exclusiones son del cron, no del botón. [proyecto: historia.md] [humano, 2026-10-08] El interruptor `SUBSCRIPTION_REMINDERS_ENABLED` tampoco lo frena. Con el interruptor apagado, el pase de cada 15 minutos igual cierra las filas forzadas (`forcedByUserId` no nulo): pasan a enviado o, si Meta rechazó, a SMS. Las filas automáticas de ese pase siguen sin tocarse. Sin suscripción, no se envía nada.

### R-08 · Sin teléfono

No se crea fila en `WhatsappQueue` ni en `SmsQueue`. Se crea `SubscriptionReminder` `NOT_DELIVERED` con `forcedByUserId`. La pantalla dice que el comercio no tiene teléfono de contacto.

### R-09 · Cadena

WhatsApp primero. Si esa fila queda `FAILED`, el mismo request reconcilia y encola el SMS de plataforma al mismo contacto. El historial pasa a `SENT_SMS` cuando el SMS sale, o a `NOT_DELIVERED` si el SMS también falla. Misma máquina que el cron. [repo: subscription-reminder-queue.ts]

### R-10 · Cupo

El origen de la cola es `PLATFORM`. No incrementa el consumo mensual del comercio.

### R-11 · Doble pulsación

Dos requests del mismo comercio y el mismo `kind` con un forzado todavía `QUEUED_WHATSAPP` creado hace menos de 2 minutos producen una sola fila y un solo WhatsApp. El segundo request responde éxito apuntando a la fila existente.

### R-12 · No tapa el automático

Una fila forzada no ocupa el único parcial. El cron de las 08:00, si el día es de aviso y el interruptor está encendido, inserta su propia fila. Pueden salir los dos el mismo día. Aceptado. [humano, 2026-10-08]

### R-13 · Historial

La ficha lista los avisos del comercio, automáticos y forzados, del más nuevo al más viejo: fecha de creación, tipo, si fue forzado, estado (`QUEUED_WHATSAPP`, `SENT_WHATSAPP`, `SENT_SMS`, `NOT_DELIVERED`). No muestra el cuerpo del error de Meta en la pantalla; eso sigue en `WhatsappQueue.errorLog` para quien consulte la base.

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
| `triggerWhatsappWorker` falla por red | La fila forzada queda `QUEUED_WHATSAPP`. El cron de 15 minutos la recoge. La pantalla dice que quedó encolado y se enviará en el siguiente ciclo. |
| Dos crons y un forzado a la vez | El único parcial deja un solo automático. El forzado es otra fila. El claim reparte las colas. |
| Timeout de Cloud Run a mitad de lote | Lo ya marcado `SENT` no se repite. Lo que quedó `PROCESSING` lo recoge R-18, con el riesgo de doble envío descrito en D-05. |

## Matriz

| Criterio de la historia | Requisito | Task | Prueba |
|---|---|---|---|
| Cupones IA válidos | R-01 | T-02 | Vitest del cliente mockeado + prueba manual del set |
| SMS IA válidos | R-02 | T-02 | Igual |
| Alta con 3 cupones, por los dos orígenes | R-03 | T-02 | Tests de bootstrap ya existentes, siguen verdes |
| IA caída, alta no falla, error visible | R-04 | T-02 | Tests de bootstrap y de las actions |
| Set de referencia | R-05 | T-01, T-02 | Nota del analista en `decisions.md` |
| Elige el tipo y el contacto lo recibe | R-06, R-09 | T-05, T-06 | Test de la acción con cola mockeada + 1 envío real en el corte |
| Reenvío y suscripción vencida | R-07 | T-05 | Test: no mira vencimiento ni duplicado del cron |
| Sin teléfono | R-08 | T-05, T-06 | Test + estado vacío de la pantalla |
| SMS si Meta rechaza | R-09 | T-05 | Test: cola WhatsApp `FAILED` → fila SMS |
| No gasta cupo | R-10 | T-05 | Test: origen `PLATFORM`, contadores intactos |
| Doble pulsación | R-11 | T-05 | Test de dos llamadas seguidas |
| No tapa el automático | R-12 | T-04, T-05 | Test de integración del único parcial, o test del SQL contra la base de Docker |
| Historial | R-13 | T-06 | Test del query |
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

SELECT "templateName", status, "errorLog", "createdAt"
FROM "WhatsappQueue"
WHERE origin = 'PLATFORM'
ORDER BY "createdAt" DESC
LIMIT 20;
```

Lectura: sin esas migraciones, faltó aplicarlas. Tabla vacía de avisos: interruptor apagado o no era día de aviso. `FAILED`: el `errorLog` dice si fue plantilla o worker. Esto no se automatiza.
