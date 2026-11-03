SDD: 17tnjrajf9b · v10 · 2026-11-02

# Tasks — 068 · whatsapp_rulett-app

Se despliega **antes** de que rulett-app active `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=true`. Es compatible hacia atrás: las plantillas actuales no cambian.

## Dependencias externas
- `rulett-app/T-00`: plantilla aprobada en Meta, con el índice del botón y la forma del parámetro anotados en `decisions.md`.
- `rulett-app/T-07`: replica el fixture de contrato en `src/lib/__tests__/fixtures/feedback-contract.ts` (D-14).

Rama (v4, WD-1): se trabaja directo en `cloud-run`. Cada push despliega, así que solo se hace push con `npm test` y `npm run typecheck` en verde. El despliegue es inocuo porque la app no encola `calificar_pedido` hasta activar su flag.

---

### W-01 · Tipos y armado de `calificar_pedido`
- [x] Hecha (2026-11-02): `FEEDBACK_TEMPLATE_NAME`, `FEEDBACK_BODY_PARAMS`, `FeedbackTemplateParams` + `isFeedbackParams` en `types.ts`; `buildFeedbackComponents` con segunda configuración de botón (WD-4), antes de la rama v2, que no cambia. 5 pruebas nuevas; las 98 existentes en verde.
Repo: whatsapp_rulett-app · Depende de: ninguna
Archivos previstos: `src/types.ts` (`FEEDBACK_TEMPLATE_NAME`, `FEEDBACK_BODY_PARAMS = ['nombre_usuario','numero_pedido','nombre_sede','fecha_pedido']`, tipo `FeedbackTemplateParams`), `src/services/whatsapp.ts` (rama `buildFeedbackComponents`: header `nombre_tenant`, body en orden, botón `{ type:'button', sub_type:'url', index: WHATSAPP_FEEDBACK_BUTTON_INDEX, parameters:[{ type:'text', text: boton_calificacion }] }`, con `parameter_name` solo si existe `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME`)
Criterio de hecho: `buildTemplateComponents('calificar_pedido', …)` arma los components exactos del fixture. Las ramas v1 y v2 no cambian.
Pruebas: fixture `test/fixtures/feedback-contract.ts`; regresión de los fixtures v2 existentes.
Seguridad: A03 (validación de entrada) · Hotspot: no

### W-02 · Validación de params y configuración
- [x] Hecha (2026-11-02): `parseFeedbackParams` en `src/db/queue.ts` (rama por nombre exacto entre el aviso de suscripción y la v2; `UUID_PATTERN` y `parseV2Params` intactos), `WHATSAPP_FEEDBACK_BUTTON_INDEX` (default `0`, inválido = falla el arranque) y `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME` en `config.ts` y `.env.example`. Campo requerido agregado al literal de `Config` de `whatsapp.test.ts` y las dos variables a la lista `KEYS` de `config.test.ts` (WD-2). 17 pruebas nuevas.
Repo: whatsapp_rulett-app · Depende de: W-01
Archivos previstos: el módulo de `parseTemplateParams` (ubicarlo; no se leyó en el diseño), `src/config.ts` (v4, WD-2: campo **requerido** en `Config`; los objetos de configuración de las pruebas existentes solo agregan el campo, sin cambiar aserciones. `WHATSAPP_FEEDBACK_BUTTON_INDEX` por defecto `"0"`; un índice no numérico falla el arranque, como en 056; `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME` opcional)
Criterio de hecho: en `calificar_pedido`, todas las variables son texto no vacío y `boton_calificacion` cumple `^[A-Za-z0-9_-]{38}$`. Si algo falla, `templateParams` queda `null` y la fila termina `FAILED` («templateParams vacío») sin llamar a Meta. Las claves desconocidas se descartan.
Pruebas: cada variable faltante; un token con 37 o 39 caracteres; caracteres inválidos; un índice inválido en config.
Seguridad: A03 · Hotspot: no

### W-03 · Pruebas de contrato
- [x] Hecha (2026-11-02): `test/fixtures/feedback-contract.ts` con el mismo `templateParams` que `rulett-app/src/lib/__tests__/fixtures/feedback-contract.ts` (D-14; comparado con un script: idénticos) y los `components` exactos. Pruebas: el fixture produce los components exactos, también como texto JSON, y `mapRow` lo conserva. Suite completa: 120 en verde; `typecheck` OK.
Repo: whatsapp_rulett-app · Depende de: W-01, W-02
Archivos previstos: `test/fixtures/feedback-contract.ts`, pruebas del servicio
Criterio de hecho: el JSON de `templateParams` de specs §2.1 produce exactamente los `components` esperados. Mismo fixture que `rulett-app/T-07`.
Pruebas: las de este archivo; suite completa en verde.
Seguridad: ninguno · Hotspot: no

### W-04 · Documentación y despliegue
- [x] Documentación (2026-11-02): `openspec/specs/integrations.md` (sección `calificar_pedido` y logs sin datos personales), `domain_model.md` (contrato de `templateParams`), `runbooks/DEPLOYMENT.md` (variables y orden de activación), `AGENTS.md` (variables y estado), `.env.example` y README de cambios activos.
- [ ] Despliegue en Cloud Run con las variables y envío de prueba real en lab: pendientes de T-00 (Oscar, WD-5). `closure.md` y `git mv` al cierre de 068.
Repo: whatsapp_rulett-app · Depende de: W-03, rulett-app/T-00
Archivos previstos: `openspec/specs/integrations.md` (fila de `calificar_pedido`), runbook de despliegue (variables), `openspec/changes/active/README.md` (en curso: 068)
Criterio de hecho: el worker queda desplegado en Cloud Run con las variables. Hubo un envío de prueba real en lab con la plantilla aprobada. Al cerrar 068, se crean `closure.md` y el `git mv` a `completed/`.
Pruebas: el envío de prueba en lab · Seguridad: ninguno · Hotspot: no

### W-05 · Logs del worker sin datos personales (v4, WD-3)
- [x] Hecha (2026-11-02): `processor.ts` sin `userName` ni `userPhone` en ningún log; «Mensaje enviado» y «Fallo al enviar mensaje» con `templateName` y `status` (WD-8). Revisados `server.ts`, `index.ts` y `batch-runner.ts`: no registran datos del destinatario. `maskPhone` eliminada por quedar sin uso (WD-6); una aserción existente ajustada solo en el campo retirado (WD-7). 2 pruebas con espía de `console.log` (envío exitoso y fallido). Suite: 119 en verde.
Repo: whatsapp_rulett-app · Depende de: ninguna
Archivos previstos: `src/processor.ts` (líneas 21-28 y cualquier otro log con `userName`/`userPhone`), pruebas
Criterio de hecho: ningún log del worker incluye nombre ni teléfono del destinatario, para ninguna plantilla. Los logs quedan con el id de la fila, la plantilla, el estado y el código de error de Meta.
Pruebas: espía del logger en un envío exitoso y en uno fallido; las aserciones existentes sobre logs se ajustan solo en el campo retirado (queda en `decisions.md`).
Seguridad: A09 (logs sin PII; specs/security.md de 062) · Hotspot: no

> v6 (2026-11-02): el envío manual (H6) es solo de rulett-app. El worker no cambia: las filas manuales usan la misma plantilla `calificar_pedido`.

> v8 (2026-11-02): H7 es solo de rulett-app. El worker no cambia: el mensaje a comensales sin billetera usa la misma plantilla.

> v10 (2026-11-02): H8 (ajustes de vendedores) es solo de rulett-app. El worker no cambia.
