SDD: 17tnjra7awa · v4 · 2026-10-10

# Specs (delta) — 056 Envíos automáticos de WhatsApp/SMS sin acosar al cliente
estado: aprobado [humano, 2026-10-10]
Specs canónicas afectadas al cierre: `domain_model.md`, `integrations.md`, `operations.md`, `contracts.md`, `boundaries.md`, `security.md`, `testing.md` (inventario), `regression.md` (app) y `integrations.md` y `domain_model.md` (worker).

## Requisitos

### Envío diario
- **R-01.** Un cron diario (`/api/cron/auto-messages`, `30 13,20 * * *` UTC = 08:30 y 15:30 Bogotá) ejecuta `runAutoMessagesPass` cuando `AUTO_MESSAGES_ENABLED==='true'`. La segunda pasada es idempotente y retoma lo que quedó.
- **R-02.** Solo participan tenants con `isActive`, suscripción operable (legacy sin fila: sí; fila con `expiresAt > now`, incluida la prueba gratis: sí; vencida: no) y algún cupo > 0.
- **R-03.** Cada tenant usa su configuración efectiva. Si no tiene fila, usa los valores por defecto: recordatorio encendido con 7 días, cumpleaños encendido con 3 días, sin regalos, textos SMS por defecto y landing principal = la única landing activa si hay exactamente una.
- **R-04.** Orden de proceso: primero los cumpleaños de todos los tenants, después los recordatorios.

### Recordatorio de cupones
- **R-05.** Elegibilidad del `UserCoupon`:
  - Del tenant, sin redimir, de un cupón activo.
  - `expiresAt > now` y días calendario Bogotá hasta el vencimiento ≤ N.
  - Con redenciones disponibles.
  - Usuario activo con teléfono.
  - Sin `CouponExpiryNotice`.
- **R-06.** Por teléfono y tenant sale un solo mensaje con la cantidad de cupones elegibles y el que vence primero, con su fecha `dd/mm/aaaa` en `America/Bogota`.
- **R-07.** Al encolar se registra un aviso por cada cupón incluido. Un cupón con aviso no se vuelve a incluir.
- **R-08.** Un recordatorio desplazado (por topes o sin cupo) no registra avisos. Se reintenta en cada pasada mientras el cupón siga elegible.
- **R-09.** Si el contacto termina `NOT_DELIVERED`, se borran sus avisos y el cupón vuelve a ser elegible.

### Cumpleaños
- **R-10.** Destinatarios: usuarios activos con fecha de nacimiento, teléfono y al menos un cupón ganado en el tenant, cuyo cumpleaños (calendario Bogotá; 29-feb → 28-feb en año no bisiesto) esté a entre 0 y N días.
- **R-11.** Un saludo por (tenant, teléfono, año del cumpleaños), mediante `dedupeKey`.
- **R-12.** Un teléfono recibe como máximo 3 saludos activos por año de cumpleaños, sumando todos los tenants.
- **R-13.** El saludo de un canal requiere el regalo de ese canal. Sin regalo WhatsApp ni SMS, no se planea y el dashboard marca "falta regalo".
- **R-14.** Nunca se envía después del día del cumpleaños.

### Canal
- **R-15.** El planificador elige WhatsApp si hay cupo y, en cumpleaños, regalo WhatsApp. Si no, SMS si hay cupo, regalo SMS (en cumpleaños) y render válido. Si no, se omite por `NO_QUOTA`, `MISSING_SMS_GIFT` o `INVALID_TEXT`.
- **R-16.** El cupo restante descuenta lo enviado en el periodo y lo pendiente del tenant, y se decrementa durante la pasada.
- **R-17.** Un WhatsApp automático que queda `FAILED` genera como máximo un SMS de respaldo, con el mismo `contactId` y `reason`, si el SMS es posible. Si no, el contacto queda `NOT_DELIVERED`.
- **R-18.** El SMS de respaldo creado fuera de la ventana horaria queda `PENDING` y sale al abrir la ventana (comportamiento existente del procesador).
- **R-19.** Un contacto nunca tiene más de una fila por canal. El cliente no recibe el mismo motivo por los dos canales: el SMS solo se crea si el WhatsApp falló.
- **R-20.** Los envíos manuales no pasan a SMS.

### Texto SMS
- **R-21.** Comodines válidos: `nombre_usuario`, `nombre_comercio`, `cupon`, `fecha_vencimiento`, `cantidad_cupones`, `regalo`, `fecha_cumpleanos`. Al guardar se rechazan los comodines desconocidos, los caracteres fuera de `SMS_ALLOWED_CHARS` y un literal de más de 160 caracteres, con un mensaje que dice qué corregir.
- **R-22.** Al enviar, los valores se sanean (sin tildes ni caracteres fuera de GSM). Si el texto pasa de 160, se recorta `cupon` y luego `nombre_comercio` (mínimo 3 caracteres cada uno). Si aun así no cabe, se omite con `INVALID_TEXT`.

