SDD: 17tnjrajf9b · v5 · 2026-11-02

# Specs — 068 Calificación de pedidos

Las reglas R1–R50 son las de la historia (`rulett/historias/feedback-pedidos.md`). Los supuestos de la historia los confirmó Oscar en bloque [humano, 2026-11-01]. Aquí se precisa el comportamiento técnico de cada caso.

## 1. Comportamiento caso por caso

### 1.1 Solicitud
| Caso | Resultado |
|---|---|
| Pedido → FINALIZED con la sede encendida y `customerUserId` | `OrderFeedback` en `SCHEDULED`, `dueAt=closedAt+1h`, `expiresAt=closedAt+7d` |
| Pedido → FINALIZED con la sede encendida, sin `customerUserId` (personal o comensal sin sesión) | `OrderFeedback` en `NOT_APPLICABLE`, sin `dueAt` |
| Sede apagada | No se crea la solicitud |
| `PaymentRejected` al finalizar | Rollback: no hay solicitud |
| Finalizar dos veces (reintento o carrera) | El CAS de finalize falla, o `orderId @unique` impide una segunda solicitud |
| Pedido → CANCELLED | No se crea la solicitud |
| Corrección de pago posterior | No se crea otra solicitud |
| Pedido finalizado antes del despliegue | No tiene solicitud; su enlace muestra `unavailable` |

### 1.2 Despacho (cron cada 15 min)
| Condición (en este orden) | Estado final |
|---|---|
| Flag `ORDER_FEEDBACK_MESSAGES_ENABLED` apagado | El cron no hace nada |
| Hora de Bogotá fuera de [08:00, 21:00) | El cron no hace nada |
| `answeredAt` no nulo | `SKIPPED/ANSWERED` |
| `expiresAt <= now` | `SKIPPED/EXPIRED` |
| Sede apagada en este momento | `SKIPPED/DISABLED` |
| El comercio no puede operar por la suscripción (los legacy sí pueden) | `SKIPPED/SUBSCRIPTION` |
| La billetera no tiene celular | `SKIPPED/NO_PHONE` |
| Baja activa (comercio, msisdn) | `SKIPPED/OPT_OUT` |
| Plantilla aprobada y queda cupo de WA | `QUEUED_WHATSAPP` (fila WA) |
| Queda cupo de SMS | `QUEUED_SMS` (fila SMS) |
| No queda cupo en ningún canal | `SKIPPED/NO_QUOTA` |

- El mensaje **no** consulta ni crea `MessageContact`: no cuenta en los topes y no desplaza a otros mensajes.
- Las filas de cola usan `origin TENANT`, `trigger AUTOMATIC`, `reason ORDER_FEEDBACK` y `qrCampaignId null`. Descuentan del cupo porque son `TENANT`.

### 1.3 Reconciliación
| Desde | Fila de cola | Hacia |
|---|---|---|
| QUEUED_WHATSAPP | WA SENT | SENT_WHATSAPP |
| QUEUED_WHATSAPP | WA FAILED, con cupo de SMS, sin baja, vigente y sin respuesta | QUEUED_SMS (fila SMS nueva) |
| QUEUED_WHATSAPP | WA FAILED, sin alguna de las condiciones anteriores | NOT_DELIVERED (o SKIPPED/ANSWERED, EXPIRED u OPT_OUT según el motivo) |
| QUEUED_WHATSAPP / QUEUED_SMS | CANCELLED | SKIPPED/OPT_OUT |
| QUEUED_SMS | SMS SENT | SENT_SMS |
| QUEUED_SMS | SMS FAILED | NOT_DELIVERED |
| cualquiera | fila PENDING o PROCESSING | sin cambio |

### 1.4 Página `/f/{token}`
| Estado | Condición | Se muestra |
|---|---|---|
| invalid | firma o formato inválido, o el pedido no existe | «Este enlace no es válido» |
| not_ready | pedido en IN_PROGRESS, PENDING_CONFIRMATION, CREATED o DELIVERED | «Podrás calificar cuando tu pedido termine» + datos del pedido |
| cancelled | CANCELLED | «Este pedido no se puede calificar» |
| unavailable | FINALIZED sin `OrderFeedback` | «Este pedido no tiene calificación disponible» |
| expired | `expiresAt <= now` y sin respuesta | «El plazo para calificar terminó» |
| answered | `answeredAt` no nulo | «Ya calificaste este pedido. ¡Gracias!» |
| open | lo demás | Formulario |

