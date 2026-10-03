# Intake — 17tnjra85qn · Recordar el pago, caber el juego y filtrar Descubre
Estado: cerrado. Código v11 reconciliado en local. Quality gate de SonarCloud en verde, con 1 issue nuevo. Flag apagado. Faltan las dos migraciones en lab y PDN, y W-04. Pruebas de laboratorio cerradas el 2026-10-01 con veredicto Incompleto. El envío al teléfono queda fuera.
ClickUp: https://app.clickup.com/t/9013064238/17tnjra85qn · Subtareas: no leídas · Dependencias: no leídas
Repos involucrados: rulett-app, whatsapp_rulett-app
Actualizado: 2026-10-01 (v11)

## Historia
[proyecto: historias/lote-suscripcion-juego-descubre/historia.md] Una sola historia con tres flujos: aviso de suscripción al contacto del comercio (WhatsApp y SMS si no se entrega), juego público en una pantalla, y Descubre con fichas de ruleta y de página, filtro por tipo y por categoría del alta, en `/descubre` y en la billetera.

ClickUp no está conectado en este chat. No se leyeron descripción viva, subtareas, comentarios, relaciones, campos ni adjuntos de `17tnjra85qn`. El contrato usado es el archivo local. Si la tarjeta difiere, hay que señalarlo antes de generar el SDD.

## Contexto recibido
- [humano, 2026-09-30] Rama en rulett-app: `CU-17tnjra85qn_Feature-Recordar-el-pago-de-la-suscripcion-caber-el-juego-en-una-pantalla-y-filtrar-lo-que-hay-cerca_Oscar-Javier-Bernal-Guzman`.
- [humano, 2026-09-30] Rama en whatsapp_rulett-app: la misma con sufijo `-whatsapp`. Pregunta si ahí se toca código.
- [repo: rulett-app] Rama verificada igual a la que indicó el humano. `docs/sdd/` no existía. El estado del sistema está en `openspec/specs/`.
- [repo: whatsapp_rulett-app] `docs/sdd/` no existía. El worker no es genérico: `buildTemplateComponents` mapea cuatro plantillas por nombre. Un botón URL estático no viaja en el POST. Variables de cuerpo nuevas sí exigen cambio y redeploy en Render.
- [repo: rulett-app/prisma/schema.prisma] `WhatsappQueue.qrCampaignId` y `SmsQueue.qrCampaignId` son obligatorios. `Tenant.contactPhone` no tiene código de país. `BranchLanding` no tiene bandera de Descubre.
- [repo: rulett-app/src/actions/discovery.ts] Descubre no filtra por suscripción vencida. El juego y la landing pública sí cortan por `expiresAt`.
- [repo: rulett-app/src/lib/whatsapp-worker-trigger.ts] rulett-app encola y dispara al worker. El SMS sale en este repo (LabsMobile), no en el worker.

## Brechas abiertas
- [DESEABLE] IDs de subtareas de ClickUp, para cruzarlas con las tasks. — pendiente
- [DESEABLE] Confirmar que la tarjeta de ClickUp no contradice `historia.md` (comentarios no leídos). — pendiente

## Supuestos vigentes
- Ninguno en la historia de negocio.
- El plan de rulett-app todavía no llegó. Hasta contrastarlo, no se autoriza implementar. El contrato que ese plan tiene que cumplir ya está en v3: `templateParams` con `nombre_comercio` y `dias` texto `"7"`, `userName` = nombre del comercio, y `isWhatsappTemplateParams` por plantilla.

