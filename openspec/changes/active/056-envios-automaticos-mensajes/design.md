SDD: 17tnjra7awa · v4 · 2026-10-10

# Design — 056 Envíos automáticos de WhatsApp/SMS sin acosar al cliente
estado: aprobado [humano, 2026-10-10]

Documentos consultados: la historia y el intake locales; `rulett/00-INDICE-RULETT.md` del proyecto (desactualizado: dice que el próximo número es 050); `openspec/specs/{domain_model,integrations,operations,contracts,boundaries,regression,testing}.md`; los changes 051, 053, 054 y 055; AGENTS.md de ambos repos; y el código citado abajo.

---

## 1. Decisión de diseño

**Un punto único de contacto.** Todo mensaje a un cliente (automático o manual, WhatsApp o SMS) pasa por `reserveContact()`. Esta función:

1. Bloquea el teléfono dentro de la transacción (`pg_advisory_xact_lock`).
2. Verifica la baja del cliente con ese comercio.
3. Verifica los topes.
4. Registra un **contacto** (`MessageContact`) antes de crear la fila de cola.

Los topes se cuentan sobre contactos, no sobre filas de cola. Así:

- El SMS de respaldo es el mismo contacto que el WhatsApp que falló.
- Un contacto `NOT_DELIVERED` o `CANCELLED` deja de contar [humano, 2026-10-10].

**Envío diario.** Lo encola un cron (`/api/cron/auto-messages`) que copia el patrón del 051 [repo: src/lib/billing/subscription-reminder-queue.ts]:

1. Encola.
2. Dispara el worker.
3. Reconcilia.

El orden de proceso es primero todos los cumpleaños y luego todos los recordatorios. Así se cumple la prioridad cumpleaños > cupón > manual: el cron corre a las 08:30 Bogotá, antes de casi cualquier envío manual.

**El respaldo WhatsApp→SMS lo hace la app, no el worker.** La reconciliación lee `WhatsappQueue.status`. Si encuentra `FAILED` en un automático, encola el SMS en la misma transacción que actualiza el contacto. El worker sigue sin tocar `SmsQueue` [repo: whatsapp_rulett-app/openspec/specs/domain_model.md]. La reconciliación corre:

- Al final del cron diario, después del disparo síncrono del worker, que responde cuando termina el lote [repo: whatsapp_rulett-app/src/server.ts].
- Al final de los crons `send-whatsapp` y `send-sms`.

"De inmediato" significa entonces "en la misma pasada o en la siguiente". Si la ventana de SMS está cerrada, el SMS queda `PENDING` y `processPendingSmsBatch` lo omite hasta las 08:00 [repo: src/lib/sms-processor.ts], que es justo la regla de la historia.

**Configuración sin backfill.** `TenantAutoMessageConfig` es opcional por comercio. El resolver `getEffectiveAutoMessageConfig()` devuelve los valores por defecto si no hay fila (encendidos, 7 y 3 días, textos por defecto). La landing principal efectiva es la configurada o, si no hay ninguna, la única landing activa del comercio cuando tiene exactamente una. Esto cubre comercios existentes, nuevos y futuros sin migración de datos ni cambios en `tenant-bootstrap`.

**Botón "Información del comercio".** Es un botón URL dinámico que apunta a `https://rulett.app/c/{tenantId}`. Esa ruta redirige a la landing principal efectiva *en el momento del clic*.

**Plantillas v2 por variable de entorno.** Se activan con `WHATSAPP_V2_TEMPLATES_APPROVED` (lista separada por comas). Mientras una v2 no esté en la lista, se usa su v1.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Contar los topes sobre `WhatsappQueue`/`SmsQueue` por `userPhone` | Un WhatsApp fallido y su SMS de respaldo contarían doble. No hay forma de excluir lo no entregado sin unir dos tablas. Además no existe un índice por teléfono [repo: prisma/schema.prisma:738-783]. |
| Que el worker encole el SMS al recibir el rechazo de Meta | El worker no conoce `SmsQueue` ni los cupos. El 051 ya descartó esto y estableció la reconciliación en la app [repo: openspec/changes/completed/051-recordatorio-juego-descubre/design.md]. |
| Reutilizar `origin` para marcar automático/manual | `origin` significa quién envía: TENANT consume el cupo del comercio, PLATFORM no [repo: src/lib/whatsapp-limit.ts]. Un automático del comercio es TENANT. Se agrega `trigger` aparte. |
| Columnas de configuración en `Tenant` + backfill | Agranda `Tenant` y exige tocar los dos caminos de alta [repo: src/lib/tenant-bootstrap.ts, self-signup-bootstrap.ts]. El resolver con valores por defecto logra lo mismo sin migrar datos. |
| Botón con `/l/{tenant}/{sede}` en el parámetro | Si el comercio cambia su landing principal, los mensajes ya enviados quedan apuntando a la anterior. Con `/c/{tenantId}`, el contrato con Meta es estable. |
| Un cron que encola manuales y automáticos en una "cola previa" | Rehace el flujo manual. El punto único de contacto basta y no cambia el contrato con el worker. |
| Reservar cupo de contacto para manuales | Fuera de alcance por decisión del analista. |
| Partir el SDD en 3 changes | El analista lo descartó para la historia. Se planea un change con fases desplegables por separado. |

---

## 2. Componentes

