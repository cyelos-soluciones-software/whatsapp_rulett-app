SDD: 17tnjra85qn · v8 · 2026-10-01

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

R-26. Publicar sin GPS de esa sede no guarda el flag y el administrador ve que falta la ubicación.

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
| Página no publicada / sin GPS | R-25, R-26 | T-09 | unit de la acción |
| Suscripción vencida fuera de Descubre | R-27 | T-10 | unit |
| Sin GPS del usuario | R-28 | T-10 | unit |
| Billetera igual que la página | R-29 | T-11 | la misma función; smoke de props |
| Cómo llegar abre el mapa de la sede | R-30 | T-12 | unit del enlace; revisión en el celular |
