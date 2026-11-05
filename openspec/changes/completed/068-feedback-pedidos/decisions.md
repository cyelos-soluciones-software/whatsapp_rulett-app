SDD: 17tnjrajf9b · v10 · 2026-11-02

# Decisions — 068

Desviaciones y decisiones que se aceptaron al validar el plan de implementación de rulett-app [implementador + validador; Oscar decide D-1, D-2, D-7 y G-0, 2026-11-01].

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| D-1 | QR del PDF | Agregar `qrcode` + `@types/qrcode` (versión exacta) y dibujar el QR en vectores en jsPDF. ADR-068-8 reescrito | El PDF se genera en el servidor (`branch-order.ts:973`) y `qrcode.react` no expone su codificador | Oscar (opción a) |
| D-2 | Pruebas de finalize | Se agrega solo el delegado `orderFeedback` (y `branchOrderStatusEvent.findFirst` si hace falta) a los mocks de `branch-order-finalize-payment.test.ts` y `branch-order.test.ts`, sin cambiar aserciones | El gancho llama a delegados que el mock no tiene; proteger producción para las pruebas lo prohíbe ADR-010-2 | Oscar |
| D-3 | Proxy `/f/*` | Solo se agrega a `isSessionFreePublicPath`; el matcher no cambia | Igual que `/l` y `/c` en 066 | Validador |
| D-4 | T-07 | Las vistas ya toleran filas sin campaña (`?? '—'`). El trabajo es de etiquetas (`REASON_LABELS`, que no avisa en tipos) y validación. `calificar_pedido` **no** entra a `WHATSAPP_TEMPLATES` | Evita que aparezca en el envío manual | Validador |
| D-5 | Host del SMS | Se deriva de `getSiteUrl()` según el ambiente | Un token de lab no abre en PDN | Validador |
| D-6 | Botón WA en lab | La URL base queda fija en Meta (`www`): en lab solo se verifica la entrega; el botón completo se prueba en PDN | Limitación de la plantilla | Validador |
| D-7 | `nombre_usuario` vacío | «cliente» | Con «Hola» como respaldo, el mensaje diría «Hola Hola» | Oscar |
| D-8 | Descubre después de calificar | `getTopNationalCampaigns`, 3 resultados | Descubre lista campañas, no sedes | Validador |
| D-9 | Enlace en el documento | `feedbackUrl?` opcional en el contexto; el texto, el WhatsApp, la impresión y el PDF lo llevan solo si el pedido está Finalizado con solicitud vigente | Las instantáneas existentes no cambian | Validador |
| D-10 | Orden | T-05 y T-06 juntas, después de T-07. T-01 (spike, máximo 4 h) antes de T-14. Prueba de la frontera de audiencias en T-13. Escenario E2E de home en T-19 si existe | Dependencias reales | Validador |
| G-0 | Textos de la home | Aprobados tal cual (design §4.13) | — | Oscar |

## Validación del plan del worker (v4, 2026-11-02)

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| WD-1 | Rama | Se trabaja directo en `cloud-run`. Solo se hace push con las pruebas y el typecheck en verde | El cambio es retrocompatible y la app no encola `calificar_pedido` hasta activar su flag | Oscar |
| WD-2 | `Config` | `whatsappFeedbackButtonIndex` es requerido. A los objetos de configuración de las pruebas existentes se les agrega solo el campo | Tipos estrictos, igual que el índice de las v2; cambio aditivo (criterio D-2) | Oscar |
| WD-3 | Logs con PII | Nueva W-05: el worker deja de registrar el nombre y el teléfono en todos los envíos | `processor.ts:21-28` registraba `userName`; con 068 entran comensales y la regla de 062 prohíbe nombres en los logs | Oscar |
| WD-4 | Armado del botón | `buildTemplateComponents` recibe una segunda configuración de botón, no se amplía `ButtonOptions`; las ramas se eligen por nombre exacto (`calificar_pedido` antes de `isV2Template`; en `parseTemplateParams`, entre el aviso de suscripción y la v2) | La rama v2 y su validación UUID quedan idénticas | Implementador, aceptado por el validador |
| WD-5 | W-04 en dos partes | Documentación ahora. El despliegue en Cloud Run y el envío real en lab los hace Oscar después de T-00. `closure.md` y `git mv` van al cierre de 068 | Depende de la aprobación de Meta | Implementador, aceptado por el validador |

