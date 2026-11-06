SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# Design — Endurecimiento de seguridad

Principio: **nada se rompe**. Lo que solo agrega (cabeceras inocuas, guardias de rol sobre acciones que solo usa el admin, validaciones de lo que el formulario ya envía) entra directo. Lo que puede rechazar a un usuario legítimo entra en observación detrás de `SECURITY_ENFORCE` (ADR-070-1).

## 0. Interruptor único `SECURITY_ENFORCE`

- Variable de entorno con una lista separada por comas. Valores: `credentials-preauth`, `login-throttle`, `oauth-checks`, `spin-token`, `spin-sticky`, `r2-prefix`. Ausente o vacía = comportamiento de hoy + registros de observación.
- Módulo puro `src/lib/security/enforce.ts`: `isEnforced(flag)` lee y valida la lista una vez por proceso; un valor desconocido se ignora con un `warn` (`scope: 'security'`, sin el valor).
- Apagar un control = quitarlo de la lista y redeplegar variables (sin build nuevo en Vercel: requiere *redeploy*; [SUPUESTO — confirmar] si Oscar prefiere Edge Config para cambio instantáneo, es un cambio menor del lector).
- Registro de observación común: `logSecurityObservation(event, fields)` con `scope: 'security'`; los campos son solo ids, motivo y ruta; nunca correo, teléfono, token, IP ni contraseña.

## H0 — Operación (sin código)

| Paso | Qué | Evidencia esperada |
|---|---|---|
| Legales | Revisar en el Firewall de Vercel por qué `/privacidad` y `/terminos` dieron 403 (Attack Challenge Mode, Bot Protection o regla propia) y corregir para que respondan 200 a navegadores y bots verificados. El código no devuelve 403 [repo: src/proxy.ts:234-250]. | `curl -I` 200 con UA de navegador y de Googlebot |
| Tasa por IP (D-03, plan Pro) | Reglas del Firewall en acción **Log** primero, luego **Deny/Challenge**: `POST` con cabecera `Next-Action` a `/*/play/*` (30/min/IP), `POST /api/auth/callback/credentials` (10/min/IP), `POST` a `/login*` (20/min/IP), `/registro` y `/vendedores/registro` (30/min/IP, cierra D-60 de 063), `/recuperar*` (10/min/IP), `/api/csp-report` (60/min/IP). | Reglas exportadas en `runbooks/` |
| HSTS | Confirmar con `curl -I` la cabecera que hoy envía Vercel, para no bajarla en H1. | Valor registrado en `decisions.md` |
| Dependencias | `npm audit --omit=dev` en ambos repos; abrir task por cada Alta/Crítica. | Salida en `decisions.md` |

## H1 — Cabeceras, CSP Report-Only y `security.txt`

**Módulo puro** `src/lib/security/headers.ts` → `buildSecurityHeaders({ r2PublicUrl, isPreview })` devuelve el arreglo que consume `next.config.ts` `headers()` (hoy solo agrega `X-Robots-Tag` en preview [repo: next.config.ts:6-21]; se conserva).

| Cabecera | Valor | Modo |
|---|---|---|
| `Strict-Transport-Security` | El que hoy envía Vercel (T-04), por defecto `max-age=63072000`. **Sin** `includeSubDomains` ni `preload` hasta inventariar subdominios. Si Vercel ya envía ese valor, la app **no** la emite para no duplicarla (D-12). | Obligatoria (no cambia nada) |
| `X-Content-Type-Options` | `nosniff` | Obligatoria |
| `X-Frame-Options` | `DENY` (D-05; sin iframes propios en `src/`) | Obligatoria |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (el default de los navegadores: sin cambio de comportamiento) | Obligatoria |
| `Permissions-Policy` | `camera=(self), geolocation=(self), microphone=(), usb=(), browsing-topics=()`. Sin `payment` para no afectar el widget de Wompi. | Obligatoria |
| `Content-Security-Policy-Report-Only` | ver abajo | Report-Only |
| `Cross-Origin-Opener-Policy-Report-Only` | `same-origin-allow-popups; report-to="csp"` | Report-Only |
| `Reporting-Endpoints` | `csp="/api/csp-report"` | — |

