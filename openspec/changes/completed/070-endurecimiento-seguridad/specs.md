SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# Specs — 070 Endurecimiento de seguridad

## 1. Requisitos (EARS)

| R | Requisito |
|---|---|
| R-01 | El sistema **deberá** enviar en toda respuesta las cabeceras de `design.md` H1, con CSP y COOP en Report-Only. |
| R-02 | **Cuando** llegue un reporte a `/api/csp-report`, el sistema **deberá** registrar directiva, origen bloqueado y pathname del documento, y responder 204, aunque el cuerpo sea inválido o supere 16 KB. |
| R-03 | El sistema **deberá** servir `/.well-known/security.txt` válido según RFC 9116. |
| R-04 | El rewrite de teselas **solo deberá** coincidir con subdominio `a`, `b` o `c` y coordenadas numéricas. |
| R-05 | **Si** quien llama a `updateQrTheme`, `getLeads` o `getSedesForLeadsFilter` no es `TENANT_ADMIN` con CSRF válido, **entonces** el sistema **deberá** rechazar sin consultar la base. |
| R-06 | **Si** la entrada de `createCoupon`/`updateCoupon` trae claves fuera de la lista, **entonces** el sistema **deberá** rechazarla sin escribir. |
| R-07 | El purpose `payment-receipt` **deberá** generar claves `private/payment-receipts/{tenantId}/…` en el bucket actual y el presign **deberá** exigir mismo origen. **Cuando** el cliente pida `keyOnly: true`, el presign **no deberá** devolver `publicUrl`; sin esa marca (cliente viejo) la devuelve y registra `R2_RECEIPT_LEGACY_PRESIGN`, hasta T-42 (D-10). Sin cambios en Cloudflare (D-09). |
| R-08 | El comprobante nuevo **deberá** guardarse como `attachmentKey` y leerse solo por la ruta firmada (comercio dueño o Super Admin). |
| R-09 | **Si** una URL o clave R2 guardada no pertenece a los prefijos del comercio y purpose, y no es igual al valor ya guardado, **entonces** el sistema **deberá** registrarla y, con `r2-prefix`, rechazarla. |
| R-10 | **Si** el evento aprobado de Wompi trae monto o moneda distintos del recibo, **entonces** el sistema **no deberá** escribir y **deberá** registrar el desajuste sin montos. |
| R-11 | El cron **deberá** comparar `CRON_SECRET` en tiempo constante. **Si** falta el secreto, **deberá** fallar cerrado con `NODE_ENV === 'production'` (producción y previews) y permitir solo fuera de producción, como hoy (D-11). |
| R-12 | **Mientras** `VERCEL_ENV` sea `production`, `assertSameOriginRequest` **no deberá** aceptar `localhost` ni `127.0.0.1`. |
| R-13 | **Si** `authorize()` recibe credenciales sin preautorización válida, **entonces** el sistema **deberá** registrarlo y, con `credentials-preauth`, no abrir sesión. |
| R-14 | **Cuando** un correo acumule 10 fallos en 15 min, el sistema **deberá** registrarlo y, con `login-throttle`, bloquearlo 15 min con el mismo mensaje para correos existentes e inexistentes. |
| R-15 | Las acciones de login **deberán** verificar la contraseña antes de explicar rol o estado de la cuenta. |
| R-16 | **Si** el usuario de la sesión no existe, está inactivo, es personal de un comercio inactivo o su `sessionVersion` difiere del token, **entonces** el sistema **deberá** cerrar la sesión en esa petición. |
| R-17 | **Cuando** se escriba `password`, el sistema **deberá** incrementar `sessionVersion` en la misma escritura. |
| R-18 | El token de recuperación **deberá** guardarse como hash, con tope de 3 solicitudes por hora por correo y respuesta genérica ante fallo de correo. |
| R-19 | **Mientras** `oauth-checks` esté activo y no sea `development`, Google y Facebook **deberán** usar `state` y PKCE. |
| R-20 | El sorteo **deberá** usar `crypto.randomInt`. |
| R-21 | **Cuando** se gire, el sistema **deberá** devolver un `spinToken`; **si** un reclamo no trae un token válido para esa campaña y ese cupón, **entonces** **deberá** registrarlo y, con `spin-token`, rechazarlo. |
| R-22 | **Mientras** `spin-sticky` esté activo, volver a girar la misma campaña desde el mismo navegador dentro de la ventana **deberá** devolver el mismo premio con `repeated: true`. |

