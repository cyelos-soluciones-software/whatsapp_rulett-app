SDD: 17tnjra85qn · v11 · 2026-10-01

# Spec

Los escenarios de negocio están en la historia. Aquí se fijan los que el código debe cumplir y cómo se prueban.

## Aviso

R-01. A las 08:00 Bogotá, un comercio activo, con suscripción aún no vencida, sin recibo `MANUAL` en `PENDING`, cuyo `expiresAt` cae en 7 días calendario, encola un WhatsApp `PLATFORM` `recordatorio_suscripcion_7d` al contacto (`57` + número si no tiene otro código) y no encola SMS.

R-02. El día calendario de `expiresAt`, si a las 08:00 el instante todavía es futuro, encola `recordatorio_suscripcion_hoy`.

R-03. Si `expiresAt` ya pasó, o el comercio está `isActive = false`, no hay fila de aviso ni mensaje.

R-04. Prueba gratis con `expiresAt` a 7 días: igual que R-01.

R-05. Un recibo `PENDING` de canal `MANUAL` impide crear el aviso de los 7 días y el del día. Un `PENDING` de Wompi no lo impide. [humano, 2026-10-01]

R-06. Si el recibo se rechaza antes de las 08:00 del día que corresponde, R-01 o R-02 sí ocurren. Si el rechazo es al día siguiente, ese momento no se crea.

R-07. Si un pago aprobado mueve `expiresAt`, el `DUE_DAY` de la fecha vieja no se selecciona. La unique key de la fecha nueva permite un ciclo nuevo.

R-08. Contacto previo a la migración: el código guardado es `57`.

R-09. Alta de super admin y prueba de 14 días exigen código de país y número de contacto. El aviso usa ese código.

R-10. Cola WhatsApp `FAILED` → un SMS `PLATFORM` con el texto de la historia, sin tildes, ≤160, URL completa. No queda también el WhatsApp como entregado.

R-11. Plantilla aún no aprobada (Meta `132000` u otro rechazo) → no hay WhatsApp entregado y sí hay SMS.

R-12. Nombre que no cabe: se recorta el nombre, no la URL.

R-13. WhatsApp `FAILED` y SMS `FAILED` → `NOT_DELIVERED`. La unique key impide otro intento al día siguiente.

R-14. Con el cupo del comercio en cero, el aviso igual se encola. `getWhatsappLimitStatus` y `getSmsLimitStatus` no aumentan `sentThisMonth` por filas `PLATFORM`.

R-15. El cron con `SUBSCRIPTION_REMINDERS_ENABLED` distinto de `true` no escribe filas. Sin `CRON_SECRET` válido responde no autorizado, igual que `send-whatsapp`.

R-16. Parámetros encolados: `nombre_comercio` y, en la de 7 días, `dias = "7"`. Sin header.

## Juego

R-17. Paso 1 muestra «¡Prueba tu suerte!», «Gira y gana un premio de {nombre del comercio}.» y «Sin registros · Sin compras · 100% gratis». El nombre de campaña del encabezado ocupa una línea.

R-18. Paso 2: «¿Qué buscas hoy?» y «Elige uno o varios.» Con 4 intereses, en 390×844, título, tarjetas y continuar se ven sin scroll del documento. Con 6, el título y continuar siguen visibles y la grilla se desplaza.

R-19. Paso 3: «Gira y descubre tu premio», sin el subtítulo actual. Ruleta y botón de girar visibles juntos en 390×844.

R-20. Paso 4: «¡Ganaste!», título y descripción a lo sumo dos líneas en pantalla. Botones de guardar visibles. El premio en base no se modifica.

## Descubre

R-21. Con GPS, una ruleta pública y una página `listedInDiscovery` a ≤15 km salen como fichas de distinto `kind`. El resultado, mezclado, no pasa de 12 fichas.

R-22. Filtro `page` oculta ruletas. Filtro `roulette` oculta páginas.

R-23. Filtro por `TenantCategory` deja solo comercios de esa categoría.

