SDD: 17tnjra85qn · v8 · 2026-10-01

# Propuesta

## Problema

El contacto del comercio solo ve el vencimiento si entra al panel. El juego público, en un celular como el de las capturas, esconde la acción debajo del scroll. Descubre lista campañas QR y no las páginas del comercio, ni filtra por tipo ni por la categoría del alta. [proyecto: historias/lote-suscripcion-juego-descubre/historia.md]

## Valor

Cobrar a tiempo sin depender de que el administrador abra el panel. Dejar el botón del juego a la vista. Hacer que Descubre sirva para elegir una ruleta o una página cercana, en la web pública y en la billetera.

## Alcance

Lo de la historia local, sin ampliarlo:

- Dos avisos (7 días calendario y el día del vencimiento, hora Colombia), al teléfono de contacto, con código de país. Los ya cargados quedan en 57.
- WhatsApp de utilidad. Si Meta no lo entrega en el intento, SMS. Un intento por momento. No reintenta al día siguiente.
- No sale si el comercio está desactivado, si la suscripción ya venció, si ese día ya pasó, o si hay un `PaymentReceipt` en `PENDING` del canal `MANUAL`. Un `PENDING` de Wompi no calla el aviso. [humano, 2026-10-01]
- La prueba gratis entra mientras `expiresAt` no haya pasado.
- El aviso no cuenta en el cupo del comercio.
- Juego: textos acordados y título más acción visibles sin scroll en un viewport de 390×844.
- Descubre: fichas de ruleta y de página, filtros, 15 km, página pública y billetera. La página se publica solo con ubicación de esa sede. La ficha de página y su menú público ofrecen «Cómo llegar», que abre la app de mapas del celular en esa sede. [humano, 2026-10-01]

## No alcance

Avisos ya vencida, otros teléfonos, app nativa, cambiar los 15 km, enlace a la página dentro de la ficha de la ruleta, tablero de métricas para el comercio, reescribir el premio guardado, webhook de entrega de WhatsApp.

## Usuarios

Administrador del comercio (recibe el aviso y publica la página). Jugador anónimo del QR. Persona en `/descubre` o en la billetera.

## Criterios

Los escenarios de [proyecto: historias/lote-suscripcion-juego-descubre/historia.md], sección Criterios de aceptación. La matriz está en `spec.md`.

## Orden nacional de Descubre

[humano, 2026-09-30] [humano, 2026-10-01] Las páginas no tienen jugadas. En el listado nacional se ordenan por `listedInDiscoveryAt` (el instante en que se publicaron en Descubre), no por la creación de la página. Con el filtro «todas», van detrás de las ruletas. Las ruletas siguen ordenadas por jugadas. El listado, nacional o local, corta en 12 fichas en total.

## Riesgos

- Meta puede rechazar las plantillas. El SMS cubre ese caso. Un WhatsApp aceptado que no llega al teléfono no tiene respaldo. [repo: whatsapp_rulett-app/src/server.ts]
- Si el vencimiento es antes de las 08:00 del mismo día, el aviso de «hoy» no sale. [proyecto: historias/lote-suscripcion-juego-descubre/historia.md]
- El cupo actual cuenta toda fila `SENT` del comercio. Hay que excluir el aviso o se cobra contra su cupo. [repo: rulett-app/src/lib/whatsapp-limit.ts] [repo: rulett-app/src/lib/sms-limit.ts]

## Preguntas abiertas

Ninguna.