## Aprobación
- [humano, 2026-09-30] Orden nacional confirmado: páginas por fecha de publicación, detrás de las ruletas cuando el filtro es «todas». Ruletas por jugadas.
- [humano, 2026-09-30] Aprueba el SDD v2. La estimación en horas no parte el trabajo.
- [humano, 2026-10-01] Tres ajustes de plan: silencio solo con recibo MANUAL en PENDING; migraciones del implementador solo en Docker local; pruebas del worker con node:test y tsx.
- SDD v4. Implementación todavía no autorizada: el plan de rulett-app tiene que coincidir con v4.
- [humano, 2026-10-01] W-00 a W-03 del worker coinciden con v4. Antes de mergear, `engines.node` es `>=22.5.0` (no `>=22`): `--test-coverage-include` existe desde 22.5.0. No hay `.nvmrc` ni `.node-version`; Render toma Node de `engines` en el redespliegue de W-04. En ese log se anota la versión y se comprueba `/health`.
- [humano, 2026-10-01] Variables nuevas del worker: ninguna. Obligatorias en código: `DATABASE_URL`, `WORKER_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCOUNT_ID`. Con default: `POLL_INTERVAL_MS`, `BATCH_SIZE`, `PORT`, `DATABASE_SSL`. `AGENTS.md` marca `POLL_INTERVAL_MS` como requerida aunque `src/config.ts` usa 60000 si falta.
- [humano, 2026-10-01] Avisó de un archivo `env` sin punto en la raíz del worker, sin seguimiento. En disco no está: solo `.env`, y `.gitignore` cubre `.env`. La regla `.env` no cubre un archivo llamado `env`.
- [humano, 2026-10-01] Revisó la v6 contra el repo y la lanza así. `WHATSAPP_LANGUAGE_CODE` usa `es_CO` si falta. No bloquea: el implementador puede alinear `AGENTS.md` (`POLL_INTERVAL_MS`) en el mismo cambio de `engines`.
- [implementador, 2026-10-01] T-01 a T-11 en rulett-app, sin commit. Migración `20261001114819_subscription_reminders_discovery` solo en Docker. Build, typecheck y 1.367 tests en verde. `src/lib` 83,88 % de líneas. Desviaciones aceptadas en v7: teléfono vacío → `NOT_DELIVERED`; el worker se dispara solo si hubo encolado; `campaignName` sigue en la prop de `GameFlow`; `.env.example` no entra por `.env*`.
- [humano, 2026-10-01] En Descubre, la ficha de página (como el menú de Hype Burguer) y el menú público deben tener «Cómo llegar»: abre la app de mapas del celular en las coordenadas de la sede. No reemplaza «Ver página». Las ruletas no. Quedó como T-12 en v8, sin implementar.
- [humano, 2026-10-01] Meta: `recordatorio_suscripcion_7d` está Activa (calidad pendiente). `recordatorio_suscripcion_hoy` sigue En revisión. El flag no se enciende por esto.
- [humano, 2026-10-01] v9. Toda landing, incluida la ya creada y la del alta de 14 días, nace con «Publicar esta página en Descubre» marcado. El comercio lo apaga si quiere. Los cupones que crean el alta de super admin y el de 14 días quedan en la sede de ese alta. El botón de cupones con IA del panel no les pone sede. En la ficha de página, si hay ofertas en el menú de esa sede, el conteo.
- [humano, 2026-10-01] v10. No se repite «Sede · {nombre}» en la ficha de página: el título ya es la sede. El plan del implementador queda aceptado con las desviaciones anotadas en `decisions.md`.
- [implementador, 2026-10-01] T-13 a T-15 en local, sin commit. Migración `20261001230527_discovery_listed_default_true` solo en Docker. 1.398 tests y build en verde.

## Corte propuesto (no acordado)
Tres SDD bajo el mismo ID de historia. No se bloquean entre sí.

1. `17tnjra85qn-aviso` — aviso de suscripción. Repos: rulett-app y whatsapp_rulett-app. Incluye código de país del contacto, proceso de la mañana, WhatsApp, SMS de respaldo, comercio desactivado y pago en revisión.
2. `17tnjra85qn-juego` — juego en una pantalla. Solo rulett-app. Sin esquema.
3. `17tnjra85qn-descubre` — fichas, filtros y publicación de la página. Solo rulett-app. Sí hay esquema.

## Respuesta ya verificada sobre el worker
Sí se toca código en whatsapp_rulett-app, solo en el corte del aviso: mapear las dos plantillas nuevas. El SMS no vive ahí. El botón de pago, si queda fijo en la plantilla de Meta, no se envía en el payload.
