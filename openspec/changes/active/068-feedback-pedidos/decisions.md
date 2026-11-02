SDD: 17tnjrajf9b · v4 · 2026-11-02

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