**CSP Report-Only** (inventario en intake; los huecos los revelan los reportes):

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://checkout.wompi.co;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: <NEXT_PUBLIC_R2_PUBLIC_URL> https://i.ytimg.com;
font-src 'self';
connect-src 'self' https://challenges.cloudflare.com https://*.wompi.co https://*.r2.cloudflarestorage.com;
frame-src https://challenges.cloudflare.com https://checkout.wompi.co https://www.youtube-nocookie.com;
form-action 'self' https://accounts.google.com https://www.facebook.com;
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; worker-src 'self'; manifest-src 'self';
report-uri /api/csp-report; report-to csp
```

`'unsafe-inline'` en `script-src` es necesario mientras no haya nonces: Next inyecta scripts en línea (carga RSC). Quitarlo es el cambio posterior (ADR-070-2).

**Endpoint de reportes** `src/app/api/csp-report/route.ts` (`POST`, público):
- Acepta `application/csp-report`, `application/reports+json` y `application/json`; corta a 16 KB (por `content-length` y leyendo el cuerpo con tope); máx. 20 reportes por petición; siempre responde 204 y nunca lanza.
- Registra por reporte `{ scope: 'csp', directive, blockedHost, documentPath, disposition }`: solo el **origen** del recurso bloqueado y solo el **pathname** del documento (sin query: puede llevar llaves o tokens).
- El proxy lo deja pasar sin `auth()` agregándolo a `isSessionFreePublicPath` [repo: src/proxy.ts:206-212]; el matcher literal **no** cambia (regla de 066).

**`security.txt`**: archivo estático `public/.well-known/security.txt` (RFC 9116) con `Contact: mailto:<RULETT_SUPPORT_EMAIL>`, `Expires` a 12 meses, `Preferred-Languages: es, en`, `Canonical: https://www.rulett.app/.well-known/security.txt`. Lleva punto, así que el matcher del proxy ya lo excluye [repo: src/proxy.ts:268]. Una prueba compara el correo con `RULETT_SUPPORT_EMAIL` de `cyelos-brand.ts` y falla 30 días antes de `Expires`.

**Teselas**: `/map-tiles/:subdomain(a|b|c)/:z(\\d+)/:x(\\d+)/:y(\\d+).png` [repo: next.config.ts:22-30]. Leaflet solo pide `a|b|c` con `{s}` [repo: src/lib/map-tiles.ts:6]: sin cambio para el usuario.

## H2 — Autorización y validaciones

**Migración M2 (aditiva, antes del código):** `PaymentReceipt.attachmentKey String?`. Sin relleno.

