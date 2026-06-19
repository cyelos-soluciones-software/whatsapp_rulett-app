# Delta specs: 005 worker

## `buildTemplateComponents`

Nueva rama `invitacion_evento_exclusivo`:

- Un solo componente `type: 'body'`.
- Parámetros en orden: `nombre_usuario`, `nombre_tenant`, `nombre_evento`, `fecha_evento`.
- Sin header (plantilla Meta body-only).

## `parseTemplateParams` (`db/queue.ts`)

Debe incluir `nombre_evento` y `fecha_evento` al deserializar JSON de PostgreSQL.

## Tipos (`types.ts`)

`TemplateParams` extiende con `nombre_evento?: string`, `fecha_evento?: string`.

## Deploy

Cambio en worker sin redeploy Render → Meta `#132000` aunque rulett-app encole JSON correcto.
