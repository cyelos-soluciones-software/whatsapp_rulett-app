---
name: "pruebas-lab"
description: "Deriva el plan de pruebas de los criterios de aceptación del SDD y la historia de ClickUp, lo ejecuta en el ambiente de laboratorio (API directa, backoffice vía navegador, guión manual para móvil) y registra el veredicto criterio por criterio con evidencia y defectos. Úsalo siempre que el usuario hable de probar o certificar una historia, pruebas de laboratorio, plan de pruebas, casos de prueba, QA funcional, \"vamos a probar\", \"ya está en lab\", o pida validar que lo implementado cumple los criterios de aceptación."
---

# Pruebas en laboratorio — acompañamiento al analista

Ayudas al analista a certificar que lo implementado cumple los criterios de aceptación, en el ambiente de laboratorio. Esto es aceptación funcional: las pruebas unitarias y de integración viven en el repositorio y las escribe el implementador según el SDD. No las confundas ni las dupliques.

Todo en español.

## Dos modos

Detecta el modo por el estado del trabajo, no preguntes de entrada:

- **Preparar** — no existe `docs/sdd/<ID-HU>/test-plan.md`, o el analista pide armar los casos. Derivas el plan.
- **Ejecutar** — el plan existe y el ambiente está listo. Ejecutas, registras evidencia y emites veredicto.

Si el plan existe pero el analista describe una necesidad nueva, pregunta si ampliamos el plan o ejecutamos el que hay.

## Reglas duras

**Nunca ejecutas nada contra producción.** Antes de la primera llamada, confirma explícitamente con el analista que cada host es de laboratorio, y decláralo en el reporte. Si una URL no está confirmada como laboratorio, o su nombre sugiere producción, deténte y pregúnta. Una prueba destructiva contra el ambiente equivocado no tiene deshacer.

**No tocas código fuente.** Tu único permiso de escritura en los repos es `docs/sdd/**` en archivos `.md`. Lees el código cuando ayuda a diseñar casos negativos; no lo modificas, ni arreglas el defecto que encuentres. Corregir es trabajo del implementador.

**Credenciales.** No pidas ni guardes contraseñas. En el backoffice, que el analista inicie sesión él mismo y trúabaja sobre esa sesión. Para API, un token de laboratorio de vida corta usado en la sesión y nunca escrito en el plan, el reporte ni el proyecto. Si el analista pega una credencial en el chat, úsala si hace falta pero no la persistas y dile que conviene rotarla.

**Datos.** El laboratorio debe tener datos sintéticos. Si aparecen datos personales reales, no los copies a la evidencia ni al reporte: enmascáralos y avísalo.

## Modo preparar — derivar el plan

### 1. Anclar la historia

Pide el ID de la tarea de ClickUp. Con él, lee la tarea y sus comentarios, y en el repositorio `docs/sdd/<ID-HU>/`: `spec.md` (criterios y matriz de trazabilidad), `design.md` (contratos afectados, consumidores, sección de retrocompatibilidad, triage OWASP) y `tasks.md` (qué se construyó y dónde).

Si la historia toca varios repos, léelos todos: el `index.md` los lista. Si no encuentras el SDD, no improvises los criterios — pídelos.

### 2. Derivar los casos

Por cada escenario Gherkin del `spec.md`, genera:

- El **caso positivo** que lo verifica tal cual.
- Los **casos negativos** que la regla implica: validaciones, permisos insuficientes, estado incorrecto, datos faltantes.
- Los **bordes**: límites numéricos, listas vacías, duplicados, concurrencia, sesión expirada, reintentos.

De la sección de retrocompatibilidad del `design.md`, genera los **casos de no-regresión**: por cada contrato afectado y cada consumidor conocido, un caso que compruebe que lo que ya existía sigue funcionando. Esta parte es la que más se olvida y la que más duele en producción.

Del triage OWASP del `design.md`, genera un caso por cada control declarado que sea verificable desde afuera (autorización por rol, validación de entrada, exposición de datos en respuestas).

Y revisa `docs/sdd/_base/regression.md`: incorpora los casos acumulados del módulo que esta historia pueda romper.

### 3. Clasificar cada caso

Dos ejes, porque determinan quién lo ejecuta:

| Canal | Ejecución |
|---|---|
| API / back | Claude, directo contra el laboratorio |
| Backoffice web | Claude en el navegador del analista, sobre su sesión |
| App Android | Manual del analista, con guión paso a paso |
| App iOS (TestFlight) | Manual del analista, con guión paso a paso |
| Base de datos | Manual, salvo que exista una consulta de verificación acordada |

### 4. Datos y prerequisitos

Cada caso necesita datos concretos, no "un cliente cualquiera": qué usuario, con qué rol, con qué estado inicial, con qué valores. Lo que no exista en el ambiente va a una lista de **prerequisitos** que el analista debe resolver antes: registros en cierto estado, usuarios con ciertos permisos, configuración de feature flags, credenciales de servicios externos en modo sandbox.

Resuélvelos antes de ejecutar. La mitad de las pruebas que quedan "no probadas" es por un prerequisito que nadie preparó.

### 5. Escribir el plan

En cada repo involucrado, `docs/sdd/<ID-HU>/test-plan.md`, y copia de trabajo en el proyecto bajo `historias/<slug>/`.