En todos los estados válidos se muestran el comercio, la sede, #consecutivo, la modalidad o «Atendido por el personal», la fecha y hora de Bogotá de `closedAt` (o de `createdAt` si aún no cierra) y los productos con su cantidad. **Nunca** los datos del cliente.

### 1.5 Responder
| Caso | Resultado |
|---|---|
| Score entero 0..10, comentario ≤ 500 (se recorta), con Turnstile válido o con sesión USER | Guarda la respuesta; `answeredVia=LINK` (página) o `WALLET` (billetera) |
| Sin score | `{ error: 'score_required' }` |
| Score fuera de rango o no entero | `{ error: 'invalid' }` |
| Sin sesión y sin Turnstile, o Turnstile inválido | `{ error: 'bot_check' }` |
| Ya respondida, por una carrera de dos envíos | El primero gana; el segundo recibe `{ error: 'answered' }` |
| Vencida | `{ error: 'expired' }` |
| Desde la billetera, con un `customerUserId` distinto al de la sesión | `{ error: 'not_found' }` |
| Con sesión USER que no es el dueño, desde el enlace | Se acepta la respuesta, con `answeredUserId`; **no** vincula el pedido |

### 1.6 Billetera
- «Por calificar» muestra los pedidos de `customerUserId=sesión` con `answeredAt null`, `expiresAt>now` y FINALIZED: máximo 20, ordenados por `closedAt` descendente.
- `?calificar={orderId}` abre directamente la hoja de ese pedido si pertenece al usuario. Si no le pertenece, se ignora.
- Baja: la lista de comercios es la unión de los cupones (`coupon.tenantId`) y los pedidos con `customerUserId=sesión`. `setMerchantMessagesEnabled` rechaza un `tenantId` que no esté en esa unión.

### 1.7 Cifras e informe
- **NPS** = `round(100×(P−D)/N)` con P = 9–10 y D = 0–6. Si N = 0, se muestra «Sin calificaciones».
- **Periodo:** la semana va de lunes 00:00 a domingo 23:59:59 en Bogotá y se filtra por `answeredAt`. El NPS por modalidad o franja usa la hora de `closedAt`.
- **Rankings:** n ≥ 5 por persona o producto dentro del periodo.
  - «Atendió» es `attendedById`, que puede ser mesero o administrador.
  - «Cobró» es `finalizedById`.
  - Un producto se agrupa por `productId`; si el `productId` es nulo, por `productName` normalizado.
- **Temas:** se cuentan solo las etiquetas con p ≥ 0,7; el resto va a «Sin clasificar».
- **Informe semanal** (lunes 06:00, con reintento el martes para lo faltante), solo si:
  - hay al menos una respuesta en la semana;
  - el comercio puede operar;
  - `maxAiPromptsPerMonth > 0`;
  - no existe ya el informe WEEKLY de esa semana.
- **A demanda:** los últimos 7 días hasta hoy. Un intento por día y comercio: el segundo devuelve `{ error: 'daily_limit' }` y no cobra.
- **Sin cupo de IA:** `{ error: 'no_quota' }`; el semanal se omite y se registra en el log. Las cifras sin IA siguen visibles.
- **Falla de los dos proveedores en la narrativa:** el informe queda `FAILED` con `metrics`, se borra la `AiPromptUsage` y se muestran «Cifras sin análisis».
- **Pantalla:** los últimos 12 informes.

### 1.8 Resumen
- Pestañas `ventas` (por defecto), `premios`, `mensajes` y `experiencia`. Un valor inválido en `?tab` cae en `ventas`.
- Sin `?tab`, manda la cookie.
- El banner de suscripción o prueba y los videos se muestran fuera de las pestañas.
- Solo se consultan los datos de la pestaña activa.

