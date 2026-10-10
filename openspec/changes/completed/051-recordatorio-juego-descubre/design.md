SDD: 17tnjra85qn · v11 · 2026-10-01

# Diseño

## Decisión

Un solo cambio de esquema en rulett-app y un mapeo nuevo en el worker. El aviso de Rulett hacia el contacto viaja por las colas que ya existen, marcado para que no sea un envío del comercio a sus clientes. No se inventa una campaña QR falsa: `qrCampaignId` pasa a ser opcional solo en esas filas.

Alternativa descartada: tabla de envío aparte que el worker no lee. Obligaría a un segundo claim en Render para el mismo Graph API. [repo: whatsapp_rulett-app/src/processor.ts]

Alternativa descartada: rellenar `qrCampaignId` con una campaña centinela. Ensucia Descubre, cupos y el historial del comercio.

Alternativa descartada: partir el SDD en tres. El humano la rechazó. [humano, 2026-09-30]

## Componentes

| Pieza | Repo | Cambio |
|---|---|---|
| Prisma | rulett-app | Campos y tabla de idempotencia |
| Cupo WhatsApp y SMS | rulett-app | El conteo ignora `origin = PLATFORM` |
| Formularios de alta | rulett-app | Código de país del contacto |
| Cron 08:00 Bogotá | rulett-app | Elige, encola WhatsApp, reconcilia SMS |
| LabsMobile | rulett-app | SMS de respaldo, sin pasar por el cupo |
| GameFlow y encabezado | rulett-app | Textos y encuadre |
| Descubre | rulett-app | Filtros, fichas de página, ocultar vencidas |
| `buildTemplateComponents` | whatsapp_rulett-app | Dos plantillas, solo body |

## Contrato de las plantillas

El worker habla con Meta por `parameter_name`, no por `{{1}}`. [repo: whatsapp_rulett-app/openspec/specs/integrations.md]

Los `{{1}}` y `{{2}}` de la historia son los huecos del texto. En Meta y en el JSON de la cola se llaman así:

| `templateName` | Header | Body, en este orden | Botón |
|---|---|---|---|
| `recordatorio_suscripcion_7d` | ninguno | `nombre_comercio`, `dias` (texto `7`) | URL fija `https://www.rulett.app/admin/suscripcion`, título «Pagar suscripción» |
| `recordatorio_suscripcion_hoy` | ninguno | `nombre_comercio` | el mismo botón |

Idioma `es_CO`. Categoría de Meta: utilidad. El botón no viaja en el POST. [repo: whatsapp_rulett-app/src/services/whatsapp.ts]

Texto del body, igual a la historia. El worker no arma el texto: Meta lo tiene. El worker solo manda los parámetros.

Si el nombre de plantilla no está mapeado, el worker hoy manda solo el header `nombre_tenant` y Meta responde `132000`. Por eso el mapeo nuevo es body sin header, y el deploy del worker va antes de encender el cron. [repo: whatsapp_rulett-app/src/services/whatsapp.ts]

`parseTemplateParams` descarta el JSON si no trae `nombre_tenant` y `nombre_usuario`. Con eso, un aviso de suscripción ni siquiera llama a Meta: `sendTemplateMessage` responde `templateParams vacío` y la fila queda `FAILED`. [repo: whatsapp_rulett-app/src/db/queue.ts] [repo: whatsapp_rulett-app/src/services/whatsapp.ts] La validación nueva es por plantilla. Las cuatro actuales siguen exigiendo esos dos campos. Las dos nuevas exigen `nombre_comercio` y, en la de 7 días, `dias` como texto `"7"`.

En rulett-app, `isWhatsappTemplateParams` hace el mismo exigido. [repo: rulett-app/src/lib/whatsapp-template-params.ts] T-05 no puede encolar el aviso hasta que esa función acepte el JSON nuevo sin pedir `nombre_tenant` ni `nombre_usuario`.

`userName` sigue siendo `NOT NULL` en la cola. [repo: whatsapp_rulett-app/sql/schema.sql] El aviso lo llena con el nombre del comercio. El worker no lo usa como parámetro de estas plantillas.

`String(row.qrCampaignId)` convierte un null en el texto `"null"`. [repo: whatsapp_rulett-app/src/db/queue.ts] W-02 lo deja en null. El `DROP NOT NULL` de `sql/schema.sql` es solo para el Docker local. La migración de Neon es T-01. No correr `db:schema` del worker contra Neon.

El log de `processRow` imprime `userPhone` completo. [repo: whatsapp_rulett-app/src/processor.ts] W-02 lo enmascara y deja los últimos 4 dígitos.