| Pieza | Repo | Cambio |
|---|---|---|
| `prisma/schema.prisma` + migración | app | Enums `MessageTrigger`, `MessageReason`, `MessageContactStatus`, `MessageSkipReason`. Modelos `MessageContact`, `CouponExpiryNotice`, `MessageOptOut`, `TenantAutoMessageConfig`, `MessageSkipDaily`. Columnas `trigger`, `reason` y `contactId` en ambas colas. |
| `src/lib/auto-messages/bogota-date.ts` | app | Fecha local de Bogotá, días calendario hasta el vencimiento, próximo cumpleaños (29-feb → 28-feb en años no bisiestos). |
| `src/lib/auto-messages/contact-caps.ts` | app | Constantes de topes y evaluación pura. |
| `src/lib/auto-messages/contact-gate.ts` | app | `reserveContact()`: lock, baja, topes, creación de `MessageContact`. `recordSkip()` sobre `MessageSkipDaily`. |
| `src/lib/auto-messages/opt-out.ts` | app | Baja y reactivación por (tenant, msisdn). Cancela los pendientes. |
| `src/lib/auto-messages/config.ts` | app | Resolver de configuración efectiva, schema Zod, valores por defecto, landing principal efectiva. |
| `src/lib/auto-messages/sms-auto-render.ts` | app | Comodines, validación al guardar, render sin tildes y recorte a 160 caracteres. |
| `src/lib/auto-messages/coupon-expiry-selection.ts` | app | Candidatos a recordatorio agrupados por teléfono. |
| `src/lib/auto-messages/birthday-selection.ts` | app | Candidatos a saludo de cumpleaños. |
| `src/lib/auto-messages/channel-planner.ts` | app | Decisión pura del canal y el contenido según cupos, regalo y plantillas aprobadas. |
| `src/lib/auto-messages/template-resolver.ts` | app | Elige la plantilla v1 o v2 y arma `templateParams`, incluido `boton_comercio`. |
| `src/lib/auto-messages/run.ts` | app | Orquestador `runAutoMessagesPass()` e interruptor. |
| `src/lib/auto-messages/reconcile.ts` | app | Sincroniza el estado de los contactos y hace el respaldo por SMS de los automáticos. |
| `src/lib/auto-messages/dashboard-metrics.ts` | app | Agregación pura de indicadores. |
| `src/app/api/cron/auto-messages/route.ts` + `vercel.json` | app | Cron diario. |
| `src/app/api/cron/send-whatsapp`, `send-sms` | app | Agregar `reconcileContactsSafely()` al final. |
| `src/actions/whatsapp.ts`, `sms.ts` | app | Integración del punto único de contacto en los envíos manuales y resultado con omitidos. En WhatsApp, también el resolver de plantilla v2. |
| `src/actions/auto-messages.ts` | app | Leer y guardar la configuración (TENANT_ADMIN). |
| `src/actions/auto-messages-dashboard.ts` | app | Indicadores. Archivo nuevo, no se toca `analytics.ts`. |
| `src/actions/merchant-messages.ts` | app | Baja y reactivación del cliente (USER). |
| `src/app/admin/mensajes-automaticos/page.tsx` + `components/admin/AutoMessagesConfigForm.tsx` | app | Pantalla de configuración según la maqueta. |
| `src/config/backoffice-nav.ts` + mapeo de iconos del nav | app | Ítem en la sección `difusion`. |
| `src/app/admin/{whatsapp,sms}/page.tsx` | app | Enlace a "Mensajes automáticos". |
| `components/admin/{Whatsapp,Sms}QueueTable.tsx`, `queue/QueueTableParts.tsx`, `types/*-queue.ts` | app | Columnas Origen y Motivo; estado `CANCELLED`. |
| `components/admin/AdminAnalyticsDashboard.tsx` o un panel hermano | app | Sección de mensajería automática. |
| `components/wallet/WalletShell.tsx`, `WalletAccountMenu.tsx` (nuevo), `app/billetera/mensajes/page.tsx` (nuevo) | app | Menú de cuenta y pantalla "Mensajes de comercios". |
| `src/lib/onboarding-tour-content.json`, `onboarding-tour.ts` | app | Paso nuevo; WhatsApp y SMS con `since` nuevo; versión `2026-11`. |
| `src/app/c/[tenantId]/route.ts` | app | Redirección a la landing principal efectiva. |
| `src/lib/whatsapp-templates.ts`, `whatsapp-template-params.ts` | app | Nombres v2, parámetro `cantidad_cupones`, `boton_comercio`. |
| `src/types.ts`, `src/db/queue.ts`, `src/services/whatsapp.ts` | worker | Plantillas v2, componente `button`, parseo de `boton_comercio` y `cantidad_cupones`. |

---

## 3. Contratos

### 3.1 Cola → worker (`WhatsappQueue.templateParams`). Expand, compatible hacia atrás.

| Plantilla (nombre Meta [SUPUESTO — confirmar en T-00]) | Header | Body | Botones |
|---|---|---|---|
| `recordatorio_cupones_vencer_v2` | `nombre_tenant` | `nombre_usuario`, `cantidad_cupones`, `cupon`, `fecha_vencimiento` | [0] URL fija "Mira tus cupones"; [1] URL dinámica "Información del comercio" `https://rulett.app/c/{{1}}` |
| `cumpleanos_regalo_tenant_v2` | `nombre_tenant` | `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` | igual |
| `invitacion_evento_exclusivo_v2` | `nombre_tenant` | `nombre_usuario`, `nombre_evento`, `fecha_evento` | igual |
| `promocion_relampago_v2` | `nombre_tenant` | `nombre_usuario`, `fecha_limite`, `descuento_promo`, `producto_servicio` | igual |

- El parámetro nuevo `boton_comercio` contiene el `tenantId` (UUID). El worker lo envía como `{type:"button", sub_type:"url", index:"<WHATSAPP_V2_BUTTON_INDEX>", parameters:[{type:"text", text:<tenantId>}]}`. Si Meta registra la variable de la URL como `{{1}}` (posicional), se envía sin `parameter_name`; si la registra con nombre, el nombre debe ser `boton_comercio` y se envía con `parameter_name:"boton_comercio"`. T-00 registra cuál quedó y W-02 lo sigue (la documentación de Meta muestra el ejemplo con `parameter_name` y exige percent-encoding; un UUID no lo necesita) [web: developers.facebook.com/documentation/business-messaging/whatsapp/templates/components]. El índice por defecto es `"1"` y debe coincidir con el orden de botones aprobado en Meta.
- Las v1 no cambian: header + body, sin botón [repo: whatsapp_rulett-app/src/services/whatsapp.ts].
- Validación por plantilla en ambos lados: `isWhatsappTemplateParams` [repo: src/lib/whatsapp-template-params.ts] y `parseTemplateParams` [repo: whatsapp_rulett-app/src/db/queue.ts]. Las claves desconocidas se descartan, así que el worker debe desplegarse antes de que la app encole v2 [repo: openspec/specs/boundaries.md].

