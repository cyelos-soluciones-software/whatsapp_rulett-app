SDD: 17tnjrajf9b · v10 · 2026-11-02

# ADR — 068 Calificación de pedidos

## ADR-068-1 · Tabla propia `OrderFeedback`, sin `MessageContact`
- **Contexto:** R15 pide que el mensaje no cuente en los topes de 056 ni desplace otros mensajes. `reserveContact` crea contactos que sí cuentan para los topes [repo: src/lib/auto-messages/contact-gate.ts:104-172]. Además, la reconciliación de 056 marca NOT_DELIVERED cualquier motivo distinto de cupón o cumpleaños [repo: src/lib/auto-messages/reconcile.ts:97].
- **Decisión:** una fila `OrderFeedback` por pedido (`orderId @unique`) guarda la solicitud, el despacho (su propia máquina de estados), la respuesta y la clasificación. Las filas de cola se enlazan por id único.
- **Consecuencias:** se necesita una reconciliación propia (§4.3 del design). La baja de 056 cubre igual las filas pendientes, porque cancela por teléfono [repo: opt-out.ts:40-118].
- **Alternativas descartadas:** `MessageContact` excluido de los topes por motivo (toca el gate de 056 y su prueba); campos dentro de `BranchOrder` (mezcla dominios y no sirve para los informes).

## ADR-068-2 · Enlace firmado sin estado
- **Contexto:** el enlace debe poder reproducirse en el PDF, en el resumen de WhatsApp, en el mensaje y en la billetera, en cualquier momento. Un token aleatorio guardado como hash no se puede reconstruir.
- **Decisión:** `token = b64url(uuidBytes(orderId)) ‖ b64url(HMAC-SHA256(FEEDBACK_LINK_SECRET, "of1:"+orderId)[0..12])`, 38 caracteres. Se verifica con `timingSafeEqual`. El prefijo `of1:` versiona el formato.
- **Consecuencias:**
  - El uuid del pedido queda visible. No es un dato personal y sin la firma no da acceso.
  - Rotar el secreto invalida los enlaces vivos (máximo 7 días); se documenta en ENV.
  - 96 bits de firma bastan para un enlace de baja sensibilidad que solo permite calificar una vez.
- **Alternativas descartadas:** token aleatorio con hash (no se puede reproducir); token cifrado en BD (requiere una clave igual y agrega estado); reutilizar la llave de seguimiento (vence a las 24 h).

## ADR-068-3 · Envío diferido por cron propio y franja horaria
- **Contexto:** las colas no tienen `scheduledAt` y el worker reclama todo lo `PENDING` [repo: prisma/schema.prisma:1045-1094]. Los crons de mensajería corren de 08:00 a 21:00 en Bogotá [repo: vercel.json].
- **Decisión:**
  - `dueAt = closedAt + 1 h`.
  - El cron `/api/cron/order-feedback` corre cada 15 min de 08:00 a 20:45.
  - Encola lo vencido, dispara el worker y reconcilia.
  - Lo que vence fuera de la franja sale en la primera corrida de las 08:00 [humano, 2026-11-01].
- **Alternativas descartadas:** WA también de noche; no enviar lo que pase la franja; columna `scheduledAt` en las colas (cambia el contrato del worker).

## ADR-068-4 · Reutilizar las colas con `reason=ORDER_FEEDBACK` y sin campaña
- **Contexto:** el contrato exige `qrCampaignId` cuando `origin=TENANT` [repo: openspec/specs/contracts.md]. El cupo cuenta solo filas `TENANT` [repo: src/lib/whatsapp-limit.ts:13-34]. R14 pide que el mensaje descuente del cupo del comercio.
- **Decisión:** `origin=TENANT`, `trigger=AUTOMATIC`, `reason=ORDER_FEEDBACK` y `qrCampaignId=null`. Ese es el **único** caso `TENANT` sin campaña.
- **Consecuencias:** hay que revisar las vistas y los filtros que asumen campaña (T-07).
- **Alternativa descartada:** `origin=PLATFORM`, porque no descuenta del cupo del comercio ni lo cancela la baja.

## ADR-068-5 · `calificar_pedido` como rama propia del worker
- **Contexto:** las plantillas v2 exigen `boton_comercio` con formato UUID y usan un índice de botón global [repo: worker src/services/whatsapp.ts:76-178; rulett-app src/lib/whatsapp-template-params.ts:137-155].
- **Decisión:**
  - Rama explícita por nombre.
  - Parámetro `boton_calificacion` validado con `^[A-Za-z0-9_-]{38}$`.
  - Índice `WHATSAPP_FEEDBACK_BUTTON_INDEX`, por defecto `"0"`.
  - Parámetro posicional, salvo que exista `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME`.
  - En la app, `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED` decide si se encola WA.
- **Alternativa descartada:** nombre `_v2` reutilizando la validación UUID (rompería el token).

## ADR-068-6 · IA: clasificador intercambiable, narrativa con Gemini y cupo reservado
- **Contexto:**
  - Oscar pidió modelos probabilísticos (Jev, Microsoft-Decision-1).
  - Esos modelos no redactan texto y su contrato en OpenRouter no está verificado [web: OpenRouter, 2026-10].
  - Gemini ya está integrado [repo: src/lib/vertex-ai.ts].
  - `AiPromptUsage` no tiene estado y se inserta después del uso [repo: ai-prompt-limit.ts; specs/security.md:47-48].
