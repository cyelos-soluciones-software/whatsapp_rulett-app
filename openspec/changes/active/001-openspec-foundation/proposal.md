# Proposal: Fundación OpenSpec (worker)

**ID:** `001-openspec-foundation`  
**Repo:** whatsapp_rulett-app  
**Par:** rulett-app `openspec/changes/active/001-openspec-foundation`

## Problema

Documentación del worker en `docs/ARCHITECTURE.md` y `docs/DATABASE.md` sin alineación formal con rulett-app ni flujo SDD previo a cambios de contrato (`WhatsappQueue`).

## Objetivos

1. Espejar estructura `openspec/` de rulett-app.
2. Canonicalizar arquitectura y modelo de cola en `openspec/specs/`.
3. Mantener `AGENTS.md` como reglas de implementación.

## Criterios de aceptación

- [ ] `openspec/specs/` con system_architecture, domain_model, integrations, operations
- [ ] `docs/ARCHITECTURE.md` y `docs/DATABASE.md` apuntan a specs
- [ ] `AGENTS.md` referencia OpenSpec como primer paso
