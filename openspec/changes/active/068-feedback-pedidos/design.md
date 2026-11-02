SDD: 17tnjrajf9b · v5 · 2026-11-02

# Design — 068 Calificación de pedidos e informe de experiencia

Fuentes leídas en el repo (copia del 2026-11-01): `prisma/schema.prisma`, `src/lib/branch-order/{finalize,status,pdf,messages,whatsapp-tab}.ts`, `src/lib/auto-messages/{run,reconcile,channel-planner,contact-gate,opt-out,merchant-list,config,template-resolver,bogota-date}.ts`, `src/lib/{whatsapp-limit,whatsapp-templates,whatsapp-template-params,ai-prompt-limit,vertex-ai}.ts`, `src/config/ai-prompts.ts`, `src/lib/menu-assistant/reservation.ts`, `src/lib/customer-order/{tracking,wallet-orders,create}.ts`, `src/components/public/customer-order/{CustomerOrderSent,CustomerOrderTracking}.tsx`, `src/app/admin/page.tsx`, `src/lib/dashboard/copy.ts`, `src/components/wallet/{WalletShell,MerchantMessagesList}.tsx`, `src/app/billetera/{page,mensajes/page}.tsx`, `src/lib/{tenant-bootstrap,self-signup-bootstrap}.ts`, `src/actions/sede-customer-orders.ts`, `src/app/api/cron/auto-messages/route.ts`, `vercel.json`, `package.json`, `openspec/specs/{contracts,integrations,domain_model,security,ui_and_brand,testing}.md`, `AGENTS.md`; worker: `src/types.ts`, `src/services/whatsapp.ts`, `openspec/specs/integrations.md`.

**Verificados por el implementador en el plan v3:** callers de finalize (2), `merchant-messages.ts`, `summary.ts`, el PDF en el servidor, el proxy, `sms-charset`, el 308 del apex, las vistas de colas y `llms.txt` (ver `decisions.md` D-1…D-9). **Originalmente no leídos:** las actions que llaman `finalizeOrderInTx`, `src/actions/merchant-messages.ts`, `src/lib/sms-limit.ts`, `src/lib/sms-time-window.ts`, `src/lib/branch-order/summary.ts`, `src/proxy.ts`, `CustomerOrderTrackingSheet.tsx`, `WalletOrderCard/Detail`, `pdf-share-flow.ts`, y en el worker `parseTemplateParams` y `db/queue.ts`.

## 1. Decisión de diseño (resumen)

| Tema | Decisión | ADR |
|---|---|---|
| Persistencia | Tabla propia `OrderFeedback` (una fila por pedido: solicitud, despacho y respuesta) y `FeedbackReport`. No se usa `MessageContact`. | ADR-068-1 |
| Enlace | Token firmado sin estado: `base64url(uuid del pedido, 16 bytes)` + `base64url(HMAC-SHA256(FEEDBACK_LINK_SECRET, "of1:"+orderId)[0..12])` = 38 caracteres. Se puede reproducir para el PDF, el resumen y el mensaje. | ADR-068-2 |
| Envío diferido | `OrderFeedback.dueAt = closedAt + 1 h`. Cron `/api/cron/order-feedback` cada 15 min de 08:00 a 20:45 (Bogotá) que encola lo vencido, dispara el worker y reconcilia el respaldo. | ADR-068-3 |
| Colas | Se reutilizan `WhatsappQueue` y `SmsQueue` con `origin=TENANT`, `trigger=AUTOMATIC`, `reason=ORDER_FEEDBACK` y `qrCampaignId=null` (expand del contrato). | ADR-068-4 |
| Plantilla | `calificar_pedido` como rama propia en el worker (no es v2): botón con `boton_calificacion` (token de 38 caracteres) e índice propio por variable. | ADR-068-5 |
| IA | Clasificación detrás de una interfaz con dos proveedores: OpenRouter (modelo de decisión) y Gemini. El informe narrativo lo hace Gemini. La clasificación no consume cupo; cada informe gasta 1 prompt, reservado con lock. | ADR-068-6 |
| Resumen | 4 pestañas por `?tab=`; el servidor carga solo los datos de la pestaña activa. La última pestaña se recuerda en una cookie. | ADR-068-7 |
| QR | (v3) El PDF se arma en el servidor (`getBranchOrderPdfAction`): se usa la dependencia nueva `qrcode` (+ `@types/qrcode`, versiones exactas) y `QRCode.create(url).modules` se dibuja como rectángulos vectoriales en jsPDF. | ADR-068-8 |
| Home (v2) | Cuarto destacado en `HOME_HIGHLIGHTS`, con ilustración en código, y una pregunta frecuente en `HOME_FAQ`. Grilla de 2 columnas en tablet y 4 en escritorio. Textos con compuerta G-0. | ADR-068-9 |

### Alternativas descartadas
- **Reutilizar `MessageContact` y `reserveContact`.** Esos contactos cuentan en los topes de 056 y desplazarían a otros mensajes, lo que viola R15. Además `reconcile.ts:97` marca como NOT_DELIVERED cualquier motivo nuevo [repo].
- **Reutilizar la llave de seguimiento de 062.** Vence 24 h después del cierre [repo: src/lib/customer-order/tracking.ts:58-65] y solo existe en los pedidos del comensal.
- **Token aleatorio guardado como hash.** No se puede reproducir para el PDF ni para el resumen que el personal comparte después: habría que guardarlo en claro o cifrado.
- **Agregar `scheduledAt` a las colas.** Cambia el contrato del worker, que reclama todo `PENDING` [repo: worker].
- **Pestaña nueva en la billetera.** Se prefiere integrar la calificación en «Pedidos» (sección «Por calificar»), que ya carga esos pedidos a demanda [repo: src/app/billetera/page.tsx:37-55].
- **Dependencia `qrcode` en el servidor.** No hace falta mientras el PDF se genere en el cliente. Si T-11 encuentra que se genera en el servidor, se registra en `decisions.md` y se decide.

## 2. Componentes afectados