| # | Cambio | Detalle | Retrocompatibilidad |
|---|---|---|---|
| H-06 | `updateQrTheme` → `requireTenantAdminMutation()` y `updateMany({ where: { id, tenantId } })` | Hoy solo exige `tenantId` [repo: src/actions/updateQrTheme.ts:24-28] | Solo la usa `QrThemeForm` en `/admin` (admin). |
| H-07 | `getLeads`, `getSedesForLeadsFilter` → `requireTenantAdminSession()` | [repo: src/actions/leads.ts:55-75] | Solo los llama `/admin/ganadores`. |
| H-08 | `createCoupon`/`updateCoupon`: esquema Zod `.strict()` con `title`, `description`, `code`, `maxRedemptions`, `expiresAt`, `categoryIds`, `branchIds` (y `clonedFromId` al crear). `createCoupon` deja el `...spread` y arma el `data` campo por campo; `updateCoupon` ya lo hace así [repo: src/actions/coupon.ts:178-191] y solo gana el esquema (D-16) | [repo: src/actions/coupon.ts:72-126] | Las páginas `nuevo` y `editar` envían exactamente esos campos. |
| H-09a | **Sin cambios en Cloudflare (D-09):** mismo bucket, misma credencial, mismo r2.dev. `payment-receipt` pasa a la clave `private/payment-receipts/{tenantId}/{uuid}.{ext}`. El cliente nuevo pide `keyOnly: true` y recibe solo `objectKey`; sin la marca (cliente viejo: `ReceiptAttachmentField` exige `publicUrl` [repo: src/components/admin/billing/ReceiptAttachmentField.tsx:59]) el presign sigue devolviendo `publicUrl` y registra `R2_RECEIPT_LEGACY_PRESIGN`, hasta T-42 (D-10) | `buildObjectKey` [repo: src/lib/r2-upload-keys.ts:29-30], `purposeHasPublicUrl` | Los recibos viejos quedan donde están; una pestaña abierta antes del despliegue sigue subiendo. |
| H-09b | Comprobante: `reportPaymentReceiptFromForm` acepta `attachmentKey` (validada: prefijo `private/payment-receipts/{tenantId de sesión}/` + UUID + extensión permitida) y la guarda con `attachmentUrl` nulo. De un cliente viejo acepta `attachmentUrl`: si es de `private/payment-receipts/{tenantId de sesión}/` la convierte en `attachmentKey`; si es de `billing/payment-receipts/{tenantId de sesión}/` (subida antes del despliegue) la guarda como hoy; otra cosa se rechaza (specs §2.5). Ruta nueva `GET /api/billing/receipts/[id]/attachment` (comercio: solo su `tenantId`; Super Admin: cualquiera) que responde 302 a URL firmada de 60 s con `no-store` y `no-referrer` (patrón de 063 H2, reutiliza `getR2SignedReadUrl` [repo: src/lib/r2-read-url.ts]) | [repo: src/actions/billing/payment-receipts.ts:50-52], `PaymentReceiptModal` | La UI usa la ruta si hay `attachmentKey` y la URL vieja si no. |
| H-09c | Riesgo residual (D-38 de 063, sigue aceptado): quien conozca una clave `private/*` puede leerla por r2.dev. Lo mitiga que la clave es un UUID que ya no aparece en ninguna URL pública ni en el HTML. Cerrarlo del todo exige un cambio en Cloudflare, fuera de este cambio. | — | — |
| H-09d | Prefijo por comercio en URLs públicas guardadas (`logoUrl`, `bannerUrl`, `photoUrl`, `*ObjectKey` de landing, menú y campañas): `isAllowedR2UrlForTenant(url, { tenantId, purpose })` deriva los prefijos de `buildObjectKey` (sin tabla duplicada) + `global-banners/` cuando aplica | [repo: src/lib/r2.ts:48-57], [repo: src/actions/branch-landing.ts:131-200], [repo: src/actions/digital-menu.ts:58-76] | Un valor **igual al ya guardado** siempre pasa. Observación por `r2-prefix`: sin la bandera, solo registra `R2_URL_PREFIX_MISMATCH` (purpose, tenantId). |
| H-09e | Presign `POST /api/uploads/r2` con `assertSameOriginFromRequest` | [repo: src/app/api/uploads/r2/route.ts:69-110] | El navegador siempre manda `Origin` en `fetch` POST. |
| H-14 | Wompi: antes del CAS, leer el recibo `PENDING` y comparar `amount_in_cents` con `reportedAmount × 100` (entero) y `currency` con `COP`; si difiere, no escribir, `logError WOMPI_AMOUNT_MISMATCH` (referencia, `tenantId`, banderas `amountMatches`/`currencyMatches`, sin montos) y responder 200 para cortar reintentos. `timestamp` a más de 24 h: solo `warn` | [repo: src/lib/billing/apply-wompi-payment.ts:68-100] | La firma de integridad ya fija el monto [repo: src/actions/billing/wompi.ts:121-137]: un pago legítimo siempre coincide. |
| H-15 | `assertSameOriginRequest`: `localhost`/`127.0.0.1` solo si `VERCEL_ENV !== 'production'` | [repo: src/lib/assert-same-origin.ts:62-66] | La E2E corre sin `VERCEL_ENV`: no le afecta. |
| H-16 | `isAuthorizedCronRequest` único con SHA-256 + `timingSafeEqual`; las 5 copias locales `authorizeCron` de `src/app/api/cron/*` se reemplazan por él (las 7 rutas lo usan). Sin secreto: falla cerrado con `NODE_ENV === 'production'` y permite fuera de producción, como hoy (D-11) | [repo: src/lib/cron-auth.ts:5-9], [repo: src/app/api/cron/send-sms/route.ts:9-14] | Mismo secreto, misma cabecera, mismo comportamiento sin secreto. |
| H-18 | LabsMobile por API JSON con autenticación básica, detrás de `LABSMOBILE_TRANSPORT=json` (sin la variable, el GET de hoy) | [repo: src/lib/sms-processor.ts:243-249] | [SUPUESTO — confirmar] que el plan acepta el API JSON; se prueba en lab con un envío real. |
| H-19 | Logs: `contactEmail` → solo dominio | [repo: src/lib/mail/send-tenant-bootstrap-welcome.ts:225-227] | Solo logs. |
| H-20 | Separar de `@/lib/wallet` lo que usa el cliente; `google-wallet.ts` con `import 'server-only'` | [repo: src/lib/wallet.ts:2] | El build falla si queda un import cliente: lo detecta `npm run build`. |
| Guardia | Prueba estática `tenant-guard-sources.test.ts`: toda exportación de `src/actions/**` que lea `session.user.tenantId` tras `auth()` sin un helper `require*` debe estar en una lista permitida con motivo | — | Solo pruebas. |

