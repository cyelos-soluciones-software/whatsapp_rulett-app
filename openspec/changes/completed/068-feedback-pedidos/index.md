SDD: 17tnjrajf9b · v10 · 2026-11-02

# 068 — Calificación de pedidos (NPS + comentario) e informe de experiencia con IA

Estado: **aprobado** (v1 aprobado por Oscar el 2026-11-01; v2 agrega la home con la compuerta G-0 de textos).
Tamaño: normal (2 repos, esquema nuevo, contrato de colas y plantilla nueva).
ClickUp: `17tnjrajf9b`, cuenta de Rulett. Alias de la historia: `RUL-feedback-pedidos`.
Historia: `rulett/historias/feedback-pedidos.md` en el proyecto Claude «Rulett App». Tiene 50 reglas (R1–R50) y 28 escenarios. Oscar la aprobó el 2026-11-01 y confirmó en bloque sus supuestos vivos.

> ClickUp no se leyó por regla del proyecto: el ClickUp conectado es de SOS. La fuente es la historia del proyecto. Si la tarjeta la contradice, se detiene la implementación y se avisa.

## Repos

| Repo | Qué hace | Tasks |
|---|---|---|
| `rulett-app` | Modelo y migración; solicitud al finalizar; enlace firmado; página pública y billetera; envío WA/SMS diferido con respaldo; baja ampliada; interruptor por sede; indicadores e informe con IA; Resumen en pestañas; destacado y pregunta frecuente en la home | T-00 … T-19 |
| `whatsapp_rulett-app` | Acepta la plantilla `calificar_pedido` con su botón URL dinámico | W-01 … W-04 |

## Hitos (se prueban por separado)

| Hito | Contenido | Tasks |
|---|---|---|
| H0 | Plantilla en Meta (Oscar, en paralelo) y spike de OpenRouter | T-00, T-01 |
| H1 | Captura: datos, enlace, solicitud al finalizar, página pública, billetera, enlace/QR, interruptor y baja | T-02 … T-04, T-08 … T-12 |
| H2 | Envío: despacho diferido, respaldo SMS, plantilla app + worker | T-05 … T-07, W-01 … W-04 |
| H3 | Pestañas del Resumen y cifras sin IA | T-13, T-15 |
| H4 | IA: clasificación, cupo, informe semanal y a demanda | T-14 |
| H5 | Home: destacado «Sabe qué opinan tus clientes» + pregunta frecuente (compuerta G-0 de textos; se publica con el resto en PDN) | T-19 |
| H6 | (v6) Envío manual de la calificación desde el pedido finalizado | T-20 … T-23 |
| H7 | (v8) Mensaje a comensales sin billetera con la autorización nueva, baja desde `/f` y `/f` con el diseño de la landing | T-24 … T-28 |
| H8 | (v10) Ajustes del programa de vendedores: texto de contraseña, código bloqueado desde la URL de `/registro`, pago en 5 días hábiles (contrato `vendedores-v3-2026-11`), liquidación y fecha de pago en el portal, y el reporte de QA sobre el % de comisión | T-29 … T-35 |
| QA | E2E, documentación, laboratorio y cierre | T-16 … T-18 |

## Orden de despliegue

1. Migración `order_feedback` en Neon. Es solo expand. Va primero a lab y luego a PDN, siempre con `migrate deploy` (runbook `ACTUALIZAR-BASE-NEON.md`; PDN según el runbook de operación del proyecto).
2. Worker con W-01…W-03. Es compatible hacia atrás porque las plantillas actuales no cambian.
3. App con `ORDER_FEEDBACK_MESSAGES_ENABLED=false`, `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=false` y `FEEDBACK_LINK_SECRET` definido.
   - Desde este paso ya se crean solicitudes y funcionan el enlace, el QR, la billetera, las pestañas y las cifras.
   - Sin `OPENROUTER_API_KEY`, la clasificación usa Gemini.
4. En lab: `ORDER_FEEDBACK_MESSAGES_ENABLED=true` y QA. Solo en lab existe `ORDER_FEEDBACK_NOW` para simular la hora.
5. En PDN: `ORDER_FEEDBACK_MESSAGES_ENABLED=true`. Hasta que Meta apruebe la plantilla, solo sale SMS (R18).
6. Con la plantilla aprobada: `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=true`, redespliegue y un envío de prueba.

## Documentos

| Archivo | rulett-app | worker |
|---|---|---|
| index.md, proposal.md, design.md, specs.md, adr.md | idénticos | idénticos |
| tasks.md | T-00…T-19 | W-01…W-05 |
| intake.md, meta-plantilla.md | sí | — |
| decisions.md | sí (D-1…D-10) | sí (copia) |
| test-plan.md / test-report.md | los genera `/pruebas-lab` | — |