### rulett-app
| Área | Archivos previstos |
|---|---|
| Datos | `prisma/schema.prisma`, `prisma/migrations/<ts>_order_feedback/` |
| Dominio | `src/lib/order-feedback/` (nuevo): `token.ts`, `create.ts`, `dispatch.ts`, `reconcile.ts`, `sms-text.ts`, `answer.ts`, `metrics.ts`, `classify/` (`types.ts`, `openrouter.ts`, `gemini.ts`, `redact.ts`), `report.ts`, `ai-quota.ts`, `copy.ts`, `config.ts` |
| Gancho | `src/lib/branch-order/finalize.ts` (llama a `createOrderFeedbackInTx`) |
| Mensajería | `src/lib/whatsapp-templates.ts`, `src/lib/whatsapp-template-params.ts`, `src/lib/auto-messages/merchant-list.ts`, `src/actions/merchant-messages.ts` |
| Rutas | `src/app/f/[token]/page.tsx`, `src/app/api/cron/order-feedback/route.ts`, `src/app/api/cron/feedback-report/route.ts`, `vercel.json`, `src/proxy.ts` / `proxy-routing.ts` (`/f/*` público) |
| Actions | `src/actions/order-feedback.ts` (responder desde el enlace o la billetera), `src/actions/order-feedback-admin.ts` (lista, cifras, informe a demanda), `src/actions/sede-order-feedback.ts` (interruptor) |
| UI pública | `src/components/public/order-feedback/*` (formulario NPS, estados, invitación a la billetera y Descubre) |
| Billetera | `WalletOrdersPanel`, `WalletOrderCard` (sección «Por calificar» y botón «Calificar») |
| Pedido | hoja de seguimiento (enlace en la etapa final), `summary.ts` (línea con el enlace), `pdf.ts` (QR + enlace) |
| Admin | `src/app/admin/page.tsx` (pestañas), `src/components/admin/resumen/*`, `src/components/admin/experience/*`, formulario de la sede |
| Home (v2) | `src/lib/marketing/home-copy.ts`, `src/components/landing/home/HomeHighlights.tsx`, pruebas `home-copy.test.ts` / `home-sources.test.ts`; `llms.txt` y su fuente si listan capacidades [verificar en T-19] |
| Docs | `openspec/specs/*` (delta), `runbooks/ENV.md`, `AGENTS.md` |

### whatsapp_rulett-app
`src/types.ts`, `src/services/whatsapp.ts`, `parseTemplateParams` (archivo según el repo), `src/config.ts`, `test/`, `openspec/specs/integrations.md`, `docs/DEPLOYMENT.md` / runbook.

## 3. Modelo de datos (migración `order_feedback`, solo expand)

```prisma
// Branch
orderFeedbackEnabled Boolean @default(true)   // R1: ADD COLUMN ... DEFAULT true deja todas las sedes existentes encendidas

enum MessageReason { ... ORDER_FEEDBACK }      // ALTER TYPE ADD VALUE (al final)

enum OrderFeedbackDispatch {
  NOT_APPLICABLE   // sin billetera vinculada (R10)
  SCHEDULED        // espera dueAt
  QUEUED_WHATSAPP
  QUEUED_SMS
  SENT_WHATSAPP
  SENT_SMS
  SKIPPED          // ver skipReason
  NOT_DELIVERED    // WA falló y no hubo SMS posible
}
enum OrderFeedbackSkip { NO_PHONE OPT_OUT NO_QUOTA ANSWERED DISABLED SUBSCRIPTION EXPIRED }
enum OrderFeedbackAnswerVia { WALLET LINK }

model OrderFeedback {
  id              String   @id @default(uuid())
  tenantId        String
  branchId        String
  orderId         String   @unique                 // una por pedido (R7); idempotente
  customerUserId  String?                          // copia de BranchOrder.customerUserId al finalizar
  attendedById    String?                          // createdById ?? actor del evento -> CREATED (R31)
  finalizedById   String?                          // actor del evento -> FINALIZED (R31)
  closedAt        DateTime                         // copia de BranchOrder.closedAt
  expiresAt       DateTime                         // closedAt + 7 días (R21)
  dueAt           DateTime?                        // closedAt + 1 h; null si NOT_APPLICABLE
  dispatchStatus  OrderFeedbackDispatch
  skipReason      OrderFeedbackSkip?
  whatsappQueueId String?  @unique
  smsQueueId      String?  @unique
  score           Int?                             // 0..10 (R29)
  comment         String?  @db.VarChar(500)
  answeredAt      DateTime?
  answeredVia     OrderFeedbackAnswerVia?
  answeredUserId  String?                          // quien respondió con sesión (no vincula el pedido, R27)
  consentVersion  String?                          // aviso de datos sin cuenta (R36)
  classification  Json?                            // { topics:[{topic,tone,p}], model, provider }
  classifiedAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // FKs: tenant/branch/order Cascade; usuarios SetNull
  @@index([dispatchStatus, dueAt])
  @@index([tenantId, answeredAt])
  @@index([tenantId, closedAt])
  @@index([customerUserId, answeredAt, expiresAt])
}

enum FeedbackReportKind { WEEKLY ON_DEMAND }
enum FeedbackReportStatus { READY FAILED }
model FeedbackReport {
  id            String   @id @default(uuid())
  tenantId      String
  kind          FeedbackReportKind
  periodStart   DateTime                           // inicio del día Bogotá (UTC)
  periodEnd     DateTime
  status        FeedbackReportStatus
  metrics       Json                               // cifras + rankings + temas (sin texto de comentarios)
  narrative     Json?                              // { attack:[3], recognize:[3] }
  provider      String?
  createdById   String?
  aiPromptUsageId String? @unique                  // la fila de cupo que lo pagó (null si no se cobró)
  createdAt     DateTime @default(now())
  @@unique([tenantId, kind, periodStart])          // un semanal por semana; el a demanda usa periodStart = día Bogotá
  @@index([tenantId, createdAt])
}
```

- El borrado del pedido arrastra su feedback (`Cascade`). Los usuarios borrados quedan en `SetNull`.
- Sin relleno de datos: los pedidos finalizados antes del despliegue no tienen solicitud, así que su enlace muestra «no disponible».
- `AiPromptUsage` no cambia. La reserva se hace insertando la fila antes y borrándola si falla (§6.3).

## 4. Flujos