R-24. Comercio con `categoryId` null: visible en todas, oculto al elegir una categoría.

R-25. Landing activa con GPS pero `listedInDiscovery = false`: no sale.

R-26. Landing con `listedInDiscovery = true` y sede sin latitud o sin longitud: no sale. La casilla puede quedar marcada y el guardado no la apaga. El administrador ve que, sin esa ubicación, no aparece en el listado. [humano, 2026-10-01]

R-31. Toda landing nace con la casilla marcada: alta de super admin, alta de 14 días y alta posterior de una landing en el admin. Las que ya existen quedan marcadas. El comercio puede apagarla. Al apagarla, `listedInDiscoveryAt` vuelve a null. [humano, 2026-10-01]

R-32. Los cupones que el alta de super admin o el alta de 14 días logra crear quedan asociados a la sede creada en ese alta. Si no se crea ninguno, el alta igual termina. El botón de cupones con IA del panel no asocia sede. Los cupones ya guardados no se reasignan. [humano, 2026-10-01]

R-33. La ficha `PAGE` no repite «Sede · {nombre}». Su título ya es el nombre de esa sede y arriba va el nombre del comercio. [repo: rulett-app/src/actions/discovery.ts] La ruleta sigue mostrando «Sede · {nombre}» porque su título es la campaña. El hueco de la página lo ocupa la línea del menú de R-34 y R-35. Si no hay productos activos, no hay línea extra. [humano, 2026-10-01]

R-34. Si el menú de esa sede tiene 1 producto con oferta, la ficha dice «Tiene 1 oferta en el menú». Si tiene más, «Tiene {n} ofertas en el menú». El enlace abre `/l/{comercio}/{sede}/menu`. Oferta es la de la pestaña «Ofertas»: producto activo, categoría activa, de esa sede, y `resolveProductDisplayPrice` con `hasDiscount`. Un descuento que esa función no cuenta, no suma. El conteo es en código, no en SQL. [humano, 2026-10-01] [repo: rulett-app/src/lib/product-pricing.ts]

R-35. Si esa sede no tiene ofertas y sí tiene productos activos, la ficha dice «Menú digital de esta sede» y abre el mismo menú. Si no tiene productos activos, no hay segunda línea. [humano, 2026-10-01]

R-27. `isSubscriptionBillingExpired` verdadero: ni ruleta ni página de ese comercio.

R-28. Sin GPS del usuario: listado nacional, y los filtros igual aplican. Las ruletas van por jugadas. Las páginas van por `listedInDiscoveryAt` descendente y, si el filtro es «todas», detrás de las ruletas. El total no pasa de 12. [humano, 2026-09-30] [humano, 2026-10-01]

R-29. La pestaña Descubre de la billetera usa el mismo resultado que `/descubre` para los mismos filtros. La pestaña de cupones sigue.

R-30. Una ficha `PAGE` con coordenadas de sede muestra «Cómo llegar» junto a «Ver página», en `/descubre` y en la billetera, con o sin distancia. El mismo botón está en el menú público de esa sede. Abre la app de mapas del celular en esas coordenadas. Una ficha de ruleta no lo muestra. Sin coordenadas, el botón no aparece. [humano, 2026-10-01]

## Errores y bordes

- Teléfono de contacto vacío: se crea `NOT_DELIVERED` y no se reintenta.
- Dos crons solapados: la unique key deja una sola fila `QUEUED_WHATSAPP`.
- Worker desplegado sin W-01: la fila falla en el worker, sin llamar a Meta, con `errorLog` `templateParams vacío: no se puede enviar plantilla con variables`. El reconciliador manda SMS. No es un `132000`.
- Worker con W-01 y plantilla Meta distinta (posicional o con header): ahí sí Meta responde `132000` y también sale el SMS.
- Legacy sin `TenantSubscription`: sin aviso; en Descubre no se considera vencido.

## SonarCloud v11