## H3 — Login y sesiones

**Migración M1 (aditiva, antes del código):**
- `User.sessionVersion Int @default(0)`.
- `AuthThrottle { key String @id, failures Int @default(0), windowStartedAt DateTime, lockedUntil DateTime?, updatedAt DateTime @updatedAt }` con índice en `updatedAt` para limpieza. `key` = `scope:` + SHA-256 hex del correo en minúsculas (`login:…`, `recovery:…`): nunca el correo en claro, y cuenta también correos inexistentes (ADR-070-6).

**Preautorización del callback de credenciales (H-03, ADR-070-5):**
- `mintCredentialsPreauth(email)` → `pa1.<b64url(email|exp)>.<HMAC-SHA256(k, …)>` con `k = HMAC(AUTH_SECRET, 'rulett:preauth:v1')`, `exp` = 120 s. La emiten solo las acciones del servidor después de Turnstile: `signInAdminAction`, `super-sign-in`, `staff-credentials-sign-in`, `vendor-sign-in`, y `sales-agent-signup` tras el OTP [repo: rg `signIn('credentials'`].
- `authorize()` la verifica (tiempo constante, correo igual, vigente). Se declara como credencial `preauth` (igual que `portal`) y entra a la lista de claves que redacta `auth-oauth-logger` [repo: src/lib/auth-oauth-logger.ts:14-45]: nunca se registra (D-18). Sin bandera: si falta o es inválida, `logSecurityObservation('AUTH_CREDENTIALS_NO_PREAUTH', { portal })` y sigue. Con `credentials-preauth`: `return null`.
- El mock `super@admin.com` (solo `development`) no cambia.

**Bloqueo por intentos (H-03, D-03):** `src/lib/auth/login-throttle.ts`
- `assertLoginAllowed(email)` y `registerLoginFailure(email)` / `clearLoginFailures(email)`; ventana 15 min, 10 fallos → `lockedUntil = now + 15 min`; éxito borra la fila. Escritura con `upsert` + incremento atómico.
- Se llaman en las acciones de login (antes de `compare`) **y** en `authorize()` (camino directo). Sin bandera: cuenta y registra `AUTH_LOGIN_LOCK_OBSERVED`, no bloquea. Con `login-throttle`: bloqueado ⇒ «Demasiados intentos. Espera 15 minutos o recupera tu contraseña.», idéntico para correos inexistentes.
- Limpieza: filas con `updatedAt` de más de 24 h se borran en el cron diario existente `reset-tenant-limits` (sin cron nuevo en `vercel.json`).

**Sin enumeración (H-12):**
- `signInAdminAction`, `super-sign-in` y `staff-credentials-sign-in` comparan la contraseña **antes** de explicar rol, cuenta inactiva o comercio inactivo (como ya hace `vendor-sign-in` [repo: src/actions/vendor-sign-in.ts:56-58]). Con contraseña incorrecta o usuario inexistente: «Correo o contraseña incorrectos.».
- `authorize()` ejecuta `compare` contra un hash ficticio fijo cuando el usuario no existe o no tiene contraseña.