### 4.1 Solicitud al finalizar (H1)
`finalizeOrderInTx` [repo: src/lib/branch-order/finalize.ts:81-128]: después del CAS, del evento y de los pagos, y antes del `return { ok: true }` final, llama a `createOrderFeedbackInTx(tx, { orderId, actorId })`. Esa función:
1. Lee del pedido: sede (`orderFeedbackEnabled`), `tenantId`, `customerUserId`, `createdById`, `closedAt` y el `actorId` del evento con `toStatus=CREATED`.
2. Si la sede tiene el interruptor apagado, no crea nada (R4).
3. Crea la solicitud con `createMany({ skipDuplicates: true })` o con un `upsert` que no hace nada si ya existe; es idempotente gracias a `orderId @unique`.
   - Sin `customerUserId`: `dispatchStatus=NOT_APPLICABLE` y `dueAt=null`.
   - Con `customerUserId`: `SCHEDULED` y `dueAt=closedAt+1h`.
4. Si el pago se rechaza, la transacción se revierte y la solicitud no queda (R7, R9).

El guardián de suscripción **no** bloquea la creación: R5 aplica al envío (`SUBSCRIPTION`). La página de un comercio con la suscripción vencida sigue aceptando calificaciones (R5).

«Cambiar pedido» (R8): el pedido reemplazado se cancela y nunca llega a Finalizado, así que no genera solicitud. Corregir un pago no pasa por `finalizeOrderInTx` (R9) [SUPUESTO — se verifica en T-04].

### 4.2 Despacho (H2) — `/api/cron/order-feedback`
`*/15 13-23,0-1 * * *` (de 08:00 a 20:45 Bogotá), `maxDuration=300`, Bearer `CRON_SECRET`. Si `ORDER_FEEDBACK_MESSAGES_ENABLED !== 'true'`, termina con `{ ok, skipped: 'disabled' }`.
1. **Ventana:** si la hora de Bogotá no está en [08:00, 21:00) no hace nada (decisión de Oscar 2026-11-01). Todo lo vencido sale en la primera corrida desde las 08:00.
2. **Selección:** `dispatchStatus=SCHEDULED`, `dueAt <= now`, con tope `ORDER_FEEDBACK_MAX_PER_RUN` (por defecto 500), ordenado por `dueAt`.
3. **Por solicitud**, en una transacción con CAS `where { id, dispatchStatus: 'SCHEDULED' }`:
   - `answeredAt` no nulo → `SKIPPED/ANSWERED` (R17).
   - `expiresAt <= now` → `SKIPPED/EXPIRED`.
   - Sede apagada → `SKIPPED/DISABLED` (R4).
   - El comercio no puede operar (`canTenantOperateWithSubscription`, que se reutiliza; los legacy pasan) → `SKIPPED/SUBSCRIPTION` (R5).
   - El usuario de la billetera no tiene `phone` → `SKIPPED/NO_PHONE` (R11). El teléfono se normaliza a msisdn con `toInternationalMsisdn(User.phoneCountryCode, User.phone)`.
   - `MessageOptOut(tenantId, msisdn).optedOut` → `SKIPPED/OPT_OUT` (R16).
   - **Canal:** WA si `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=true` y queda cupo de WA (`maxWhatsappPerMonth − SENT del periodo − PENDING/PROCESSING`, la misma regla de `run.ts:140-157`, que se extrae a un helper compartido; ver §8). Si no, SMS si queda cupo. Si no hay ninguno → `SKIPPED/NO_QUOTA` (R13, R14).
   - **Encolado:** `WhatsappQueue` o `SmsQueue` con `origin TENANT`, `trigger AUTOMATIC`, `reason ORDER_FEEDBACK` y `qrCampaignId null`. Luego `dispatchStatus=QUEUED_*` y se enlaza `whatsappQueueId`/`smsQueueId`.
4. El cupo se descuenta en memoria por comercio durante la corrida, como en `run.ts`.
5. Al final: si hubo WA, `triggerWhatsappWorker()` [repo: src/lib/whatsapp-worker-trigger.ts]; después se corre `reconcileOrderFeedbackSafely()` (§4.3). El SMS lo procesa el cron `send-sms`, que ya respeta su franja horaria.
6. **Respuesta:** `{ ok, queuedWhatsapp, queuedSms, skipped: {…por motivo}, reconciled, truncated }`. El log `scope: 'order-feedback'` lleva solo conteos y ids, nunca teléfonos ni texto.

**Plantilla WA:** `templateName='calificar_pedido'`, `languageCode='es_CO'`, `templateParams`:

| Parámetro | Valor |
|---|---|
| `nombre_tenant` | nombre del comercio, recortado a 60 |
| `nombre_usuario` | primer nombre del perfil, o «cliente» si no hay [humano, v3] |
| `numero_pedido` | consecutivo |
| `nombre_sede` | nombre de la sede |
| `fecha_pedido` | `d MMM yyyy` en Bogotá, desde `closedAt` |
| `boton_calificacion` | token de 38 caracteres |

**Texto SMS** (GSM, ≤ 160, sin tildes; `sms-text.ts` lo sanea y recorta el nombre del comercio para que quepa): `{Comercio}: ¿como te fue con tu pedido #{n}? Califica en 1 min: rulett.app/f/{token}`. El signo `¿` no es GSM-7 básico; si `sms-charset` lo rechaza, se omite [verificar en T-05]. (v3, D-5) El host del SMS sale de `getSiteUrl()` sin `https://` ni `www.`: en PDN queda `rulett.app/f/…` (verificado: 308 a `www` conservando la ruta) y en lab `lab.rulett.app/f/…`. Así el token de cada ambiente abre en su propio ambiente. El signo `¿` es GSM (verificado en `sms-charset`).

### 4.3 Respaldo WA→SMS — `reconcileOrderFeedback`
Copia el patrón de `queueFallbackSms` [repo: src/lib/auto-messages/reconcile.ts:171-201] sobre `OrderFeedback`. Recorre en lotes de 200 los `QUEUED_WHATSAPP` y los `QUEUED_SMS` y lee el estado de su fila de cola:
- WA `SENT` → `SENT_WHATSAPP`.
- WA `FAILED` → si sigue sin respuesta, sin baja, dentro de vigencia y con cupo de SMS, encola SMS (CAS `smsQueueId: null`) → `QUEUED_SMS`. Si no → `NOT_DELIVERED`.
- WA `CANCELLED` (por baja) → `SKIPPED/OPT_OUT`.
- SMS `SENT` → `SENT_SMS`. SMS `FAILED` o `CANCELLED` → `NOT_DELIVERED` o `SKIPPED/OPT_OUT`.

