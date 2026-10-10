# Reporte de pruebas — 17tnjra85qn
Veredicto: Incompleto
Cierre del 2026-10-10: Oscar declara que todo el cambio está en producción. Lo que Claude no probó queda aceptado por esa declaración y no se marca como cumple. El veredicto de QA no cambia. [humano, 2026-10-10]
Cierre: el analista cierra esta corrida el 2026-10-01 con lo ya ejecutado. [humano, 2026-10-01]
Ejecutado: 2026-10-01 · Ambiente: laboratorio `https://lab.rulett.app` (lo confirmó el analista; no es producción) · Versión probada: despliegue `dpl_4FPS7MxtUd8BMA2bgSrSQ4WLCAKp`

La corrida anterior en `http://localhost:3000` también quedó Incompleta. No se reescribe aquí como si fuera este laboratorio.

El envío al teléfono queda fuera. No se marca como cumple.

## Resumen por criterio
| Criterio | Casos | Resultado |
|---|---|---|
| R-21, R-22, R-28 | CL-01 | Cumple. Primero el listado popular, mientras el navegador buscaba GPS. Después, 6 resultados cerca: 5 ruletas y 1 página. Páginas dejó solo la página. Ruletas dejó 5 ruletas y ninguna página. El tope de 12 no se exigió porque hay 6. |
| R-23 | CL-02 | Cumple. Farmacias dejó 1 ruleta. Comida rápida y Licorerías no dejaron fichas cerca. |
| R-24 | CL-02 | No probado. No hay un comercio sin categoría identificado en este listado. |
| R-33, R-34 | CL-03 | Cumple. La página se titula con la sede y no repite «Sede ·». Dice «Tiene 1 oferta en el menú» y ese enlace abre el menú de esa sede. El menú tiene la pestaña Ofertas y un producto con precio rebajado. Las ruletas sí muestran «Sede ·». |
| R-35 | CL-03 | No probado. No se vio una página sin ofertas. |
| R-30 | CL-03 | Cumple en escritorio. «Cómo llegar» está en la ficha de página y en el menú, abre Google Maps y no está en la ruleta. No se probó la app de mapas del celular. |
| R-29 | CL-08 | Cumple. En la billetera, Descubre tiene los mismos filtros. Páginas dejó 2 páginas y ninguna ruleta. Ruletas dejó 5 ruletas, con «Sede ·» y sin «Cómo llegar». Mis Cupones sigue. |
| R-09 | CL-04 | Cumple. El alta pública y la de super admin dejan el país en +57. Con el celular vacío no se crea la cuenta. |
| R-15 | CL-05 | Parcial. Sin secreto y con un bearer inválido responde 401 y «No autorizado.». No se usó el secreto real, para no encolar un aviso. |
| R-17 | CL-06 | Parcial. El paso 1 en 390×844 no hace scroll y muestra el título y la línea de gratis. No se avanzó al paso 2 ni se giró. |
| R-18, R-19, R-20 | CL-06 | No probado. |
| R-36 | CL-07 | Cumple. En la landing Dominos la casilla está habilitada y marcada, con `aria-label` «Publicar esta página en Descubre», el `for` del label igual al `id` del checkbox y el texto de 15 km enlazado. No se guardó. |
| R-26 | — | Aprobado por el analista. Ya lo probó en una corrida anterior. Esta sesión no lo repite. |
| R-25, R-31 | — | No probado. No se destildó la casilla para no sacar la página de Descubre. El relleno SQL no se miró en la base. |
| R-27 | — | No probado. No hay un comercio vencido identificado. |
| R-01 … R-14, R-16, R-32 | — | Fuera de esta corrida. El analista decidió no probar el envío al teléfono. |

## Detalle
### CL-01 — Cumple
Esperado: filtros de tipo, fichas de ruleta y de página, tope 12, y listado nacional si no hay GPS.
Obtenido: así en el tramo cercano. Páginas: 1 resultado, «Ver página», «Cómo llegar» y la línea de oferta, cero «¡Jugar Ahora!». Ruletas: 5 «¡Jugar Ahora!», cinco líneas «Sede ·», cero «Cómo llegar».
Evidencia: `https://lab.rulett.app/descubre`.

