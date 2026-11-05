SDD: 17tnjrajf9b · v10 · 2026-11-02

# Closure — 068 (worker) Plantilla `calificar_pedido`

Estado: **cerrado por declaración de Oscar (2026-11-02)**. El código y la documentación están completos. El despliegue y el envío real dependen de la aprobación de Meta (T-00 en rulett-app).

## Qué se construyó
- **W-01:** rama `calificar_pedido` con `buildFeedbackComponents`. El encabezado lleva `nombre_tenant`, el cuerpo tiene 4 variables con nombre y el botón URL dinámico usa su propio índice (WD-4). Las v1 y v2 no cambian.
- **W-02:** `parseFeedbackParams`, en `src/db/queue.ts`. Valida `boton_calificacion` con `^[A-Za-z0-9_-]{38}$`. `WHATSAPP_FEEDBACK_BUTTON_INDEX` es requerido en `Config` (por defecto `0`; uno inválido impide el arranque). `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME` es opcional.
- **W-03:** fixture de contrato idéntico al de la app.
- **W-05:** los logs ya no llevan nombre ni teléfono (WD-3). `mask-phone.ts` se retiró (WD-6).
- **W-04:** documentación hecha. **Pendiente:** despliegue en Cloud Run con las variables y envío real en lab.
- **Pruebas:** 119 en verde. Typecheck y build sin errores.

## Plantilla registrada en Meta
- Nombre `calificar_pedido`, Español (COL), categoría Utilidad, id `1704361807924992`. Al cerrar, estaba **en revisión**. Más tarde ese día, la Graph API la mostraba aprobada (`es_CO`), pero la URL del botón «Calificar» quedó `https://www.rulett.app/f/%7B%7B1%7D%7D{{1}}`: el `{{1}}` escrito en la base se guardó codificado. Hay que dejar solo `https://www.rulett.app/f/` como base (Meta permite una edición cada 24 h). Hasta entonces W-04 sigue sin marcar.
- Dos botones: «Calificar» (URL dinámica `https://www.rulett.app/f/{{1}}`, índice 0) e «Ir a billetera» (URL fija). El botón fijo no necesita parámetros, así que el índice 0 por defecto sirve.
- Al aprobarse:
  - confirmar si la variable de la URL quedó posicional `{{1}}`; si quedó con nombre, definir `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME`;
  - registrar la categoría final en `decisions.md`.

## Decisiones
WD-1…WD-10 en `decisions.md`. Se trabajó directo en `cloud-run`.

## Reconciliación
- [ ] Marcar el despliegue de W-04 cuando ocurra.
- [x] `git mv` de `active/068-feedback-pedidos` a `completed/`, una fila en `completed/README.md` y actualizar `active/README.md` (ninguno en curso).