### 3.2 Columnas nuevas en las colas

- `trigger`, `reason` y `contactId` en `WhatsappQueue` y `SmsQueue`.
- `status` acepta además `'CANCELLED'`.
- El worker no lee las columnas nuevas: `RETURNING_COLUMNS` es una lista explícita [repo: whatsapp_rulett-app/src/db/queue.ts]. El worker solo reclama `PENDING` y solo recupera `PROCESSING`, así que `CANCELLED` nunca se procesa.

### 3.3 Server actions (todas devuelven `ActionResult`)

- `queueWhatsappMessages(formData)` y `queueSmsMessages(...)`. El éxito cambia de `{ success, queuedCount }` a `{ success, queuedCount, skipped: { capTenant, capGlobal, optOut } }`. Es compatible: un campo nuevo.
- `getAutoMessageSettings()` devuelve `{ config, landings: {id, label}[], status: { couponReminder, birthdayWhatsapp, birthdaySms, primaryLanding } }`.
- `saveAutoMessageSettings(input)`:
  - `requireTenantAdminMutation` (CSRF + rol) y `tenantId` de sesión.
  - Zod.
  - Valida que `primaryBranchLandingId` pertenezca al tenant y esté activa.
- `getAutoMessagingDashboard()`: TENANT_ADMIN, `tenantId` de sesión.
- `listMerchantMessagePreferences()`: USER autenticado. Devuelve `{ hasPhone, merchants: { tenantId, name, logoUrl, enabled }[] }`.
- `setMerchantMessagesEnabled({ tenantId, enabled })`:
  - USER autenticado, `assertSameOriginRequest()` y Zod (uuid, boolean).
  - Exige que el usuario tenga al menos un `UserCoupon` cuyo `coupon.tenantId` sea el comercio, y que tenga teléfono.

### 3.4 HTTP

- `GET /api/cron/auto-messages`:
  - Requiere `Bearer CRON_SECRET` (mismo `authorizeCron` que los demás crons).
  - Responde `{ ok, skipped?: 'disabled', birthdays: {queued, skipped}, coupons: {queued, skipped}, reconciled }`.
  - `maxDuration = 300` [SUPUESTO — plan de Vercel lo permite; hoy los crons usan 120 [repo: src/app/api/cron/send-whatsapp/route.ts]].
- `GET /c/{tenantId}`:
  - Público. Valida el uuid.
  - Si hay landing principal efectiva y la landing pública es accesible (comercio activo y guardián de suscripción [repo: src/lib/public-landing-access.ts]), responde 302 a su URL pública. La URL se construye con el helper existente [repo: src/lib/branch-landing-url.ts — no leído, verificar firma].
  - Si no, responde 302 a `/billetera`. No revela si el comercio existe.

### 3.5 Variables de entorno nuevas (app)

| Variable | Default | Uso |
|---|---|---|
| `AUTO_MESSAGES_ENABLED` | ausente = apagado | Interruptor del cron diario. La reconciliación corre siempre. |
| `AUTO_MESSAGES_NOW` | — | ISO datetime para simular "hoy" en lab. **Se ignora si `VERCEL_ENV==='production'`**. |
| `AUTO_MESSAGES_MAX_PER_RUN` | 2000 | Tope de contactos por pasada (protección de tiempo). |
| `WHATSAPP_V2_TEMPLATES_APPROVED` | vacío | Nombres v1 cuya v2 ya está aprobada. |

Worker: `WHATSAPP_V2_BUTTON_INDEX` (default `"1"`; un valor que no sea entero ≥ 0 hace fallar el arranque) y `WHATSAPP_V2_BUTTON_PARAM_NAME` (opcional; sin definir, el parámetro del botón va posicional; definida, p. ej. `boton_comercio`, se envía como `parameter_name`). Cambiarla en Cloud Run crea una revisión nueva sin rebuild. (v4)

---

## 4. Modelo de datos y migración

Migración `YYYYMMDDHHMMSS_auto_messages_caps_optout`. Es solo expand: tablas nuevas, enums nuevos y columnas con default o nullable.