### CL-02 — Cumple en R-23. R-24 no probado
Esperado: una categoría deja solo sus comercios.
Obtenido: Farmacias dejó una sola ficha. Comida rápida y Licorerías mostraron «Por ahora no hay ruletas ni páginas muy cerca de ti».
Evidencia: el mismo `/descubre`, filtro Todas.

### CL-03 — Cumple en escritorio para R-30, R-33 y R-34
Esperado: título de sede, línea de ofertas hacia el menú, «Cómo llegar» en la página y en el menú, no en la ruleta.
Obtenido: así. El enlace del menú es `/l/rulett.app/menu-rulett/menu`. «Cómo llegar» en escritorio apunta a Google Maps. La ruleta no lo tiene.
Evidencia: ficha en `/descubre` y `https://lab.rulett.app/l/rulett.app/menu-rulett/menu`. No se copian coordenadas.

### CL-04 — Cumple en el alta pública
Esperado: el país queda en +57 y, con el celular vacío, no se crea la cuenta.
Obtenido: el botón del país muestra +57. Al pulsar Siguiente en el paso 2 con el celular vacío, aparece «El teléfono de contacto es obligatorio.» y el formulario sigue en el paso 2. No se llegó a «Enviar código».
Evidencia: `https://lab.rulett.app/registro`. No se usó un teléfono ni un correo reales.

En `https://lab.rulett.app/super-admin/tenants/nuevo`, con sesión de super admin, el celular directo también muestra +57 y el país guardado es 57. Al pulsar «Registrar empresa» con ese celular vacío, el foco vuelve al campo y la página sigue en `/nuevo`. No se creó la empresa.

### CL-05 — Parcial
Esperado: sin secreto, no autorizado.
Obtenido: 401 y `{"error":"No autorizado."}` sin encabezado y con un bearer que no es el secreto. El camino existe en este despliegue.
Evidencia: `GET https://lab.rulett.app/api/cron/subscription-reminders`. No se imprimió ninguna cookie ni el secreto.

### CL-06 — Parcial
Esperado: paso 1 sin scroll en 390×844.
Obtenido: ancho 390, alto 844, `scrollHeight` 844. Título «¡Prueba tu suerte!» y la línea «100% gratis». No se giró.
Evidencia: juego público de una ruleta ya listada en Descubre.

### CL-07 — Cumple
Esperado: el nombre accesible de la casilla es el título visible, sin cambiar el `name` ni guardar.
Obtenido: sesión de admin del comercio Dominos, landing `/admin/landings/569554c9-573c-4fe8-ad71-baa4c2ffafc7`. Checkbox `listedInDiscovery` marcado y habilitado. `aria-label` igual al título. `htmlFor` coincide con el `id`. `aria-describedby` apunta al texto de los 15 km. El botón «Guardar visibilidad» está, y no se pulsó. No hay aviso ámbar de GPS.
Evidencia: esa pantalla de edición.

### CL-08 — Cumple
Esperado: la billetera usa los mismos filtros que `/descubre` y la pestaña de cupones sigue.
Obtenido: Todas mostró 7 fichas cerca, por debajo de 12. Páginas: 2 «Ver página» y 2 «Cómo llegar», cero «¡Jugar Ahora!». Ruletas: 5 «¡Jugar Ahora!», cero «Cómo llegar». Al volver, Mis Cupones sigue abierto. El nombre de una sede del cupón abre Google Maps en otra pestaña.
Evidencia: `https://lab.rulett.app/billetera` y `?tab=descubre`. No se copian datos personales ni la dirección.

## Defectos encontrados
Ninguno. Lo que no se vio queda no probado, no como fallo.

## No probado y por qué
- Envío al teléfono, SMS y cupo (R-01 a R-14, R-16, R-32): el analista cierra la corrida sin esa prueba. El cron no se llamó con el secreto.
- Página destildada, relleno SQL, comercio vencido, comercio sin categoría, página sin ofertas, pasos 2 a 4 del juego y mapas del celular: no se vieron. No son defectos.
- La sede sin GPS ya la aprobó el analista. Esta corrida no la repite.
- Esta corrida no se reabre para completar esos huecos.