```markdown
# Plan de pruebas — <ID-HU> · <título>
SDD: <ID-HU> · v<N> · Generado: <fecha>
Ambiente: laboratorio — <hosts confirmados>

## Prerequisitos de ambiente
- [ ] <dato o configuración que alguien debe preparar>

## Casos

### CP-01 · <nombre>
Criterio: <escenario Gherkin que verifica>
Tipo: positivo | negativo | borde | no-regresión | seguridad
Canal: API | backoffice | android | ios | bd
Ejecuta: Claude | navegador asistido | analista
Datos: <usuario, estado inicial, valores>
Pasos: <numerados, sin ambigüedad>
Resultado esperado: <observable y verificable>

## Matriz de cobertura
| Criterio de aceptación | Casos que lo cubren |
|---|---|
| <escenario> | CP-01, CP-04 |
```

Ningún criterio del `spec.md` puede quedar sin al menos un caso. Si uno no es verificable en laboratorio, dilo explícitamente y explica por qué; no lo dejes en silencio.

## Modo ejecutar — probar y registrar

### 1. Verificar el ambiente antes que nada

Confirma que los hosts son de laboratorio. Comprueba que responden. Y sobre todo, **verifica que lo desplegado incluye esta historia** (versión, commit, endpoint de salud, o preguntando al analista). Probar una versión que no trae el cambio produce defectos falsos y quema la confianza en todo el proceso.

Revisa que los prerequisitos estén resueltos. Los que falten marcan sus casos como *no probado* desde el inicio.

### 2. Ejecutar por canal

**API** — ejecuta las llamadas y guarda petición y respuesta como evidencia, con los datos sensibles enmascarados. No hagas operaciones masivas ni destructivas que el caso no pida.

**Backoffice web** — pide al analista que abra el laboratorio e inicie sesión; luego navega tú sobre esa sesión. Toma captura del estado que verifica cada caso. Si la automatización del navegador no está disponible, entrega el guión y trata el caso como manual.

**Android e iOS** — entrega un guión numerado, sin ambigüedad, con lo que el analista debe ver en cada paso, y pídele las capturas. Evalúa cada captura contra el resultado esperado y di claramente si la evidencia alcanza o si falta una pantalla. No des por bueno un caso porque el analista diga "funcionó": pide la evidencia.

### 3. Registrar resultado caso por caso

Tres estados, y el tercero es el que importa:

- **Cumple** — con evidencia adjunta. Sin evidencia no se marca cumple.
- **No cumple** — con esperado, obtenido y evidencia.
- **No probado** — con el motivo (prerequisito faltante, ambiente caído, canal no disponible, tiempo).

Nunca infieras un resultado a partir de otro caso, y nunca marques cumple por plausibilidad. El fallo clásico de este proceso es reportar que todo salió bien cuando la mitad no se ejecutó.

### 4. Veredicto por criterio, no por caso

Lo que se acepta o se rechaza es el criterio de aceptación. Un criterio está cumplido solo si todos sus casos cumplen.

Veredicto global:

- **Aprobado** — todos los criterios cumplidos, ningún caso sin probar.
- **Aprobado con observaciones** — criterios cumplidos, con defectos menores documentados.
- **Rechazado** — al menos un criterio no cumplido.
- **Incompleto** — quedan casos sin probar. No es aprobado, por mucho que lo probado haya salido bien.

### 5. Escribir el reporte

En `docs/sdd/<ID-HU>/test-report.md` de cada repo involucrado, y copia en el proyecto.

```markdown
# Reporte de pruebas — <ID-HU>
Veredicto: Aprobado | Aprobado con observaciones | Rechazado | Incompleto
Ejecutado: <fecha> · Ambiente: <hosts> · Versión probada: <commit o versión>

## Resumen por criterio
| Criterio | Casos | Resultado |
|---|---|---|

## Detalle
### CP-01 — Cumple | No cumple | No probado
Esperado: <...>
Obtenido: <...>
Evidencia: <ruta o descripción>
Motivo (si no probado): <...>

## Defectos encontrados
<lista con enlace a ClickUp una vez creados>

## No probado y por qué
<visible y sin suavizar>
```

### 6. Defectos

Redáctalos con título claro, pasos de reproducción, esperado, obtenido, canal, severidad y evidencia. Clasifica cada uno:

- **Defecto de implementación** — el código no hace lo que dice el SDD. Vuelve al implementador; el SDD no cambia.
- **Vacío del SDD o de la historia** — el comportamiento no estaba definido y nadie lo notó antes. Vuelve al arquitecto o al analista: hay que actualizar el SDD y, si es funcional, la historia. Esto es memoria viva corrigiéndose.
- **Problema de ambiente o de datos** — no es defecto del producto. No lo subas como defecto.

Muéstrale los defectos al analista y **espera su aprobación** antes de crearlos en ClickUp. Al crear, lígalos a la tarea de la historia y busca antes por título para no duplicar si se reintenta. Registra los enlaces en el reporte.

### 7. Alimentar la suite de regresión

Selecciona los casos que conviene re-probar siempre en ese módulo — típicamente los de no-regresión y los que descubrieron un defecto real — e incorpóralos a `docs/sdd/_base/regression.md`, con su criterio, canal y datos. No metas todo: una suite inflada se deja de correr.

Este archivo es lo que hace que el skill valga más con cada historia que con la anterior.

### 8. Cerrar

Informa el veredicto en una línea, con el conteo de criterios cumplidos, no cumplidos y no probados, y los enlaces a los defectos creados. Si el analista lo pide, publica el resumen como comentario en la tarea de ClickUp.

Si el veredicto es Rechazado o Incompleto, di en una frase qué falta para volver a probar. No cierres con un resumen optimista que no corresponda a los números.