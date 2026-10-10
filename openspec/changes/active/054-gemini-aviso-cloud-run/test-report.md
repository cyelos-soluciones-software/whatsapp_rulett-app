# Reporte de pruebas — 17tnjrabmxn
Veredicto: **Incompleto**
Ejecutado: 2026-10-09 · Ambiente: `lab.rulett.app`, Neon `ep-patient-hat-aq4hmsfw` (lab), Cloud Run `whatsapp-rulett-app` apuntando a lab · Versión probada: rulett-app `origin/release` (incluye 3f423b9, cefd1dd, fdbf7f4; PR #154); worker `origin/main` c80fb34 (PR #4).
Nada se ejecutó contra producción. Las consultas a lab fueron de solo lectura, con un script que se negaba a correr contra el host de producción; el script ya se borró.

## Resumen por criterio
| Criterio | Casos | Resultado |
|---|---|---|
| R-20 mañana y 7 días | CP-01, CP-02, CP-03, CP-04 | Cumple |
| R-12 misma base | CP-10 | Cumple |
| R-07 interruptor | CP-06 | Cumple (suite) |
| R-08 nadie en ventana | CP-07 | Parcial: suite cumple, UI no probada |
| R-09 respaldo SMS | CP-08 | Parcial: suite cumple, lab no probado |
| R-06, R-11 botón y toast | CP-05 | No probado en UI (la BD muestra que el pase corrió) |
| R-10 segundo clic | CP-09 | No probado |
| R-14, R-16 campañas por Cloud Run | CP-11 | Parcial: 2 de 4 plantillas |
| R-15 rechazos | CP-12 | Parcial: suite cumple, 403 en vivo no probado |
| R-17 convivencia | CP-13 | No probado |
| R-18, R-19 reclaim y health | CP-14 | Cumple (suite + BD) |
| R-01 a R-04 IA | CP-15 | No probado en lab (suite verde) |
| R-05 comparación | CP-16 | No probado |
| R-13 fuera de alcance | CP-17 | No probado |
| OWASP A01 | CP-18 | No probado |
| Retrocompatibilidad | NR-01 a NR-05 | NR-01, NR-02 cumplen; NR-04 observación; NR-03, NR-05 no probados |

## Detalle

### CP-01 — Cumple
Esperado: `DUE_DAY` mañana, `SENT_WHATSAPP`, `dias` `"1"`, `PLATFORM`, `SENT`.
Obtenido: una fila `DUE_DAY`, `expiresOn` 2026-10-10, creada 2026-10-09T15:28Z, `SENT_WHATSAPP`; WhatsApp `recordatorio_suscripcion_7d`, `dias` `"1"`, `SENT`, origen `PLATFORM`, sin error ni SMS. El analista confirmó la recepción.
Evidencia: consulta de solo lectura a `SubscriptionReminder` ⨝ `WhatsappQueue` en lab.

### CP-02 — Cumple
Obtenido: `SEVEN_DAYS`, `expiresOn` 2026-10-16, creada 14:57Z, `dias` `"7"`, `SENT`, `PLATFORM`. Anticipación medida: 1 día para `DUE_DAY`, 7 para `SEVEN_DAYS`.

### CP-03 — Cumple
Obtenido: cero filas nuevas con `recordatorio_suscripcion_hoy`; ningún `dias` fuera de `"1"`/`"7"`.

### CP-04 — Cumple
Obtenido: `subscription-reminder.test.ts`, `subscription-reminder-queue.test.ts`, `sms-charset.test.ts`, `whatsapp-template-params.test.ts` verdes dentro de la suite completa.

### CP-05 — No probado
Motivo: no hubo sesión de navegador del analista. Indicio, no evidencia: las dos filas de aviso se crearon a las 14:57Z y 15:28Z, fuera del horario del cron (14:00Z), así que salieron del botón. El toast, la confirmación y el estado «Enviando…» no se observaron.

### CP-06 — Cumple (suite)
Obtenido: tests del interruptor verdes. No se cambió el interruptor en lab.

### CP-07 — Parcial
Suite: test `queued` 0 sin trigger, verde. UI: no probado.

### CP-08 — Parcial
Suite: `FAILED` → SMS `PLATFORM`, cupo intacto, verde. Lab: no hubo rechazo de Meta; cero `SmsQueue` `PLATFORM`. Motivo: forzar un rechazo exige una plantilla inválida en Meta.

### CP-09 — No probado
Motivo: requiere un segundo clic en la UI. Indicio: cero duplicados de `(tenantId, kind, expiresOn)` en lab.

### CP-10 — Cumple
Obtenido: las filas encoladas desde el Preview quedaron `SENT`; Cloud Run leyó la base de lab.

### CP-11 — Parcial
Obtenido (últimos 3 días, origen `TENANT`): `recordatorio_cupon_vencer` 23 `SENT`, `invitacion_evento_exclusivo` 1 `SENT` (20:19Z). Cero `FAILED`.
No probado: `cumpleanos_regalo_tenant`, `promocion_relampago`. Sus parámetros están cubiertos por los tests del worker («plantillas actuales sin cambios»), pero no hubo envío real.

### CP-12 — Parcial
Suite del worker: rechazos 401 verdes. Motivo del no probado: el 403 de Cloud Run sin token de identidad no se llamó en vivo.

### CP-13 — No probado
Motivo: requiere Render y Cloud Run sobre la misma base a la vez; hoy Render atiende producción.

### CP-14 — Cumple
Suite: reclaim y `/health` verdes. Lab: ninguna fila `PROCESSING` ni `PENDING` de más de 15 minutos.

### CP-15, CP-16, CP-17, CP-18 — No probados
Motivo: requieren sesión en el navegador (super admin y un usuario sin ese rol) y, para la IA, verificar `GOOGLE_CLOUD_LOCATION=global` en el Preview. `vertex-ai.test.ts` y `sms-prompts.test.ts` están verdes.

### NR-01 — Cumple
rulett-app: 193 archivos, 2194 tests verdes; `tsc --noEmit` sin errores. Worker: `typecheck` limpio, 59 tests verdes.

### NR-02 — Cumple
Lab: cero `QUEUED_WHATSAPP`, cero duplicados de la clave única, cero `FAILED` en 3 días, nada atascado.
Nota: hay dos WhatsApp `PLATFORM` al mismo contacto el mismo día. Son los dos avisos distintos (`SEVEN_DAYS` 7 días y `DUE_DAY` 1 día, con `expiresOn` distintos), no el mismo aviso enviado dos veces. Es el comportamiento esperado cuando el vencimiento del comercio de prueba se movió entre las dos corridas.

### NR-03 — No probado
Render despliega `main` automáticamente y c80fb34 (worker sin sondeo, sin `EDGE_SHARED_SECRET`, trigger que espera el lote) ya está en `main`. Producción probablemente corre ya el código nuevo. No se verificó porque no se toca producción. Lo verifica el analista en el panel de Render: commit desplegado y logs sin errores de arranque.
Consecuencia si ya está: los mensajes de producción solo salen cuando el cron o una campaña disparan el worker (ya no hay sondeo de 60 s), y el `rulett-app` de producción actual, sin T-07, espera la respuesta sin timeout propio.

### NR-04 — Observación (vacío del SDD)
`vercel.json` en `release` (commit fdbf7f4) cambia dos crons de producción:
- `/api/cron/send-whatsapp`: de cada 15 minutos (`*/15 13-23,0-1`) a cada hora (`0 13-23,0-1`).
- `/api/cron/subscription-reminders`: de 08:00 (`0 13`) a 09:00 y 18:00 Bogotá (`0 14,23`).
El SDD v8 no lo menciona y en varios lugares (R-07, R-09, tabla de errores, D-06) asume el pase de 15 minutos. Efectos: el cierre de `SENT_SMS`/`NOT_DELIVERED` y de filas `QUEUED_WHATSAPP` tarda hasta una hora; R-16 ya no es «08:00» sino el primer disparo de la mañana. Las campañas no se afectan porque disparan el worker al encolar. La clave única impide que el pase de las 18:00 duplique el de las 09:00. No es defecto de lab; hay que confirmar si fue intencional y actualizar el SDD.

### NR-05 — No probado
Consulta T-03 en producción: la corre el analista antes del deploy.

## Defectos encontrados
Ninguno de implementación. Un vacío del SDD (NR-04), pendiente de aprobación antes de registrarlo en ClickUp.

## No probado y por qué
- UI del botón, toast, segundo clic, solo super admin, fuera de alcance (CP-05, CP-07 UI, CP-09, CP-17, CP-18): falta sesión del analista en el navegador.
- IA en lab y comparación (CP-15, CP-16): falta sesión y el set de R-05.
- `cumpleanos_regalo_tenant` y `promocion_relampago` (CP-11): no se enviaron.
- 403 de Cloud Run en vivo (CP-12) y convivencia (CP-13).
- Render en producción (NR-03) y T-03 (NR-05): son de producción; los hace el analista.