```prisma
enum MessageTrigger { MANUAL AUTOMATIC }
enum MessageReason { COUPON_EXPIRING BIRTHDAY EVENT_INVITE FLASH_PROMO SMS_GENERAL }
enum MessageContactStatus { QUEUED_WHATSAPP QUEUED_SMS SENT_WHATSAPP SENT_SMS NOT_DELIVERED CANCELLED }
enum MessageSkipReason { CAP_TENANT CAP_GLOBAL BIRTHDAY_GLOBAL_LIMIT OPT_OUT NO_QUOTA INVALID_TEXT MISSING_SMS_GIFT }

model MessageContact {
  id              String               @id @default(uuid())
  tenantId        String
  phone           String               // msisdn internacional (toInternationalMsisdn)
  trigger         MessageTrigger
  reason          MessageReason
  localDate       DateTime             @db.Date   // día Bogotá del contacto
  status          MessageContactStatus
  fellBackToSms   Boolean              @default(false)
  birthdayYear    Int?                 // año del cumpleaños saludado (BIRTHDAY)
  dedupeKey       String?              @unique    // "BIRTHDAY:{tenantId}:{phone}:{year}"
  whatsappQueueId String?              @unique
  smsQueueId      String?              @unique
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  tenant          Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  couponNotices   CouponExpiryNotice[]
  @@index([phone, localDate])
  @@index([tenantId, phone, localDate])
  @@index([tenantId, localDate, trigger])
  @@index([phone, reason, birthdayYear])
  @@index([status, trigger])
}

model CouponExpiryNotice {
  userCouponId String         @id
  contactId    String
  tenantId     String
  createdAt    DateTime       @default(now())
  userCoupon   UserCoupon     @relation(fields: [userCouponId], references: [id], onDelete: Cascade)
  contact      MessageContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  @@index([contactId])
}

model MessageOptOut {
  id              String    @id @default(uuid())
  tenantId        String
  phone           String    // msisdn
  optedOut        Boolean   @default(true)
  optedOutAt      DateTime  @default(now())
  reactivatedAt   DateTime?
  updatedByUserId String?
  updatedAt       DateTime  @updatedAt
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, phone])
  @@index([tenantId, optedOut])
}

model TenantAutoMessageConfig {
  tenantId               String         @id
  couponReminderEnabled  Boolean        @default(true)
  couponReminderDays     Int            @default(7)
  birthdayEnabled        Boolean        @default(true)
  birthdayDays           Int            @default(3)
  birthdayGiftWhatsapp   String?
  birthdayGiftSms        String?
  smsCouponTemplate      String
  smsBirthdayTemplate    String
  primaryBranchLandingId String?
  updatedByUserId        String?
  updatedAt              DateTime       @updatedAt
  tenant                 Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  primaryBranchLanding   BranchLanding? @relation(fields: [primaryBranchLandingId], references: [id], onDelete: SetNull)
}

model MessageSkipDaily {
  tenantId   String
  localDate  DateTime          @db.Date
  trigger    MessageTrigger
  reason     MessageReason
  skipReason MessageSkipReason
  count      Int               @default(0)
  tenant     Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@id([tenantId, localDate, trigger, reason, skipReason])
}
```

Colas: se agregan a `WhatsappQueue` y `SmsQueue`:

- `trigger MessageTrigger @default(MANUAL)`
- `reason MessageReason?` (null en filas PLATFORM y en las históricas)
- `contactId String?` con relación `onDelete: SetNull`
- `@@index([contactId])`

Las relaciones inversas se agregan en `Tenant`, `UserCoupon` y `BranchLanding`.

**Notas:**
- `phone` es siempre el msisdn que produce `toInternationalMsisdn(phoneCountryCode, normalizePhone(phone))` [repo: src/lib/international-phone.ts — no leído; src/lib/user-phone.ts]. La baja y los topes son por teléfono, no por cuenta [historia].
- Sin backfill: las filas históricas quedan `trigger=MANUAL`, `reason=null` y no cuentan para los topes, porque no tienen contacto. Los topes empiezan a contar desde el despliegue [SUPUESTO — aceptable; ver Riesgos].
- Rango de días de antelación: 1–30 para ambos [SUPUESTO — la historia no fija máximo; el cumpleaños manual ya tope 30].

**Estados de `MessageContact` que cuentan para los topes:** `QUEUED_WHATSAPP`, `QUEUED_SMS`, `SENT_WHATSAPP`, `SENT_SMS`. No cuentan `NOT_DELIVERED` ni `CANCELLED` [humano, 2026-10-10].

**Al pasar un contacto automático a `NOT_DELIVERED`:**
- Se borran sus `CouponExpiryNotice`.
- Se pone `dedupeKey=null`.

Con eso, el recordatorio o el saludo se reintentan en la siguiente pasada mientras sigan vigentes. Es consecuente con "no cuenta" [SUPUESTO — confirmar en la aprobación].

---

## 5. Lógica clave

### 5.1 `reserveContact(tx, { tenantId, phone, trigger, reason, localDate, birthdayYear? })`
1. `SELECT pg_advisory_xact_lock(hashtext($phone))`. Serializa el mismo teléfono entre el cron y los envíos manuales concurrentes.
2. Si existe `MessageOptOut{tenantId, phone, optedOut:true}`, devuelve `skip OPT_OUT`.
3. Cuenta los contactos activos del par (tenant, teléfono) con `localDate = hoy` y con `localDate ≥ hoy-6`. Si llegan a 1 o 3 respectivamente, devuelve `skip CAP_TENANT`.
4. Cuenta los contactos activos del teléfono en todos los comercios, hoy y en 7 días. Si llegan a 2 o 5, devuelve `skip CAP_GLOBAL`.
5. Solo para `BIRTHDAY`: si el teléfono ya tiene 3 contactos activos de `BIRTHDAY` con ese `birthdayYear`, devuelve `skip BIRTHDAY_GLOBAL_LIMIT`.
6. Crea el `MessageContact` (status según el canal; `dedupeKey` en BIRTHDAY). Si la `dedupeKey` choca (P2002), devuelve `duplicate`.

El llamador crea la fila de cola en la misma `tx` y enlaza `whatsappQueueId`/`smsQueueId` y `contactId`. `recordSkip()` hace upsert con incremento en `MessageSkipDaily`. Las filas PLATFORM (avisos de suscripción) no pasan por aquí ni cuentan [SUPUESTO — van al teléfono del comercio, no al cliente].

### 5.2 Selección de recordatorios (por tenant)
Entran los `UserCoupon` que cumplen todo esto:

- `coupon.tenantId = T`, `isRedeemed=false`, `coupon.isActive=true`.
- `coupon.expiresAt > now` y `diasCalendarioBogota(hoy → expiresAt) ≤ N`.
- `coupon.maxRedemptions IS NULL OR currentRedemptions < maxRedemptions`.
- `user.phone` no nulo y `user.isActive`.
- Sin `CouponExpiryNotice`.