**`sessionVersion` e `isActive` por petición (H-05, D-04, ADR-070-7):**
- Al iniciar sesión: `token.sv = user.sessionVersion` (credenciales desde `authorize`; OAuth desde `dbUser` en el primer `jwt`).
- En cada `jwt` [repo: src/auth.ts:310-318], con `dbUser` de `loadSessionUserByEmail` (se agrega `tenant: { select: { isActive: true } }` [repo: src/lib/auth/session-user.ts:11-16]):
  - `dbUser` nulo y no es el mock de desarrollo ⇒ `return null`.
  - `dbUser.isActive === false` ⇒ `return null`.
  - rol de personal (`TENANT_ADMIN`, `TENANT_CASHIER`, `TENANT_WAITER`) con `tenant.isActive === false` ⇒ `return null`. Un `USER` con `tenantId` adoptado **no** se afecta.
  - `(dbUser.sessionVersion ?? 0) !== (token.sv ?? 0)` ⇒ `return null`.
- `return null` limpia la cookie de sesión [repo: node_modules/@auth/core/lib/actions/session.js:34-56].
- Incrementan `sessionVersion` en el mismo `update` que escribe `password`: recuperación, cambio desde `/admin/perfil` [repo: src/actions/profile.ts:110-118] y toda otra escritura de `password` (inventario en T-29; prueba estática). Tras cambiar la propia contraseña, la acción cierra la sesión y lleva al login de su portal (`/login`, `/login/vendedor` o `/login/super`) con `passwordChanged=1` y aviso (D-14). Un cambio de correo por el Super Admin también cierra la sesión (D-15).
- Un token emitido antes del despliegue no tiene `sv` ⇒ vale 0 ⇒ sigue válido. La cookie firmada de la E2E tampoco lo tiene: sin cambio.

**Recuperación de contraseña (H-13):**
- Se guarda `sha256(token)` en la misma columna (sin migración); la búsqueda es por hash. Transición: si no aparece y el token recibido tiene formato UUID, también se busca en claro (los enlaces enviados antes del despliegue; TTL de 1 h). Un valor de 64 hex nunca se busca en claro, así que un hash filtrado no sirve como token. T-31 retira esa rama más de 1 h después de T-30 en PDN (D-13).
- Tope `recovery:` 3 solicitudes por hora por correo: al exceder, misma respuesta genérica sin enviar.
- Fallo SMTP ⇒ la misma respuesta genérica + `logError` [repo: src/actions/auth-recovery.ts:88-92].

**OAuth (H-04, ADR-070-9):** con `oauth-checks` y fuera de `development`, Google y Facebook sin `checks: ['none']` ⇒ los valores por defecto de Auth.js (`pkce` + `state`) [repo: node_modules/@auth/core/lib/utils/providers.js:52-55]. Sin la bandera, igual que hoy. Medir con el log de 018 los errores de callback.

## H4 — Juego y premios

**Sorteo:** `crypto.randomInt(coupons.length)` en lugar de `Math.random` [repo: src/actions/game.ts:104] (cierra S2245). Uniforme como hoy.

**Token del giro (H-01, ADR-070-3):** `src/lib/game/spin-token.ts` (puro).
- Formato `sp1.<b64url(JSON{ q, c, iat, exp, n })>.<b64url(HMAC-SHA256(k, payload))>`, `k = HMAC(AUTH_SECRET, 'rulett:spin:v1')`, `exp = iat + 2 h`, `n` = 12 bytes aleatorios.
- `spinRouletteAction` agrega `spinToken` a la respuesta (campo nuevo: el cliente viejo lo ignora).
- `PendingClaimPayload` agrega `spinToken?: string` [repo: src/lib/pending-claim.ts:3-10]; `GameFlow`/`OAuthClaimFinish` lo guardan y lo envían a `claimCouponPostLogin` y `completeProfileAndClaim` (parámetro opcional nuevo).
- Verificación en ambos reclamos, **antes** de `validateClaimContext`: firma en tiempo constante, `exp` vigente, `q === qrId`, `c === couponId`. Resultado `ok | missing | invalid | expired | mismatch`.
  - Sin bandera: si no es `ok`, `logSecurityObservation('CLAIM_SPIN_TOKEN_<MOTIVO>', { qrId })` y sigue como hoy.
  - Con `spin-token`: si no es `ok`, «Tu giro ya no es válido. Vuelve a girar para reclamar tu premio.» (texto en `game-flow-copy.ts`), sin escribir.
