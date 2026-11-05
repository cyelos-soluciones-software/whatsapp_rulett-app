SDD: 17tnjrajf9b · v10 · 2026-11-02

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

### 1.10 Envío manual (v6)
| Caso | Resultado |
|---|---|
| Cajero o administrador, pedido FINALIZED con solicitud `SCHEDULED`, dentro de la franja | Se encola de inmediato por WA o SMS según el cupo; la solicitud queda `QUEUED_*` con `dispatchTrigger=MANUAL`; la fila de cola con `trigger=MANUAL`; el cron ya no la envía |
| Igual, fuera de la franja | `dueAt=now`, `MANUAL`; mensaje «Se enviará a las 08:00»; la toma el cron de las 08:00 |
| Solicitud ya `QUEUED_*`, `SENT_*`, `SKIPPED`, `NOT_DELIVERED` o respondida | No envía; responde `already` con el estado |
| Solicitud `NOT_APPLICABLE` (sin billetera) | No envía; aviso «Este cliente no tiene billetera. Comparte el resumen por WhatsApp: ya lleva el enlace para calificar» |
| Sin solicitud (sede apagada o pedido anterior a 068) | «Este pedido no tiene calificación disponible» |
| Pedido no Finalizado | Sin bloque ni botón; la acción responde `not_finalized` |
| Mesero | Ve el estado, no el botón; la acción responde «no autorizado» |
| Cajero de otra sede o administrador de otro comercio | «Pedido no encontrado» |
| Baja, sin cupo, sin teléfono, suscripción vencida, vencida | Misma omisión que el automático; el mensaje dice el motivo |
| `ORDER_FEEDBACK_MESSAGES_ENABLED` apagado | Botón deshabilitado con «Los envíos de calificación están desactivados» |
| Doble clic o carrera con el cron | Un solo envío; el segundo recibe `already` |

### 1.11 Comensal sin billetera, baja y diseño de `/f` (v8)
| Caso | Resultado |
|---|---|
| Pedido del comensal sin sesión con `pedido-2026-11`, finalizado, sede encendida | `SCHEDULED`, `ORDER_CONSENT`; a la hora sale WA/SMS al celular del pedido con su primer nombre |
| Pedido del comensal con `pedido-2026-10` (antes del despliegue) | `NOT_APPLICABLE` |
| Pedido del mesero o del administrador | `NOT_APPLICABLE` |
| Celular del pedido no válido para msisdn | `SKIPPED/NO_PHONE` |
| Celular con baja en el comercio | `SKIPPED/OPT_OUT` |
| Envío manual (H6) de un pedido `ORDER_CONSENT` | Igual que con billetera |
| La hoja del pedido muestra la autorización | Con el texto nuevo; el pedido guarda `pedido-2026-11` |
| «No quiero recibir más mensajes de {comercio}» en `/f` | Baja del msisdn del contacto; cancela los pendientes; no muestra el número; ya no salen ni la calificación ni los automáticos ni los manuales de ese comercio a ese celular |
| `/f` de un pedido `NOT_APPLICABLE` | Sin enlace de baja |
| `/f` de una sede con landing de fondo #1A1A2E y botón #FF6B00 | La página usa esos colores, las tipografías y el logo de la landing |
| `/f` de una sede sin landing | Colores por defecto de la marca |
| Color inválido guardado | Valor por defecto para ese color |

### 1.12 Ajustes del programa de vendedores (v10, H8)

#### Contraseña
`step3.accessHelp` usa la constante (12). Ningún texto de contraseña en `src/` dice un mínimo distinto.

#### Código desde la URL
| Llegada | Campo |
|---|---|
| `/registro?codigo=X` con X válido | Bloqueado (`readOnly`, con candado). Muestra «Te recomendó {Nombre I.}» y «Este código viene del enlace de tu vendedor.». No consulta; envía X. |
| `/registro?codigo=X` válido, pero el servidor lo rechaza al verificar el correo | Se desbloquea y muestra el error (D-65) |
| `/registro?codigo=X` con X inválido | Editable, con el error de hoy |
| `/registro` sin parámetro | Editable y opcional |

#### Plazo de pago
- Registro del vendedor: «…en los 5 primeros días hábiles del mes siguiente…».
- Contrato v3, cláusula 7.2: «cinco (5)».
- Vendedor con la v2 aceptada: ve el aviso obligatorio en `/vendedor` y no puede navegar ni guardar hasta aceptar la v3. El evento `POLICY_ACCEPTED` guarda `previousVersion`.
- Quien estaba a mitad del registro cuando se desplegó recibe «los datos cambiaron, pide otro código» (D-68).

#### Pagos del portal
| Estado | Texto nuevo |
|---|---|
| Por liquidar | «Entra en la liquidación de {mes año}» · «Se paga en los 5 primeros días hábiles de {mes siguiente año}» |
| En una liquidación generada y no pagada | «En la liquidación {número} · se paga en los 5 primeros días hábiles de {mes siguiente}» |
| Pagado / omitido / histórico | Sin cambio |

- El mes se calcula en hora de Bogotá con `reviewedAt` (aprobación).
- Inicio y Liquidaciones muestran: «Liquidamos cada mes cerrado y pagamos en los 5 primeros días hábiles del mes siguiente.»