## 2. Comportamiento caso a caso

### 2.1 Giro y reclamo (H4)

| Caso | Sin banderas | `spin-token` | `spin-sticky` |
|---|---|---|---|
| Gira y reclama de inmediato con el token | OK | OK | OK |
| Reclama otro `couponId` de la misma campaña | OK + `CLAIM_SPIN_TOKEN_MISMATCH` | «Tu giro ya no es válido…» | — |
| Reclama sin token (cliente viejo o `localStorage` viejo) | OK + `CLAIM_SPIN_TOKEN_MISSING` | Rechazo | — |
| Token vencido (> 2 h; p. ej. OAuth abandonado) | OK + `…_EXPIRED` | Rechazo; la UI vuelve a girar | — |
| Token de otra campaña | OK + `…_MISMATCH` | Rechazo | — |
| Token alterado | OK + `…_INVALID` | Rechazo | — |
| Vuelve a girar dentro de la ventana | Nuevo sorteo | Nuevo sorteo | Mismo premio, `repeated: true` |
| Vuelve a girar y el premio guardado se agotó o salió de la campaña | Nuevo sorteo | Nuevo sorteo | Nuevo sorteo y se reemplaza la entrada |
| Cookie `rulett_spin` alterada | — | — | Se ignora y se reescribe |
| Con sesión y dentro del cooldown | Antifraude de hoy (sin cambio) | Igual | Igual |
| Campaña terminada (`endsAt`) | Regla de 069 (sin cambio) | Igual | Igual |

Orden en ambos reclamos: sesión → token del giro → `validateClaimContext` → antifraude → `claimCouponInTransaction` (sin cambio de 066).

### 2.2 Login del personal (H3)

| Caso | Sin banderas | `credentials-preauth` | `login-throttle` |
|---|---|---|---|
| Formulario normal con Turnstile | OK | OK | OK |
| POST directo al callback sin preautorización | Sesión + `AUTH_CREDENTIALS_NO_PREAUTH` | Sin sesión | — |
| Preautorización de otro correo o vencida (> 120 s) | Sesión + log | Sin sesión | — |
| Contraseña mala, rol equivocado | «Correo o contraseña incorrectos.» | Igual | Igual (cuenta fallo) |
| Contraseña buena, rol equivocado | Mensaje del rol (como hoy) | Igual | Igual |
| Correo inexistente | «Correo o contraseña incorrectos.» (con `compare` ficticio) | Igual | Cuenta fallo |
| 10.º fallo en 15 min | `AUTH_LOGIN_LOCK_OBSERVED` | — | «Demasiados intentos. Espera 15 minutos o recupera tu contraseña.» |
| Contraseña correcta durante el bloqueo | OK | — | Mismo mensaje de bloqueo |
| Éxito | Borra la fila de `AuthThrottle` | — | Igual |

### 2.3 Sesiones (H3)

