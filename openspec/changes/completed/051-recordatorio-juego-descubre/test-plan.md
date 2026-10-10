# Plan de pruebas — 17tnjra85qn · Recordar el pago, caber el juego y filtrar Descubre
SDD: 17tnjra85qn · v8 · Generado: 2026-10-01
Ambiente: localhost — `http://localhost:3000` (rulett-app). Lo confirmó el analista. No es laboratorio remoto ni producción. Prohibido llamar Neon de lab/PDN, Render o encender el flag fuera de este `.env` local.

ClickUp no se leyó en esta sesión. Los criterios salen de `specs.md`. La regresión corta de esta historia está en `regression.md`.

T-12 no está implementada. R-30 se ejecuta para dejar constancia; si falta el botón, el caso queda no probado por tarea pendiente, no como defecto de T-11.

Los criterios R-01 a R-16, R-06, R-07, R-08, R-10 a R-14 y el cupo ya tienen prueba unitaria en el repo. Aquí no se reescriben. En localhost solo se aceptan si el analista confirma que el teléfono de contacto es de prueba. No se dispara el cron contra un número real.

## Prerequisitos de ambiente
- [ ] `npm run dev` de rulett-app responde en `http://localhost:3000`.
- [ ] El analista inicia sesión él mismo en la billetera. No se piden contraseñas.
- [ ] Hay al menos una página en Descubre (Hype Burguer u otra) y, si existe, una ruleta cerca.
- [ ] Un QR de juego público para los cuatro pasos, en viewport 390×844.
- [ ] Sesión de super admin solo si se llega a CP-09 y CP-10.
- [ ] Para el aviso (CP-11 en adelante): comercio sintético, teléfono de prueba, `SUBSCRIPTION_REMINDERS_ENABLED=true` solo en el `.env` local, worker local, y la plantilla que corresponda. `recordatorio_suscripcion_hoy` sigue en revisión en Meta.

## Casos

### CP-01 · Descubre en la billetera
Criterio: R-22, R-29
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: sesión del analista. Pestaña Descubre.
Pasos:
1. Abrir `http://localhost:3000/billetera` ya con sesión.
2. Entrar a Descubre.
3. Pulsar Páginas, luego Ruletas, luego Todas.
4. Volver a Mis Cupones.
Resultado esperado: Páginas no muestra ruletas. Ruletas no muestra páginas. El botón de una página dice «Ver página» y el de una ruleta «¡Jugar Ahora!». Mis Cupones sigue existiendo.

### CP-02 · Misma consulta en la página pública
Criterio: R-29, R-21, R-28
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: sin sesión, o la misma. GPS del navegador si el navegador lo pide.
Pasos:
1. Abrir `http://localhost:3000/descubre`.
2. Comparar filtros Todas / Ruletas / Páginas con lo visto en la billetera.
3. Si el navegador no da GPS, anotar que el listado es nacional.
Resultado esperado: los mismos tres filtros. Con GPS, fichas de ruleta y de página, distancia, tope 12. Sin GPS, listado nacional y los filtros siguen. No más de 12 fichas.

### CP-03 · Categoría
Criterio: R-23, R-24
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: una categoría que tenga comercios y, si existe, uno sin categoría.
Pasos:
1. En Descubre, filtro Todas las categorías: anotar si aparece un comercio sin categoría.
2. Elegir una categoría concreta.
Resultado esperado: la categoría deja solo comercios de esa categoría. Uno sin categoría no aparece al filtrar.

### CP-04 · Página no publicada
Criterio: R-25
Tipo: negativo
Canal: backoffice
Ejecuta: navegador asistido
Datos: una landing activa con GPS y `listedInDiscovery` apagado, si el analista tiene una.
Pasos:
1. Confirmar en el admin de esa landing que Descubre está destildado.
2. Buscarla en `/descubre` y en la billetera.
Resultado esperado: no sale. Si no hay esa landing en local, el caso queda no probado.

### CP-05 · Suscripción vencida fuera de Descubre
Criterio: R-27
Tipo: negativo
Canal: backoffice
Ejecuta: analista
Datos: un comercio de prueba con suscripción vencida y página o ruleta pública.
Pasos:
1. Buscar ese comercio en Descubre.
Resultado esperado: no aparece. Si en local no hay uno vencido, no probado.