#### Análisis del reporte de QA
- El % por comercio es `TenantSubscription.salesCommissionPercent` y se lee al aprobar:
  - Wompi: dentro de la transacción [repo: src/lib/billing/apply-wompi-payment.ts:137-184].
  - Transferencia: en el mismo request [repo: src/lib/billing/payment-receipt-process.ts].
- No hay copia previa del %, ni caché, ni vigencias. Guardar la suscripción escribe el % [repo: src/actions/superadmin/subscription.ts:150-186].
- **Causa más probable:** QA cambió el % por defecto del vendedor, que solo se copia a los comercios que se registran con su código. Es así por diseño de 063 y Oscar decidió mantenerlo.
- **Hallazgo del implementador (D-71):** en transferencia, el % se lee antes de `$transaction`. Si se guarda la suscripción en el mismo instante en que se aprueba, puede salir el anterior. No explica el reporte de QA. Se registra y no se corrige en H8.
- **Consulta de diagnóstico** (solo lectura, lab):
  ```sql
  SELECT pr.id, pr."reviewedAt", pr."commissionPercentSnapshot", ts."salesCommissionPercent", ts."updatedAt", sa."defaultCommissionPercent"
  FROM "PaymentReceipt" pr
  JOIN "TenantSubscription" ts ON ts."tenantId" = pr."tenantId"
  LEFT JOIN "SalesAgent" sa ON sa.id = ts."salesAgentId"
  WHERE pr."tenantId" = '<id>' AND pr.status = 'APPROVED'
  ORDER BY pr."reviewedAt";
  ```
  T-34 revisa los nombres de las columnas contra `schema.prisma`.

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
| CA-30 | (v6) El cajero envía la calificación de un pedido con billetera y sale de inmediato | — | T-21, T-22 | `staff-dispatch.test` + E2E-5 |
| CA-31 | (v6) Lo enviado a mano no vuelve a salir por el cron | — | T-21 | `staff-dispatch.test`, `dispatch.test` |
| CA-32 | (v6) Un pedido sin billetera muestra el aviso y no envía | R10 | T-22, T-23 | `staff-dispatch.test` |
| CA-33 | (v6) Fuera de la franja queda para las 08:00 | franja | T-21 | `staff-dispatch.test` |
| CA-34 | (v6) Una ya enviada o respondida no se reenvía | R7 | T-21 | `staff-dispatch.test` |
| CA-35 | (v6) El mesero no ve el botón ni puede enviar | A01 | T-22, T-23 | `order-feedback-staff-action.test` |
| CA-36 | (v6) Respeta la baja y el cupo | R14, R16 | T-21 | `staff-dispatch.test` |
| CA-37 | (v8) Comensal sin billetera con la autorización nueva recibe el mensaje | — | T-24, T-25 | `order-feedback-create.test`, `dispatch.test` |
| CA-38 | (v8) Pedido con la autorización anterior o del personal no recibe | R10 | T-25 | `order-feedback-create.test` |
| CA-39 | (v8) La autorización muestra el texto nuevo y guarda `pedido-2026-11` | — | T-24 | `customer-order` copy + `create.test` + E2E pedido-comensal |
| CA-40 | (v8) Baja desde `/f` | R16 | T-26 | `feedback-link-opt-out.test` |
| CA-41 | (v8) `/f` usa los colores, tipografías y logo de la landing | — | T-27 | `page-state.test` + revisión visual |
| CA-42 | (v8) Sede sin landing o color inválido → por defecto | — | T-27 | `page-state.test` |
| CA-43 | (v8) La frontera de audiencias sigue: los datos del pedido no entran a campañas | 062 | T-25 | `branch-order-audience-boundary.test` |
| CA-29 | (v2) La home anuncia la calificación de pedidos con los textos de G-0 | — (alcance 12) | T-19 | `home-copy.test`, `home-sources.test` + revisión visual en 360/768/1280 px |
| CA-44 | (v10) El registro del vendedor dice el mismo mínimo de contraseña que valida (12) | — | T-29 | copy + búsqueda estática |
| CA-45 | (v10) `/registro?codigo=` válido bloquea el campo; el alta queda con ese vendedor | — | T-30 | UI + E2E `@CA-45` |
| CA-46 | (v10) Un código inválido en la URL o la URL sin parámetro dejan el campo editable; si el servidor rechaza el código, se desbloquea | — | T-30 | UI |
| CA-47 | (v10) El registro y el portal dicen 5 primeros días hábiles; no queda ninguna mención a 3 | — | T-31 | copy + búsqueda estática |
| CA-48 | (v10) Un vendedor con la v2 aceptada debe aceptar la v3, cuya cláusula 7.2 dice cinco (5) | — | T-32 | aviso obligatorio + copy |
| CA-49 | (v10) Un pago aprobado el 15 de nov de 2026 dice «liquidación de noviembre de 2026 · se paga en los 5 primeros días hábiles de diciembre de 2026». Uno aprobado el 30 de nov a las 23:30 (hora de Bogotá) cae en noviembre. Uno de diciembre se paga en enero de 2027 | — | T-33 | puras + UI |
| CA-50 | (v10) Bajar el % de la suscripción hace que el siguiente pago (Wompi o transferencia) se liquide con el % nuevo y el anterior conserve el suyo | — | T-34 | integración |
| CA-51 | (v10) La ficha del vendedor explica el alcance de su % por defecto; el % de la suscripción muestra el valor guardado | — | T-35 | UI |

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