## Durante la implementación del worker (2026-11-02)

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| WD-6 | `maskPhone` | Se eliminó `src/lib/mask-phone.ts` y su `describe` en `test/processor.test.ts` (3 pruebas) | Tras W-05 ningún log usa el teléfono: era código muerto | Implementador |
| WD-7 | Aserción existente de logs | En `processor.test.ts`, la prueba «envía una fila de plataforma…» afirmaba `userPhone === '***4567'`; ahora afirma que el campo no está. Es el único cambio en una aserción existente (criterio de W-05) | El campo se retiró del log | Implementador |
| WD-8 | Campos del log | «Procesando mensaje» conserva `queueId`, `tenantId`, `campaignId` y `templateName` (ninguno es dato personal). «Mensaje enviado» y «Fallo al enviar mensaje» suman `templateName` y `status` (`SENT` / `FAILED`); el fallo conserva `statusCode` y el error de Meta con su `code` | W-05: id de fila, plantilla, estado y código de Meta | Implementador |
| WD-9 | `scripts/seed.ts` | No se tocó: imprime el teléfono y el nombre de las filas **de demostración** que él mismo crea en Docker local. No es un log del worker desplegado | Fuera del alcance de W-05 | Implementador |
| WD-10 | Lista `KEYS` de `config.test.ts` | Se agregaron las dos variables nuevas para aislar el entorno de cada prueba; ninguna aserción cambió | Mismo criterio aditivo de WD-2 | Implementador |

## Validación del plan H6 (v7, 2026-11-02)

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| D-32 | Origen del trigger | `dispatchFeedbackRow` lee `row.dispatchTrigger` en vez de recibirlo como parámetro. Lo pedido de noche sale `MANUAL` en la corrida de las 08:00 | Sin esto, CP-41 saldría `AUTOMATIC` | Implementador, aceptado por el validador |
| D-33 | Respaldo manual | `reconcile.ts` propaga `dispatchTrigger`: el SMS de respaldo de un envío manual también sale `MANUAL` | Coherencia del rastro en las colas y el dashboard | Implementador, aceptado |
| D-34 | DTO del personal | `feedback?: { status, trigger, dueAt, skipReason, answered }`, sin `sentChannel` (el canal va en `status`) y sin teléfono ni comentario. `feedbackMessagesEnabled` va en `BranchOrderView` | Mostrar la hora y el motivo; el interruptor es del servidor, no del pedido | Implementador, aceptado |
| D-35 | Respuesta de la acción | `{ outcome, order }` y `onOrderChange`, más `revalidatePath` | Patrón de las acciones del pedido | Implementador, aceptado |
| D-36 | CAS | `{ dispatchStatus: 'SCHEDULED', answeredAt: null }` | `answer.ts` no cambia `dispatchStatus`; sin esto se enviaría una solicitud ya respondida | Implementador, aceptado |
| D-37 | Disparo del worker | Se dispara en `after()`; si falla, el cron horario del worker procesa la fila | El cajero no espera la llamada externa | Implementador, aceptado |
| D-38 | Botón en un pedido sin billetera (resuelve la contradicción entre D-28 y design §4.14) | El botón se ve **deshabilitado** con el aviso «Este cliente no tiene billetera. Comparte el resumen por WhatsApp: ya lleva el enlace para calificar». No hace ninguna petición. La acción igual responde `no_wallet` si alguien la llama directamente | Cumple D-28 («botón con aviso») sin un clic que no hace nada | Validador, según la decisión de Oscar |
| D-39 | Suscripción vencida | Se ve el estado y no el botón, igual que las demás mutaciones del pedido. Si alguien llama la acción, se omite con `SUBSCRIPTION` | Mismo guardián | Implementador, aceptado |
| D-40 | E2E | `buildAppEnv` agrega `ORDER_FEEDBACK_MESSAGES_ENABLED=true` y `ORDER_FEEDBACK_NOW` = hoy a las 12:00 de Bogotá. E2E-5 verifica `QUEUED_SMS` / `MANUAL` sin llamar a LabsMobile ni al worker | Que el resultado no dependa de la hora del CI | Implementador, aceptado |
| D-41 | Documentación en T-23 | `AGENTS.md`, `contracts.md` (filas `MANUAL` con `reason=ORDER_FEEDBACK`) y `ENV.md` (el interruptor también controla el botón) | Junto al código | Implementador, aceptado |