R-36. En `/admin/landings/{id}` la casilla sigue diciendo «Publicar esta página en Descubre» y el texto de los 15 km, que sigue siendo un `<span>` dentro del `<label>`. Los ids salen de `useId()`. El `<label>` lleva `aria-label` con ese mismo título y `htmlFor` apuntando al `id` del checkbox. Ese span lleva `id` y el input lo referencia con `aria-describedby`. El aviso ámbar de GPS no entra ahí. `name` sigue siendo `listedInDiscovery`. [repo: src/app/admin/landings/[id]/page.tsx]

R-31, ajuste v11. El relleno de páginas ya creadas queda así, en el mismo archivo `prisma/migrations/20261001230527_discovery_listed_default_true/migration.sql`:

```sql
UPDATE "BranchLanding"
SET "listedInDiscovery" = true,
    "listedInDiscoveryAt" = COALESCE("listedInDiscoveryAt", "createdAt")
WHERE "listedInDiscovery" = false
   OR "listedInDiscoveryAt" IS NULL;
```

Una fila ya publicada y con instante no cambia: el `UPDATE` anterior la reescribía con los mismos valores y este la salta. Una fila apagada, o con instante nulo, recibe los mismos valores que el `UPDATE` sin `WHERE`. No se crea otra migración. `sonar.exclusions` no se toca: el proyecto ya rechazó tapar el gate con exclusiones. [repo: sonar-project.properties] [repo: openspec/changes/completed/050-tema-visual/decisions.md]

## Matriz

| Criterio de la historia | Requisito | Task | Prueba |
|---|---|---|---|
| Aviso a 7 días por WhatsApp | R-01, R-16 | T-04, T-05, W-01 | unit elegibilidad + params; worker mapea body |
| Aviso el día del vencimiento | R-02 | T-04, T-05, W-01 | unit fecha calendario |
| Ya vencida no avisa | R-03 | T-04 | unit |
| Prueba gratis | R-04 | T-04 | unit |
| Pago en revisión calla | R-05 | T-04 | unit |
| Rechazo a tiempo avisa | R-06 | T-04 | unit |
| Día pasado no se recupera | R-06 | T-04 | unit |
| Pago aprobado mueve la fecha | R-07 | T-04 | unit |
| Contacto viejo es 57 | R-08 | T-01 | migración / default |
| Alta pide código de país | R-09 | T-03 | test de schema de alta |
| WhatsApp no entregable → SMS | R-10, R-12 | T-06, T-07 | unit reconciliación y recorte |
| SMS no espera a Meta | R-11 | T-06 | unit FAILED → SMS |
| Ambos fallan | R-13 | T-06 | unit |
| No consume cupo | R-14 | T-02 | unit de conteo con fila PLATFORM |
| Comercio desactivado | R-03 | T-04 | unit |
| Bienvenida, intereses, ruleta, premio | R-17 … R-20 | T-08 | unit de textos + revisión 390×844 |
| Cerca, filtros, categoría, sin categoría | R-21 … R-24 | T-10, T-11 | unit de la consulta |
| Página no publicada / sin GPS | R-25, R-26, R-31 | T-13 | unit de la acción y del relleno |
| Cupón del alta en la sede | R-32 | T-14 | unit del alta; el botón de IA no conecta sede |
| Sede y ofertas en la ficha de página | R-33, R-34, R-35 | T-15 | unit del conteo y de la línea |
| Suscripción vencida fuera de Descubre | R-27 | T-10 | unit |
| Sin GPS del usuario | R-28 | T-10 | unit |
| Billetera igual que la página | R-29 | T-11 | la misma función; smoke de props |
| Cómo llegar abre el mapa de la sede | R-30 | T-12 | unit del enlace; revisión en el celular |
| Casilla con nombre accesible | R-36 | T-16 | el texto visible no cambia; el label declara `aria-label` |
| Relleno con `WHERE` equivalente | R-31 | T-17 | el SQL escribe las mismas filas; checksum solo en Docker |