Se agrupan por msisdn. Por cada teléfono:
- `cantidad` = número de cupones elegibles.
- `primero` = el de `expiresAt` mínimo, con su título y fecha (`es-CO`, `America/Bogota`).
- `nombre` = nombre del usuario dueño del primero.

Al encolar se crean `CouponExpiryNotice` para **todos** los cupones del grupo: el resumen cuenta como aviso [historia]. Si el contacto se desplaza por topes, no se crean avisos, y el reintento ocurre de forma natural al día siguiente mientras el cupón no venza.

> Esto corrige solo para los automáticos la deuda D-01 (cupones inactivos y agotados). El filtro de tenant va explícito en `coupon`; no se usa `userCouponLeadsWhere` con `extra.coupon` (trampa D-05).

### 5.3 Selección de cumpleaños (por tenant)
- Usuarios con `dateOfBirth` y `phone`, `isActive`, y al menos un `UserCoupon` cuyo `coupon.tenantId = T`.
- Condición: `0 ≤ díasHastaCumpleañosBogota ≤ N`.
- Se deduplica por msisdn.
- `birthdayYear` = año de esa ocurrencia; `dedupeKey` = `BIRTHDAY:{T}:{phone}:{year}`.
- El saludo nunca sale después del día del cumpleaños: el día siguiente ya no está en la ventana.

### 5.4 Planificador de canal (función pura)
Entradas:
- `waRemaining`, `smsRemaining`.
- `reason`.
- `giftWa`, `giftSms`.
- `smsRender` (ok o inválido).
- Plantilla v2 aprobada para la v1 dada.
- Landing principal efectiva.

Reglas, en orden:
1. Si `waRemaining > 0` y (no es BIRTHDAY o hay `giftWa`) → **WhatsApp**.
2. Si no, si `smsRemaining > 0`:
   - Si es BIRTHDAY sin `giftSms` → `skip MISSING_SMS_GIFT`.
   - Si el render SMS es inválido → `skip INVALID_TEXT`.
   - Si no → **SMS**.
3. Si no → `skip NO_QUOTA`.

Si es BIRTHDAY y no hay ningún regalo, no se planea nada y no se registra omisión: el dashboard ya lo muestra como "falta regalo" (CA-08).

Si es BIRTHDAY con `giftSms` pero sin `giftWa`, sale por SMS aunque haya cupo de WhatsApp. "El cumpleaños de un canal solo arranca cuando el comercio configuró el regalo de ese canal" [historia]. [SUPUESTO — confirmar.]

El cupo restante se calcula al inicio de cada tenant como `límite − SENT(periodo de facturación, TENANT) − PENDING/PROCESSING(TENANT)` y se descuenta en memoria. Esto evita sobreencolar (deuda D-03) solo en los automáticos.

### 5.5 Render de SMS automáticos
Comodines permitidos: `{{nombre_usuario}}`, `{{nombre_comercio}}`, `{{cupon}}`, `{{fecha_vencimiento}}`, `{{cantidad_cupones}}`, `{{regalo}}`, `{{fecha_cumpleanos}}`.

**Al guardar:**
- `findDisallowedSmsChars` sobre el texto literal, sin los comodines [repo: src/lib/sms-charset.ts].
- Comodines desconocidos: error.
- Literal mayor de 160: error.

**Al enviar:**
- Cada valor pasa por `sanitizeSmsText`, que quita tildes y caracteres fuera de GSM [repo: src/lib/sms-charset.ts].
- Si el resultado pasa de 160, se recorta `{{cupon}}` hasta un mínimo de 3 caracteres, luego `{{nombre_comercio}}` hasta 3, sin puntos suspensivos.
- Si aun así no cabe, devuelve `INVALID_TEXT`.

Textos por defecto (validados contra `SMS_ALLOWED_CHARS`; `¡` y `ñ` son válidos):
- Recordatorio: `Hola {{nombre_usuario}}, en {{nombre_comercio}} tienes premios por vencer. {{cupon}} vence el {{fecha_vencimiento}}. Redimelo pronto!`
- Cumpleaños: `¡Feliz cumpleaños {{nombre_usuario}}! En {{nombre_comercio}} queremos celebrarlo contigo: {{regalo}}. Te esperamos.`

### 5.6 Orquestador `runAutoMessagesPass(now)`
1. `hoy` = fecha de Bogotá de `now`. En entornos que no son producción, `now` puede venir de `AUTO_MESSAGES_NOW`.
2. Tenants elegibles:
   - `isActive`.
   - `canTenantOperateWithSubscription`: legacy sin fila → sí [humano, 2026-10-10]; fila con `expiresAt > now` → sí, incluida la prueba gratis [repo: src/lib/billing/subscription-access.ts].
   - `maxWhatsappPerMonth > 0 || maxSmsPerMonth > 0`.
3. **Fase cumpleaños** sobre todos los tenants elegibles con cumpleaños encendido; luego **fase recordatorios** con recordatorio encendido.
4. Por cada candidato:
   - Planificador.
   - Si hay canal: `reserveContact` + crear la fila de cola (`trigger=AUTOMATIC`, `reason`, `origin=TENANT`, `qrCampaignId` = campaña del cupón más reciente del cliente en el tenant). Para recordatorios, crear `CouponExpiryNotice`.
   - Si no: `recordSkip`.
5. Se corta al llegar a `AUTO_MESSAGES_MAX_PER_RUN` o tras 240 s. La segunda pasada del día retoma lo que quedó, y es idempotente gracias a los avisos y la `dedupeKey`.
6. Si se encoló algún WhatsApp, `triggerWhatsappWorker()` [repo: src/lib/whatsapp-worker-trigger.ts].
7. `reconcileContacts()`.
8. Si se encoló algún SMS y la ventana está abierta: `processPendingSmsBatch()` [repo: src/lib/sms-processor.ts].