### 1.9 Home (v2; textos aprobados en G-0, v3)
- `/` muestra en «Lo que más se nota» la tarjeta «Sabe qué opinan tus clientes» con su ilustración, junto a las tres que ya existen, y la pregunta frecuente «¿Cómo sé qué opinan mis clientes?». Los textos son los aprobados en G-0.
- La tarjeta no muestra cifras, nombres ni datos reales.
- En 360 px se ven en una columna; en tablet, en dos; en escritorio, en cuatro (o 2×2 si la verificación de T-19 lo exige).
- Lighthouse de la home sin regresión: SEO 100 y accesibilidad ≥ 95 (metas de 058/060).

## 2. Contratos en detalle

### 2.1 `templateParams` de `calificar_pedido`
```json
{
  "nombre_tenant": "La Previa",
  "nombre_usuario": "Ana",
  "numero_pedido": "128",
  "nombre_sede": "Sede Centro",
  "fecha_pedido": "1 nov 2026",
  "boton_calificacion": "AbCdEfGhIjKlMnOpQrStUv0123456789abcdEF"
}
```
- Header: `nombre_tenant`. Body en orden: `nombre_usuario`, `numero_pedido`, `nombre_sede`, `fecha_pedido`. Botón URL dinámico `https://www.rulett.app/f/{{1}}`, índice `WHATSAPP_FEEDBACK_BUTTON_INDEX`, con texto = `boton_calificacion`.
- Validación: todos los valores son texto no vacío. `boton_calificacion` debe cumplir `^[A-Za-z0-9_-]{38}$`. Si algo falla, la fila queda `FAILED` con «templateParams vacío» y no se llama a Meta.
- Fixture compartido: `test/fixtures/feedback-contract.ts` en el worker y su réplica en rulett-app.

### 2.2 Respuesta de los crons
- `order-feedback`: `{ ok: true, skipped?: 'disabled'|'outside_window', queuedWhatsapp, queuedSms, skippedBy: { ANSWERED, EXPIRED, DISABLED, SUBSCRIPTION, NO_PHONE, OPT_OUT, NO_QUOTA }, reconciled, truncated }`
- `feedback-report`: `{ ok: true, generated, failed, skippedNoQuota, skippedNoData, truncated }`

### 2.3 Clasificación persistida (`OrderFeedback.classification`)
```json
{ "v": 1, "provider": "openrouter|gemini", "model": "…",
  "topics": [ { "topic": "ATTENTION", "tone": "NEGATIVE", "p": 0.86 } ] }
```

## 3. Matriz de trazabilidad

