# Convenciones de código

Estándares que todo contribuidor y agente de IA debe seguir en este repositorio.

## TypeScript

- **Modo estricto** habilitado (`strict: true`).
- **Módulos ESM** con `module: NodeNext`.
- Imports relativos **con extensión `.js`** (requerido por NodeNext):

```typescript
// Correcto
import { loadConfig } from './config.js';

// Incorrecto
import { loadConfig } from './config';
```

- Preferir `interface` para objetos de dominio, `type` para unions y aliases.
- No usar `any`. Usar `unknown` + type guards si es necesario.
- No dejar variables/parámetros sin usar (activado en tsconfig).

## Estructura de archivos

| Ubicación | Responsabilidad |
|---|---|
| `src/index.ts` | Orquestación del bucle de polling |
| `src/config.ts` | Variables de entorno |
| `src/types.ts` | Tipos compartidos |
| `src/db/` | Acceso a PostgreSQL |
| `src/services/` | Clientes HTTP externos |
| `scripts/` | Utilidades CLI (seed, schema, inspect) |
| `sql/` | Migraciones y seeds SQL |

**Regla:** Una responsabilidad por archivo. No mezclar acceso a BD con lógica HTTP.

## SQL

- Nombres de tabla/columna Prisma: **camelCase con comillas dobles** → `"WhatsappQueue"`, `"userPhone"`.
- Parámetros siempre con placeholders (`$1`, `$2`) — nunca interpolación de strings.
- Queries de claim/update en transacciones cuando involucran bloqueo.
- Migraciones idempotentes: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.

## Manejo de errores

```typescript
// Servicios externos: retornar resultado tipado, no throw
async sendTemplateMessage(row): Promise<WhatsappSendResult> {
  // ...
  return { ok: false, error: message };
}

// Orquestación: catch en el bucle principal, log y continuar
try {
  await processBatch(...);
} catch (error) {
  log('error', 'Error en ciclo de polling', { error: message });
}

// Config: fail-fast al inicio
function requireEnv(name: string): string {
  if (!value) throw new Error(`Variable requerida: ${name}`);
}
```

## Logging

Formato JSON estructurado obligatorio:

```typescript
function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}
```

Campos recomendados en meta: `queueId`, `tenantId`, `userPhone`, `templateName`, `statusCode`, `error`.

## Variables de entorno

- Cargar con `dotenv` solo en `config.ts` (via `import 'dotenv/config'`).
- Validar al inicio, no en runtime disperso.
- Documentar nuevas variables en `.env.example` y `AGENTS.md`.
- Nunca hardcodear secretos.

## Dependencias

- Agregar dependencias solo si hay justificación clara.
- Preferir APIs nativas de Node.js (`fetch`, `crypto`).
- No agregar frameworks web (Express, Fastify, etc.).
- No agregar ORM (Prisma, Drizzle, etc.).

## Git

- Mensajes de commit en español o inglés, concisos, enfocados en el **por qué**.
- No commitear: `.env`, `dist/`, `node_modules/`.
- No crear commits ni PRs a menos que el usuario lo solicite.

## Scripts npm

Al agregar scripts:
- Prefijo `db:` para operaciones de base de datos.
- Usar `tsx` para scripts TypeScript en desarrollo.
- Documentar en `docs/DEVELOPMENT.md` y `AGENTS.md`.

## Testing (futuro)

Cuando se agreguen tests:
- Framework sugerido: **Vitest** o **Node test runner** nativo.
- Ubicación: `src/**/*.test.ts` o carpeta `tests/`.
- Mockear `pg` y `fetch`, no llamar APIs reales en tests.