**`qrCampaignId`:** hoy solo es nulo en PLATFORM [repo: prisma/schema.prisma]. Para un automático se usa la `qrCampaignId` del `UserCoupon` elegido. En un cumpleaños se usa la del `UserCoupon` más reciente del cliente en el tenant; si fuera nula, se omite al cliente y se registra en el log, sin nuevo motivo de omisión. Así se conserva la columna "Campaña" de las colas y su filtro.

### 5.7 Reconciliación `reconcileContacts()` (lotes de 200)
Recorre los contactos `QUEUED_WHATSAPP` y `QUEUED_SMS`, automáticos y manuales:

- WhatsApp `SENT` → `SENT_WHATSAPP`.
- WhatsApp `FAILED` (o fila borrada):
  - Automático con SMS posible (cupo, regalo SMS si es cumpleaños, render válido): reclama con `updateMany where {id, smsQueueId:null, status:QUEUED_WHATSAPP}`, crea `SmsQueue` (`trigger=AUTOMATIC`, mismo `reason` y `contactId`), marca `QUEUED_SMS` y `fellBackToSms=true`. Todo en una transacción. La unique de `smsQueueId` evita duplicados entre crons solapados (patrón 051).
  - Automático sin SMS posible → `NOT_DELIVERED` (y `recordSkip NO_QUOTA`, `MISSING_SMS_GIFT` o `INVALID_TEXT` según el caso).
  - Manual → `NOT_DELIVERED`. Los manuales no pasan a SMS [historia].
- SMS `SENT` → `SENT_SMS`; SMS `FAILED` → `NOT_DELIVERED`.
- Fila de cola `CANCELLED` → contacto `CANCELLED`.
- Todos los cambios a estado final usan CAS sobre el estado previo.

### 5.8 Baja
**`setMerchantMessagesEnabled(false)`:**
- Upsert de `MessageOptOut{optedOut:true, optedOutAt:now}`.
- En la misma transacción:
  - `WhatsappQueue`/`SmsQueue` `PENDING` de (tenant, `userPhone`=msisdn) → `CANCELLED` con `errorLog='Cancelado por baja del cliente'`.
  - Sus contactos → `CANCELLED`.
  - Las filas `PROCESSING` no se tocan: carrera aceptada.

**`setMerchantMessagesEnabled(true)`:** `optedOut=false` y `reactivatedAt=now`.

El administrador no tiene ninguna acción sobre `MessageOptOut` (CA-28).

**Contacto cancelado por baja (v3):** conserva su `dedupeKey` y sus `CouponExpiryNotice`. Si el cliente reactiva, ese saludo de ese año y esos cupones no se reenvían; un `CANCELLED` sigue sin contar para los topes. [implementador, 2026-10-10; aceptado por validador]

El listado de comercios sale de los `UserCoupon` del usuario: `coupon.tenant` distinto, con el logo de la campaña más reciente.

### 5.9 Envíos manuales
En `queueWhatsappMessages` y `queueSmsMessages`, tras armar los destinatarios y el dedupe actual:

1. Pre-evaluación sin escritura: baja y topes, para calcular `toQueue`.
2. La regla actual de cupo se aplica sobre `toQueue`: si excede, error y no se encola nada [repo: src/actions/whatsapp.ts:742-750]. Se conserva.
3. Por cada destinatario: `tx` con `reserveContact` (`trigger=MANUAL`, `reason` según la plantilla o el filtro) y la fila de cola. Si un concurrente lo desplazó, se suma a `skipped`.
4. `recordSkip` por cada omitido, con `trigger=MANUAL`. **Los manuales desplazados no se reintentan** [historia].

`reason`:
- WhatsApp: `recordatorio_cupon_vencer` → COUPON_EXPIRING, `cumpleanos_regalo_tenant` → BIRTHDAY, `invitacion_evento_exclusivo` → EVENT_INVITE, `promocion_relampago` → FLASH_PROMO.
- SMS: `expiring_coupons` → COUPON_EXPIRING, `birthdays` → BIRTHDAY, `general` → SMS_GENERAL.

El formulario muestra: "Se encolaron 88. Se omitieron 12: 10 por tope de mensajes, 2 por baja del cliente."

Los manuales de WhatsApp usan la plantilla v2 cuando está aprobada y hay landing principal efectiva (CA-35/36).

### 5.10 Dashboard (mes calendario, igual que los KPI actuales [repo: src/actions/analytics.ts])
- Enviados por canal × `trigger` (colas `SENT`, `origin=TENANT`, `sentAt` en el mes).
- Enviados por `reason`.
- Omitidos por `skipReason`: suma de `MessageSkipDaily` del mes. Son eventos por día; un automático desplazado 3 días suma 3. Se rotula "omisiones".
- Pasaron a SMS: contactos `fellBackToSms` y `SENT_SMS` del mes.
- Consumo de cupo: `getWhatsappLimitStatus`/`getSmsLimitStatus`, por periodo de facturación, y se rotula así [repo: src/lib/whatsapp-limit.ts, sms-limit.ts].
- Dados de baja: `MessageOptOut{tenantId, optedOut:true}`.
- Estado de los automáticos: encendido o apagado, falta regalo WhatsApp/SMS, falta landing principal.
- Gráfica de barras apiladas con `recharts` (ya instalado) [repo: src/components/admin/AdminAnalyticsDashboard.tsx].

### 5.11 Recorrido guiado
- Se sube `CURRENT_ONBOARDING_TOUR_VERSION` a `'2026-11'`.
- Se agrega la entrada `/admin/mensajes-automaticos` con `since:'2026-11'`.
- Se actualizan los textos de `/admin/whatsapp` y `/admin/sms` con `since:'2026-11'`.

`selectAutoOnboardingTourSteps` ya muestra solo los pasos con `since > storedVersion` [repo: src/lib/onboarding-tour.ts], así que quien terminó la versión 2026-10 ve 3 pasos una vez. El ancla `data-tour-target` la hereda el ítem del nav [repo: src/components/admin/OnboardingTour.tsx].