Corre al final del cron de despacho. La baja ya cancela las filas `PENDING` de ese teléfono [repo: src/lib/auto-messages/opt-out.ts:40-118], así que no hace falta tocarla.

### 4.4 Enlace y página pública `/f/[token]` (H1)
- `token.ts`:
  - `signFeedbackToken(orderId)`.
  - `verifyFeedbackToken(token)` → `orderId | null`: regex `^[A-Za-z0-9_-]{38}$`, decodifica el uuid, recalcula el HMAC y compara con `timingSafeEqual`.
  - `feedbackUrl(orderId)` arma `https://www.rulett.app/f/{token}` desde la URL pública canónica.
  - Si falta `FEEDBACK_LINK_SECRET`, se lanza un error al usarlo; el enlace no se muestra y se registra un log de error.
- Página dinámica (`noindex`, fuera del sitemap), que **no** usa `auth()` en el render público. Sigue la regla de 066: la sesión se detecta con una action del cliente, como `getLandingWalletCountAction`. Estados:

  | Estado | Cuándo |
  |---|---|
  | `invalid` | firma mala o pedido inexistente |
  | `not_ready` | el pedido no está Finalizado ni Cancelado y no tiene solicitud (R23) |
  | `cancelled` | el pedido está cancelado |
  | `unavailable` | Finalizado sin solicitud: sede apagada o pedido anterior al despliegue |
  | `expired` | (R21) |
  | `answered` | (R24) |
  | `open` | se puede calificar |

- **Datos visibles (R30):** comercio, sede, `#consecutivo`, modalidad (o «Atendido por el personal»), fecha y hora de Bogotá, y productos con cantidad, sin precios. **Nunca** el nombre, el teléfono ni la dirección del cliente.
- **Con sesión `USER`** (R25): botón «Calificar en mi billetera» → `/billetera?tab=pedidos&calificar={orderId}`. Si la sesión es la del dueño (`customerUserId`), la redirección es automática.
- **Formulario:** NPS de 0 a 10 en botones grandes y comentario opcional (contador de 500). Sin sesión: aviso de datos con versión `calificacion-2026-11` (R36) y Turnstile invisible (R28).
- **Después de responder** (R26): «¡Gracias!», CTA «Crea tu billetera» (`/login/billetera?callbackUrl=/billetera`, con `sanitizeReturnPath`) y un bloque de Descubre con 3 campañas de `getTopNationalCampaigns` (Descubre lista campañas, no sedes) [v3, verificado por el implementador]. Crear la billetera no vincula el pedido (R27).

### 4.5 Responder — `submitOrderFeedbackAction`
Orden de validación:
1. `assertSameOriginRequest()`.
2. Zod: `{ token, score: int 0..10, comment?: string trim ≤500, turnstileToken? }`.
3. Verificar el token.
4. Sesión opcional (`auth()` en la action). Si no hay sesión `USER`, Turnstile es obligatorio y falla cerrado.
5. CAS `updateMany where { orderId, answeredAt: null, expiresAt: { gt: now } }` con `score`, `comment`, `answeredAt`, `answeredVia`, `answeredUserId` y `consentVersion`.
6. `count=0` → recalcula el estado y devuelve `{ error: 'expired' | 'answered' | 'unavailable' }`.

Devuelve `ActionResult`. Desde la billetera se usa `submitWalletOrderFeedbackAction(orderId, …)`, que exige sesión `USER` y `OrderFeedback.customerUserId === session.userId`.

### 4.6 Billetera (H1)
- `listPendingWalletFeedback(userId)`: `customerUserId = userId`, `answeredAt null`, `expiresAt > now`, con el pedido Finalizado. Máximo 20, ordenados por `closedAt` descendente.
- Pestaña «Pedidos»: sección «Por calificar (N)» arriba, con una tarjeta por pedido y el formulario en hoja. Las tarjetas de pedido finalizado no calificado llevan el botón «Calificar».
- El indicador «N» en la pestaña se calcula en el servidor junto con el conteo existente [verificar en T-10].

### 4.7 Enlace y QR en el pedido (H1)
- **Seguimiento** (etapa `finished`): botón «Calificar mi pedido» que lleva a `/f/{token}`. El servidor solo lo incluye si existe la solicitud y está vigente.
- **Documento del pedido (v3):** `BranchOrderDocumentContext.feedbackUrl?` es opcional y solo lo llena `loadBranchOrderDocumentContext` cuando el pedido está Finalizado con la solicitud vigente. Sin ese dato, el documento queda igual que hoy y sus instantáneas no cambian. El pie del texto, del WhatsApp y de la impresión (`print-blocks`) lleva la línea «Califica tu experiencia: {url}». La URL no pasa por `toPdfText`.
- **PDF (v3):** se genera en el servidor. Al pie lleva un QR de 28 mm dibujado con `qrcode` (vectores, nivel de corrección M), el texto «Califica tu pedido» y la URL.
- Los pedidos no finalizados no muestran enlace (R23 aplica si alguien tiene una URL vieja).

### 4.8 Baja ampliada (H1)
`listMerchantMessagePreferences` agrega a los comercios de cupones (`coupon.tenantId`) los `tenantId` de `BranchOrder` con `customerUserId = session.userId`, sin duplicar. `setMerchantMessagesEnabled` acepta un `tenantId` que esté en cualquiera de las dos fuentes (R34). Hoy la action solo se verifica contra cupones [verificar en T-08].

### 4.9 Interruptor por sede (H1)
`updateSedeOrderFeedbackAction(sedeId, { enabled })` imita `updateSedeCustomerOrdersAction` [repo: src/actions/sede-customer-orders.ts:63-101]: `requireTenantAdminMutation` (CSRF), Zod, `branch.updateMany({ where: { id, tenantId } })` y `revalidatePath` de `/admin/sedes`. No toca la landing, así que no llama a `revalidatePublicLandings`. La UI es una casilla «Pedir calificación a los clientes» en el editor de la sede, junto a «Pedidos del comensal».