El repo del worker no tiene script `test`. [repo: whatsapp_rulett-app/package.json] W-00 agrega `node:test` con el `tsx` que ya está, y los tests en `test/`, sin dependencia nueva.

## Modelo de datos

Migración solo en rulett-app. El worker no migra. [repo: rulett-app/openspec/specs/operations.md]

`Tenant`

- `contactPhoneCountryCode String @default("57")`. Los registros actuales quedan en 57. `contactPhone` no se reescribe.

`enum MessageOrigin`

- `TENANT` (default) y `PLATFORM`.

`WhatsappQueue` y `SmsQueue`

- `origin MessageOrigin @default(TENANT)`
- `qrCampaignId` pasa a opcional. Las filas `TENANT` lo siguen enviando, como hoy. Las `PLATFORM` van con null.
- Índice existente por campaña no se borra; Prisma lo deja usable con null.

`SubscriptionReminder`

- `tenantId`, `kind` (`SEVEN_DAYS` | `DUE_DAY`), `expiresOn` (fecha calendario de `expiresAt` en Bogotá, no el instante), `status` (`QUEUED_WHATSAPP` | `SENT_WHATSAPP` | `SENT_SMS` | `NOT_DELIVERED`), `whatsappQueueId?`, `smsQueueId?`, `createdAt`, `updatedAt`.
- `@@unique([tenantId, kind, expiresOn])`.

`BranchLanding`

- `listedInDiscovery Boolean @default(true)`. v8 lo dejó en false; v9 lo invierte. [humano, 2026-10-01]
- `listedInDiscoveryAt DateTime?`. Se escribe al pasar el flag a true y se borra al pasarlo a false. El listado nacional de páginas ordena por este instante.
- Relleno, en una migración nueva (no se edita `20261001114819_subscription_reminders_discovery`): toda `BranchLanding` queda con `listedInDiscovery = true`. Si `listedInDiscoveryAt` ya tiene valor, se conserva. Si está nulo, se copia `createdAt`, para no dejar todas las páginas viejas con el mismo instante de la migración. El implementador la aplica solo en Docker local. Lab y producción las aplica el humano. [humano, 2026-10-01]
- Alta de super admin y alta de 14 días crean la landing por `bootstrapTenantRecords`. Esa creación deja el flag en true y el instante en ese momento. Lo mismo al crear una landing después, desde el admin del comercio. [repo: rulett-app/src/lib/tenant-bootstrap.ts] [repo: rulett-app/src/actions/superadmin/tenant.ts] [repo: rulett-app/src/actions/self-signup.ts]
- Sin latitud y longitud de esa sede la página no entra a la consulta de Descubre, aunque el flag esté en true. La casilla sigue marcada y se puede guardar. El texto del formulario dice que, sin esa ubicación, no sale en el listado. Al cargar el GPS después, sale sin volver a marcar la casilla. Apagarla borra el instante. [humano, 2026-10-01]

No se añade columna de estado a la suscripción. Sigue siendo `expiresAt`. [repo: rulett-app/openspec/specs/domain_model.md]

## Aviso

Zona `America/Bogota`. [repo: rulett-app/src/lib/billing/billing-timezone.ts]

No se usa `getDaysUntilExpiry` (techo de 24 h). [repo: rulett-app/src/lib/billing/subscription-expiry.ts] La regla de la historia es fecha calendario.

Cron nuevo `0 13 * * *` en `vercel.json` (13:00 UTC = 08:00 Bogotá; Colombia no cambia el reloj). Misma autorización `Bearer CRON_SECRET` que los otros crons. [repo: rulett-app/src/app/api/cron/send-whatsapp/route.ts]

El cron no hace nada si `SUBSCRIPTION_REMINDERS_ENABLED` no es `true`. Así un deploy no escribe a todos los contactos por accidente.

Elegible si, a las 08:00:

- `Tenant.isActive`
- hay suscripción y `expiresAt` todavía es futuro (`isSubscriptionActive`)
- la fecha calendario de `expiresAt` es hoy (kind `DUE_DAY`) o hoy más 7 (kind `SEVEN_DAYS`)
- no hay `PaymentReceipt` de ese comercio en `PENDING` con canal `MANUAL`. Un `PENDING` de Wompi no impide el aviso. [humano, 2026-10-01]

Sin teléfono de contacto no se encola WhatsApp ni SMS: se crea `SubscriptionReminder` en `NOT_DELIVERED` y la unique key impide el reintento. [repo: openspec/changes/active/051-recordatorio-juego-descubre/specs.md] Si no es elegible por otra causa, no se crea fila. Si el día ya pasó, no se recupera: el selector solo mira el calendario de esta mañana.