---

## 6. Seguridad — triage OWASP

### Top 10 web (app)

| Ítem | ¿Aplica? | Control | Task |
|---|---|---|---|
| A01 Control de acceso | **Aplica** | Configuración, dashboard y colas: `tenantId` solo de la sesión. Baja: el usuario solo actúa sobre su propio teléfono y sobre comercios donde tiene cupones; se valida en el servidor. El administrador no tiene ninguna acción sobre la baja. `primaryBranchLandingId` debe pertenecer al tenant. `/c/{id}` no revela existencia. | T-04, T-07, T-09, T-14 |
| A02 Fallas criptográficas | No aplica | No hay secretos ni datos cifrados nuevos. El msisdn ya se guarda en claro en las colas. | — |
| A03 Inyección | **Aplica** | Prisma parametrizado. El advisory lock usa `$executeRaw` con plantilla etiquetada, nunca `Unsafe`. Zod en todas las entradas. Los comodines se reemplazan con una lista cerrada; no hay evaluación de plantillas. | T-03, T-08, T-09 |
| A04 Diseño inseguro | **Aplica** | Topes contra abuso del número compartido. Punto único de contacto: ningún camino de envío al cliente lo salta. Interruptor `AUTO_MESSAGES_ENABLED`. Override de fecha bloqueado en producción. | T-03, T-05, T-13 |
| A05 Mala configuración | **Aplica** | Cron con `CRON_SECRET` (`authorizeCron`). `AUTO_MESSAGES_NOW` se ignora en producción. Variables documentadas en ENV. | T-13, T-18 |
| A06 Componentes vulnerables | No aplica | Sin dependencias nuevas (`recharts` ya está). | — |
| A07 Autenticación | **Aplica** | `/billetera/mensajes` exige sesión (redirige a `/login/billetera` como `/billetera`). Las actions de admin pasan por `requireTenantAdminMutation`. | T-07, T-09 |
| A08 Integridad | **Aplica** | CSRF con `assertSameOriginRequest` / `requireTenantAdminMutation` en todas las mutaciones nuevas. | T-07, T-09 |
| A09 Registro y monitoreo | **Aplica** | Logs JSON (logger existente) de la pasada diaria: conteos por tenant y motivo, sin teléfono completo (enmascarado). Log de baja y reactivación con userId y tenantId, sin teléfono. | T-12, T-04 |
| A10 SSRF | No aplica | `/c/{id}` redirige solo a rutas internas que construye el servidor, nunca a una URL recibida. | T-14 |

### API Security Top 10 (cron y worker)
- **API2 (autenticación):** Bearer `CRON_SECRET` en el cron; el worker sigue con `WORKER_API_KEY` + IAM.
- **API4 (consumo de recursos):** `AUTO_MESSAGES_MAX_PER_RUN` y presupuesto de 240 s.
- **API3 (propiedades):** `parseTemplateParams` del worker descarta las claves desconocidas y valida que `boton_comercio` sea un uuid (W-01).

### Privacidad
- El cliente puede darse de baja por comercio.
- El administrador ve conteos de omisiones y bajas, nunca qué teléfonos se dieron de baja.
- La ofuscación PII por licencia (035) no cambia.