## Mejora v8 (2026-11-02)

> Renumeradas D-48…D-51 el 2026-11-02: los números D-43…D-46 ya los usaba el implementador en H6.

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| D-48 | Autorización | El texto obligatorio del pedido del comensal amplía su finalidad a pedir la calificación por WhatsApp o SMS, con la versión `pedido-2026-11` | Contactar también a quien pide sin billetera | Oscar (Claude recomendó una casilla aparte opcional; Oscar eligió ampliar el texto obligatorio). Riesgo legal aceptado, pendiente de Legal |
| D-49 | Alcance del contacto por pedido | Solo pedidos del comensal con `pedido-2026-11` y celular válido. El personal y las versiones anteriores siguen sin mensaje | El cliente solo autoriza cuando él mismo pide | Validador |
| D-50 | Revocación | Baja desde `/f` con el teléfono resuelto en el servidor; la reactivación sigue solo en la billetera | Quien no tiene billetera no tenía cómo darse de baja (Habeas Data) | Validador; Oscar confirma al aprobar v8 |
| D-51 | Diseño de `/f` | Colores, tipografías y logo de la landing de la sede, con los valores por defecto si no hay landing; la billetera no cambia | Que la calificación se vea como el comercio | Oscar |

## H8 — Ajustes de vendedores (v10, 2026-11-02)

| ID | Tema | Decisión | Motivo | Decidió |
|---|---|---|---|---|
| D-65 | Código bloqueado | Si el servidor rechaza el código al verificar el correo (vendedor desactivado entre la carga y el envío), el campo se desbloquea | Que el comercio no quede atrapado | Implementador, aceptado |
| D-66 | Constante del plazo | `COMMISSION_PAYOUT_BUSINESS_DAYS = 5` en `commission-defaults.ts`, el módulo de configuración que ya existe | Un solo lugar, sin módulo nuevo | Implementador, aceptado |
| D-67 | Prueba G-3 | En `sales-agent-signup-intro.test.ts`, «3» pasa a «5» en el texto aprobado de G-3 | Es el cambio pedido, no una prueba de forma | Implementador, aceptado |
| D-68 | Registro a medio camino | Quien pidió el código con la v2 recibe «los datos cambiaron, pide otro código», porque el hash incluye la versión del contrato. No se cambia | Efecto esperado del versionado | Implementador, aceptado |
| D-69 | Frase del mes | Función pura nueva para «noviembre de 2026»; `formatPeriodMonthLabel` no cambia (la usan el PDF y Liquidaciones) | Sin regresiones | Implementador, aceptado |
| D-70 | Unir con 068 | Los ajustes de vendedores van como H8 de 068 y no como cambio 069. Se borra la carpeta `069-ajustes-vendedores/` (nunca commiteada) y el próximo número libre vuelve a 069 | Pedido de Oscar | Oscar |
| D-71 | Carrera en transferencia | El % se lee antes de `$transaction` en `payment-receipt-process.ts`. Un guardado de la suscripción en el mismo instante puede usar el % anterior. No explica el reporte de QA. Queda como deuda; no se corrige en H8 | Riesgo bajo, fuera del alcance pedido | Implementador (hallazgo), validador |
| D-72 | Contraseña de una cuenta existente | El registro del vendedor exige 12 caracteres aunque la cuenta ya exista y el texto diga «escribe esa misma contraseña». Una cuenta vieja con una contraseña más corta no se puede vincular. Queda como pendiente aparte | Fuera del alcance pedido | Implementador (hallazgo); Oscar decide si se vuelve historia |
| D-73 | `decisions.md` | El resultado de T-34 va en este `decisions.md` (no en uno de 069) | Unión con 068 | Validador |
| D-74 | Documentación | T-32 actualiza `AGENTS.md` (línea de 063 con la v2) y, al cerrar, la spec de vendedores | El faltante que señaló el implementador | Validador |