El cron diario dispara el worker solo si encoló al menos un WhatsApp. La reconciliación corre igual. Lo que ya quedó `PENDING` lo sigue drenando el cron de WhatsApp. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]

Idempotencia: la unique key. Un segundo disparo del cron no encola otro WhatsApp.

Destino: dígitos de `contactPhoneCountryCode` + `contactPhone`, reutilizando el criterio con el que la cola ya guarda `userPhone`. No duplicar otro normalizador.

Cupo: `getWhatsappLimitStatus` y `getSmsLimitStatus` cuentan `SENT` de todo el comercio. [repo: rulett-app/src/lib/whatsapp-limit.ts] [repo: rulett-app/src/lib/sms-limit.ts] Esas consultas suman `origin: TENANT`. El alta del aviso no llama a esos límites. El historial `/admin/whatsapp` y la cola SMS del comercio tampoco listan `PLATFORM`.

Reconciliación, en el mismo cron y también al final del cron de WhatsApp que ya corre cada 15 minutos:

- cola `SENT` → `SENT_WHATSAPP`. No hay SMS.
- cola `FAILED` → se encola el SMS `PLATFORM` (o se marca `NOT_DELIVERED` si el SMS falla). Un solo SMS.
- cola aún `PENDING` o `PROCESSING` → se espera al siguiente pase. No se manda SMS todavía.

El SMS no espera la aprobación de Meta: un `132000` es `FAILED` y dispara el SMS. [repo: rulett-app/openspec/specs/integrations.md]

Texto SMS, sin tildes, máximo 160, URL entera. Si no cabe, se recorta solo el nombre. Helper único junto a `SMS_MAX_LENGTH`. [repo: rulett-app/src/lib/sms-charset.ts]

El SMS de respaldo entra por `SmsQueue` con `origin = PLATFORM`, no por una llamada directa a LabsMobile. `sendSmsSingleViaLabsMobile` es privado del procesador y ya respeta ventana, alfabeto y estado `FAILED`. [repo: rulett-app/src/lib/sms-processor.ts] Una llamada directa duplicaría eso.

Carrera aceptada: si el comprobante manual pasa a `PENDING` después de encolar, no se cancela el WhatsApp ya puesto en cola.

El JSON del aviso no lleva `nombre_tenant` ni `nombre_usuario`. Meterlos para complacer al parser viejo queda descartado: el parser se valida por plantilla (v3).

El listado de Descubre, nacional o local, devuelve como máximo 12 fichas en total, ruletas y páginas juntas. Hoy el tope interno llega a 24 si el llamador lo pide. [repo: rulett-app/src/actions/discovery.ts] Aquí el tope es 12.

Comercio sin suscripción (legacy): no hay fecha, no hay aviso. En Descubre, `isSubscriptionBillingExpired` es falso si no hay fila, así que sigue listado. [repo: rulett-app/src/lib/billing/subscription-access.ts] No es una regla nueva.

## Juego

Solo presentación. Ruta existente `/{tenant}/play/{qrId}`. [repo: rulett-app/src/app/[tenant]/play/[qrId]/page.tsx]

Textos de la historia en el paso 1, 2, 3 y 4 de `GameFlow`. El nombre de campaña del encabezado, una línea (`line-clamp` / truncado). La ruleta deja de ser un cuadrado fijo de 320 px si eso empuja el botón; el criterio es el viewport, no un píxel mágico. [repo: rulett-app/src/components/GameFlow.tsx] [repo: rulett-app/src/components/game/CampaignBrandHeader.tsx]

Prueba de layout: viewport 390×844 sobre los cuatro pasos. Vitest no demuestra la ausencia de scroll. Los textos, si se extraen a un módulo, sí llevan test unitario.

## Descubre

`getTopNationalCampaigns` y `getLocalCampaigns` pasan a devolver un ítem con `kind: ROULETTE | PAGE`. [repo: rulett-app/src/types/discovery.ts]

Ruleta: lo de hoy (`isPubliclyVisible`, comercio `isActive`, sedes con GPS) más exclusión si `isSubscriptionBillingExpired`.

Página: `BranchLanding.isActive`, `listedInDiscovery`, la sede activa con latitud y longitud, comercio `isActive`, suscripción no vencida. Distancia = esa sede, no la más cercana de varias. Radio 15 km. Flag en true y sede sin GPS: no sale. [repo: rulett-app/src/lib/discovery-geo.ts] [humano, 2026-10-01]

Filtros `type` (`all` | `roulette` | `page`) y `categoryId` de `TenantCategory`. Sin categoría: solo en `all`.