| Caso | Resultado |
|---|---|
| Sesión emitida antes del despliegue (`sv` ausente) | Válida |
| Cambio de la propia contraseña | Se cierra la sesión y lleva al login de su portal (`/login`, `/login/vendedor` o `/login/super`) con `passwordChanged=1` (D-14); las demás sesiones caen en su siguiente petición |
| Admin o Super Admin cambia la contraseña de otro usuario | Las sesiones de ese usuario caen |
| Super Admin cambia el correo de un usuario | Las sesiones de ese usuario caen (el `jwt` busca por correo; D-15) |
| Recuperación de contraseña | Todas las sesiones caen |
| Super Admin desactiva un usuario | Sus sesiones caen en su siguiente petición |
| Usuario borrado | Sus sesiones caen |
| Comercio desactivado | Caen las de admin, cajero y mesero; un `USER` con ese `tenantId` sigue |
| Vendedor | Reglas de 063 sin cambio, más las de esta tabla |
| Mock de desarrollo | Sin cambio (solo `development`) |

### 2.4 Recuperación (H3)

Respuesta siempre «Si el correo está registrado, te enviamos un enlace.» (texto actual de `auth-recovery.ts`), también con tope excedido o SMTP caído. Se busca por `sha256(token)`; solo si no aparece y el token recibido tiene formato UUID, también en claro (enlaces enviados antes del despliegue). Un valor de 64 hex nunca se busca en claro. La rama en claro se retira en T-31, más de 1 h después de T-30 en PDN (D-13).

### 2.5 R2 y comprobantes (H2)

| Caso | Resultado |
|---|---|
| Comprobante nuevo (cliente con `keyOnly`) | Clave `private/payment-receipts/{tenantId}/…` en el bucket actual, `attachmentKey`, `attachmentUrl` nulo; enlace por `/api/billing/receipts/[id]/attachment` |
| Cliente viejo (bundle en caché) sube después del despliegue | El presign devuelve `publicUrl` + `R2_RECEIPT_LEGACY_PRESIGN`; al guardar, la URL de `private/payment-receipts/{tenantId de sesión}/` se convierte en `attachmentKey` y `attachmentUrl` queda nulo (D-10) |
| Cliente viejo subió antes del despliegue y guarda después | URL de `billing/payment-receipts/{tenantId de sesión}/` ⇒ se guarda en `attachmentUrl` como hoy |
| URL o clave de otro comercio, de otro prefijo o malformada | «El comprobante no es válido.», sin escribir |
| Comprobante viejo | Enlace a `attachmentUrl` como hoy |
| Otro comercio pide la ruta de un comprobante ajeno | 404 (mismo que inexistente) |
| Alguien conoce una clave `private/*` | La lee por r2.dev (riesgo D-38 aceptado; cerrarlo requiere Cloudflare, fuera de alcance) |
| Admin guarda la landing con el mismo logo de siempre | OK |
| Admin guarda un logo de otro comercio o de `private/` | Log; con `r2-prefix`, rechazo «La imagen no es válida.» |

### 2.6 Wompi (H2)

| Caso | Resultado |
|---|---|
| `APPROVED` con monto y moneda iguales | Aplica como hoy |
| `APPROVED` con monto distinto | Sin escrituras, recibo sigue `PENDING`, `logError WOMPI_AMOUNT_MISMATCH`, 200 |
| `timestamp` a más de 24 h | Aplica + `warn` |
| Firma inválida | 401 como hoy |

## 3. Contratos

```ts
// spinRouletteAction — expand
type SpinResult =
  | { winnerId: string; winnerTitle: string; spinToken: string; repeated?: true }
  | { error: string; expired?: true };

// Reclamos — parámetro opcional nuevo
type ClaimCouponPostLoginInput = { /* actuales */ spinToken?: string };
// completeProfileAndClaim: mismo campo opcional `spinToken` en su entrada

// PendingClaimPayload (localStorage) — campo opcional
type PendingClaimPayload = { /* actuales */ spinToken?: string };
```