| CA | Escenario (historia) | Reglas | Tasks | Prueba |
|---|---|---|---|---|
| CA-01 | Sedes existentes encendidas | R1 | T-02 | migración (SQL) + lab |
| CA-02 | Comercios nuevos encendidos (registro / Super Admin) | R2 | T-02, T-12 | `tenant-bootstrap` (default) + lab |
| CA-03 | Sede apagada | R4 | T-04, T-12 | `create.test` |
| CA-04 | Pedido con billetera recibe WA | R10–R14 | T-05, T-07, W-01…W-03 | `dispatch.test` + lab |
| CA-05 | Sin cupo de WA → SMS | R13, R14 | T-05, T-06 | `dispatch.test`, `reconcile.test` |
| CA-06 | Sin cupo de ningún canal | R14 | T-05 | `dispatch.test` |
| CA-07 | Pedido sin billetera no recibe mensaje | R10 | T-04 | `create.test` |
| CA-08 | Cliente dado de baja | R16 | T-05, T-06 | `dispatch.test` |
| CA-09 | No consume los topes de 056 | R15 | T-05 | `dispatch.test` (no se llama a `reserveContact`) |
| CA-10 | Cancelado no se califica | R7 | T-04, T-09 | `create.test`, `page-state.test` |
| CA-11 | Ya calificó antes del envío | R17 | T-05 | `dispatch.test` |
| CA-12 | Califica sin cuenta y recibe la invitación | R26, R28, R36 | T-09 | `answer.test` + E2E-2 |
| CA-13 | Con sesión abre la billetera | R25 | T-09, T-10 | E2E-1 |
| CA-14 | Pedido aún sin finalizar | R23 | T-09 | `page-state.test` |
| CA-15 | Enlace vencido | R21 | T-09 | `page-state.test`, `answer.test` |
| CA-16 | Segunda calificación | R24 | T-09 | `answer.test` + E2E-2 |
| CA-17 | Falta el 0 a 10 | R29 | T-09 | `answer.test` |
| CA-18 | La página muestra los datos del pedido | R30 | T-09 | `page-dto.test` |
| CA-19 | Calificaciones pendientes en la billetera | R33 | T-10 | `wallet-feedback.test` + E2E-1 |
| CA-20 | Baja en un comercio con solo pedidos | R34 | T-08 | `merchant-list.test` |
| CA-21 | NPS de la semana (6/2/2 → 40) | R38 | T-13 | `metrics.test` |
| CA-22 | Informe semanal descuenta 1 prompt | R39, R42, R44 | T-14 | `report.test` + lab |
| CA-23 | Sin cupo de IA | R45 | T-14, T-15 | `report.test` |
| CA-24 | Tope del informe a demanda | R43 | T-14 | `report.test` |
| CA-25 | Falla la IA | R46 | T-14 | `report.test` |
| CA-26 | Ranking solo con muestra suficiente | R41 | T-13 | `metrics.test` |
| CA-27 | Atribución desde el pedido | R31 | T-04, T-13 | `create.test`, `metrics.test` |
| CA-28 | Pestañas del Resumen | R48, R49 | T-15 | `resumen-tab.test` + E2E-3 |
| CA-29 | (v2) La home anuncia la calificación de pedidos con los textos de G-0 | — (alcance 12) | T-19 | `home-copy.test`, `home-sources.test` + revisión visual en 360/768/1280 px |

## 4. Delta a `openspec/specs/*` (se fusiona al cerrar)
- **domain_model.md:**
  - `Branch.orderFeedbackEnabled`.
  - Agregados `OrderFeedback` y `FeedbackReport` con sus enums.
  - `MessageReason.ORDER_FEEDBACK`.
  - Invariantes: una solicitud por pedido; una respuesta; vigencia de 7 días; mensajes solo con billetera y al celular del perfil; fuera de los topes de 056.
- **contracts.md:**
  - Excepción `qrCampaignId` nulo con `TENANT` + `ORDER_FEEDBACK`.
  - Plantilla `calificar_pedido`.
  - Crons `order-feedback` y `feedback-report`.
  - Variables nuevas.
- **integrations.md:** OpenRouter (clasificador) y el tercer uso de Gemini (clasificación y narrativa); worker `calificar_pedido`.
- **security.md:**
  - Token firmado.
  - Página pública sin `auth()` en el render.
  - Turnstile al calificar sin sesión.
  - Redacción antes de la IA.
  - Frontera de datos del pedido intacta.
  - Reserva de cupo de IA con lock.
- **ui_and_brand.md:** Resumen en 4 pestañas (reemplaza el orden fijo de 062 H12); página `/f`; «Por calificar» en la billetera; QR en el PDF; home con 4 destacados y la pregunta frecuente de calificación (v2).
- **seo.md:** `/f/*` con `noindex` y fuera del sitemap; `llms.txt` con la capacidad nueva si lista capacidades (v2).
- **system_architecture.md:** ruta pública `/f/*` y crons.
- **testing.md:** escenarios E2E nuevos.
- **regression.md:** casos que defina `/pruebas-lab`.

## 5. Cambios v3 (validación del plan)
- Respaldo de `nombre_usuario`: «cliente».
- Host del SMS por ambiente: `getSiteUrl()`.
- El botón de WhatsApp apunta siempre a `www.rulett.app`, porque la URL base queda fija en la plantilla de Meta. En lab se verifica solo la entrega; el botón completo se prueba en PDN (T-18).
- El documento del pedido (texto, WhatsApp, impresión y PDF) lleva el enlace solo si el pedido está Finalizado con la solicitud vigente. El PDF lleva además el QR.