- Riesgo residual R-02: el token es un portador; quien lo copie puede reclamar ese mismo premio con su cuenta. Lo acotan `maxRedemptions`, el único `(userId, couponId)` y el antifraude.

**Resultado fijo por dispositivo (H-02, D-02, ADR-070-4):** con `spin-sticky`.
- Cookie `rulett_spin` (`httpOnly`, `secure` en producción, `sameSite=lax`, `path=/`), valor `ss1.<b64url(JSON[{ q, c, exp }])>.<HMAC>` con `k = HMAC(AUTH_SECRET, 'rulett:spin-sticky:v1')`; máx. 10 entradas, se podan las vencidas; firma inválida ⇒ se ignora y se reescribe.
- Ventana: `ruleCooldownHours` si es > 0; si no, 24 h; acotada a 1–168 h.
- Al girar: si hay entrada vigente para `q` y su `c` sigue jugable en la campaña (mismo `playableCouponWhere` sin el filtro de categorías del jugador y con cupo), se devuelve ese `c` con `repeated: true` y un `spinToken` nuevo. Si no, se sortea y se guarda.
- UI: con `repeated`, la ruleta cae en el mismo premio y muestra «Ya giraste en esta campaña. Tu premio sigue siendo este.» (`game-flow-copy.ts`).
- Borrar cookies lo evita: lo acota la regla de tasa de H0 sobre `Next-Action` en play.

**Canje (H-22, D-06):** sin cambio. Se documenta en `specs/security.md` que un cupón de campaña terminada sigue canjeable hasta su `expiresAt`.

## H5 — Prueba autenticada y paso a obligatorio

- `/pruebas-lab` genera `test-plan.md` sobre lab con dos comercios (A y B), cada uno con admin, cajero y mesero, dos vendedores (X ligado a A, Y a B) y dos comensales. Capítulos ASVS 4.0.3 L2: V2 autenticación, V3 sesiones, V4 control de acceso, V5 validación, V8 datos, V11 lógica de negocio, V12 archivos, V13 API, V14 configuración. Matriz: cada familia de acciones × cada rol de A contra ids de B.
- E2E nuevas (`e2e/`, 067): `aislamiento-comercios.feature` (admin de A abre editar cupón, campaña, landing y pedido de B ⇒ «no encontrado») y `giro-reclamo.feature` (girar ⇒ reclamar; volver a girar ⇒ mismo premio con `spin-sticky` en el ambiente E2E).
- Paso a obligatorio por bandera: lab obligatorio ⇒ PDN observación ≥ 7 días con métricas ⇒ PDN obligatorio. Criterios por bandera en `specs.md` §6.

## Seguridad — triage OWASP

**Top 10 web (2021):**

| Ítem | Aplica | Control y task |
|---|---|---|
| A01 Control de acceso | Sí | Rol en `updateQrTheme`/`leads` (T-11, T-12); token del giro (T-34); prefijo R2 por comercio (T-16); ruta del comprobante por `tenantId` (T-15); guardia estática (T-23). |
| A02 Fallas criptográficas | Sí | HMAC con claves derivadas por propósito y comparación en tiempo constante (T-06, T-25, T-34, T-35); token de recuperación con hash (T-30); cron en tiempo constante (T-18). |
| A03 Inyección | Sí | Zod estricto en cupones (T-13); el endpoint CSP no refleja ni guarda contenido (T-08). Sin SQL nuevo. |
| A04 Diseño inseguro | Sí | Giro ligado al reclamo y resultado fijo (T-34, T-35); comparación de monto Wompi (T-17). |
| A05 Configuración | Sí | Cabeceras y CSP (T-07); `security.txt` (T-09); `localhost` fuera de PDN (T-19); teselas (T-10); Firewall (T-01, T-02). |
| A06 Componentes vulnerables | Sí | `npm audit` y Dependabot (T-05); `next` 16.4.5 y `next-auth` beta.32 (T-43); `zod` 4.6.x (T-44); versiones mayores de `nodemailer` y `prisma` en un cambio aparte (D-27). `next-auth` sigue en beta (riesgo registrado). |
| A07 Identificación y autenticación | Sí | Preautorización (T-25), bloqueo (T-26), enumeración (T-27), `sessionVersion` (T-28, T-29), recuperación (T-30, T-31), OAuth (T-32). |
| A08 Integridad de datos | Sí | Monto Wompi (T-17); asignación masiva (T-13). |
| A09 Registro y monitoreo | Sí | `logSecurityObservation` sin PII (T-06); PII fuera de logs (T-21, W-01). |
| A10 SSRF | Sí (bajo) | Teselas acotadas a `a|b|c` (T-10). Sin `fetch` nuevo a URL de usuario. |