### CP-06 · Juego en una pantalla
Criterio: R-17, R-18, R-19, R-20
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: una campaña pública. Viewport 390×844.
Pasos:
1. Abrir el juego de esa campaña.
2. Paso 1: leer título, subtítulo y la línea de gratis. El nombre de campaña en el encabezado es una línea.
3. Paso 2: título e instrucción. Con hasta 4 intereses, no hay scroll de la página. Si hay más de 4, solo se mueve la grilla.
4. Paso 3: título «Gira y descubre tu premio», ruleta y botón de girar juntos.
5. Girar solo si el analista acepta consumir un juego de prueba. Si no, el paso 4 queda no probado.
Resultado esperado: los textos de R-17 a R-19 se ven sin scroll del documento en 390×844. El premio guardado no se reescribe.

### CP-07 · Cómo llegar
Criterio: R-30
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: ficha de página con distancia, por ejemplo Hype Burguer, y su menú.
Pasos:
1. En la ficha, buscar «Cómo llegar» junto a «Ver página».
2. Abrir «Ver página» y buscar el mismo botón.
3. Mirar una ficha de ruleta.
Resultado esperado del contrato: el botón está en la página y en el menú, no en la ruleta, y abre mapas. Hoy T-12 no está hecha: si falta el botón, no probado por tarea pendiente.

### CP-08 · Cupones de la billetera siguen abriendo mapa
Criterio: retrocompatibilidad de la billetera
Tipo: no-regresión
Canal: backoffice
Ejecuta: navegador asistido
Datos: un cupón con sede y coordenadas.
Pasos:
1. En Mis Cupones, abrir un cupón que liste sedes.
2. Pulsar el nombre de la sede.
Resultado esperado: abre Google Maps en otra pestaña con esas coordenadas, como antes de esta historia.

### CP-09 · Alta exige código de país
Criterio: R-09
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: sesión de super admin, o el formulario de prueba de 14 días si está en local.
Pasos:
1. Abrir el alta o la edición de un comercio.
2. Dejar vacío el teléfono de contacto e intentar guardar.
3. No guardar un teléfono real.
Resultado esperado: no deja guardar contacto sin código de país y número. Un comercio viejo se puede guardar si no se cambia el teléfono.

### CP-10 · Publicar sin GPS
Criterio: R-26
Tipo: negativo
Canal: backoffice
Ejecuta: navegador asistido
Datos: landing de una sede sin latitud ni longitud.
Pasos:
1. En el admin de esa landing, intentar marcar Descubre.
Resultado esperado: no queda publicada y se ve que falta la ubicación. Si toda sede local tiene GPS, no probado.

### CP-11 · El cron apagado no escribe
Criterio: R-15, A05
Tipo: seguridad
Canal: API
Ejecuta: Claude
Datos: flag distinto de `true`. No se imprime `CRON_SECRET`.
Pasos:
1. Llamar `GET http://localhost:3000/api/cron/subscription-reminders` sin secreto.
2. Llamarla con secreto inválido.
3. Con secreto válido y flag apagado, comprobar que no inserta `SubscriptionReminder`.
Resultado esperado: sin secreto, no autorizado. Con flag apagado, no hay filas nuevas.

### CP-12 · Aviso a 7 días
Criterio: R-01, R-04, R-16
Tipo: positivo
Canal: API
Ejecuta: Claude
Datos: comercio sintético, teléfono de prueba, `expiresAt` dentro de 7 días calendario, sin recibo MANUAL pendiente. Flag local en true. Worker local.
Pasos:
1. Disparar el cron una vez.
2. Leer la fila de cola sin copiar el teléfono completo.
Resultado esperado: un WhatsApp `PLATFORM`, plantilla `recordatorio_suscripcion_7d`, `nombre_comercio` y `dias` texto `"7"`, sin SMS. Si Meta ya aprobó esa plantilla y el worker local está arriba, puede quedar `SENT`. Si queda `templateParams vacío`, no cumple.

### CP-13 · Vence hoy con plantilla en revisión
Criterio: R-02, R-11
Tipo: borde
Canal: API
Ejecuta: Claude
Datos: otro comercio sintético cuyo `expiresAt` es hoy y todavía es futuro a la hora de la prueba. Teléfono de prueba.
Pasos:
1. Disparar el cron.
2. Dejar que el worker procese.
Resultado esperado: WhatsApp no entregado. SMS `PLATFORM` con la URL completa, sin tildes, máximo 160. No se hace esta prueba si el teléfono no es de prueba.

