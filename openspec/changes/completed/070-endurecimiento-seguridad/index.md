SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# 070 — Endurecimiento de seguridad (parte del worker)

estado: **cerrado por declaración de Oscar (2026-11-06) sin código en este repo**; W-01 y W-02 pasan a 071. Ver [closure.md](./closure.md).
tamaño: pequeño en este repo (sin contrato ni esquema nuevos); el cambio completo es normal y vive en `rulett-app`
ID HU: ClickUp `17tnjraqgk7` (tomado de la rama de `rulett-app`, D-24) · alias `RUL-endurecimiento-seguridad`

## Repos y orden de despliegue

El cambio principal está en `../rulett-app/openspec/changes/active/070-endurecimiento-seguridad/` (H0…H5, T-01…T-41). Este repo solo tiene W-01 y W-02, **independientes** del orden de la app: se despliegan cuando convenga.

## Archivos

- `proposal.md`, `design.md`, `adr.md`, `specs.md` — copias idénticas de las de `rulett-app` (contexto compartido; si difieren, manda la versión más alta en ambos repos).
- [tasks.md](./tasks.md) — W-01, W-02.
