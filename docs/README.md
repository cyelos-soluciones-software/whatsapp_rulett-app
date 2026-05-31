# Documentación del proyecto

Índice de documentación para desarrolladores y agentes de IA.

## Punto de entrada

| Prioridad | Documento | Descripción |
|---|---|---|
| 1 | [../AGENTS.md](../AGENTS.md) | **Leer primero.** Contexto completo para agentes de IA |
| 2 | [../README.md](../README.md) | Overview y quick start |
| 3 | [../CONTRIBUTING.md](../CONTRIBUTING.md) | Cómo contribuir |

## Documentación técnica

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diseño, componentes, diagramas, decisiones |
| [DATABASE.md](DATABASE.md) | Schema, estados, queries, migraciones |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup local, scripts, debugging |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Render, Railway, Docker, Neon |
| [CONVENTIONS.md](CONVENTIONS.md) | Estándares TypeScript, SQL, logging |

## Archivos de referencia en el repo

| Archivo | Propósito |
|---|---|
| `.env.example` | Variables de entorno (sin secretos) |
| `sql/schema.sql` | Migración idempotente de BD |
| `sql/seed.sql` | Seed estático para Docker |
| `sql/dev-bootstrap.sql` | Tenant/campaña demo |
| `docker-compose.yml` | PostgreSQL local |
| `Dockerfile` | Container del worker |

## Herramientas de IA compatibles

Esta estructura sigue convenciones reconocidas por:

- **Cursor** — lee `AGENTS.md` y `.cursor/rules/`
- **Antigravity** — lee `AGENTS.md` y `README.md`
- **GitHub Copilot** — lee `README.md` y archivos abiertos
- **Cualquier agente** — `AGENTS.md` como fuente de verdad