- Token del giro: `sp1.<payload>.<firma>`; preautorización: `pa1.…`; cookie del giro: `ss1.…`. Base64url sin relleno; firma HMAC-SHA256 completa (43 caracteres).
- `POST /api/uploads/r2` para `payment-receipt`: entrada con `keyOnly?: true` ⇒ respuesta sin `publicUrl`; sin la marca, con `publicUrl` hasta T-42 (D-10). Los demás purposes no cambian.
- `reportPaymentReceiptFromForm`: acepta `attachmentKey` (nuevo) o `attachmentUrl` (cliente viejo, reglas de §2.5).
- `GET /api/billing/receipts/[id]/attachment` → 302 a URL firmada de 60 s, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; 401 sin sesión; 404 ajeno, inexistente o sin `attachmentKey`.
- `POST /api/csp-report` → 204 siempre.
- Worker `/api/trigger`: `POST` como hoy; `GET` registrado 14 días y luego 405.

**Variables de entorno nuevas** (van a `runbooks/ENV.md`):

| Variable | Valores | Default |
|---|---|---|
| `SECURITY_ENFORCE` | lista: `credentials-preauth`, `login-throttle`, `oauth-checks`, `spin-token`, `spin-sticky`, `r2-prefix` | vacía |
| `LABSMOBILE_TRANSPORT` | `json` | ausente = GET de hoy |

## 4. Modelo de datos

- **M1:** `User.sessionVersion Int @default(0)`; tabla `AuthThrottle` (ver `design.md` H3). Aditiva.
- **M2:** `PaymentReceipt.attachmentKey String?`. Aditiva.
- Sin relleno ni cambios de tipo. Protocolo seguro de Neon; PDN solo con orden explícita de Oscar.

## 5. Reglas de negocio

- Un cupón de una campaña terminada sigue canjeable hasta su `expiresAt` (D-06; sin cambio).
- «Máximo de redenciones» cuenta reclamos, no canjes (comportamiento de 066; sin cambio).
- La ubicación del comensal es la que envía su navegador (R-01 residual).

## 6. Paso a obligatorio (criterios por bandera)

| Bandera | Lab | PDN en observación (≥ 7 días) | Pasa a obligatorio si |
|---|---|---|---|
| `credentials-preauth` | E2E de login en verde | `AUTH_CREDENTIALS_NO_PREAUTH` | 0 eventos de usuarios legítimos (los que haya deben coincidir con IPs bloqueadas o sin Turnstile) |
| `login-throttle` | Casos de §2.2 | `AUTH_LOGIN_LOCK_OBSERVED` | Ningún bloqueo de una cuenta que luego entró bien en < 15 min con la misma IP (revisión manual) |
| `oauth-checks` | Google y Facebook en Chrome, Safari iOS, navegador de Instagram y de Facebook | errores de callback del log de 018 | La tasa no sube frente a los 7 días previos (CA-09); se activa directo en PDN tras lab, con vigilancia de 48 h |
| `spin-token` | E2E de play en verde | `CLAIM_SPIN_TOKEN_*` | `MISSING` + `EXPIRED` < 0,5 % de los reclamos, sin `INVALID` |
| `spin-sticky` | `giro-reclamo.feature` | — (solo se activa) | Lab aprobado por Oscar |
| `r2-prefix` | Guardar landing, menú, campañas y comprobantes | `R2_URL_PREFIX_MISMATCH` | 0 eventos de valores legítimos (si aparecen prefijos viejos, se agregan antes de activar) |

## 7. Supuestos vigentes

- [SUPUESTO — confirmar] El plan de Vercel es Pro y admite reglas de tasa del Firewall (D-08).
- [SUPUESTO — confirmar] LabsMobile acepta el API JSON con autenticación básica.
- [SUPUESTO — confirmar] Ninguna integración externa llama `/api/trigger` del worker con `GET`.
- [SUPUESTO — confirmar] La política HSTS de hoy es la de Vercel por defecto (T-04).
- [SUPUESTO — confirmar] La configuración de los «7 ajustes» del diagnóstico externo coincide con CA-01.

## 8. Trazabilidad