### CP-14 · No avisa si no corresponde
Criterio: R-03, R-05
Tipo: negativo
Canal: bd
Ejecuta: analista
Datos: un comercio desactivado, uno ya vencido y uno con recibo MANUAL en `PENDING`.
Pasos:
1. Incluirlos en la ventana del cron.
2. Confirmar que no nace `SubscriptionReminder` para ellos.
Resultado esperado: cero filas de aviso. Un `PENDING` de Wompi no calla el aviso; eso ya está en unit y aquí no se fuerza si no hay un Wompi de prueba.

### CP-15 · Las cuatro plantillas de cliente no cambian
Criterio: retrocompatibilidad del worker
Tipo: no-regresión
Canal: API
Ejecuta: analista
Datos: ninguna fila real de cliente.
Pasos:
1. No reenviar mensajes a clientes.
Resultado esperado: no verificable en esta corrida de localhost sin un envío real. Cubierto por las pruebas del worker. Queda dicho, no en silencio.

## Matriz de cobertura
| Criterio | Casos |
|---|---|
| R-01, R-04, R-16 | CP-12 |
| R-02, R-11 | CP-13 |
| R-03, R-05 | CP-14 |
| R-06, R-07, R-08, R-10, R-12, R-13, R-14 | unitarios del repo; no se duplican en localhost |
| R-09 | CP-09 |
| R-15 | CP-11 |
| R-17 … R-20 | CP-06 |
| R-21, R-28 | CP-02 |
| R-22, R-29 | CP-01, CP-02 |
| R-23, R-24 | CP-03 |
| R-25 | CP-04 |
| R-26 | CP-10 |
| R-27 | CP-05 |
| R-30 | CP-07 |
| Billetera cupones | CP-08 |
| Plantillas de cliente | CP-15 |

## Corrida laboratorio — 2026-10-01

Ambiente confirmado por el analista: `https://lab.rulett.app`. No es producción. No se llama el cron con el secreto real. No se gira la ruleta. No se crea una cuenta.

Los resultados esperados de CP-04 y CP-10 son los de la v8. En la v11 la casilla puede quedar marcada sin GPS y el relleno publica las páginas ya creadas. Esos dos casos no se juzgan con el texto viejo. El analista ya aprobó la sede sin GPS (R-26). Esta corrida no la repite. El 2026-10-01 cierra el laboratorio con lo ejecutado. El envío al teléfono queda fuera.

### CL-01 · Filtros cerca
Criterio: R-21, R-22, R-28
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: `https://lab.rulett.app/descubre`, sin sesión.
Pasos: abrir Descubre, esperar el GPS del navegador, pulsar Páginas, Ruletas y Todas.
Resultado esperado: con GPS, fichas de los dos tipos y no más de 12. Páginas no muestra ruletas. Ruletas no muestra páginas. Sin GPS, listado nacional.

### CL-02 · Categoría
Criterio: R-23, R-24
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: el mismo listado cercano.
Pasos: en Todas, elegir Farmacias y después una categoría que no corresponda a esas fichas.
Resultado esperado: Farmacias deja solo comercios de esa categoría. La otra categoría no los mezcla.

### CL-03 · Ficha de página y menú
Criterio: R-30, R-33, R-34, R-35
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: la página que salga en Páginas y su menú.
Pasos: leer el título, la línea del menú y «Cómo llegar». Abrir el menú. Mirar una ruleta.
Resultado esperado: el título de la página es la sede, sin repetir «Sede ·». La línea de ofertas abre el menú. «Cómo llegar» está en la ficha y en el menú, no en la ruleta. En escritorio abre Google Maps.

### CL-04 · Alta pública, código de país
Criterio: R-09
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: `https://lab.rulett.app/registro`. No se envía el formulario.
Pasos: abrir el alta y leer el celular de contacto.
Resultado esperado: el país queda en +57 y el celular es obligatorio. No se crea la cuenta.

### CL-05 · Cron sin secreto
Criterio: R-15
Tipo: seguridad
Canal: API
Ejecuta: Claude
Datos: ninguna credencial real.
Pasos: `GET /api/cron/subscription-reminders` sin secreto y con un bearer que no es el secreto.
Resultado esperado: 401. No se llama con el secreto de laboratorio.

### CL-06 · Paso 1 del juego
Criterio: R-17
Tipo: positivo
Canal: backoffice
Ejecuta: navegador asistido
Datos: una ruleta pública ya listada. Viewport 390×844. No se gira.
Pasos: abrir el juego y medir el scroll del paso 1.
Resultado esperado: título, línea de gratis y sin scroll del documento. Los pasos 2 a 4 quedan fuera si no se gira.
