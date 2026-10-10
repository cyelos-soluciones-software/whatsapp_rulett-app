# Plan de pruebas — 17tnjrabmxn · Gemini 3.1, aviso de suscripción forzado y worker en Cloud Run
SDD: 17tnjrabmxn · v8 · Generado: 2026-10-09
Ambiente: laboratorio — `https://lab.rulett.app` (Preview de Vercel), Neon `ep-patient-hat-aq4hmsfw` (base de lab), Cloud Run `whatsapp-rulett-app` (us-central1) apuntando temporalmente a la base de lab. Confirmado por el analista el 2026-10-09. Producción (`www.rulett.app`, Neon `ep-green-grass-aqr97nzy`, Render) queda fuera: ningún caso se ejecuta allí.

## Prerequisitos de ambiente
- [x] Cloud Run con `DATABASE_URL` de lab.
- [x] Preview con T-07: `WHATSAPP_WORKER_TRIGGER_URL` (`run.app`) y `WHATSAPP_WORKER_INVOKER_*`.
- [x] Un comercio activo que vence mañana y otro que vence en 7 días (Bogotá).
- [x] Usuario de prueba con teléfono colombiano propio del analista (no se copia a la evidencia).
- [ ] Sesión de super admin del analista en `lab.rulett.app` abierta para los casos de navegador.
- [ ] Sesión de un usuario sin rol super admin para CP-18.
- [ ] Preview con `GOOGLE_CLOUD_LOCATION=global` y los modelos `AI_COUPON_MODEL` / `AI_SMS_MODEL` en 3.1.
- [ ] Set de R-05: 5 comercios y 5 intenciones de SMS.
- [ ] Acceso del analista al panel de Render (solo lectura) para NR-04.

## Casos

### CP-01 · Aviso de 1 día sale por WhatsApp
Criterio: R-20 · Tipo: positivo · Canal: bd · Ejecuta: Claude (solo lectura)
Datos: comercio de prueba que vence mañana.
Pasos: 1. El analista corre el pase (botón). 2. Consultar `SubscriptionReminder` y `WhatsappQueue`.
Resultado esperado: una fila `DUE_DAY`, `expiresOn` = mañana, `SENT_WHATSAPP`; WhatsApp `recordatorio_suscripcion_7d`, `dias` = `"1"`, origen `PLATFORM`, `SENT`, sin SMS.

### CP-02 · Aviso de 7 días
Criterio: R-20 · Tipo: positivo · Canal: bd · Ejecuta: Claude
Resultado esperado: fila `SEVEN_DAYS`, `expiresOn` = hoy + 7, `dias` = `"7"`, `SENT`.

### CP-03 · No se encola la plantilla de hoy
Criterio: R-20 · Tipo: negativo · Canal: bd · Ejecuta: Claude
Resultado esperado: cero filas nuevas con `recordatorio_suscripcion_hoy`; ningún `dias` distinto de `"1"` y `"7"`.

### CP-04 · Reglas de fecha y SMS de 1 día
Criterio: R-20 · Tipo: borde · Canal: suite · Ejecuta: Claude
Pasos: `npx vitest run` en rulett-app.
Resultado esperado: verdes los tests de medianoche Bogotá → `DUE_DAY`, mismo instante al día siguiente → vencido, SMS «manana» ≤ 160.

### CP-05 · Botón en el listado
Criterio: R-06, R-11 · Tipo: positivo · Canal: backoffice · Ejecuta: navegador asistido
Datos: sesión super admin.
Pasos: 1. Abrir `/super-admin/tenants`. 2. Ver «Forzar avisos de suscripción» junto a «Forzar reinicio de límites». 3. Clic, confirmar. 4. Ver «Enviando…» y luego el toast.
Resultado esperado: confirmación previa; toast con encolados, omitidos, duplicados y disparo; sin teléfonos ni `errorLog`.

### CP-06 · Interruptor
Criterio: R-07 · Tipo: negativo · Canal: suite · Ejecuta: Claude
Resultado esperado: verdes los tests «interruptor apagado igual encola desde el botón», «cron de la mañana apagado no encola», «reconciliación apagada igual consulta la cola».

### CP-07 · Nadie en la ventana
Criterio: R-08 · Tipo: borde · Canal: suite + backoffice
Resultado esperado: test `queued` 0 sin llamar al trigger; en UI, toast «no encoló avisos» sin error.

### CP-08 · Respaldo SMS si Meta rechaza
Criterio: R-09 · Tipo: negativo · Canal: suite (lab no reproducible sin forzar un rechazo de Meta)
Resultado esperado: WhatsApp `FAILED` → `SmsQueue` `PLATFORM`; cupo del comercio intacto.