## Versión
- v10 (2026-11-02). Por pedido de Oscar, los ajustes de vendedores van como **H8 dentro de 068** y no en un cambio aparte. Se descarta la carpeta `069-ajustes-vendedores/`, que nunca se commiteó, y el próximo número libre vuelve a ser 069. Se incorpora el plan del implementador validado: D-65…D-74. H8 no tiene migración ni toca el worker. [humano + validador, 2026-11-02]
- v9 (2026-11-02). Se valida el plan H7: ALINEADO CON AJUSTES. Se aceptan las desviaciones 1–4 del implementador. Nombre legal en la autorización: CYELOS (Oscar). Se agrega la compuerta G-1 (Legal) antes de pasar H7 a PDN y la variante de envío manual en CP-43. Decisiones D-52…D-58. [humano + validador, 2026-11-02]
- v8 (2026-11-02). H7, pedido por Oscar:
  - (a) La autorización del pedido del comensal amplía su finalidad: «…para gestionar este pedido y pedirme por WhatsApp o SMS que lo califique», versión `pedido-2026-11`. Los pedidos del comensal sin billetera, creados con esa versión, también reciben el mensaje en el celular del pedido. Los del mesero no lo reciben.
  - (b) Baja desde la página `/f`.
  - (c) `/f` con los colores, las tipografías y el logo de la landing de la sede.
  - T-24…T-28, CA-37…CA-43, ADR-068-11 y ADR-068-12. Riesgo legal aceptado por Oscar (texto obligatorio ampliado), pendiente de revisión de Legal. El worker no cambia. [humano, 2026-11-02]
- v7 (2026-11-02). Se valida el plan H6: ALINEADO CON AJUSTES. Se aceptan D-32…D-41 (trigger desde la solicitud, respaldo `MANUAL`, DTO con `dueAt` y `skipReason`, CAS con `answeredAt: null`, worker en `after()`, botón deshabilitado con aviso sin billetera, E2E con la hora fija). Solo cambian design §4.14, index y decisions; los demás archivos quedan en v6. [validador, 2026-11-02]
- v6 (2026-11-02). Mejora pedida por Oscar: botón «Enviar calificación» en los pedidos finalizados para el administrador y el cajero, que adelanta el envío automático (H6, T-20…T-23, CA-30…CA-36, ADR-068-10). Decisiones de Oscar: un pedido sin billetera muestra el botón con un aviso; se respeta la franja de 08:00 a 21:00; solo administrador y cajero; una sola vez por pedido. Migración nueva, solo expand. El worker no cambia. [humano, 2026-11-02]
- v5 (2026-11-02). Oscar confirma D-20 tras el spike T-01: Gemini clasifica por defecto; OpenRouter con Jev 1.13 queda como alternativa por variable (`FEEDBACK_CLASSIFIER_PROVIDER=openrouter`) y Microsoft-Decision-1 se descarta. Design §4.11: si el proveedor elegido falla, se usa el otro si está configurado. [humano, 2026-11-02]
- v4 (2026-11-02). Se valida el plan del worker: ALINEADO CON AJUSTES. Se trabaja directo en `cloud-run`; el índice del botón es requerido en `Config`; se agrega W-05 (logs del worker sin nombre ni teléfono). El fixture de la app vive en `src/lib/__tests__/fixtures/feedback-contract.ts` (D-14). Las decisiones del worker son WD-1…WD-5. [humano + validador, 2026-11-02]
- v3 (2026-11-01). Se valida el plan de rulett-app: ALINEADO CON AJUSTES. Se aceptan D-1…D-10 (ver `decisions.md`): QR con `qrcode` en el servidor, delegado en los mocks de finalize, host del SMS por ambiente, botón de WA solo en PDN, «cliente» como respaldo del nombre y textos de la home aprobados (G-0). El plan del worker está pendiente. [humano + validador, 2026-11-01]
- v2 (2026-11-01). Oscar aprueba el SDD v1 y pide anunciar la funcionalidad en la home. Se agregan H5 y T-19 (destacado en «Lo que más se nota», con ilustración en código y pregunta frecuente), la compuerta G-0 con los textos propuestos en design §4.13, CA-29 y el delta a `ui_and_brand.md` y `seo.md`. El worker no cambia (solo el encabezado). [humano, 2026-11-01]
- v1 (2026-11-01). Primera versión con las decisiones de Oscar del 2026-11-01:
  - los pedidos que vencen fuera de la franja de 08:00 a 21:00 salen a las 08:00;
  - supuestos de la historia confirmados en bloque;
  - ClickUp `17tnjrajf9b`.