- **Decisión:**
  - Interfaz `FeedbackClassifier` con OpenRouter (modelo de decisión) como opción principal si T-01 la aprueba, y Gemini como respaldo.
  - Umbral 0,7.
  - La narrativa 3+3 la hace solo Gemini.
  - La clasificación no cobra.
  - Cada informe cobra 1 prompt: se reserva con un advisory lock por comercio insertando `AiPromptUsage` antes de llamar, y la fila se borra si falla (patrón 057).
- **Riesgo aceptado:** puede haber una carrera con cupones y SMS de IA, que no usan el lock.
- **Alternativas descartadas:** cobrar la clasificación (decisión de Oscar); agregar estado a `AiPromptUsage` (toca 030/032); solo Gemini (descarta lo pedido sin evaluarlo).

## ADR-068-7 · Resumen en pestañas por URL y carga perezosa
- **Decisión:** `?tab=ventas|premios|mensajes|experiencia`. El servidor solo consulta la pestaña activa. La última pestaña se recuerda en la cookie `rulett_admin_resumen_tab`. El banner y los videos quedan fuera de las pestañas.
- **Consecuencias:** se actualiza `ui_and_brand.md` §Resumen (orden fijo de 062 H12) y la prueba de textos prohibidos.
- **Alternativas descartadas:** pestañas solo en el cliente con todas las consultas (más carga); `localStorage` (el servidor no lo lee).

## ADR-068-8 · QR del PDF con `qrcode` en el servidor (v3; reemplaza la versión de v1)
- **Contexto:** el PDF lo genera `getBranchOrderPdfAction` en el servidor [repo: src/actions/branch-order.ts:973, verificado por el implementador]. `qrcode.react` 4.2 no expone su codificador.
- **Decisión:**
  - Se agregan las dependencias `qrcode` y `@types/qrcode` con versión exacta.
  - `QRCode.create(url, { errorCorrectionLevel: 'M' }).modules` se dibuja como rectángulos en jsPDF, sin PNG ni canvas [humano, 2026-11-01].
- **Alternativas descartadas:**
  - Que el cliente genere la imagen y la mande a la action, porque rompe la regla de que el servidor resuelve el documento (R22).
  - Copiar `qrcodegen` al repo, porque suma código propio y penaliza duplicación y cobertura.
  - El PDF sin QR.
- **Control:** `npm audit` sin altas ni críticas nuevas por estas dependencias.

## ADR-068-9 · Anunciar la calificación en la home (v2)
- **Contexto:** Oscar pide hablar de la funcionalidad en la página inicial porque da mucho valor a los comercios [humano, 2026-11-01]. La home tiene una sola fuente de textos y pruebas que lo exigen (058 ADR-058-7). Además, solo puede prometer lo que está en producción (058 D-36).
- **Decisión:**
  - Cuarto destacado en «Lo que más se nota», con ilustración en código.
  - Pregunta frecuente nueva.
  - Compuerta G-0 de textos.
  - Se publica en el mismo despliegue que activa la funcionalidad.
  - No se publica `aggregateRating` porque las calificaciones son privadas.
- **Alternativas descartadas:**
  - Una sección propia en la home: alarga una página que 058 acortó.
  - Una tarjeta en `HOME_BUSINESS.capabilities`: exige una captura real que todavía no existe.
  - Cambiar el título del hero.

## ADR-068-10 · Envío manual que adelanta la misma solicitud (v6)
- **Contexto:** Oscar pide que el administrador o el cajero envíen la calificación de inmediato en un pedido finalizado, y que el envío manual reemplace al automático [humano, 2026-11-02].
- **Decisión:** el botón no crea una solicitud nueva. Adelanta la existente (`dueAt=now`, `dispatchTrigger=MANUAL`) con un CAS sobre `SCHEDULED` y la despacha con la misma función del cron (`dispatchFeedbackRow`). Así se aplican exactamente las mismas reglas (billetera, baja, cupo, suscripción, franja) y se garantiza un solo envío por pedido.
- **Alternativas descartadas:**
  - Un segundo canal de envío con sus propias reglas: duplica lógica y abre el doble envío.
  - Encolar directo sin pasar por la solicitud: rompe la reconciliación y el rastreo por canal.

## ADR-068-11 · Mensaje a comensales sin billetera con la autorización ampliada (v8)
- **Contexto:** Oscar pide enviar la calificación también a quien pide sin billetera, usando la autorización del pedido [humano, 2026-11-02]. El texto actual solo autoriza a «gestionar este pedido», y 062 prohibió usar esos datos para mensajes.
- **Decisión:**
  - Nueva versión obligatoria `pedido-2026-11`, que agrega la finalidad «pedirme por WhatsApp o SMS que lo califique».
  - Solo pedidos del comensal con esa versión.
  - Un mensaje transaccional por pedido, al celular del pedido.
  - Baja desde `/f`.
- **Alternativas descartadas:**
  - Casilla aparte opcional: más limpia legalmente; recomendada por Claude y descartada por Oscar.
  - Usar la versión anterior: no informa esa finalidad.
  - Pedidos del personal: el cliente no autoriza.
- **Riesgo:** la finalidad queda dentro de una casilla obligatoria. Validar con Legal antes de PDN.

## ADR-068-12 · `/f` con el diseño de la landing de la sede (v8)
- **Decisión:** se aplican los colores, las tipografías y el logo de la landing de la sede, igual que `BranchLandingView`, con los valores por defecto si no hay landing. La billetera no cambia.
- **Alternativa descartada:** solo colores.
