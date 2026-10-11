SDD: 17tnjra7awa · v4 · 2026-10-10

# 056 — Envíos automáticos de WhatsApp/SMS sin acosar al cliente

Estado: **aprobado** [humano, 2026-10-10] — planes de rulett-app (v3) y del worker (v4) validados
Ubicación: `openspec/changes/active/056-envios-automaticos-mensajes/`. La carpeta existe en `rulett-app` y en `whatsapp_rulett-app` con el mismo número.
ClickUp: [Enviar solos los recordatorios de cupones y los saludos de cumpleaños, sin acosar al cliente](https://app.clickup.com/t/17tnjra7awa). Subtareas: `17tnjra7awb`…`17tnjra7awj`.
Historia local: [repo-local: Rulett/historias/envios-automaticos-whatsapp-sms/historia.md]. Su intake, la maqueta `revision-funcional.html` (aprobada [humano, 2026-10-10]) e `intake.md` están en esta misma carpeta.

> ClickUp no se leyó, por regla del proyecto: el ClickUp conectado es de SOS. La fuente es la historia local que publicó el analista el 2026-09-28. Si ClickUp la contradice, detener la implementación y avisar.

## Repos

| Repo | Qué hace | Tasks |
|---|---|---|
| `rulett-app` | Modelo y migración; punto único de topes y baja; envío diario; reconciliación WhatsApp→SMS; configuración; billetera; colas; dashboard; recorrido; ruta `/c/{tenantId}` | T-00 … T-19 |
| `whatsapp_rulett-app` | Acepta las plantillas v2 y envía el parámetro del botón URL dinámico | W-01 … W-04 |

## Fases (entregables que se prueban por separado)

| Fase | Contenido | Tasks | Subtarea ClickUp |
|---|---|---|---|
| 0 | Trámite de plantillas en Meta (en paralelo, sin código) | T-00 | awb |
| 1 | Datos + topes + baja sobre los envíos manuales + billetera (incluye T-08 y la pastilla «Cancelado») | T-01…T-08 | awc |
| 2 | Pantalla "Mensajes automáticos" | T-09 | awd |
| 3 | Envío diario | T-10…T-13 | awe |
| 4 | Canal y respaldo por SMS | T-06 (reconciliación), T-12 (planificador) | awf |
| 5 | Botón "Información del comercio" | T-14, W-01…W-04 | awg (espera a T-00) |
| 6 | Colas, dashboard y recorrido | T-15…T-17 | awh |
| QA | Documentación, verificación y cierre | T-18, T-19 | awj |

## Orden de despliegue

1. Migración Prisma `auto_messages_caps_optout` en Neon (expand-only), según `ACTUALIZAR-BASE-NEON.md`.
2. Despliegue del worker con W-01…W-03. Es compatible hacia atrás: las plantillas v1 no cambian.
3. Despliegue de la app con `AUTO_MESSAGES_ENABLED=false` y `WHATSAPP_V2_TEMPLATES_APPROVED` vacío. Topes y baja aplican a los manuales desde este paso.
4. En lab: `AUTO_MESSAGES_ENABLED=true`, QA con `AUTO_MESSAGES_NOW` (solo fuera de producción).
5. Producción: encender `AUTO_MESSAGES_ENABLED=true`.
6. Cuando Meta apruebe las plantillas: agregar sus nombres a `WHATSAPP_V2_TEMPLATES_APPROVED` (por plantilla) y redesplegar.

## Documentos

| Archivo | rulett-app | worker |
|---|---|---|
| index.md, proposal.md, design.md, specs.md, adr.md | idénticos | idénticos |
| tasks.md | T-00…T-19 | W-01…W-04 |
| intake.md | sí | — |
| meta-plantillas.md (guía T-00) | sí | — |
| decisions.md | sí | sí |
| test-plan.md / test-report.md | los genera `/pruebas-lab` | — |

## Versión

- v4. Plan del worker validado: variable opcional `WHATSAPP_V2_BUTTON_PARAM_NAME`, validación estricta solo en v2, índice inválido falla el arranque, fixture de contrato compartido (W-03 ↔ T-14), `docs/DEPLOYMENT.md` en W-04 y envío de prueba al aprobar cada plantilla. Guía Meta: el cuerpo v2 no lleva `nombre_tenant`. [implementador + validador, 2026-10-10]
- v3. Plan de implementación de rulett-app validado: T-08 pasa a la Fase 1 (lo requiere T-06), T-14 antes de T-12, pastilla «Cancelado» adelantada a T-04, `timeout` explícito en transacciones, `/c/*` público en el proxy y `/billetera/mensajes` protegida (T-14/T-07), gate manual de activación de v2, AGENTS.md y CLAUDE.md en T-18, contacto cancelado conserva `dedupeKey` y avisos. [implementador + validador, 2026-10-10; Oscar aprueba al pegar la confirmación]
- v2. Oscar aprueba el SDD y confirma todos los supuestos de v1 (PLATFORM fuera de topes; NOT_DELIVERED reintenta; cumpleaños solo con regalo SMS sale por SMS; días 1–30 y regalo 1–60; topes desde el despliegue; maxDuration 300; botón dinámico en índice 1). Se agrega `meta-plantillas.md` (guía T-00) y `decisions.md`. Ajuste en design §3.1 y W-02: el parámetro del botón se envía con o sin `parameter_name` según cómo Meta registre la variable de la URL. [humano, 2026-10-10]
- v1. Primera versión. Decisiones de Oscar del 2026-10-10: los comercios legacy sí reciben automáticos; un contacto no entregado o cancelado no cuenta para los topes; el throughput del worker (`BATCH_SIZE` y frecuencia del cron) lo ajusta Oscar por operación, fuera de este change; la maqueta está aprobada. [humano, 2026-10-10]