### Topes y baja
- **R-23.** Por tenant y teléfono: máximo 1 contacto activo por día Bogotá y 3 en los últimos 7 días (hoy y los 6 anteriores).
- **R-24.** Global por teléfono: máximo 2 por día y 5 en 7 días.
- **R-25.** Cuentan los contactos `QUEUED_*` y `SENT_*`. No cuentan `NOT_DELIVERED`, `CANCELLED` ni las filas PLATFORM.
- **R-26.** Todo envío a un cliente (automático o manual) pasa por `reserveContact` con lock por teléfono.
- **R-27.** Un envío manual omite a los destinatarios bloqueados por topes o baja, encola al resto y devuelve los conteos por motivo. La regla de cupo de todo o nada se evalúa sobre los encolables. Un manual omitido no se reintenta.
- **R-28.** La baja es por (tenant, msisdn). Bloquea WhatsApp y SMS, automáticos y manuales. Al activarla se cancelan las filas `PENDING` de ese tenant hacia ese teléfono en ambas colas.
- **R-29.** Solo el propio cliente, autenticado, puede darse de baja o reactivar, y solo frente a comercios donde tiene o tuvo cupones. El administrador no tiene acción sobre la baja.
- **R-30.** La billetera tiene un menú de cuenta (Tema, Mensajes de comercios, Cerrar sesión) que conserva las pestañas "Mis Cupones" y "Descubre". `/billetera/mensajes` lista los comercios con un interruptor por cada uno. Si la cuenta no tiene teléfono, indica que no recibe mensajes y deshabilita los interruptores.

### Omitidos, colas y dashboard
- **R-31.** Cada omisión incrementa `MessageSkipDaily(tenant, día, trigger, reason, skipReason)`.
- **R-32.** Las colas de WhatsApp y SMS muestran Origen (Automático/Manual) y Motivo, y la pastilla "Cancelado".
- **R-33.** El dashboard muestra, del mes calendario:
  - Enviados por canal × origen.
  - Enviados por motivo.
  - Omisiones por motivo (tope = CAP_TENANT + CAP_GLOBAL + BIRTHDAY_GLOBAL_LIMIT; baja; sin cupo; texto inválido; falta regalo SMS).
  - Pasaron a SMS.
  - Consumo del cupo (periodo de facturación).
  - Dados de baja vigentes.
  - Estado de los automáticos.
  - Acceso a "Mensajes automáticos".

### Configuración
- **R-34.** `/admin/mensajes-automaticos` (TENANT_ADMIN) permite editar:
  - Encendido de cada mensaje.
  - Días 1–30 de cada uno.
  - Regalo WhatsApp y regalo SMS (1–60 caracteres; el SMS valida el charset).
  - Los dos textos SMS.
  - Landing principal (activa y del tenant, o ninguna).

  Es accesible desde el menú (sección Difusión), el dashboard y las pantallas de WhatsApp y SMS.
- **R-35.** Apagar un mensaje lo excluye desde la siguiente pasada.

### Plantillas y botón
- **R-36.** Si la v2 de una plantilla está en `WHATSAPP_V2_TEMPLATES_APPROVED` y el tenant tiene landing principal efectiva, se encola la v2 con `boton_comercio = tenantId`. Si no, se encola la v1 (en el recordatorio, con el primer cupón y sin cantidad). Aplica a automáticos y manuales.
- **R-37.** `/c/{tenantId}` redirige (302) a la URL pública de la landing principal efectiva si es accesible; si no, a `/billetera`.
- **R-38.** El worker envía el componente `button` URL con `boton_comercio` solo para plantillas v2.

### Recorrido
- **R-39.** Versión del recorrido `2026-11`: paso nuevo de mensajes automáticos y textos de WhatsApp y SMS actualizados, todos con `since 2026-11`. Quien terminó una versión anterior ve solo esos pasos, una vez.

## Errores y bordes
- **Dos crons solapados:** la unique de `smsQueueId` y `dedupeKey`, el CAS de estados y el advisory lock evitan duplicados.
- **Manual concurrente con el cron:** el lock por teléfono serializa. El que llega segundo ve el tope.
- **Tenant con un solo cupo en 0:** usa el otro canal. Con ambos en 0, queda fuera de la pasada (R-02) y no registra omisiones. Si el cupo llega a 0 durante la pasada, se registran `NO_QUOTA` (CA-16).
- **Fila de WhatsApp borrada** (cascade por campaña): se trata como FAILED.
- **Usuario con el mismo teléfono en varias cuentas:** un solo contacto por teléfono (agrupación por msisdn). La baja aplica a todas las cuentas.
- **Landing principal configurada que luego se desactiva:** la efectiva pasa a null y se usa la v1; el dashboard marca "falta landing principal".
- **Cupón que vence hoy, más tarde que ahora:** elegible (días = 0).
- **`AUTO_MESSAGES_NOW` en producción:** se ignora y se registra un warning.
- **Pasada cortada por tiempo:** lo no procesado queda para la siguiente, sin efectos parciales por destinatario (una transacción por destinatario).