`/descubre` y `DiscoveryBoard` de la billetera usan la misma función. [repo: rulett-app/src/components/public/DiscoveryBoard.tsx] [repo: rulett-app/src/components/wallet/WalletShell.tsx]

Cómo llegar. La ficha de página muestra «A {n} km de ti» y no ofrece ir. [humano, 2026-10-01] [repo: rulett-app/src/components/public/DiscoveryBoard.tsx] `DiscoveryItem` hoy no trae coordenadas. [repo: rulett-app/src/types/discovery.ts] La sede de una página publicada sí las tiene. [repo: rulett-app/src/actions/discovery.ts]

- Botón «Cómo llegar» en la ficha `PAGE`, en `/descubre` y en la billetera, además de «Ver página». También en la landing pública de esa sede (`BranchLandingView`), que es el menú. Sale aunque la distancia sea 0 y también en el listado nacional.
- No va en fichas de ruleta.
- Destino: latitud y longitud de esa sede, con el nombre del lugar. No hace falta dirección postal.
- En Android abre `geo:` para la app de mapas predeterminada. En iPhone abre Mapas de Apple. En escritorio abre la URL de Google Maps que ya usa el cupón de la billetera, en otra pestaña. [repo: rulett-app/src/lib/wallet.ts]
- Sin coordenadas válidas no se muestra el botón. No se agregan teléfono, correo ni otras sedes.

Ficha de página. Hoy la línea «Sede · …» solo se pinta en la ruleta, así que la página queda con un hueco para igualar la altura. [repo: rulett-app/src/components/public/DiscoveryBoard.tsx] [humano, 2026-10-01]

- La ficha `PAGE` no muestra «Sede · {nombre}»: `name` ya es el nombre de esa sede. [repo: rulett-app/src/actions/discovery.ts] La ruleta sí la muestra. En `/descubre` y en la billetera, el hueco de la página es la línea del menú.
- Debajo, una sola línea más, solo en la página:
  - Si esa sede tiene al menos un producto de menú con oferta: «Tiene 1 oferta en el menú» o «Tiene {n} ofertas en el menú». El enlace abre el menú público de esa sede (`/l/{comercio}/{sede}/menu`).
  - Si no hay ofertas y sí hay productos activos de esa sede: «Menú digital de esta sede», al mismo menú.
  - Si no hay productos activos de esa sede: no hay segunda línea. La sede basta.
- Oferta = la misma regla que la pestaña «Ofertas»: producto activo, categoría activa, asociado a esa sede, y `resolveProductDisplayPrice(...).hasDiscount`. No se cuenta con SQL. [repo: rulett-app/src/lib/product-pricing.ts] [repo: rulett-app/src/lib/digital-menu-offers.ts]
- El conteo viaja en el ítem de Descubre. Una consulta agrupada por las sedes del resultado, no una carga del menú por ficha.
- La ruleta no muestra esa línea de menú. Sus botones no cambian.

Cupones del alta. `persistBootstrapAiCoupons` crea hasta 3 cupones inactivos y no les pone sede: `createMany` no escribe la relación `Coupon.branches`. [repo: rulett-app/src/lib/tenant-bootstrap-ai.ts] [repo: rulett-app/prisma/schema.prisma] Lo llaman el alta de super admin y el alta de 14 días, después de crear la sede. [repo: rulett-app/src/actions/superadmin/tenant.ts] [repo: rulett-app/src/actions/self-signup.ts]

- Esos dos llamadas pasan el `branchId` que acaba de devolver `bootstrapTenantRecords`. Cada cupón creado en esa llamada queda conectado a esa sede.
- Si la IA no crea ninguno, el alta sigue igual: no lanza.
- El `branchId` sale del alta, nunca del JSON de la IA.
- `create-ai-coupons` (el botón del panel) no recibe sede y no conecta `Coupon.branches`. [repo: rulett-app/src/actions/create-ai-coupons.ts]
- No se reescriben cupones ya guardados.

Publicar: la casilla nace marcada y se puede guardar sin GPS. El texto avisa que, sin la ubicación de esa sede, no sale en Descubre. No exige GPS de las otras sedes. [humano, 2026-10-01] [repo: rulett-app/src/components/admin/QrDiscoveryPublishForm.tsx]

Orden nacional: ruletas por jugadas; páginas por `listedInDiscoveryAt` descendente, detrás de las ruletas si el filtro es «todas». [humano, 2026-09-30] [humano, 2026-10-01]

## Seguridad — triage OWASP

Aplicación web y crons. No hay app nativa: MASVS no aplica.

