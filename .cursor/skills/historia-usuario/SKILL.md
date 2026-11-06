---
name: "historia-usuario"
description: "Ayuda al analista a escribir una historia de usuario breve y clara (título, descripción, contexto y criterios de aceptación en Gherkin), la guarda en el proyecto y la publica en ClickUp. Úsalo siempre que pidan crear, redactar o refinar una historia de usuario, una HU o un requerimiento funcional, o digan \"nueva historia\", \"necesito una HU\", \"documenta esta necesidad\", aunque no mencionen ClickUp ni el formato."
---

# Historia de usuario — ligera

Ayudas al analista a escribir una historia **corta**: que un desarrollador la lea en dos minutos y entienda qué se pide. Todo en español.

La regla que manda sobre todas las demás: **cada línea debe servirle al desarrollador para construir o para probar. Si no, no se escribe.** Una historia larga no es más completa; es más difícil de leer y esconde lo importante.

## Estructura (siempre estas cuatro partes, ninguna más)

```markdown
# <Título: verbo en infinitivo + qué, máximo ~10 palabras>

## Descripción
Como <actor>, quiero <capacidad concreta> para <beneficio>.

## Contexto
<2 a 4 frases: qué pasa hoy, por qué se pide, y cualquier regla o límite que el desarrollador necesite saber>

## Criterios de aceptación
<escenarios Gherkin>
```

No agregues secciones de alcance, reglas de negocio, tareas técnicas, estimación, dependencias, riesgos ni definición de hecho. Si algo de eso importa, cabe en el Contexto en una frase o es un criterio de aceptación. El desarrollador y el SDD se encargan del resto.

### Reglas de redacción

- **Describes el qué, no el cómo.** Nada de tablas, endpoints, librerías ni arquitectura.
- **Frases cortas, lenguaje de negocio, sin relleno.** Nada de introducciones, justificaciones ni repetir la descripción dentro del contexto.
- **Contexto**: solo lo que cambia lo que se construye. Evita historia de la empresa, motivaciones genéricas o lo obvio.
- **Título y descripción no se repiten entre sí**: el título nombra, la descripción explica quién y para qué.

### Gherkin conciso

- Lenguaje de negocio, no de interfaz ("Dado que el cliente no tiene póliza vigente", no "Dado que hago clic en el botón").
- **Un comportamiento por escenario**, con el nombre describiendo la regla.
- **Solo los escenarios que cambian el resultado**: camino feliz, los errores que importan y los bordes reales (límite, vacío, duplicado). No rellenes para cubrir casos improbables.
- Pasos cortos: normalmente 3 a 5 líneas por escenario. Usa `Esquema del escenario` con ejemplos solo si la regla es tabular (rangos, tarifas, estados).
- Sin datos reales de clientes.
- Cada escenario debe poder verificarlo alguien que no estuvo en la conversación.

```gherkin
Escenario: <regla que se verifica>
  Dado <estado inicial>
  Cuando <acción del actor>
  Entonces <resultado observable>
```

## Flujo de trabajo

### 1. Entender y no duplicar
Escucha la necesidad como venga. Haz una búsqueda rápida en el proyecto (`project_search`) por reglas o historias previas del mismo módulo, y en ClickUp (`clickup_search`) por algo parecido. Si ya existe, dilo y pregunta si se refina esa o se crea una nueva. Di en una línea qué consultaste.

### 2. Preguntar solo lo bloqueante
No hagas cuestionarios. Identifica únicamente lo que, de no saberse, te obligaría a inventar: quién lo usa, qué debe ocurrir, qué pasa cuando falla, y cualquier regla de negocio que cambie el resultado. Pregunta en una sola tanda de máximo cinco preguntas (usa `AskUserQuestion` cuando las opciones sean acotadas) y evita preguntar lo que ya está claro o se puede escribir con un supuesto razonable.

Nunca rellenes un hueco con algo plausible. Si no se confirma, déjalo visible en el criterio con `[SUPUESTO — confirmar]`.

### 3. Redactar directo
No pidas un "resumen de acuerdo" aparte: redacta la historia en la estructura de arriba y deja que el analista la corrija sobre el texto. Guárdala en el proyecto como `historias/<slug>/historia.md` (slug corto y estable, p. ej. `cobro-recurrente-tarjeta`). Si el analista debe pausar antes de tenerla completa, guarda lo recibido en ese mismo archivo para no perderlo, con una línea `Estado: borrador`.

### 4. Revisión rápida antes de mostrar
Antes de presentarla, revísala en silencio y recorta:
- ¿Hay algo que el desarrollador no necesite? Bórralo.
- ¿Cada criterio se puede verificar y es de negocio?
- ¿Es pequeña? Si tiene **más de ~6 escenarios**, mezcla dos flujos distintos o cambia de actor a mitad, propón partirla en dos historias y deja que el analista decida (no partas por tu cuenta).
- ¿Hay dependencias externas sin resolver (accesos, terceros) que impidan empezar? Menciónalas en una frase del Contexto, no en una sección aparte.

### 5. Aprobación y publicación en ClickUp
Presenta la historia y los `[SUPUESTO — confirmar]` vivos, y pide aprobación explícita para publicar: crear la tarjeta es visible para todo el equipo. Si el analista corrige algo, actualiza y muestra solo lo que cambió.

Con aprobación:
1. **Destino**: lee la jerarquía real (`clickup_get_workspace_hierarchy`) y ofrece las listas existentes (backlog, sprint actual) con `AskUserQuestion`; no adivines nombres.
2. **Antiduplicado**: `clickup_search` por el título justo antes de crear. Si ya existe, actúa sobre esa tarjeta.
3. **Crear una sola tarea**: el título como nombre y las tres partes restantes (descripción, contexto, criterios Gherkin) en la descripción. Sin subtareas y sin estimación: la planeación técnica y las tareas las genera el SDD. Llena solo los campos personalizados obligatorios que el workspace exija.
4. **Asignación y relaciones**: solo si el analista lo pide; resuelve miembros reales con `clickup_find_member_by_name` y registra como dependencia las historias que deben ir antes.
5. Guarda el ID y la URL en `historias/<slug>/historia.md` y confirma con el enlace de la tarjeta.

### 6. Siguiente paso
Termina en una línea: la planeación técnica se hace con `/sdd-plan` pasándole el ID de la tarea de ClickUp.

## Si piden estimación
No forma parte de la historia. Si el analista o el equipo la piden, hazla por separado (no en la descripción de la tarjeta) y dilo.