| CA | R | Tasks | Prueba |
|---|---|---|---|
| CA-01 | R-01 | T-06, T-07, T-04 | `security-headers.test.ts`; `curl -I` en lab y PDN; E2E |
| CA-02 | R-03 | T-09 | `security-txt.test.ts`; `curl` en PDN |
| CA-03 | — | T-01 | `curl -I` con UA de navegador y Googlebot |
| CA-04 | R-05, R-06 | T-11, T-12, T-13, T-23 | `qr-theme-guard.test.ts`, `leads-guard.test.ts`, `coupon-input.test.ts`, `tenant-guard-sources.test.ts` |
| CA-05 | R-21 | T-34, T-39, T-40 | `spin-token.test.ts`, `claim-spin-token.test.ts`, `giro-reclamo.feature` |
| CA-06 | R-22 | T-35 | `spin-sticky.test.ts`, `giro-reclamo.feature` |
| CA-07 | R-13, R-14, R-15 | T-25, T-26, T-27, T-02 | `credentials-preauth.test.ts`, `login-throttle.test.ts`, `login-enumeration.test.ts`, integración `AuthThrottle`, lab |
| CA-08 | R-16, R-17 | T-24, T-28, T-29 | `session-version.test.ts`, `password-writes-sources.test.ts`, integración, lab |
| CA-09 | R-19 | T-32, T-40 | `oauth-checks.test.ts`, lab en navegadores de apps, métrica PDN |
| CA-10 | R-07, R-08, R-09 | T-14, T-15, T-16, T-42 | `r2-receipt-key.test.ts`, `receipt-attachment-route.test.ts`, `r2-tenant-prefix.test.ts`, lab |
| CA-11 | R-10 | T-17 | `wompi-amount-check.test.ts` |
| CA-12 | todos | T-37, T-38 | `test-plan.md`/`test-report.md` (ASVS L2), `aislamiento-comercios.feature` |
| CA-14 | — | T-05, T-43, T-44 | `npm audit --omit=dev` antes y después; unit, E2E completa y lab |
| CA-13 | todos | T-06, T-39, T-40, T-41 | E2E completa con banderas apagadas y encendidas; ensayo de apagado |

Otros requisitos: R-02 → T-08 (`csp-report-route.test.ts`); R-04 → T-10 (`map-tiles-rewrite.test.ts`); R-11 → T-18 (`cron-auth.test.ts`); R-12 → T-19 (`assert-same-origin.test.ts`); R-18 → T-30, T-31 (`auth-recovery.test.ts`); R-20 → T-33 (`game-random.test.ts`).

## 9. Delta a `openspec/specs/` (se fusiona al cierre)

- `security.md`: sección nueva «Endurecimiento (070)» con: interruptor `SECURITY_ENFORCE` y estado de cada bandera; cabeceras y CSP Report-Only; `/api/csp-report`; `security.txt`; preautorización, `AuthThrottle`, mensajes sin enumeración, `sessionVersion` y cierre por `isActive`/comercio/borrado; recuperación por hash; OAuth con checks; token y cookie del giro (R-02 residual); comprobante bajo `private/` con `attachmentKey` y ruta firmada (D-38 sigue aceptado); prefijo R2 por comercio; Wompi con monto; cron en tiempo constante; `localhost` fuera de PDN. Actualizar «Super Admin dev mock» y D-60 de 063 (regla de tasa ya aplicada). Registrar: canje de campaña terminada (D-06), ubicación del cliente (R-01), MFA del personal como pendiente, r2.dev como deuda, `nodemailer` 7 → 10 y `prisma` 6 → 7 como deuda de dependencias y las dependencias con riesgo aceptado de T-05 (D-27).
- `domain_model.md`: `User.sessionVersion`, `AuthThrottle`, `PaymentReceipt.attachmentKey`.
- `contracts.md`: respuesta del giro y entrada de los reclamos.
- `operations.md` y `runbooks/ENV.md`: variables nuevas y reglas del Firewall.
- `regression.md`: casos de §2 que valga la pena repetir (los alimenta `/pruebas-lab`).
- `AGENTS.md` §3: una línea por regla nueva (070).