**API Security Top 10 (2023):** API1 BOLA — prefijo R2 y comprobante (T-15, T-16); API2 autenticación — H3; API3 propiedades — `.strict()` en cupones (T-13); API4 consumo — tasa por IP (T-02) y tope del endpoint CSP (T-08); API5 BFLA — rol en tema y leads (T-11, T-12); API6 flujos sensibles — giro y reclamo (T-34, T-35); API7 SSRF — teselas (T-10); API8 configuración — H1; API9 inventario — guardia estática (T-23); API10 consumo de terceros — Wompi (T-17), LabsMobile (T-20).

**Procedimientos y migraciones:** M1 y M2 son aditivas y reversibles (`DROP COLUMN`/`DROP TABLE` sin datos de negocio); se aplican con el protocolo seguro de Neon [repo: AGENTS.md §4].

## Retrocompatibilidad

| Contrato | Consumidores | Estrategia | Rollback |
|---|---|---|---|
| Respuesta de `spinRouletteAction` | `GameFlow` | Expand: campos nuevos `spinToken`, `repeated` | Quitar del cliente; el servidor los ignora |
| Entrada de `claimCouponPostLogin` / `completeProfileAndClaim` | `GameFlow`, `OAuthClaimFinish`, `PhoneCaptureModal` | Parámetro opcional `spinToken`; obligatorio solo con `spin-token` | Quitar la bandera |
| `PendingClaimPayload` en `localStorage` | Reclamos en curso durante OAuth | Campo opcional; los guardados sin él pasan en observación; TTL del token 2 h antes de obligatorio | Quitar la bandera |
| JWT de sesión | Toda sesión viva y la cookie de la E2E | `sv` ausente = 0 | `sessionVersion` queda sin uso |
| `User`, `AuthThrottle`, `PaymentReceipt` | Prisma | Expand (M1, M2) sin relleno | `DROP` de lo agregado |
| Callback de credenciales | Las 5 acciones de login | Preautorización en observación | Quitar la bandera |
| OAuth | Comensales y personal | Bandera `oauth-checks` | Quitar la bandera (flujos en curso al cambiar fallan una vez) |
| Presign y comprobantes R2 | `ReceiptAttachmentField` (pestañas viejas y nuevas), Super Admin | `keyOnly` opcional; sin la marca, `publicUrl` como hoy hasta T-42; `attachmentKey` nuevo; `attachmentUrl` viejo sigue | Revertir el purpose a público; las claves ya guardadas siguen legibles por la ruta firmada |
| `next`, `next-auth`, `zod` (T-43, T-44) | Toda la app | Versiones menores dentro del rango; PR propio por paquete, E2E completa y lab antes de H2 | Revertir el PR |
| Cabeceras | Navegadores | Solo agregan; CSP y COOP en Report-Only | Quitar la entrada en `headers.ts` |
| Rewrite de teselas | Leaflet | Solo `a|b|c` (lo único que pide) | Volver al patrón libre |
| `/api/trigger` del worker | `whatsapp-worker-trigger.ts` (POST) | `GET` registrado 14 días, luego 405 | Volver a aceptar `GET` |

## Testing (Vitest)

Ubicación `src/lib/__tests__/*.test.ts`; mocks de `@/lib/prisma`, `@/auth`, R2 y externos con `vi.hoisted()` + `vi.mock()` [repo: openspec/specs/testing.md]. Meta del gate: ≥ 80 % de líneas nuevas (más estricto que el 70 % del repo).