### CP-09 · Segundo clic
Criterio: R-10 · Tipo: borde · Canal: backoffice + bd
Pasos: repetir CP-05 el mismo día.
Resultado esperado: duplicados > 0, encolados 0, sin fila nueva en `SubscriptionReminder` ni WhatsApp nuevo.

### CP-10 · Misma base
Criterio: R-12 · Tipo: positivo · Canal: bd
Resultado esperado: las filas encoladas desde lab quedan `SENT` (las tomó Cloud Run en la base de lab).

### CP-11 · Campañas del comercio por Cloud Run
Criterio: R-14, R-16 · Tipo: no-regresión · Canal: backoffice + bd
Datos: las cuatro plantillas de campaña: `recordatorio_cupon_vencer`, `invitacion_evento_exclusivo`, `cumpleanos_regalo_tenant`, `promocion_relampago`.
Resultado esperado: cada una llega al teléfono de prueba y queda `SENT`, origen `TENANT`.

### CP-12 · Rechazo sin credenciales
Criterio: R-15 · Tipo: seguridad · Canal: suite + API
Resultado esperado: tests 401 del worker verdes; `curl` sin token de identidad al `run.app` → 403.

### CP-13 · Convivencia Render y Cloud Run
Criterio: R-17 · Tipo: borde · Canal: bd · Ejecuta: analista
Resultado esperado: N pendientes, cada destinatario recibe una vez, cero pendientes al final.

### CP-14 · Reclaim y health
Criterio: R-18, R-19 · Tipo: borde · Canal: suite + bd
Resultado esperado: tests verdes; ninguna fila `PROCESSING` de más de 15 minutos en lab.

### CP-15 · IA: cupones, SMS, alta y error visible
Criterio: R-01 a R-04 · Tipo: positivo / negativo · Canal: backoffice · Ejecuta: navegador asistido
Resultado esperado: cupones con vigencia válida, SMS GSM ≤ 160, alta con 3 cupones inactivos, error visible si Vertex falla.

### CP-16 · Comparación 2.5 vs 3.1
Criterio: R-05 · Tipo: positivo · Ejecuta: analista
Resultado esperado: 100 % JSON válido y nota de calidad en `decisions.md`.

### CP-17 · Fuera de alcance
Criterio: R-13 · Tipo: negativo · Canal: backoffice
Resultado esperado: sin botón por fila ni selector de plantilla; un comercio que vence hoy no recibe aviso.

### CP-18 · Solo super admin
Criterio: OWASP A01 / API5 · Tipo: seguridad · Canal: backoffice
Datos: usuario sin rol super admin.
Resultado esperado: no ve `/super-admin/tenants` ni puede invocar la acción.

### NR-01 · Suites completas
Tipo: no-regresión · Canal: suite
Resultado esperado: rulett-app `vitest` y `tsc --noEmit` verdes; worker `typecheck` y `npm test` verdes.

### NR-02 · Salud de colas en lab
Tipo: no-regresión · Canal: bd
Resultado esperado: sin `QUEUED_WHATSAPP` colgados, sin `FAILED` recientes, sin `PROCESSING`/`PENDING` viejos, sin duplicados de la clave única.

### NR-03 · Render en producción tras el merge del worker a `main`
Tipo: no-regresión · Canal: panel de Render · Ejecuta: analista (solo lectura)
Resultado esperado: el analista confirma qué commit corre Render y que sus logs no muestran errores de arranque ni de configuración.

### NR-04 · Frecuencia de crons de producción
Tipo: no-regresión · Canal: revisión de `vercel.json`
Resultado esperado: los crons de producción quedan como define el SDD (el pase de WhatsApp cada 15 minutos).

### NR-05 · Diagnóstico T-03 en producción
Tipo: prerequisito de deploy · Ejecuta: analista
Resultado esperado: `count(*)` de `QUEUED_WHATSAPP` = 0, o decisión anotada en `decisions.md`.

## Matriz de cobertura
| Criterio de aceptación | Casos |
|---|---|
| R-01 a R-04 IA | CP-15 |
| R-05 comparación | CP-16 |
| R-06 botón y pase | CP-05, CP-01, CP-02 |
| R-07 interruptor | CP-06 |
| R-08 nadie en ventana | CP-07 |
| R-09 respaldo SMS | CP-08 |
| R-10 segundo clic | CP-09, NR-02 |
| R-11 toast | CP-05, CP-04 |
| R-12 misma base | CP-10 |
| R-13 fuera de alcance | CP-17 |
| R-14, R-16 disparo y mañana siguiente | CP-11 |
| R-15 rechazos | CP-12 |
| R-17 convivencia | CP-13 |
| R-18, R-19 reclaim y health | CP-14 |
| R-20 mañana y 7 días | CP-01, CP-02, CP-03, CP-04 |
| Retrocompatibilidad | NR-01 a NR-05, CP-11 |
| OWASP A01 | CP-18 |