Altas (R2): `bootstrapTenantRecords` crea la sede sin el campo y el `@default(true)` lo aplica [repo: src/lib/tenant-bootstrap.ts:263-271]. Una prueba lo fija.

### 4.10 Cifras sin IA (H3) — `metrics.ts` (funciones puras + consultas)
Entradas: `tenantId`, `branchId | 'all'` y periodo en días de Bogotá (semana lunes–domingo o rango). Salida:

| Cifra | Cálculo |
|---|---|
| NPS | `round(100 × (promotores − detractores) / respuestas)`; null si no hay respuestas |
| Promotores / pasivos / detractores | 9–10 / 7–8 / 0–6 |
| Tendencia | NPS de las 8 semanas anteriores |
| % respuesta por canal | WA = respondidas con `dispatchStatus=SENT_WHATSAPP` / `SENT_WHATSAPP`; igual para SMS; «enlace o QR» = respondidas de `NOT_APPLICABLE` + `SKIPPED` / su total |
| NPS por modalidad | `DINE_IN`, `PICKUP`, `DELIVERY` y «Personal» (`fulfillment` null) |
| NPS por franja | 06–11, 11–15, 15–18, 18–22, 22–06 según la hora de `closedAt` en Bogotá [SUPUESTO] |
| Lista | paginada de 20 en 20: fecha, sede, #pedido, NPS, comentario, quién atendió y quién cobró (nombre del usuario) |

Estas cifras salen siempre, sin IA (R38, R45). Las consultas usan `@@index([tenantId, closedAt])` y `[tenantId, answeredAt]`.

### 4.11 Informe con IA (H4)
**Rankings sin IA** dentro del informe: personas que atendieron, personas que cobraron y productos (`BranchOrderLine.productId ?? productName`) con NPS promedio y n. Solo aparecen con n ≥ 5 (R41). Se calculan en `metrics.ts`.

**Clasificación** (`classify/`, R39, R40): solo de comentarios no vacíos con `classifiedAt null` del periodo, en lotes de 20.
1. Primero `redact.ts` reemplaza teléfonos, correos y números de 6 o más dígitos por `[dato]`.
2. Cada comentario se clasifica en 7 temas (`ATTENTION`, `PRODUCT`, `WAIT_TIME`, `PRICE`, `PLACE`, `DELIVERY`, `OTHER`) y en un tono por tema (`POSITIVE`, `NEGATIVE`, `NEUTRAL`), cada uno con su probabilidad.
3. Se guarda en `OrderFeedback.classification`.
4. Un tema cuenta solo si p ≥ `FEEDBACK_TOPIC_THRESHOLD` (0,7).

Proveedores:
- **OpenRouter** (`openrouter.ts`): modelo `FEEDBACK_CLASSIFIER_MODEL` (por defecto `typesafe/jev-1.13`; Microsoft-Decision-1 descartado, D-20), timeout de 15 s. El formato de la petición lo fija el spike T-01. La interfaz es `classify(comments) → {id, topics:[{topic,tone,p}]}[]`.
- **Gemini** (`gemini.ts`): `responseSchema` con temas y tonos enumerados y `p` en 0..1. Reutiliza el cliente de `vertex-ai.ts` con `AbortSignal` de 15 s, siguiendo el patrón de 057 [repo: integrations.md:162].
- Orden: Gemini por defecto (D-20); OpenRouter solo con `FEEDBACK_CLASSIFIER_PROVIDER=openrouter`. Si el proveedor elegido falla, se usa el otro si está configurado (R46). La clasificación no consume cupo (R44).

**Narrativa:** Gemini (`AI_FEEDBACK_REPORT_MODEL`, por defecto `gemini-3.1-flash-lite`) recibe solo métricas y conteos de temas, más hasta 30 comentarios redactados y marcados como datos. Devuelve JSON `{ attack:[{title,detail,evidence}] ×3, recognize:[…] ×3 }`, validado con Zod. El texto se muestra escapado.

**Cupo** (`ai-quota.ts`, R44–R46), dentro de `$transaction`:
1. `pg_advisory_xact_lock(hashtext('ai-prompts:'||tenantId))`.
2. `getAiPromptLimitStatus`: si no hay cupo, `{ error: 'no_quota' }`.
3. Inserta `AiPromptUsage(tenantId, userId?)`.
4. Fuera de la transacción: clasificación + narrativa.
5. Si la narrativa falla en los dos proveedores: borra esa `AiPromptUsage`, guarda `FeedbackReport` con `status=FAILED` y solo `metrics`, y no cobra.

Riesgo aceptado: los cupones y SMS con IA siguen insertando después del uso, sin este lock, así que una carrera entre ambos puede pasarse en 1.

**Semanal:** cron `/api/cron/feedback-report`, `0 11 * * 1` (lunes 06:00 Bogotá). Toma los comercios activos que pueden operar, con `maxAiPromptsPerMonth > 0` y con calificaciones respondidas la semana anterior (lunes–domingo de Bogotá). Si ya existe el `FeedbackReport(WEEKLY, periodStart)`, no hace nada (`@@unique`). Tope de tiempo 300 s con corte (`truncated`); los que falten se reintentan al día siguiente con `ON CONFLICT`… [SUPUESTO: el cron corre lunes y martes `0 11 * * 1,2`; el martes solo completa lo faltante].

**A demanda:** `generateFeedbackReportAction()` (TENANT_ADMIN, CSRF, `tenantId` de sesión). Cubre los últimos 7 días de Bogotá hasta hoy. Un intento por día y comercio: `@@unique(tenantId, ON_DEMAND, periodStart=hoy)` (R43). Un `FAILED` también ocupa el día [SUPUESTO — evita reintentos que gasten; al fallar no cobra]. Con `maxDuration` de 60 s, si la IA tarda, la UI muestra «Generando…» y consulta el estado.

**Retención en pantalla:** se listan los 12 informes más recientes (R47).