| Módulo | Casos |
|---|---|
| `security/enforce.ts` | Lista vacía, valores válidos, desconocido ignorado con `warn`, espacios y mayúsculas |
| `security/headers.ts` | Cada cabecera y valor; preview conserva `X-Robots-Tag`; R2 ausente no rompe la CSP; snapshot de la CSP |
| `api/csp-report` | 3 tipos de contenido; > 16 KB; JSON inválido ⇒ 204; > 20 reportes; el log no lleva query ni ruta del recurso |
| `security.txt` | Correo = `RULETT_SUPPORT_EMAIL`; `Expires` a más de 30 días |
| `next.config` rewrites | `a|b|c` y números; `evil` no coincide |
| `updateQrTheme`, `leads` | `USER`, cajero y mesero con `tenantId` ⇒ rechazo sin consultar; admin ⇒ ok con `tenantId` en el `where` |
| `createCoupon`/`updateCoupon` | Clave extra (`userCoupons`, `currentRedemptions`, `tenantId`) ⇒ rechazo; formulario actual ⇒ ok |
| `isAllowedR2UrlForTenant` | Cada purpose; otro comercio; `private/`; igual al guardado ⇒ ok; observación vs obligatorio |
| Comprobante | Clave ajena o malformada; `attachmentUrl` legado válida y de otro comercio; presign sin `publicUrl`; ruta 302 con `no-store`; comercio ajeno ⇒ 404; Super Admin ⇒ ok; recibo viejo usa URL |
| Wompi | Monto igual ⇒ aplica; distinto ⇒ sin escrituras, log sin montos; moneda distinta; `timestamp` viejo ⇒ solo `warn` |
| `cron-auth` | Correcto, incorrecto, largo distinto, secreto ausente ⇒ falla cerrado; prueba estática sin `===` en `api/cron` |
| `assert-same-origin` | `localhost` con y sin `VERCEL_ENV=production` |
| Preautorización | Vigente, vencida, otro correo, firma alterada; observación vs obligatorio; las 5 acciones la emiten (prueba de fuente) |
| `login-throttle` | 9 vs 10 fallos; ventana vencida reinicia; éxito limpia; correo inexistente cuenta igual; mensaje idéntico |
| Enumeración | Rol equivocado + contraseña mala ⇒ mensaje genérico; contraseña buena ⇒ mensaje de rol; `compare` ficticio cuando no hay usuario |
| Callback `jwt` | `sv` ausente = 0; distinto ⇒ `null`; inactivo ⇒ `null`; borrado ⇒ `null`; personal con comercio inactivo ⇒ `null`; `USER` con comercio inactivo ⇒ sigue; mock de desarrollo |
| Escrituras de `password` | Prueba estática: todo `password:` en `prisma.user.update*` lleva `sessionVersion: { increment: 1 }` |
| Recuperación | Hash; transición en claro dentro de 24 h y no después; tope 3/h; SMTP caído ⇒ genérico |
| OAuth | Con y sin bandera; `development` sin checks |
| `spin-token` | Emisión/verificación; cada motivo; observación vs obligatorio en ambos reclamos |
| `spin-sticky` | Vigente ⇒ mismo premio; agotado ⇒ nuevo sorteo; firma alterada ⇒ se ignora; poda a 10; ventana 1–168 h |
| `game.ts` | `crypto.randomInt` (mock) y uniformidad del índice |

Integración (`npm run test:integration`): `AuthThrottle` con dos fallos concurrentes cuenta 2; `sessionVersion` incrementa en la misma transacción del cambio de contraseña. E2E: las dos `.feature` de H5 y las existentes de login, play, canje, pedido y registro en verde en cada hito.

## Duplicación

Las 5 copias locales del chequeo de cron (H-16) se consolidan en `cron-auth.ts`. El HMAC con clave derivada se escribe una vez en `src/lib/security/signed-token.ts` y lo usan preautorización, token del giro y cookie del giro (no tres implementaciones).

## Hotspots a revisar (SonarQube)

SonarQube 26.10 ya no tiene reglas de tipo hotspot (pasaron a `VULNERABILITY`): estos puntos se revisan a mano en `/security-review` y el gate exige 0 vulnerabilidades nuevas (D-26).

`signed-token.ts` (HMAC y `timingSafeEqual`), `spin-token.ts`, cookie `rulett_spin`, `authorize()`, callback `jwt`, `login-throttle.ts`, endpoint `csp-report` (lectura del cuerpo), `cron-auth.ts`, ruta del comprobante (redirección a URL firmada), presign `POST /api/uploads/r2` (T-14), `crypto.randomInt` (cierra S2245).
