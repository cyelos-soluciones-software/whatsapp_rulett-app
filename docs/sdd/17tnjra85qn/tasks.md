SDD: 17tnjra85qn · v11 · 2026-10-01

# Tasks — whatsapp_rulett-app

Cierre: v11 no agrega tasks aquí. T-16 y T-17 son de rulett-app y ya están en su árbol. W-00 a W-03 hechas. W-04 no es código: la hace el humano en Render.

Dependencias externas:

- rulett-app T-01 a T-11 están implementadas en local, sin commit. La migración `20261001114819_subscription_reminders_discovery` no está en Neon. Hay que aplicarla en lab y producción antes de leer filas con `qrCampaignId` null.
- rulett-app T-05 encola `{ nombre_comercio, dias? }` con `dias` texto `"7"`, y `userName` = nombre del comercio.
- Los nombres de parámetro son los de `design.md`. Si Meta se crea con `{{1}}` posicional, W-01 no aplica y hay que volver al SDD.
- Fuente de esta historia: `docs/sdd/17tnjra85qn/`. No hace falta una carpeta paralela en `openspec/changes/active/`. W-03 sí actualiza `openspec/specs/` para que la descripción del sistema no contradiga el código.

### W-00 · Corredor de pruebas
Repo: whatsapp_rulett-app · Depende de: ninguna
Subtarea ClickUp: ninguna
Archivos previstos: `package.json` (script `test`), `test/` 
Criterio de hecho: `npm test` corre `node:test` mediante el `tsx` ya instalado. Sin dependencia nueva. Los tests no viven en `src/`. `engines.node` es `>=22.5.0`: `--test-coverage-include` existe desde Node 22.5.0, y `>=22` dejaría pasar 22.0–22.4. El script de cobertura no se cambia.
Pruebas: el script existe y un test vacío pasa.
Seguridad: A06 (sin paquete nuevo)
Hotspot a revisar: no
Estado: pruebas hechas [implementador, 2026-10-01]. `engines.node` sigue en `>=20.0.0`; el implementador lo sube a `>=22.5.0` antes de mergear. Este rol no edita `package.json`. No bloquea: en ese mismo cambio puede alinear `AGENTS.md`, que marca `POLL_INTERVAL_MS` como requerida aunque el código no falla si falta. [humano, 2026-10-01]

### W-01 · Mapear las dos plantillas sin header
Repo: whatsapp_rulett-app · Depende de: W-00
Subtarea ClickUp: ninguna
Archivos previstos: `src/types.ts`, `src/db/queue.ts` (`parseTemplateParams`), `src/services/whatsapp.ts` (`buildTemplateComponents`)
Criterio de hecho: la validación es por plantilla. `recordatorio_suscripcion_7d` exige `nombre_comercio` y `dias` (string) y arma solo el body, sin header. `recordatorio_suscripcion_hoy` exige `nombre_comercio` y arma solo el body. El botón URL no se envía. Las cuatro plantillas actuales siguen exigiendo `nombre_tenant` y `nombre_usuario` y devuelven el mismo componente que hoy. Params incompletos → `FAILED` con el error de `templateParams` vacío, sin `fetch` a Meta. Una plantilla desconocida sigue cayendo al header `nombre_tenant`.
Pruebas: `sendTemplateMessage` con `fetch` falso. Casos: aviso a 7 días, aviso del día, las cuatro actuales (el cuerpo enviado no cambia), plantilla desconocida, params incompletos. ≥80 % de las líneas nuevas.
Seguridad: ninguno
Hotspot a revisar: no
Estado: hecho [implementador, 2026-10-01]. `test/whatsapp.test.ts`; líneas nuevas cubiertas al 100 %.

### W-02 · Tolerar campaña nula y no loguear el teléfono
Repo: whatsapp_rulett-app · Depende de: W-00
Subtarea ClickUp: ninguna
Archivos previstos: `src/types.ts`, `src/db/queue.ts` (`mapRow`), `src/processor.ts`, `sql/schema.sql`
Criterio de hecho: `qrCampaignId` null sigue null. No se convierte en el texto `"null"`. El claim sigue siendo `status = PENDING`. El log de `processRow` no imprime el teléfono completo: solo los últimos 4 dígitos. `sql/schema.sql` documenta la columna como nullable para el Docker local. No es la migración de Neon y no se corre `db:schema` contra Neon.
Pruebas: unit de `mapRow` con null y del enmascarado. ≥80 % de las líneas nuevas.
Seguridad: A09
Hotspot a revisar: sí, el log del teléfono
Estado: hecho [implementador, 2026-10-01]. `src/lib/mask-phone.ts`; `test/queue-row.test.ts` y `test/processor.test.ts`. `db:schema` no se corrió contra Neon.

### W-03 · Documentar el mapeo
Repo: whatsapp_rulett-app · Depende de: W-01
Subtarea ClickUp: ninguna
Archivos previstos: `openspec/specs/integrations.md`, `openspec/specs/domain_model.md`, `docs/DATABASE.md`, `docs/sdd/_base/contracts.md`, `docs/sdd/_base/glossary.md`
Criterio de hecho: las dos plantillas nuevas figuran sin header; el botón URL no va en el POST; una fila de plataforma puede tener campaña null; `domain_model.md` incluye `promocion_relampago` si la lista de plantillas de ahí estaba corta. El contrato de la historia sigue siendo `docs/sdd/17tnjra85qn/`.
Pruebas: no aplica (markdown).
Seguridad: ninguno
Hotspot a revisar: no
Estado: hecho [implementador, 2026-10-01]. También `docs/sdd/_base/architecture.md` y `AGENTS.md`.

### W-04 · Probar en Render antes de encender el aviso
Repo: whatsapp_rulett-app · Depende de: W-01, W-02, rulett-app/T-01, rulett-app/T-05
Subtarea ClickUp: ninguna
Archivos previstos: ninguno (despliegue)
Criterio de hecho: el mismo redespliegue que pide esta tarea. Render no tiene `.nvmrc` ni `.node-version`, así que toma Node desde `engines.node`. En el log se anota esa versión y `/health` responde. Después, una fila de plataforma de prueba: si la plantilla Meta ya está aprobada, queda `SENT`; si no, queda `FAILED` sin haber exigido `nombre_tenant`, y rulett-app puede pasar esa fila a SMS. Nunca `templateParams vacío`. `SUBSCRIPTION_REMINDERS_ENABLED` sigue en false hasta ver ese resultado. El flag vive solo en rulett-app.

Variables del worker, sin nuevas en esta historia [repo: src/config.ts]: el proceso exige `DATABASE_URL`, `WORKER_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_ACCOUNT_ID`. Con valor por defecto: `POLL_INTERVAL_MS` (60000), `BATCH_SIZE` (50), `PORT` (8080), `DATABASE_SSL` (se infiere) y `WHATSAPP_LANGUAGE_CODE` (`es_CO`). `AGENTS.md` marca `POLL_INTERVAL_MS` como requerida aunque el código no falla si falta. [repo: AGENTS.md]
Pruebas: una fila real o de staging, anotada en el PR.
Seguridad: A05
Hotspot a revisar: no
Estado: pendiente (despliegue en Render, lo hace el humano).