### 4.12 Resumen en pestañas (H3) — `/admin?tab=`
- Las pestañas son `ventas` (por defecto), `premios`, `mensajes` y `experiencia`. `TabLink` con `role=tab` sigue el patrón de la billetera [repo: src/components/wallet/WalletShell.tsx:89-115].
- El banner de suscripción o prueba y «Aprende a usar Rulett» quedan fuera de las pestañas (R48).

| Pestaña | Contenido |
|---|---|
| `ventas` | `SalesDashboardPanel` + `BranchOrderDashboardCounts` |
| `premios` | `AdminAnalyticsDashboard` |
| `mensajes` | `AutoMessagingDashboardPanel` |
| `experiencia` | `ExperiencePanel` (filtros de sede y semana, cifras, lista, informe, botón «Generar análisis») |

- El servidor solo ejecuta las consultas de la pestaña activa; hoy hace `Promise.all` de 6 fuentes [repo: src/app/admin/page.tsx:26-78].
- Sin `?tab`, se lee la cookie `rulett_admin_resumen_tab`, que fija el cliente al cambiar de pestaña (R49). Si la pestaña no es válida, se usa `ventas`.
- Solo `TENANT_ADMIN` entra a `/admin` (R50; sin cambio).
- Textos en `src/lib/dashboard/copy.ts`; la prueba de términos prohibidos sigue y se amplía a los nuevos (sin «dashboard», «SENT», «Top»).

### 4.13 Home: anunciar la calificación de pedidos (v2, H5)
Fuente: `src/lib/marketing/home-copy.ts` (única fuente de textos; las pruebas `home-copy.test.ts` y `home-sources.test.ts` impiden literales en los componentes) [repo]. Bloque actual: `HOME_HIGHLIGHTS` con 3 tarjetas (recordatorios, asistente IA, aviso de Wallet), grilla `md:grid-cols-3` [repo: src/components/landing/home/HomeHighlights.tsx].

**Cambios**
1. **Nuevo ítem** en `HOME_HIGHLIGHTS.items`, después de `reminders`:
   - `id: 'customer-feedback'`, `visual: 'feedback'`.
   - Ilustración en código, como `RemindersIllustration`: una tarjeta «¿Cómo te fue con tu pedido?» con una fila de 0 a 10, el 9 resaltado, y dos chips («Para reconocer: la atención» y «Para mejorar: el tiempo de espera»).
   - Sin cifras de NPS, nombres ni datos reales. No hace falta captura nueva.
2. **Grilla:** `md:grid-cols-2 xl:grid-cols-4` para 4 tarjetas. Hay que verificar que las tarjetas no queden más angostas que 260 px a 1280 px; si quedan, se usa `lg:grid-cols-2` con la cuarta en su propia fila.
3. **Pregunta frecuente** nueva en `HOME_FAQ.items`, antes de `after-trial`: `id: 'feedback'`.
4. **llms.txt (v3):** `src/lib/seo/llms-txt.ts` toma la pregunta frecuente de `HOME_FAQ.items` por su cuenta y «Qué hace» sale de `HOME_BUSINESS.capabilities`, que no cambia. Solo hay que ajustar la prueba si fija el contenido. No se agrega `aggregateRating`: las calificaciones son privadas del comercio y no se publican (historia, «No incluye»).

**Compuerta G-0. Textos aprobados tal cual por Oscar [humano, 2026-11-01, v3]:**
| Clave | Texto |
|---|---|
| `title` | Sabe qué opinan tus clientes |
| `description` | Después de cada pedido, tu cliente califica su experiencia en un minuto. Cada semana ves qué mejorar y a quién reconocer: atención, productos y tiempos. |
| `illustrations.feedbackQuestion` | ¿Cómo te fue con tu pedido? |
| `illustrations.feedbackGood` | Para reconocer: la atención |
| `illustrations.feedbackImprove` | Para mejorar: el tiempo de espera |
| FAQ `question` | ¿Cómo sé qué opinan mis clientes? |
| FAQ `answer` | Después de cada pedido, tu cliente puede calificarlo de 0 a 10 y dejar un comentario desde su billetera, desde un mensaje de WhatsApp o SMS, o con el QR de su pedido. En tu panel ves la calificación de cada semana y un análisis con IA de qué mejorar y qué reconocer. |

**Veracidad (regla 058 D-36):**
- La home solo afirma lo que hace el sistema.
- «Cada semana» es cierto por el informe semanal (§4.11).
- La pregunta frecuente explica los canales sin prometer que todos los clientes reciben mensaje: solo lo reciben quienes tienen billetera (R10).
- No se publican cuotas de IA ni de mensajes (política 030/045).
- Se publica en el mismo despliegue a PDN que activa la funcionalidad. Si H4 (IA) no llega a PDN, se quita «y un análisis con IA de…» de la pregunta frecuente.

## 5. Contratos nuevos o modificados

| Contrato | Cambio | Consumidores |
|---|---|---|
| `WhatsappQueue` / `SmsQueue` | `qrCampaignId` nulo permitido con `origin=TENANT` **solo** si `reason=ORDER_FEEDBACK`; motivo nuevo `ORDER_FEEDBACK` | worker (no lee `reason` ni campaña para enviar); vistas `/admin/whatsapp` y `/admin/sms` (columna Campaña → «Calificación de pedido»); filtros por campaña; dashboard de automáticos (`dashboard-metrics.ts`); reconciliación 056 (ignora filas sin `contactId`) |
| Plantilla `calificar_pedido` | Nueva: header `nombre_tenant`; body `nombre_usuario`, `numero_pedido`, `nombre_sede`, `fecha_pedido`; botón URL dinámico con `boton_calificacion` (38 caracteres, `^[A-Za-z0-9_-]{38}$`) en el índice `WHATSAPP_FEEDBACK_BUTTON_INDEX` (por defecto `"0"`) | worker W-01/W-02 |
| `GET /f/{token}` | Página pública nueva | proxy, enlaces |
| `GET /api/cron/order-feedback` | Nuevo, Bearer `CRON_SECRET` | Vercel cron |
| `GET /api/cron/feedback-report` | Nuevo, Bearer `CRON_SECRET` | Vercel cron |
| Server actions | `submitOrderFeedbackAction`, `submitWalletOrderFeedbackAction`, `getFeedbackLinkStateAction` (sesión), `listPendingWalletFeedbackAction`, `updateSedeOrderFeedbackAction`, `getExperienceAction`, `listOrderFeedbackAction`, `generateFeedbackReportAction`, `getFeedbackReportAction` | UI |
| `listMerchantMessagePreferences` / `setMerchantMessagesEnabled` | Incluye comercios con pedidos vinculados | billetera |
| Variables | `FEEDBACK_LINK_SECRET` (obligatoria, ≥ 32 bytes), `ORDER_FEEDBACK_MESSAGES_ENABLED`, `ORDER_FEEDBACK_NOW` (solo fuera de PDN), `ORDER_FEEDBACK_MAX_PER_RUN`, `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED`, `OPENROUTER_API_KEY`, `FEEDBACK_CLASSIFIER_MODEL`, `FEEDBACK_TOPIC_THRESHOLD`, `AI_FEEDBACK_REPORT_MODEL`; worker: `WHATSAPP_FEEDBACK_BUTTON_INDEX` | `runbooks/ENV.md` |