## Matriz de trazabilidad

| CA | Criterio de la historia | Requisito | Task | Prueba |
|---|---|---|---|---|
| CA-01 | Cupón en la ventana recibe aviso | R-05, R-06 | T-10, T-12 | unit coupon-expiry-selection; lab |
| CA-02 | Varios cupones → un resumen | R-06, R-07, R-36 | T-10, T-14 | unit selección y template-resolver; lab |
| CA-03 | Cupón avisado no se repite | R-07 | T-10 | unit; lab |
| CA-04 | Poca vigencia → siguiente envío | R-05 | T-10 | unit; lab con NOW |
| CA-05 | Redimido o desactivado no se avisa | R-05 | T-10 | unit |
| CA-06 | Cambio de días de antelación | R-03, R-05, R-34 | T-08, T-10 | unit; lab |
| CA-07 | Saludo con regalo WhatsApp | R-10, R-13, R-15 | T-11, T-12 | unit; lab |
| CA-08 | Sin regalo no hay saludo + dashboard | R-13, R-33 | T-11, T-16 | unit; lab |
| CA-09 | Un saludo por comercio y año | R-11 | T-03, T-11 | unit contact-gate |
| CA-10 | Máximo 3 felicitaciones | R-12 | T-03 | unit contact-gate |
| CA-11 | Desplazado no llega después del cumpleaños | R-14, R-08 | T-11, T-12 | unit run con NOW |
| CA-12 | Sale por WhatsApp, sin SMS | R-15, R-19 | T-12, T-06 | unit planner y reconcile |
| CA-13 | Cupo WhatsApp agotado → SMS | R-15, R-16, R-22 | T-12, T-08 | unit planner; lab |
| CA-14 | Rechazo de Meta → SMS inmediato, 1 contacto | R-17, R-25 | T-06 | unit reconcile; lab (número inválido) |
| CA-15 | Rechazo fuera de horario espera la ventana | R-18 | T-06 | unit reconcile + sms-processor existente; lab |
| CA-16 | Sin cupo en ningún canal | R-15, R-31, R-33 | T-12, T-16 | unit; lab |
| CA-17 | Suscripción vencida no envía | R-02 | T-12 | unit run |
| CA-18 | Comodines y sin tildes | R-22 | T-08 | unit sms-auto-render |
| CA-19 | Recorte para caber | R-22 | T-08 | unit |
| CA-20 | No cabe → omitido por texto inválido | R-22, R-31 | T-08, T-12 | unit |
| CA-21 | No guarda texto inválido | R-21 | T-08, T-09 | unit validate; lab UI |
| CA-22 | 1 al día por comercio | R-23 | T-03 | unit |
| CA-23 | 3 a la semana por comercio | R-23 | T-03 | unit |
| CA-24 | Outline del tope global (1/3, 2/3, 0/5) | R-24 | T-03 | unit parametrizado |
| CA-25 | Cumpleaños prioritario; cupón al día siguiente | R-04, R-08 | T-12 | unit run |
| CA-26 | Manual respeta topes e informa (88/12) | R-27, R-31 | T-05 | unit gate; lab |
| CA-27 | Baja de A, sigue B | R-28, R-29 | T-04, T-07 | unit opt-out; lab |
| CA-28 | Dado de baja fuera de manuales; admin no reactiva | R-27, R-28, R-29 | T-05, T-04 | unit; lab |
| CA-29 | Reactivación | R-28 | T-04, T-07 | unit; lab |
| CA-30 | La billetera conserva lo existente | R-30 | T-07 | lab (regresión visual) |
| CA-31 | Comercio nuevo con automáticos encendidos | R-03 | T-08, T-09 | unit config; lab |
| CA-32 | Pausar un mensaje | R-35 | T-09, T-12 | unit run; lab |
| CA-33 | Dashboard de envíos y estado | R-33 | T-16 | unit dashboard-metrics; lab |
| CA-34 | Recorrido solo con lo nuevo | R-39 | T-17 | unit onboarding-tour; lab |
| CA-35 | WhatsApp con botón a la landing | R-36, R-37, R-38 | T-14, W-02 | unit resolver + worker test; lab tras aprobación Meta |
| CA-36 | Sin landing → plantilla sin botón | R-36 | T-14 | unit resolver |
