SDD: 17tnjra7awa · v4 · 2026-10-10

# Tasks — whatsapp_rulett-app · 056 Envíos automáticos de WhatsApp/SMS
estado: aprobado — pendiente de plan de implementación validado

## Dependencias externas
- `rulett-app/T-01` (migración) puede ir antes o después: el worker no lee las columnas nuevas. Lo que importa es desplegar W-01…W-03 **antes** de que `rulett-app/T-14` active alguna plantilla v2 (`WHATSAPP_V2_TEMPLATES_APPROVED`).
- Los nombres finales de las plantillas los define `rulett-app/T-00`. Si cambian respecto al design §3.1, se actualiza la constante antes de desplegar.
- Throughput (`BATCH_SIZE`, frecuencia del cron): fuera de alcance; lo opera Oscar [humano, 2026-10-10].

## Orden
W-01 → W-02 → W-03 → W-04 · Despliegue en Cloud Run después de W-03.

---

### W-01 · Tipos y parseo de las plantillas v2
- [x] Repo: whatsapp_rulett-app · Depende de: ninguna
- Subtarea ClickUp: 17tnjra7awg
- Archivos previstos: `src/types.ts`, `src/db/queue.ts`
- Criterio de hecho:
  - `TenantTemplateParams` acepta `cantidad_cupones` y `boton_comercio`.
  - `parseTemplateParams` reconoce las 4 v2 con sus params requeridos (design §3.1). `boton_comercio` debe ser un UUID; si no, los params quedan incompletos y la fila termina en `FAILED` sin llamar a Meta.
  - Las v1 y las de suscripción no cambian.
- Pruebas: ver W-03.
- Seguridad: API3 (validación de propiedades) · Hotspot: **sí** — parseo de `boton_comercio`

### W-02 · Componente botón URL dinámico
- [x] Repo: whatsapp_rulett-app · Depende de: W-01
- Subtarea ClickUp: 17tnjra7awg
- Archivos previstos: `src/services/whatsapp.ts`, `src/config.ts`
- Criterio de hecho:
  - `TemplateComponent` admite `type:'button'`, `sub_type:'url'` e `index` con un parámetro `{type:'text', text}`; incluye `parameter_name` con el valor de `WHATSAPP_V2_BUTTON_PARAM_NAME` solo si esa variable está definida (v4); sin definir, el parámetro va posicional.
  - `buildTemplateComponents` agrega el botón solo para las v2, con `index = WHATSAPP_V2_BUTTON_INDEX` (env, default `"1"`; si no es un entero ≥ 0, falla el arranque).
  - Para las v2: header `nombre_tenant` + body (los params de la plantilla) + botón.
  - Las v1 se generan byte a byte igual que hoy.
- Pruebas: ver W-03.
- Seguridad: ninguno · Hotspot: no

### W-03 · Tests
- [x] Repo: whatsapp_rulett-app · Depende de: W-02
- Subtarea ClickUp: 17tnjra7awg
- Archivos previstos: `test/whatsapp.test.ts`, `test/queue-row.test.ts`, `test/config.test.ts`
- Criterio de hecho:
  - Payload de cada v2 con el componente botón (índice y texto = tenantId).
  - Snapshot de las v1 sin cambios.
  - `boton_comercio` ausente o inválido → params incompletos.
  - `WHATSAPP_V2_BUTTON_INDEX` por defecto, personalizado y rechazado si es inválido; `WHATSAPP_V2_BUTTON_PARAM_NAME` definida o no (v4).
  - Fixture de contrato: el JSON exacto de design §3.1 por cada v2 se parsea y produce el payload esperado. El mismo fixture va como espejo en `rulett-app` T-14 (v4).
  - `npm test` y `npm run test:coverage` en verde, con ≥80 % de las líneas nuevas.
- Pruebas: node:test + tsx, mock de `fetch`.
- Seguridad: ninguno · Hotspot: no

### W-04 · Documentación y specs del worker
- [x] Repo: whatsapp_rulett-app · Depende de: W-03
- Subtarea ClickUp: 17tnjra7awj
- Archivos previstos: `openspec/specs/integrations.md`, `openspec/specs/domain_model.md`, `AGENTS.md` (sección de plantillas y las variables nuevas), `.env.example`, `docs/DEPLOYMENT.md` (v4)
- Criterio de hecho:
  - Se documentan:
    - Las plantillas v2 y el botón dinámico.
    - `WHATSAPP_V2_BUTTON_INDEX`.
    - Que el worker ignora `trigger`, `reason`, `contactId` y el estado `CANCELLED`.
  - Al cerrar, delta fusionado y carpeta movida a `completed/` con `closure.md`.
  - Se anota la deuda D-10 (AGENTS.md desactualizado sobre sondeo y Render) sin corregirla aquí, salvo la sección de plantillas.
- Verificación manual: al aprobar cada plantilla en Meta, hacer un envío de prueba que confirme el índice del botón y la forma de la variable antes de activarla en la app (v4).
- Pruebas: n/a · Seguridad: ninguno · Hotspot: no