## 6. Seguridad — triage OWASP

### 6.1 Top 10 web (rulett-app, App Router)
| # | Ítem | ¿Aplica? | Control | Task |
|---|---|---|---|---|
| A01 | Control de acceso roto | Aplica | Admin con `tenantId` de sesión en todas las consultas (anti-IDOR); billetera exige `customerUserId === session.userId`; la página pública solo con token firmado; la interfaz nunca recibe `orderId` sin firma; el interruptor usa `updateMany` con `tenantId` | T-08, T-09, T-10, T-12, T-15 |
| A02 | Fallas criptográficas | Aplica | HMAC-SHA256 con secreto ≥ 32 bytes; `timingSafeEqual`; 96 bits de firma; el secreto nunca llega al cliente | T-03 |
| A03 | Inyección | Aplica | Prisma parametrizado; si hay SQL crudo, solo `Prisma.sql` (regla 064); comentarios escapados por React; **inyección de prompt**: los comentarios van como datos delimitados, la salida se valida con Zod y enums, la narrativa no ejecuta nada | T-05, T-13, T-14 |
| A04 | Diseño inseguro | Aplica | Una respuesta por pedido con CAS; tope diario del informe; reserva de cupo con lock; Turnstile sin sesión | T-09, T-14 |
| A05 | Configuración insegura | Aplica | `ORDER_FEEDBACK_NOW` se ignora en producción (`VERCEL_ENV==='production'`); los crons exigen `CRON_SECRET`; `/f/*` va con `noindex` | T-05, T-09 |
| A06 | Componentes vulnerables | Aplica (bajo) | Sin dependencias nuevas; OpenRouter vía `fetch` | T-14 |
| A07 | Identificación y autenticación | Aplica | Sesión `USER` para la billetera; la página pública no usa `auth()` en el render (066) | T-09, T-10 |
| A08 | Integridad de datos | Aplica | Firma del token; las respuestas de IA se validan con Zod antes de persistirse | T-03, T-14 |
| A09 | Registro y monitoreo | Aplica | Logs `scope: order-feedback` / `feedback-report` con ids y conteos, nunca teléfono, comentario ni token | T-05, T-14 |
| A10 | SSRF | No aplica | Las URLs externas son fijas (OpenRouter y Vertex); el usuario no controla ninguna URL | — |

### 6.2 API Security Top 10 (crons y actions)
| Ítem | Control |
|---|---|
| API1 BOLA | Igual que A01 |
| API2 Autenticación rota | Bearer `CRON_SECRET` en los crons |
| API3 Propiedades expuestas | DTO cerrado de la página pública, sin datos del cliente; la lista del admin no incluye el teléfono |
| API4 Consumo de recursos | `ORDER_FEEDBACK_MAX_PER_RUN`; lotes de 20 en la clasificación; timeouts de 15 s; 1 informe por día |
| API6 Flujos de negocio | Turnstile y una respuesta por pedido |
| API8 Configuración | Igual que A05 |
| API10 Consumo inseguro de APIs | Respuestas de OpenRouter y Gemini validadas con Zod; ante un fallo se usa el respaldo, sin datos parciales |

### 6.3 Privacidad (Habeas Data)
- Los datos del pedido siguen sin entrar a audiencias ni campañas. Se agrega un caso a `branch-order-audience-boundary.test.ts`: las respuestas de feedback tampoco entran.
- Los mensajes solo van al celular del **perfil de la billetera** (consentimiento 035), nunca al del pedido (R11).
- Sin cuenta, el aviso `calificacion-2026-11` se guarda en `consentVersion` (R36, pendiente de Legal).
- Antes de enviar a terceros se redactan teléfonos y correos.
- El admin ve el comentario sin datos del cliente (R37). Si el comentario incluye datos personales, la ofuscación por licencia (035) se aplica también al texto mostrado [SUPUESTO — T-15 usa el mismo helper de ofuscación si la licencia lo exige].

### 6.4 Hotspots a revisar en Sonar
- `crypto.createHmac` / `timingSafeEqual` (T-03).
- `fetch` a OpenRouter (T-14).
- `Math.random` prohibido: el token es determinista.
- Cookie de la pestaña: no es sensible; va con `sameSite=lax` y sin `httpOnly` porque la escribe el cliente (T-15).
- Expresiones de redacción sin retroceso catastrófico: sin `.*` anidados (T-14; hallazgos previos de 057/058).

