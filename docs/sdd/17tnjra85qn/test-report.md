# Reporte de pruebas — 17tnjra85qn
Veredicto: Incompleto
Ejecutado: 2026-10-01 · Ambiente: localhost `http://localhost:3000` (confirmado por el analista; no es producción) · Versión probada: árbol de trabajo local, sin commit

## Resumen por criterio
| Criterio | Casos | Resultado |
|---|---|---|
| R-21, R-22, R-28, R-29 | CP-01, CP-02 | Cumple. El analista aprueba el escenario con Hype Burguer: la página publicada y con GPS sale en Descubre. También se vieron 2 fichas cerca, filtros Páginas y Ruletas, y la misma conducta en la billetera. El tope de 12 no se exigió porque solo hay 2. |
| R-30 | CP-07 | Cumple en escritorio: «Cómo llegar» en la ficha de página y en el menú; la ruleta no lo tiene. Abre Google Maps de esa sede. No se probó la app de mapas del celular. |
| R-17, R-18, R-19 | CP-06 | Cumple en 390×844: textos y sin scroll de página. El paso 2 solo tiene 2 intereses. |
| R-20 | CP-06 | El premio quedó guardado en Mis Cupones. No hay captura de la pantalla «¡Ganaste!». |
| Retrocompatibilidad cupón | CP-08 | Cumple: el nombre de la sede del cupón abre Google Maps en otra pestaña. |
| R-23 | CP-03 | Cumple: Restaurantes deja las 2 fichas de Hype Burguer. Comida rápida no deja ninguna. |
| R-24 | CP-03 | No probado. No hay un comercio sin categoría en este listado. |
| R-09 | CP-09 | Cumple en el alta pública: el celular de contacto pide país (queda en +57) y no deja seguir si está vacío. No se creó la cuenta. Falta el formulario del super admin. |
| R-15 | CP-11 | Cumple: sin secreto y con secreto inválido responde 401. Con el secreto local y el flag apagado responde 200 y `skipped` por `SUBSCRIPTION_REMINDERS_ENABLED`. No escribió avisos. |
| R-26 | CP-10 | Cumple. Antes del GPS, en la landing de Cyelos la casilla y «Guardar visibilidad» estaban deshabilitadas, con el aviso de que la sede no tiene GPS. No se guardó nada. |
| R-25 | CP-04 | Cumple. Con GPS, la landing de Cyelos sigue activa y destildada. No aparece en `/descubre` aunque la sede queda dentro de los 15 km. |
| R-27, R-01…R-14, R-16 | CP-05, CP-12…CP-15 | No probado. |

## Detalle
### CP-01 — Cumple
Esperado: en la billetera, Páginas no muestra ruletas, Ruletas no muestra páginas, y Mis Cupones sigue.
Obtenido: así ocurrió. Páginas mostró «Ver página» y «Cómo llegar». Ruletas mostró solo «¡Jugar Ahora!». Mis Cupones volvió a abrirse.
Evidencia: sesión en `http://localhost:3000/billetera`.

### CP-02 — Cumple
Esperado: `/descubre` con los mismos filtros y, con GPS, fichas de los dos tipos.
Obtenido: 2 resultados cerca. Páginas = 1 página (Hype Burguer, publicada y con GPS). Ruletas = 1 ruleta. El analista confirma que ese es el escenario de página publicada y lo da por aprobado. No hace falta publicar Cyelos.
Evidencia: `http://localhost:3000/descubre`. En local, la landing de Hype tiene `listedInDiscovery` en verdadero.

### CP-06 — Cumple en los pasos 1 a 3. Paso 4 sin captura.
Esperado: textos de R-17 a R-19 sin scroll en 390×844. R-20 con «¡Ganaste!» y botones de guardar a la vista.
Obtenido: pasos 1 a 3 sin scroll (`scrollHeight` 844). El analista giró. En Mis Cupones quedó 1 premio activo, título «¡Prueba un Especial de la Casa! - 15% OFF», sede enlazada y botones «Ver código QR» y «Agregar a la Billetera de Google».
Evidencia: viewport 390×844 en el navegador de la sesión. No se capturó la pantalla del premio recién ganado.

### CP-07 — Cumple en escritorio
Esperado: «Cómo llegar» en ficha de página y en el menú; no en la ruleta; en escritorio, Google Maps.
Obtenido: así está. El enlace del cupón usa la misma URL de mapas.
Evidencia: href de «Cómo llegar» y del nombre de sede del cupón.

### CP-08 — Cumple
Esperado: el cupón abre el mapa de la sede como antes.
Obtenido: el nombre de la sede es un enlace a Google Maps con `target="_blank"`.
Evidencia: cupón en Mis Cupones. No se siguió el enlace.

### CP-04 — Cumple
Esperado: una landing activa, con GPS y sin publicar en Descubre, no sale en el listado.
Obtenido: la sede Cyelos Soluciones de Software ya tiene GPS. La casilla «Publicar esta página en Descubre» está habilitada y destildada, desapareció el aviso de GPS y «Guardar visibilidad» se puede pulsar. No se guardó. En `/descubre`, con la misma ubicación que muestra Hype a 0 km, siguen 2 fichas y ninguna es Cyelos. La sede de Cyelos está dentro de los 15 km y `listedInDiscovery` sigue en falso.
Evidencia: `http://localhost:3000/admin/landings/16e1195f-4753-4057-8194-db3d3170d13d` y `http://localhost:3000/descubre`.

### CP-03 — No probado
Motivo: al filtrar Comida rápida no quedó ninguna ficha. No se confirmó la categoría del comercio.

## Defectos encontrados
Ninguno con evidencia de incumplimiento.

## No probado y por qué
- Pantalla «¡Ganaste!» en 390×844: el analista ya salió de ese paso. El premio sí quedó guardado.
- Más de cuatro intereses en el juego: esta campaña tiene dos.
- Suscripción vencida y código de país en el alta del super admin.
- Cron, SMS y cupo. No se disparó el aviso para no escribir a un teléfono real. `recordatorio_suscripcion_hoy` seguía en revisión.
- App de mapas del celular. Esta corrida fue en el navegador de escritorio.