| Ítem | | Control | Task |
|---|---|---|---|
| A01 Control de acceso roto | aplica | El cron exige `CRON_SECRET`. Publicar la página exige la sesión de administrador del comercio que ya guarda la landing. La sede del cupón de alta es la que acaba de crear ese alta, no un id que mande la IA. Descubre no devuelve teléfono, correo ni pagos. La coordenada de la sede publicada es la ubicación del local, no un dato de jugador. | T-05, T-09, T-10, T-12, T-13, T-14 |
| A02 Fallos criptográficos | no aplica | No hay secreto nuevo. El teléfono de contacto ya se guardaba. | |
| A03 Inyección | aplica | Consultas por Prisma. El SMS es plantilla fija más el nombre recortado; el nombre no se concatena a SQL. | T-07 |
| A04 Diseño inseguro | aplica | Olvidar `origin: TENANT` en el cupo haría que el aviso consuma el cupo del comercio. Test de regresión del conteo. | T-02 |
| A05 Configuración | aplica | El aviso nace apagado (`SUBSCRIPTION_REMINDERS_ENABLED`). | T-05 |
| A06 Componentes vulnerables | no aplica | Sin dependencia nueva prevista. | |
| A07 Fallos de identificación | no aplica | No hay login nuevo. El botón de pago cae al login de admin que ya existe. | |
| A08 Integridad | aplica | Unique de `SubscriptionReminder` evita dos avisos del mismo momento. | T-01, T-05 |
| A09 Registro | aplica | No loguear el teléfono completo. Seguir el criterio de `logError` ya usado en discovery. | T-05 |
| A10 SSRF | no aplica | La URL del botón es constante. | |

API Security: el cron es el único extremo nuevo. API2 (autenticación rota) queda cubierto por `CRON_SECRET`. API3 (exposición de datos) queda cubierto porque la fila `PLATFORM` no sale en el historial del comercio.

## Retrocompatibilidad

| Contrato | Consumidor | Estrategia |
|---|---|---|
| `WhatsappQueue.qrCampaignId` obligatorio | worker, altas actuales | Pasa a opcional. Las altas actuales lo siguen mandando. Default de `origin` = `TENANT`, así el cupo no cambia hasta que el código nuevo filtre. |
| Conteo de cupo | panel del comercio | Se despliega el filtro `TENANT` en el mismo release que la migración, antes de encender el cron. |
| Cuatro plantillas del worker | mensajes a clientes | No se tocan sus ramas en `buildTemplateComponents`. |
| `DiscoveryCampaign` | `/descubre`, billetera | Se amplía el tipo en el mismo repo. No hay API pública externa conocida. |
| Juego | quien escanea el QR | Cambia textos y encuadre a propósito. No cambia el giro ni el reclamo. |
| Landing | `/l/{comercio}/{sede}` | v9: `listedInDiscovery` default true, también las páginas ya creadas. Sin GPS de esa sede no salen en Descubre. Apagar la casilla las saca. |
| Cupón del alta | relación `Coupon.branches` | Solo los cupones creados en el alta de super admin o de 14 días quedan en la sede de ese alta. El botón de IA del panel y los cupones viejos no cambian. |
| Ficha de Descubre | `/descubre`, billetera | La página gana la línea de sede y, si aplica, la del menú. La ruleta sigue igual. |
| Casilla de Descubre | `/admin/landings/{id}` | v11: mismo texto, mismo `name="listedInDiscovery"`, mismo aviso de GPS. Se añade `aria-label` en el `<label>` porque Sonar no lee el texto que está a dos `<span>` de profundidad. [repo: src/components/admin/BranchLandingDiscoveryForm.tsx] |
| Relleno `20261001230527` | landings ya creadas | v11: el `UPDATE` gana un `WHERE` equivalente. No hay migración nueva. El archivo ya se aplicó en Docker; lab y producción no. Solo se corrige el checksum en Docker. No se ejecuta contra Neon. |

Rollback: apagar `SUBSCRIPTION_REMINDERS_ENABLED`, borrar filas `PLATFORM` y `SubscriptionReminder`, dejar las columnas (expand sin contract). Revertir la migración con filas `PLATFORM` todavía presentes fallaría por el null de `qrCampaignId`. No se revierten columnas en caliente.

## Quality gate

Cobertura del repo para `src/lib` nuevo está en ≥70 %. [repo: rulett-app/openspec/specs/testing.md] Este SDD pide ≥80 % sobre las líneas nuevas de las tasks, 0 bugs nuevos de fiabilidad, 0 vulnerabilidades nuevas, hotspots de T-02 y T-05 revisados, y sin copiar el recorte SMS en un segundo módulo (duplicación ≤3 % en lo nuevo).