## 7. Retrocompatibilidad
- **Esquema:** solo expand (columna con default, valores de enum al final, tablas nuevas). El código anterior ignora todo lo nuevo. `ALTER TYPE … ADD VALUE` no corre dentro de una transacción en versiones antiguas de PG; Neon PG ≥ 16 lo permite. Va en una migración propia si Prisma lo exige [verificar en T-02].
- **Colas:** una fila con `qrCampaignId` nulo y `origin TENANT` es nueva para las vistas. T-07 revisa las consultas que hacen `include` o `join` de la campaña y las que filtran por campaña (`WhatsappQueueTable`, panel SMS, `dashboard-metrics`) para que no fallen.
- **Worker:** se despliega antes que la app. Un worker viejo que reciba `calificar_pedido` caería en «plantilla desconocida» (solo header) y Meta respondería 132000. Por eso la app solo encola WA con `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=true`, que se activa después del worker.
- **finalize:** el gancho está dentro de la transacción y ante un error se revierte todo. Si `createOrderFeedbackInTx` lanzara por un bug, **finalizar fallaría**; por eso sus errores de datos (sede inexistente, etc.) se manejan sin lanzar y solo un fallo de BD revierte. Una prueba fija que finalizar sigue funcionando con el interruptor apagado y sin billetera.
- **Resumen:** mismos datos y componentes reorganizados. La URL `/admin` sin parámetro sigue funcionando.
- **Flags:** `ORDER_FEEDBACK_MESSAGES_ENABLED=false` deja la funcionalidad sin enviar nada.
- **Rollback:** apagar los flags; quitar los crons de `vercel.json`; las columnas y tablas quedan sin uso. Revertir la migración (`DROP TABLE` de las dos tablas y la columna; el valor de enum queda) se documenta en `closure.md`; no se ejecuta salvo decisión explícita.

## 8. Duplicación (Quality Gate ≤ 3 %)
- **Cupo restante por canal:** se extrae de `run.ts:140-157` un helper puro `computeChannelRemaining(limit, sent, pending)` y una consulta compartida en `src/lib/auto-messages/channel-quota.ts`. `run.ts` y `order-feedback/dispatch.ts` lo usan. Se refactoriza `run.ts` sin cambiar comportamiento; sus pruebas existentes no se tocan.
- **Respaldo SMS:** `order-feedback/reconcile.ts` no copia `reconcile.ts`. Comparte solo el helper de encolado de SMS si ya existe en `sms-queue` [verificar en T-06]; si no, lo escribe sobre la tabla propia y la duplicación se mide.
- **Formulario NPS:** un único componente (`OrderFeedbackForm`) para la página pública y la billetera.
- **Pestañas:** `TabLink` se reutiliza o se extrae a `src/components/ui/` si hoy es local a la billetera.

## 9. Testing (Vitest) — estrategia
Mocks obligatorios de `@/lib/prisma`, `@/auth`, `vertex-ai`, `fetch` (OpenRouter) y `whatsapp-worker-trigger`. No se refactoriza producción solo para probar (ADR-010-2). Cobertura de lo nuevo en `src/lib/**` ≥ 70 % (política del repo); el gate de Sonar pide ≥ 80 % sobre líneas nuevas.

| Módulo | Casos clave |
|---|---|
| `token.ts` | firma y verificación; token alterado, longitud incorrecta o caracteres fuera del alfabeto → null; otro secreto → null; `feedbackUrl` con host canónico; falta el secreto |
| `create.ts` | interruptor apagado → nada; sin billetera → NOT_APPLICABLE; con billetera → SCHEDULED con `dueAt`; idempotente; atribución (`createdById` / actor `CREATED` / actor `FINALIZED`) |
| `finalize.ts` | prueba de regresión: el gancho se llama solo en el éxito; `PaymentRejected` → no hay solicitud |
| `dispatch.ts` | ventana 07:59 / 08:00 / 20:59 / 21:00; cada `skipReason`; elección de canal (WA aprobada con cupo, sin plantilla → SMS, sin cupo → SMS, sin ninguno → NO_QUOTA); descuento en memoria; tope por corrida; flag apagado; `ORDER_FEEDBACK_NOW` ignorado en producción |
| `sms-text.ts` | ≤ 160 GSM con nombre largo, sin tildes, charset |
| `reconcile.ts` | cada transición; carrera con CAS (`smsQueueId` no nulo) |
| `answer.ts` | CAS una sola vez; vencido; sin Turnstile y sin sesión → error; billetera ajena → error; score fuera de rango; comentario de 501 caracteres |
| `metrics.ts` | NPS del escenario (6/2/2 → 40); sin respuestas → null; franjas; canales; rankings con n<5 ocultos |
| `classify/*` | parseo y validación; umbral 0,7; respaldo OpenRouter→Gemini; timeouts; `redact.ts` (teléfonos, correos, números, sin ReDoS) |
| `ai-quota.ts` / `report.ts` | sin cupo; reserva y borrado al fallar; segundo informe del día rechazado; semanal idempotente |
| `merchant-list.ts` | une cupones y pedidos sin duplicar |
| copy | prueba estática de literales (patrón `customer-order/copy.ts`) y términos prohibidos del Resumen |
| home (v2) | `home-copy.test.ts`: el ítem `customer-feedback` y la pregunta `feedback` existen con los textos aprobados en G-0, sin cifras de cuotas; `home-sources.test.ts`: sin literales nuevos en `HomeHighlights.tsx` |

**E2E (067, obligatorio):** escenarios nuevos en `e2e/` (T-16):
1. Comensal con sesión pide, el personal confirma y el cajero finaliza (Android emulado); el comensal ve «Por calificar» en la billetera y califica.
2. Sin sesión: abre `/f/{token}` (token generado por la suite con el secreto del ambiente), califica, ve la invitación y Descubre; reabrir muestra «ya calificado».
3. El admin ve las 4 pestañas y la pestaña Experiencia con NPS.
4. (v2) La home muestra el destacado «Sabe qué opinan tus clientes» y la pregunta frecuente; se agrega al escenario de home existente si lo hay [verificar en T-19].

El envío real de WA/SMS no entra en E2E; se prueba en lab.

## 10. Riesgos técnicos
1. **Contrato de OpenRouter** para modelos de decisión no verificado (preguntas tipadas). Si el spike falla, Gemini queda como único clasificador y la decisión va a `decisions.md`.
2. **Carrera de cupo de IA** con cupones y SMS (§4.11), aceptada.
3. **Pedidos nocturnos** salen al día siguiente a las 08:00 (decisión de Oscar). Si el volumen supera 50 WA por disparo del worker, el retraso crece (operación).
4. **Callers de `finalizeOrderInTx`** sin leer: T-04 debe listarlos y confirmar que no existe otro camino a FINALIZED.
5. **PDN en caso B** (sin historial de Prisma): la migración de 068 se aplica con el runbook de operación del proyecto, después de la línea base.