### Hotspots a revisar
1. `$executeRaw` del advisory lock (T-03).
2. La redirección `/c/[tenantId]` (T-14).
3. La autorización en `setMerchantMessagesEnabled` (T-07).
4. El override `AUTO_MESSAGES_NOW` (T-13).
5. El parseo de `boton_comercio` en el worker (W-01).
6. `scripts/auto-messages-lab.ts`: nada de credenciales embebidas. La contraseña del admin de prueba viene de `LAB056_ADMIN_PASSWORD` o se genera con `crypto.randomBytes` (S2068, PR #161).

---

## 7. Retrocompatibilidad

| Contrato | Consumidor | Estrategia |
|---|---|---|
| Esquema de las colas (columnas nuevas, status `CANCELLED`) | Worker (lee columnas explícitas, reclama solo `PENDING`); UI de colas; `sms-processor` (lee `PENDING`) | Expand: defaults y nullables. `CANCELLED` es invisible para los procesadores. La UI agrega la pastilla. |
| `templateParams` v2 + componente botón | Worker | Expand. El worker se despliega primero; la app no encola v2 hasta que su nombre esté en `WHATSAPP_V2_TEMPLATES_APPROVED`. |
| Resultado de `queueWhatsappMessages`/`queueSmsMessages` | Formularios del admin | Campo nuevo opcional `skipped`. |
| Comportamiento de los envíos manuales (ahora con topes y baja) | Administradores | Cambio funcional pedido por la historia; se comunica con el conteo de omisiones (riesgo en la proposal). |
| Recorrido guiado (versión 2026-11) | Administradores con 2026-10 | Ven solo los pasos con `since` 2026-11. |
| `vercel.json` (cron nuevo) | Vercel | Aditivo. |
| Contactos sin histórico | Topes | Los topes cuentan desde el despliegue; la primera semana es más permisiva. Aceptado [SUPUESTO]. |

**Plan de rollback:**
1. `AUTO_MESSAGES_ENABLED=false`: detiene los automáticos sin desplegar.
2. Vaciar `WHATSAPP_V2_TEMPLATES_APPROVED`: vuelve a v1 (requiere redespliegue de la app para releer la variable).
3. Revertir el despliegue de la app. Las tablas y columnas nuevas pueden quedarse: son expand-only y no las lee el código anterior.
4. El worker anterior ignora `boton_comercio`; con v2 encolado daría 132000, por eso el paso 2 va antes que revertir el worker.

---

## 8. Testing (Vitest — app; node:test — worker)

Política: tests unitarios sin BD en `src/lib/__tests__/` [repo: openspec/specs/testing.md].
- Mocks obligatorios de `@/lib/prisma` (incluidos `$transaction` y `$executeRaw`), `@/auth`, del trigger del worker y de LabsMobile, con `vi.hoisted()`.
- No se refactoriza producción solo para testear (ADR-010-2).
- Cobertura: ≥80 % de las líneas nuevas en `src/lib/auto-messages/**`, por encima del ≥70 % de la política. ≥95 % en `bogota-date.ts`, `contact-caps.ts`, `contact-gate.ts` y `channel-planner.ts`, que son módulos de límites y fechas [repo: openspec/specs/testing.md].
- Fuera de objetivo unitario (según la política): actions, route handlers y React. Se cubren con QA de laboratorio (`/pruebas-lab`).

| Módulo | Casos mínimos |
|---|---|
| bogota-date | Medianoche UTC vs. Bogotá; vence hoy/mañana/N; 29-feb en año no bisiesto; cambio de año en cumpleaños 31-dic/1-ene |
| contact-caps / contact-gate | Tenant 0→1 ok, 1→2 bloquea; semana 3; global 1/3 ok, 2/3 bloquea, 0/5 bloquea (outline CA-24); NOT_DELIVERED/CANCELLED no cuentan; baja; límite de 3 cumpleaños; P2002 de dedupeKey → duplicate; se llama al lock |
| opt-out | Baja crea/actualiza; cancela PENDING en las dos colas y en contactos; reactivación; usuario sin teléfono → error |
| config | Sin fila → defaults; landing efectiva (0, 1, 2 activas; configurada inactiva); Zod de rangos |
| sms-auto-render | Comodín desconocido; emoji; quita tildes en valores; recorte del cupón y luego del comercio; imposible → INVALID_TEXT; los defaults validan |
| coupon-expiry-selection | Ventana N; poca vigencia; agrupar 4 → cantidad 4 y primero correcto; excluye redimido, inactivo, agotado, vencido y avisado |
| birthday-selection | Ventana 0..N; día después excluido; sin cupón en el tenant excluido; dedupe por teléfono |
| channel-planner | Las ramas de §5.4 |
| template-resolver | v2 aprobada + landing → v2 con `boton_comercio`; sin landing → v1; no aprobada → v1; recordatorio v1 sin `cantidad_cupones` |
| run | Prioridad (cumpleaños antes que cupón con tope 1); desplazado → sin aviso y reintento al día siguiente; tenant vencido excluido; legacy incluido; interruptor apagado; NOW ignorado en producción; corte por máximo |
| reconcile | SENT→SENT_WA; FAILED auto → SMS una sola vez (solapamiento); FAILED sin cupo SMS → NOT_DELIVERED + borra avisos; manual FAILED → NOT_DELIVERED; SMS FAILED |
| dashboard-metrics | Agregación por trigger/canal/motivo, omisiones, pasaron a SMS |
| worker whatsapp.test | Payload v2 con componente botón (índice y texto); v1 sin cambios; boton_comercio inválido → params incompletos |

Verificación: `npm run test`, `npm run test:coverage` y `npm run build` (app); `npm test` y `npm run test:coverage` (worker).

---

## 9. Quality gate

- 0 bugs y 0 vulnerabilidades nuevas.
- 100 % de los hotspots de §6 revisados.
- Mantenibilidad A.
- Cobertura ≥80 % del código nuevo.
- Duplicación ≤3 %.

**Riesgo de duplicación:** la lógica de "cupones por vencer" y "cumpleaños en ventana" ya existe en `src/actions/whatsapp.ts` y `sms.ts`, duplicada entre ambos. Este change **no** reescribe los manuales: los selectores nuevos viven en `src/lib/auto-messages/`. Sonar puede marcar similitud. Mitigación: los selectores nuevos tienen otra firma y se basan en días calendario de Bogotá. Queda propuesta como deuda la extracción de los manuales hacia esos selectores (D-01, D-04).

---

## 10. Deudas detectadas (documentadas, no se corrigen aquí salvo lo indicado)

- **D-01** La audiencia manual "por vencer" no excluye cupones inactivos ni agotados, y con `redeemed_coupons` recuerda cupones redimidos [repo: src/actions/whatsapp.ts:297-307; sms.ts:198-211]. *Corregido solo en los automáticos.*
- **D-02** El tope de 200 es opcional: sin `userLimit` no hay techo [repo: src/actions/whatsapp.ts:257-267].
- **D-03** El cupo no se reserva: solo cuenta `SENT` [repo: src/lib/whatsapp-limit.ts]. *Mitigado en los automáticos* (§5.4).
- **D-04** `whatsapp-birthday.ts` calcula en la zona del servidor y no en Bogotá [repo: src/lib/whatsapp-birthday.ts]. *Los automáticos usan `bogota-date.ts`.*
- **D-05** `userCouponLeadsWhere` pierde el filtro de tenant si `extra.coupon` lo pisa [repo: src/lib/tenant-lead-query.ts].
- **D-06** El SMS no tiene estado PROCESSING: dos ejecuciones solapadas pueden duplicar envíos. El token de LabsMobile viaja en la query del GET masivo [repo: src/lib/sms-processor.ts].
- **D-07** Las actions de WhatsApp y SMS no usan Zod (convención §5). *El código nuevo sí lo usa.*
- **D-08** Analytics usa mes calendario y el cupo usa el ciclo de facturación. *El dashboard nuevo lo rotula.*
- **D-09** El encolado manual de WhatsApp no dispara el worker, aunque operations.md dice que sí [repo: src/actions/whatsapp.ts:88-107].
- **D-10** AGENTS.md del worker está desactualizado (sondeo, Render, últimos changes) [repo: whatsapp_rulett-app/AGENTS.md]. *Se actualiza la sección de plantillas en W-04.*
- **D-11** El índice RAG del proyecto dice "próximo 050"; el repo va en 056.
