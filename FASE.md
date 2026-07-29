# FASE.md — Plan de fases y estado

Documento de control del proyecto GymSaaS. **Es la fuente de verdad sobre que esta hecho
y que falta.**

> **Para Claude Code:** lee este archivo ANTES de empezar cualquier trabajo, y
> actualizalo AL TERMINAR. Antes de dar una fase por cerrada, recorre su checklist
> entera y verifica cada casilla contra el codigo real, no contra el recuerdo de la
> conversacion. Si encuentras algo sin marcar que ya existe, marcalo. Si encuentras
> algo marcado que no existe, desmarcarlo y decirlo.

**Leyenda:** `[x]` hecho y verificado · `[~]` hecho a medias · `[ ]` pendiente

**Estado global:** Fases 1 a 7 completas. La Fase 8 (pago en linea del miembro por Wompi del
dueño) tiene **backend + frontend completos**; solo queda enganchar el botón de la plantilla de
WhatsApp (etapa 3), que depende de que el dueño lo añada en Meta. Lo demas es la deuda tecnica
de abajo, indispensable antes de desplegar.

---

## Fase 1 — Fundacion · COMPLETA

Objetivo: que sea imposible escribir una consulta que se salte el tenant sin darse cuenta.

### Infraestructura
- [x] Monorepo `/backend` + `/frontend` con instalaciones npm independientes
- [x] `config/entorno.js` valida el `.env` con Zod al arrancar (falla rapido)
- [x] `config/baseDatos.js` con la conexion abstraida (`obtenerConexion(tenantId)`)
- [x] `config/constantes.js` sin numeros ni strings magicos
- [x] Manejo legible de `EADDRINUSE` al arrancar

### Multi-tenancy (el requisito #1)
- [x] `contexto/contextoTenant.js` con `AsyncLocalStorage`
- [x] `ejecutarConTenant` / `ejecutarSinTenant` / `ejecutarConContexto`
- [x] Envoltura en `Promise.resolve()` para que las Query perezosas de Mongoose
      se ejecuten dentro del contexto
- [x] Plugin `modelos/complementos/aislamientoTenant.js`
- [x] Filtro automatico en find/findOne/count/update/delete/distinct
- [x] `$match` de tenant antepuesto en `aggregate`
- [x] Asignacion del tenant en `validate` e `insertMany`
- [x] `estimatedDocumentCount()` prohibido en colecciones tenant-scoped
- [x] Sin contexto, la operacion LANZA (`ErrorSinContextoTenant`)
- [x] `modelos/indice.js` con `obtenerModelo()` como unico punto de acoplamiento
- [x] Indices compuestos con `tenant` primero

### Modelos
- [x] Plataforma (sin plugin): `PlanPlataforma`, `Tenant`, `Usuario`
- [x] Tenant-scoped (con plugin): `Sede`, `PlanMembresia`, `Miembro`, `Pago`, `Notificacion`

### Auth
- [x] Login, logout, refresh, `/auth/yo`
- [x] JWT en cookies HttpOnly (acceso 15 min, refresco 7 dias)
- [x] Refresco limitado a `path=/api/auth/refrescar`
- [x] Revocacion por `Usuario.versionToken` (sin persistir refresh tokens)
- [x] Cambio de contrasena obligatorio en el primer acceso
- [x] `Tenant.estado` suspendido/cancelado bloquea el login con 403
- [x] Respuesta uniforme `{ ok, data, error }` y manejador central de errores
- [x] Validacion Zod en el borde (`validaciones/`)

### Frontend
- [x] Scaffolding Quasar (app-vite v2) con `jsconfig.json` extendiendo `.quasar/tsconfig.json`
- [x] Boot de Axios con `withCredentials` e interceptor de 401 con refresco compartido
- [x] `useAutenticacionStore` (Pinia) persistiendo solo el perfil, nunca el token
- [x] Guard de router por sesion y por rol
- [x] Login funcional de punta a punta a traves del proxy de Quasar
- [x] Paginas: IniciarSesion, CambiarContrasena, PanelInicio, PanelPlataforma, ErrorNoEncontrado
- [x] `/` redirige al panel (antes daba pantalla en blanco)
- [x] `/panel/plataforma` tiene pagina propia (antes reutilizaba PanelInicio y parecia roto)

### Pruebas y herramientas
- [x] 23 pruebas de aislamiento (negativas y positivas) — `pruebas/aislamientoTenant.prueba.js`
- [x] 14 pruebas de auth de integracion — `pruebas/auth.prueba.js`
- [x] Vitest unico para el monorepo, con `mongodb-memory-server`
- [x] `scripts/sembrarSuperAdmin.js` (idempotente)
- [x] `scripts/sembrarDatosPrueba.js` (2 gimnasios, 16 miembros, pagos variados)
- [x] graphify: `graph.js` (mapa/cerebro/detective) + hooks de Claude Code
- [x] `CLAUDE.md`, `README.md`, `.gitattributes`
- [x] Skill `frontend-design` instalado en `.claude/skills/`

---

## Fase 2 — Plataforma · COMPLETA

Objetivo: que un `super_admin` pueda dar de alta y administrar gimnasios.
Es el primer flujo que cruza la frontera plataforma → tenant.

### Backend
- [x] `validaciones/plataforma.validacion.js` (Zod)
- [x] `servicios/planesPlataforma.servicio.js` — CRUD de `PlanPlataforma`
      (DELETE archiva con `activo: false`; los planes nunca se borran porque
      los tenants los referencian)
- [x] `servicios/tenants.servicio.js` — listar, ver, suspender, reactivar, cancelar
      (`cancelado` es terminal: no hay transicion que salga de ahi)
- [x] `servicios/onboarding.servicio.js` — crear tenant + primer `tenant_owner` + primera sede
      (los pasos 1 y 2 sin contexto; el 3 dentro de `ejecutarConTenant`)
- [x] `controladores/` y `rutas/plataforma.rutas.js` protegidas con `requiereSuperAdmin`
- [x] Montar `autenticar` + `abrirContextoTenant` en el router de negocio
- [x] Transaccionalidad del onboarding: si falla la sede, no debe quedar el tenant huerfano.
      Resuelto con **compensacion manual** (no hay replica set, asi que no hay
      transacciones de Mongo); hay una prueba que sabotea el paso 3 y verifica el deshacer
- [x] Pruebas: un `tenant_owner` recibe 403 en todas las rutas de plataforma
      (14 pruebas en `pruebas/plataforma.prueba.js`)

### Frontend
- [x] `servicios/plataforma.servicio.js` (cliente HTTP)
- [x] `stores/plataforma.js`
- [x] `PanelPlataforma.vue`: tabla real de gimnasios con estado, plan, dueno y sedes
- [x] `FormularioOnboarding.vue`: alta de gimnasio + su primer dueno + primera sede
- [x] Acciones de suspender / reactivar / cancelar con confirmacion
- [x] Skill `frontend-design` aplicado: sistema visual propio ("bandas de disco",
      ver la convencion en `CLAUDE.md`)

---

## Fase 3 — Core del gimnasio · COMPLETA

Objetivo: que un gimnasio opere de verdad. Aqui el aislamiento se ejercita a diario.

### Backend
- [x] CRUD de `Sede` (el limite `maxSedes` quedo para la Fase 6, como preveia esta casilla:
      ahi va el middleware generico de limites del plan)
- [x] CRUD de `Usuario` dentro del tenant (crear `sede_admin` con `debeCambiarContrasena: true`).
      El dueno solo administra `sede_admin`; desactivar sube `versionToken` y mata la sesion.
      OJO: `Usuario` no lleva plugin — el aislamiento es manual en `usuarios.servicio.js`
- [x] CRUD de `PlanMembresia` (DELETE archiva: los pagos historicos lo referencian)
- [x] CRUD de `Miembro`, filtrado por sede para el rol `sede_admin` (crea siempre en SU sede,
      no puede mover miembros de sede, y los de otra sede son 404 para el)
- [x] `servicios/pagos.servicio.js`: al registrar un pago,
      `periodoFin = periodoInicio + planMembresia.duracionMeses` (meses de calendario)
- [x] `servicios/vencimientos.servicio.js`: derivar el estado del miembro del
      `periodoFin` de su ULTIMO pago. `obtenerUltimoPagoPorMiembro()` es la consulta unica
      que reutilizara el cron de la Fase 5. Sin `$lookup`: aggregate sobre `Pago` + merge en JS
- [x] Aplicar `limitarASede` en las rutas donde el `sede_admin` no debe ver todo
      (miembros, pagos, vencimientos)
- [x] Pruebas: un `sede_admin` no ve miembros de la otra sede del mismo tenant
      (23 pruebas en `gimnasio.prueba.js` y `pagos.prueba.js`)

### Frontend
- [x] Pantallas de sedes, equipo (usuarios), planes de membresia y miembros
- [x] `FormularioPago.vue`: al elegir plan, calcular y mostrar `periodoFin`
- [x] Distinguir efectivo vs transferencia (`referencia` obligatoria en transferencia,
      validado en Zod y en el formulario)
- [x] `useVencimientos.js` (conteos, apariencia de estados y formato de fechas)

---

## Fase 4 — Panel y reportes · COMPLETA

- [x] Ingresos del mes por sede (aggregate; el `$match` de tenant lo antepone el plugin solo)
- [x] Split efectivo vs transferencia (`servicios/reportes.servicio.js`)
- [x] Conteo de miembros activos / vencidos / proximos a vencer — reutiliza
      `listarVencimientos()` de la Fase 3, no duplica la regla de derivacion
- [x] Filtro por sede: `tenant_owner` ve el consolidado (`limitarASede` deja `{}`);
      `sede_admin` solo la suya. **Nota:** el `super_admin` no participa de este endpoint
      porque los reportes son tenant-scoped y el no pertenece a ningun gimnasio — la
      redaccion original de esta casilla lo mencionaba, pero no aplica en la practica
- [x] Sin `$lookup`: los nombres de sede salen de una consulta aparte a `Sede` y se
      cruzan en memoria con el aggregate de `Pago` (mismo patron que `tenants.servicio.js`)
- [x] Comparacion contra el mes anterior (`totalMesAnterior` + `variacion`): una cifra
      sola no dice si el gimnasio va bien. `variacion` es `null` cuando el mes anterior
      fue cero — no se inventa un "+100%"
- [x] Dashboard con graficas (skill `dataviz`): cifra heroe con el total del mes y su
      variacion, barras horizontales por sede tipo "manga de barra cargada"
      (`GraficaIngresos.vue`, paleta violeta/naranja validada con `validate_palette.js`,
      deliberadamente fuera de la familia de colores ya usada por los estados de
      vencimiento) y los dos estados accionables (vencidos / por vencer) como lista de
      llamadas, no como marcador
- [x] Vista de tabla bajo la grafica: el desglose efectivo/transferencia por sede no
      puede vivir solo en el tooltip (regla de `dataviz`: los tooltips enriquecen,
      nunca condicionan)
- [x] Pruebas: split por metodo de pago, sede en cero no desaparece, pagos fuera del
      mes no cuentan, variacion contra el mes anterior (incluido el caso `null` y el de
      hace dos meses), alcance por sede, y el conteo coincide con `/api/vencimientos`
      (9 pruebas en `reportes.prueba.js`)
- [x] Verificado en navegador real (Chrome headless por CDP) para los tres roles

---

## Fase 5 — Notificaciones WhatsApp · COMPLETA

- [x] Interfaz `NotificacionProvider` (`proveedores/NotificacionProvider.js`)
- [x] Implementaciones intercambiables: Cloud API, n8n, ninguno.
      **Baileys NO esta implementado a proposito**: no es una llamada HTTP como los otros,
      sino una dependencia pesada + emparejamiento por QR + sesion viva por gimnasio.
      Su fabrica lanza con un mensaje claro. Ver la decision abierta, abajo
- [x] El proveedor se lee de `tenant.config.whatsapp.proveedor`
- [x] Cron diario con `node-cron` (9:00 `America/Bogota`), apagable con `HABILITAR_CRON`
      para que solo UNA instancia lo programe. Se agenda dentro del callback de `listen`:
      un proceso que no tomo el puerto no debe agendar trabajo
- [x] El cron itera tenants **operativos** y envuelve CADA uno en `ejecutarConTenant`.
      Nota: la redaccion original decia "activos"; se usa `ESTADOS_TENANT_OPERATIVOS`
      (`trial` + `activo`), porque un gimnasio en prueba tiene miembros que vencen de verdad
- [x] ~~Busca pagos con `periodoFin <= hoy + DIAS_AVISO_VENCIMIENTO` y `notificado: false`~~
      **Esa consulta es incorrecta y no se implemento asi.** Un miembro que ya renovo
      conserva su pago viejo (vencido, `notificado: false`) y recibiria un aviso de que su
      mensualidad vencio estando al dia. El aviso se deriva del **ULTIMO pago**, con la
      misma `listarVencimientos()` que pinta el panel. Hay una prueba dedicada, y la
      corrida contra los datos de prueba lo confirma (el miembro con `historial: true`
      no recibe aviso)
- [x] Registra en `Notificacion` y marca `Pago.notificado = true` **solo tras un envio
      confirmado**: si falla, se registra `fallido` y se reintenta en la proxima corrida
- [x] Respetar `PlanPlataforma.features.whatsapp`: si el plan no lo incluye, no enviar
- [x] Un gimnasio mal configurado no tumba la corrida de los demas
- [x] Pruebas del cron con un proveedor falso (22 pruebas, ninguna toca la red)
- [x] Corrida de humo contra la base de desarrollo con datos sembrados

> **Decision abierta (sigue abierta):** que proveedor de WhatsApp se usa en produccion.
> El codigo no la toma: el canal se elige por gimnasio en `tenant.config.whatsapp`.
> Si se elige Baileys, hay que implementar `proveedores/baileys.proveedor.js` (dependencia
> `@whiskeysockets/baileys`, sesion persistida y emparejamiento por QR por cada gimnasio).
> Si se elige Cloud API, el proveedor ya envia una **plantilla** (`type: 'template'`,
> `PLANTILLA_VENCIMIENTO` = `aviso_vencimiento` / `es_CO`) en vez de texto libre, porque Meta
> solo acepta texto libre dentro de la ventana de 24 h. Lo que queda del lado de cada gimnasio
> (no del codigo): registrar en SU WABA una plantilla aprobada con ese nombre y sus 3 variables,
> y poner las credenciales `{ idTelefono, token }` en `tenant.config.whatsapp`.

---

## Fase 6 — Facturacion de plataforma y limites · COMPLETA

Pasarela elegida: **Wompi** (`pasarelas/wompi.pasarela.js`).

- [x] `middlewares/limitesPlan.js` verifica `PlanPlataforma.limites` antes de crear
      sede/miembro/usuario. Cuenta solo los recursos **activos**: dar de baja a un
      miembro libera cupo
- [x] Estado de suscripcion del tenant y transiciones:
      `trial` --(paga la 1a factura)--> `activo` --(impago)--> `suspendido` --(paga)--> `activo`.
      `cancelado` es terminal: **pagar no lo revive**
- [x] Suspension automatica por impago (`suspenderMorosos`, cron diario a las 3:00)
- [x] Historico de facturacion: modelo `FacturaPlataforma` (nivel plataforma, sin plugin),
      `GET /api/facturacion` para el dueno y `GET /api/plataforma/tenants/:id/facturas`
      para el super_admin
- [x] Pasarela Wompi: firma de integridad del checkout (salida) y verificacion del
      checksum del evento (entrada), con **dos secretos distintos**. Webhook publico en
      `POST /api/webhooks/wompi`, idempotente y con comprobacion de monto
- [x] Frontend: `PaginaFacturacion.vue` con la factura pendiente, el boton de pago y el
      historial
- [x] 35 pruebas nuevas (`facturacion.prueba.js`, `limitesPlan.prueba.js`); ninguna toca
      la red ni la pasarela real

### El agujero que abria la suspension (y que la fase no mencionaba)

Suspender a un gimnasio por no pagar y ademas cerrarle el login lo dejaba **sin forma de
pagar**. Se corrigio separando dos conceptos que antes eran uno:

- `ESTADOS_TENANT_OPERATIVOS` (`trial`, `activo`) — puede usar el gimnasio.
- `ESTADOS_TENANT_CON_ACCESO` (+ `suspendido`) — puede iniciar sesion.

Un gimnasio suspendido entra, pero `bloquearSiGimnasioSuspendido` le cierra todas las rutas
de negocio menos `/auth` y `/facturacion`. `cancelado` sigue sin entrar.
**Esto cambia el comportamiento documentado hasta la Fase 5**, y CLAUDE.md ya lo refleja.

---

## Fase 7 — Registro publico, prueba gratis y suscripcion unica · COMPLETA

Objetivo: que cualquiera (no solo el `super_admin`) de de alta su gimnasio, estrene
2 meses gratis y quede en una unica suscripcion plana de $100.000/mes.

### Backend
- [x] Constantes: `MESES_TRIAL_GRATIS = 2`, `PLAN_SUSCRIPCION_NOMBRE = 'Estandar'`,
      `PLAN_SUSCRIPCION_PRECIO = 100_000` en `config/constantes.js`
- [x] `Tenant.finTrial` (fecha): fin de la prueba gratis. Se calcula al crear el tenant
      con `sumarMeses(ahora, MESES_TRIAL_GRATIS)`
- [x] `Usuario.emailVerificado` (bool, **default `true`**): solo el registro publico lo
      pone en `false`. Un usuario creado por un admin nace verificado
- [x] `correos/correo.js` — transporte nodemailer cacheado; sin `SMTP_HOST` imprime el
      contenido en consola (dev/test) y **lanza en produccion** (no dar por registrado a
      quien no recibio el enlace). `correos/verificacion.correo.js` arma asunto/texto/html
- [x] `utilidades/token.js` — `firmarTokenVerificacion` / `verificarTokenVerificacion`
      (JWT con `prop: 'verificacion-email'`, 2 dias, firmado con `JWT_SECRETO_ACCESO`)
- [x] `onboarding.servicio.js` reutilizado por ambos caminos (super_admin y publico) via
      un objeto `opciones` (`{ planId, emailVerificado, debeCambiarContrasena, ahora }`)
- [x] `servicios/registroPublico.servicio.js` — `obtenerPlanDeSuscripcion()` (busca el
      plan unico activo o lanza un error claro) + `registrarGimnasioPublico()`, que crea el
      gimnasio sin verificar, firma el token y dispara el correo. El emisor de correo se
      **inyecta** (como el proveedor de WhatsApp), para que las pruebas no toquen la red
- [x] `auth.servicio.js`: `iniciarSesion` responde 403 si `!emailVerificado`;
      `verificarEmail(token)` es idempotente
- [x] Rutas publicas `POST /api/auth/registrar-gimnasio` y `GET /api/auth/verificar-email`
- [x] `facturacionPlataforma.servicio.js`: el cron de cobranza **salta** los gimnasios en
      prueba (`ahora < tenant.finTrial`): no factura durante los 2 meses gratis
- [x] `sembrarDatosPrueba.js`: un unico `PlanPlataforma` ('Estandar'), ambos gimnasios en el

### Frontend
- [x] Rutas publicas `registrar` y `verificar-email` (`meta.publica: true`)
- [x] `servicios/auth.servicio.js`: `registrarGimnasio` y `verificarEmail`
- [x] `RegistrarGimnasio.vue`: formulario publico de 3 pasos (gimnasio/dueno/sede) con
      discos numerados, slug autopropuesto desde el nombre, estado "revisa tu correo" al
      terminar (no abre sesion) y el precio "$100.000/mes" a la vista
- [x] `VerificarEmail.vue`: aterriza el enlace del correo, canjea el token y muestra
      verificando/ok/error
- [x] Enlace "Registra tu gimnasio" desde `IniciarSesion.vue`
- [x] **Bug corregido (interceptor 401):** en una pagina publica que no es el login
      (`registrar`, `verificar-email`), el chequeo de sesion de fondo del guard daba 401,
      el interceptor lanzaba un `POST /auth/refrescar` **interno sin `omitirRedireccion401`**,
      ese refresco daba 401 y redirigia a login, expulsando de la pagina. Se marca el
      refresco con `omitirRedireccion401: true`: su propio 401 ya no decide navegacion; la
      decision sigue siendo de la peticion original. (`boot/axios.js`)

### Pruebas
- [x] 11 pruebas nuevas en `pruebas/registroPublico.prueba.js` (trial + sin verificar,
      correo con token, rollback por slug ocupado, clave debil, sin plan, login bloqueado
      sin verificar, login tras verificar, verificar idempotente, token invalido, y el cron
      que salta durante la prueba pero factura despues). Suite completa en verde
- [x] Verificado en navegador real (CDP): `/registrar` renderiza y se queda (regresion del
      redirect resuelta), envio -> "revisa tu correo", `/verificar-email?token=malo` muestra
      el error sin expulsar a login

### Login por correo o cedula (incremento posterior)

El personal entra con **correo o cedula**, a eleccion. Detalles:

- `Usuario.cedula`, **opcional** y unica por tenant con indice **parcial** (solo cuenta a
  quien la tiene). El login recibe un unico `identificador`; `auth.servicio.js` decide si es
  correo o cedula por el `@`. Ambos siguen siendo unicos por tenant, asi que el paso de
  "identificador del gimnasio" tambien aplica cuando la cedula se repite entre gimnasios.
- La cedula se pide (opcional) en el registro publico, el onboarding del super_admin y el alta
  de administradores de sede. Los miembros NO se tocan: no inician sesion.
- Pruebas: login por cedula, cedula inexistente (mismo 401 generico), unicidad por tenant y
  convivencia de varios usuarios sin cedula (indice parcial), en `auth.prueba.js`.

---

## Fase 8 — Pago en linea del miembro (Wompi del dueño) · BACKEND COMPLETO

Objetivo: que el miembro pague su mensualidad EN LINEA al Wompi **del dueño** (nivel de cobro
"miembro"), desde el botón "Pagar ahora" del aviso de vencimiento por WhatsApp.

### Backend (etapa 1) — hecho
- [x] `tenant.config.wompi` (llaves del dueño: `llavePublica`, `secretoIntegridad`,
      `secretoEventos`). Nunca se serializan al cliente (`Tenant.toJSON`).
- [x] `Miembro.email` opcional (prellenado del checkout y recibo); `emailOpcional` en Zod.
- [x] `Pago.transaccionWompi` + índice único parcial `{ tenant, transaccionWompi }`
      (idempotencia); `metodoPago: 'wompi'`; `registradoPor` opcional (`null` = lo pagó el miembro).
- [x] `pasarelas/wompi.pasarela.js` generalizada: `construirEnlaceCheckout` acepta las
      credenciales del dueño + prellenado del cliente; `verificarChecksumEvento(evento, secreto)`.
      Las llaves del entorno siguen siendo el default (el cobro de plataforma no se toca).
- [x] `token.js`: `firmarTokenPagoMiembro` / `verificarTokenPagoMiembro` (JWT `prop: 'pago-miembro'`,
      7 días, sin monto ni plan — se resuelven frescos).
- [x] `pagosMiembro.servicio.js`: `construirCheckoutDesdeToken` (enlace) y `aplicarEventoPagoMiembro`
      (webhook). La firma se verifica DENTRO del servicio (secreto por gimnasio, resuelto por la
      referencia `MB-<tenant>-<miembro>-<plan>-<nonce>`). Renueva desde el fin vigente, no desde hoy.
- [x] Rutas públicas `GET /api/pagar/:token` (302 al checkout) + `GET /api/pagar/gracias` +
      `POST /api/webhooks/wompi-miembro`. `ORIGEN_PUBLICO` en el entorno.
- [x] 13 pruebas (`pagosMiembro.prueba.js`): enlace firmado con prellenado, token/creds inválidos,
      webhook crea el Pago, idempotencia, firma inválida (401), no-aprobado, monto que no cuadra,
      referencia ajena, y el cableado HTTP real (302/400/200/401). Suite completa en verde.

### Frontend (etapa 2) — hecho
- [x] **Lo configura el SUPER_ADMIN, no el dueño**: son secretos criptográficos y es más prudente
      que los maneje el operador de la plataforma. `GET/PUT /api/plataforma/tenants/:id/cobros`
      (requiereSuperAdmin). Los secretos NUNCA se devuelven al cliente; sí la llave pública y la URL
      del webhook. 5 pruebas (incluida: un dueño recibe 403).
- [x] Diálogo de config en `PanelPlataforma.vue`: botón "Cobros" por gimnasio → pega las 3 llaves,
      ve el estado (activo/sin configurar) y copia la URL del webhook. Verificado en navegador real
      (guardar → "Llaves guardadas").
- [x] Campo `email` (opcional) en el alta/edición de miembros (`PaginaMiembros.vue`). Verificado.
- [x] Página de "gracias/pago en proceso": la sirve el backend en `/api/pagar/gracias` (HTML).

### Canal de WhatsApp: configurable por gimnasio · HECHO y desplegado
- [x] `tenant.config.whatsapp` existia en el modelo pero NO habia forma de ponerlo. Ahora
      `GET/PUT /api/plataforma/tenants/:id/whatsapp` (**solo super_admin**, igual que las llaves
      de Wompi y por el mismo motivo: el token de Meta es un secreto).
- [x] El **token NUNCA se devuelve** al cliente; el `idTelefono` y la URL de n8n si (son
      identificadores). La respuesta incluye que plantilla debe tener aprobada el gimnasio
      (`aviso_vencimiento` / `es_CO`), para no adivinarlo.
- [x] Validacion como union discriminada por proveedor: `cloud_api` exige idTelefono + token,
      `n8n` exige URL, `ninguno` apaga el canal. **`baileys` no se acepta**: no esta
      implementado y dejaria el canal roto en silencio hasta la corrida del cron.
- [x] Frontend: boton "Configurar avisos por WhatsApp" por gimnasio en `PanelPlataforma.vue`.
- [x] `scripts/enviarAvisosAhora.js`: dispara la MISMA corrida del cron a mano, para probar el
      envio sin esperar a las 9:00.
- [x] 5 pruebas (`whatsapp.prueba.js`). Suite: 235 en verde.
- [x] **VERIFICADO EN PRODUCCION (21-22 jul 2026)**: plantilla `aviso_vencimiento` aprobada en
      Meta, canal configurado en el gimnasio de demo y aviso ENTREGADO a un WhatsApp real. La
      corrida reporto `enviados: 1, fallidos: 0` y el mensaje llego al telefono.
- [ ] **Pendiente del lado de Meta (no del codigo)**: la app del gimnasio sigue *sin publicar*,
      asi que Meta solo entrega a numeros dados de alta como destinatarios de prueba. Para
      avisar a miembros reales hay que publicar la app y completar la verificacion del negocio.
      Ademas, los mensajes iniciados por la empresa se cobran: la cuenta necesita saldo/metodo
      de pago activo o Meta acepta el envio pero no lo entrega.

### Bandeja de WhatsApp: recibir comprobantes y responder · HECHO
Nace de un cambio de plan del cliente: en vez de cobrar por Wompi, comparte cuenta/QR y el
miembro manda el **comprobante por WhatsApp**. Un numero conectado a la Cloud API no tiene app
detras, asi que sin esto el comprobante no lo ve nadie.
- [x] `modelos/MensajeWhatsapp.js` tenant-scoped: `sede`, `miembro` (ambos opcionales: quien
      escribe puede no ser miembro aun), `telefono`, `direccion` (entrante/saliente), `tipo`,
      `texto`, `archivo`, `mimeType`, `leido`, `enviadoPor`. Indice unico parcial
      `{ tenant, idMensajeWhatsapp }` = idempotencia frente a los reintentos de Meta.
- [x] Webhook publico `GET/POST /api/webhooks/whatsapp`. El GET es el handshake de Meta
      (`WHATSAPP_TOKEN_VERIFICACION`). El POST: el `phone_number_id` -dato NO confiable- solo
      elige **de que gimnasio** es y con que secreto verificar; lo que autentica es la firma
      HMAC (`x-hub-signature-256`) contra el `secretoApp` de ESE tenant. **Sin secreto
      configurado no se acepta nada**: aceptar sin verificar permitiria inyectar comprobantes
      falsos. Mismo patron que el webhook de Wompi de miembros.
- [x] `servidor.js` guarda el cuerpo CRUDO (`express.json({ verify })`): la firma se calcula
      sobre los bytes, no sobre el JSON reserializado.
- [x] Las imagenes se descargan de Meta (2 pasos: metadatos → binario) a
      `ALMACEN_ARCHIVOS/whatsapp/<tenantId>/`. Si la descarga falla, el mensaje se guarda igual
      (mejor un comprobante sin imagen que perderlo). A Meta se le responde 200 siempre que la
      firma sea valida, o reintenta en bucle.
- [x] `mensajes.servicio.js` + rutas `/api/mensajes` (personal del gimnasio, con `limitarASede`):
      listar, contar pendientes, marcar leidos, **responder** (texto libre) y servir el archivo.
      El comprobante se streamea por la API con la cookie de sesion: el almacen nunca se expone.
- [x] Responder usa texto LIBRE, que Meta solo acepta dentro de las 24 h desde el ultimo mensaje
      del cliente; si lo rechaza se dice claro, no un 500 mudo. Responder marca leido el hilo.
- [x] Config del canal: `secretoApp` (opcional para enviar, **obligatorio para recibir**). Los
      secretos ya guardados se **conservan** si el campo llega vacio: entrar a poner el secreto
      no puede borrar el token, que Meta solo muestra una vez.
- [x] Frontend: `PaginaMensajes.vue` (hilos por telefono, comprobante ampliable, caja de
      respuesta y boton **Registrar pago** que abre `FormularioPago` con ese miembro) + badge de
      pendientes en el menu. En `PanelPlataforma.vue`, el dialogo de WhatsApp muestra la URL del
      webhook y el token de verificacion para pegarlos en Meta.
- [x] La auditoria anota "Respondio por WhatsApp" (marcar leido no es un movimiento).
- [x] 8 pruebas (`mensajes.prueba.js`): handshake ok/ko, firma invalida rechazada (y NO guarda),
      idempotencia por `wamid`, numero desconocido ignorado, y aislamiento por sede de la
      bandeja. Suite: 243 en verde.
- [ ] **Pendiente (accion en Meta)**: registrar la URL del webhook y suscribir el campo
      `messages` en la app del gimnasio, y pegar el App Secret en el panel.

### Pendientes acumulados (para no olvidar) · anotados 29 jul 2026

**WhatsApp — overhaul de la plantilla `aviso_vencimiento` (todo en UNA edicion + re-review):**
- [ ] Cuentas de pago como TEXTO FIJO en el cuerpo (llave Bre-B, Nequi, Bancolombia
      Ahorros, titular). Van en Meta, NO en el codigo (el codigo solo manda variables).
      Faltan los 4 datos del dueño para armar el texto final.
- [ ] Boton de respuesta rapida "Enviar comprobante" (quick reply estatico: no toca el
      codigo de envio).
- [ ] 4ª variable `{{4}}` = VALOR de la mensualidad, resuelto FRESCO al enviar desde el
      precio ACTUAL del plan del ultimo pago (si cambia el precio, cambia el aviso). Esto
      SI toca codigo:
        - `notificaciones.servicio.js → construirVariables` añade el monto formateado.
        - Se lee `plan.precio` del `ultimoPago.planMembresia` (NO `ultimoPago.monto`, que es
          lo que pagó la vez pasada, no el precio de hoy). Cargar los planes del tenant una
          vez y cruzar en memoria (sin `$lookup`).
        - `cloudApi.proveedor.js` ya manda tantos parametros como variables tenga el array.
      **COORDINACION CRITICA:** el codigo de 4 variables NO se despliega hasta que la
      plantilla con `{{4}}` este APROBADA en Meta, o Meta rechaza el envio por descuadre de
      parametros. Plantilla primero, deploy despues.

**WhatsApp — nombre del numero:**
- [ ] Confirmar que el nombre visible cambió GlowUp → "Gym Barichara". Al 29 jul seguia
      como GlowUp y sin cambio pendiente en Meta; reintentar la consulta.

**Correo transaccional (recibo de pago al miembro):**
- [ ] El VPS (Clouding.io) BLOQUEA el SMTP saliente (25/465/587) — verificado con prueba de
      conexion. nodemailer/SMTP NO sirve; el firewall local esta abierto, el bloqueo es del
      proveedor. El 443 SI esta abierto: usar una API HTTP (Resend/Brevo).
- [ ] Montar proveedor de correo por HTTP + enviar recibo al registrar un pago (email del
      miembro es OPCIONAL: solo a quien lo tenga). Falta: cuenta + API key + verificar
      dominio (DKIM/SPF en deSEC para gymbarichara.dedyn.io).

**Seguridad (rotar secretos que se pegaron en el chat):**
- [ ] Contraseña root del VPS `Sam*@2023@` (reusada en Atlas). Ya hay llave SSH instalada
      (`claude-deploy-gym`), asi que se puede rotar y desactivar el login por contraseña sin
      quedar fuera.
- [ ] App Secret de Meta (si no se regeneró tras pegarlo) y los tokens permanentes de Meta.

### Pendiente (etapa 3): enganchar el botón de WhatsApp
- [ ] La plantilla de Meta hoy es solo texto, sin botón. Para el flujo completo hay que: (a) editar
      la plantilla en Meta y añadir un **botón URL dinámico** con base `ORIGEN_PUBLICO/api/pagar/`;
      (b) que `cloudApi.proveedor.js` envíe el parámetro del botón (`sub_type: 'url'`) con el token
      del miembro (`enlacePagoMiembro` ya lo genera); (c) pasar ese token desde el servicio de
      notificaciones. Sin (a) —acción del dueño en Meta— no tiene sentido implementar (b) y (c).

---

## Fase 9 — Operacion del gimnasio (pase de dia · inventario · mantenimiento)

Tres modulos que pidio el cliente dueño de gimnasio. Orden de construccion:
**pase de dia → inventario → mantenimiento**.

### Etapa 1 — Pase de dia · HECHO y desplegado
- [x] `PlanMembresia` ahora mide en `duracionMeses` **O** `duracionDias` (exactamente uno, lo
      exige un `pre('validate')` + un `.refine` en Zod). Virtual `descripcionDuracion` ("1 dia").
- [x] `utilidades/fechas.js → sumarDuracion(inicio, plan)`: dias o meses segun el plan. Lo usan
      `pagos.servicio.js` y `pagosMiembro.servicio.js` para el `periodoFin`.
- [x] Frontend: `PaginaPlanes.vue` con numero + unidad (meses/dias); `FormularioPago.vue` deriva
      el vencimiento con dias. Seed añade "Pase de dia" ($8.000 / 1 dia).
- [x] Pruebas: pase de dia vence al dia siguiente; un plan no puede tener meses y dias a la vez.

### Etapa 2 — Inventario por sede · HECHO y desplegado
- [x] `modelos/Producto.js` tenant-scoped (con plugin de aislamiento): `sede` (req), `nombre`,
      `cantidad` (min 0), `precio` (opcional), `activo`. Indice `{ tenant, sede, nombre }` unico.
- [x] `inventario.servicio.js` respeta el contrato `filtroSede`: un sede_admin solo ve/toca lo
      de SU sede (producto de otra sede = 404), y al crear se le fuerza su sede. `ajustarStock`
      rechaza dejar la cantidad en negativo ("No hay existencias suficientes").
- [x] Rutas `GET/POST /inventario`, `PATCH /:id/ajuste` (entrada/salida), `PATCH /:id`,
      `DELETE /:id` (archiva). Cadena de middlewares estandar + `limitarASede`.
- [x] Frontend: `PaginaInventario.vue` (tabla con existencias en chip verde/rojo, entrada/salida
      por dialogo, editar, archivar; selector de sede solo para el dueño), en el store y el nav.
- [x] 6 pruebas (`inventario.prueba.js`), todas en verde. Seed añade productos de demo por sede.

### Etapa 2.1 — Ventas de productos (mini punto de venta) · HECHO y desplegado
- [x] `Producto.precio` pasa a **obligatorio** (sin precio no se puede vender). Migracion
      `scripts/migrarPrecioProducto.js` pone `precio: 0` a los productos viejos sin precio
      (idempotente, sobre la coleccion cruda para arreglar todos los tenants).
- [x] `modelos/VentaProducto.js` tenant-scoped por sede: guarda FOTO de `nombreProducto` y
      `precioUnitario` al vender, `total = cantidad * precioUnitario`, y `registradoPor` (el
      encargado). Es un TERCER flujo de dinero, distinto de la mensualidad del miembro y de la
      suscripcion del gimnasio.
- [x] `ventas.servicio.js`: `registrarVenta` descuenta stock y crea la venta (compensa
      devolviendo el stock si falla el registro; no hay transacciones). `listarVentas` agrupa
      por dia (por defecto HOY) y devuelve `{ ventas, resumen: { total, unidades, operaciones } }`.
      Respeta `filtroSede`: un sede_admin solo vende/ve lo de SU sede. Rutas `GET/POST /ventas`.
- [x] Frontend: accion **Vender** en el inventario (descuenta stock + registra ingreso) y
      `PaginaVentas.vue` con el total del dia, unidades, operaciones y un selector de fecha.
      En el store, el nav y el router. Precio repuesto en la tabla y como campo obligatorio.
- [x] 5 pruebas (`ventas.prueba.js`) + inventario ampliado (rechaza producto sin precio).
      Suite completa: 211 en verde.

### Etapa 6 — Modulo de finanzas (gastos por sede + deudas del dueño) · HECHO y desplegado
- [x] `modelos/Gasto.js` tenant-scoped con **`sede` OPCIONAL**: con sede es el gasto de esa sede
      (arriendo/servicios/empleados/otros), sin sede es del gimnasio entero (obligaciones del
      dueño). De ahi salen las dos trazabilidades: por sede y consolidada.
- [x] `modelos/Deuda.js`: creditos y demas obligaciones con `montoTotal`. El **pagado y el saldo
      NO se guardan**: se derivan de la suma de sus abonos (misma regla que el vencimiento).
- [x] `abonarDeuda` crea un `Gasto` con `categoria: 'deuda'` ligado a la deuda: baja el saldo Y
      cuenta como egreso del mes, sin duplicar. No deja abonar mas que el saldo ni a una saldada.
- [x] `gastos.servicio → resumenFinanzas`: agrega por `{ sede, categoria }` en un rango (por
      defecto el mes) y devuelve `porSede` + `general` + `total`, cruzando nombres en memoria
      (sin `$lookup`). Toda sede visible aparece aunque este en cero.
- [x] Rutas: `/api/gastos` (staff, con `limitarASede`) y `/api/deudas` (**solo dueño**).
      La bitacora de auditoria mapea gastos, deudas y abonos.
- [x] Frontend `PaginaFinanzas.vue` con 3 pestañas: **Resumen** (tarjeta por sede + tarjeta
      general + consolidado, con desglose por categoria), **Gastos** (libro de egresos con alta
      y borrado) y **Deudas** (solo dueño: saldo, barra de progreso y abonar). Filtro de fechas.
- [x] 7 pruebas (`finanzas.prueba.js`): resumen sede/general/consolidado, aislamiento del
      sede_admin, sede forzada, saldo derivado, abono como gasto, tope del abono y 403 en deudas.
      Suite: 229 en verde.

### Etapa 5 — Planes de membresia POR SEDE · HECHO y desplegado
- [x] `PlanMembresia.sede` obligatorio; indice unico `{ tenant, sede, nombre }` (el nombre solo
      choca dentro de la misma sede, asi dos sedes pueden tener "Mensual" a distinto precio).
- [x] `planesMembresia.servicio` adopta el contrato `filtroSede` (listar/crear/actualizar/
      archivar) y las rutas suman `limitarASede`: un sede_admin solo ve y cobra con los suyos.
      Escribirlos sigue siendo del dueño; leerlos, de cualquier staff (formulario de pago).
- [x] **Regla nueva en `pagos.servicio`**: el plan tiene que ser de la sede del miembro; si no,
      400 "Ese plan es de otra sede". Aplica tambien al dueño, que ve los de todas las sedes.
- [x] Frontend: columna Sede y selector de sede al crear en `PaginaPlanes.vue`;
      `FormularioPago.vue` solo ofrece los planes de la sede del miembro (con aviso si esa sede
      aun no tiene planes).
- [x] `scripts/migrarSedePlanMembresia.js` (idempotente): adopta los planes sin sede en la
      primera sede activa de su gimnasio. Ejecutado en produccion (1 plan migrado).
- [x] 2 pruebas nuevas (un sede_admin solo ve los planes de su sede; no se puede cobrar con un
      plan de otra sede) + seed y 6 archivos de prueba adaptados. Suite: 222 en verde.

### Etapa 4 — Auditoria de movimientos (bitacora del dueño) · HECHO y desplegado
- [x] `modelos/Auditoria.js` tenant-scoped: guarda quien (foto de nombre y rol), que
      (`accion` legible + `recurso`), un `detalle` corto y la fecha. Registro historico:
      no se edita ni se borra.
- [x] `middlewares/auditoria.js` transversal: anota en `res.on('finish')` CADA mutacion
      exitosa (POST/PATCH/DELETE) de personal del gimnasio. Traduce la ruta a una frase
      legible (mapa `MOVIMIENTOS`); los servicios no saben que existe (cero acoplamiento).
      TRAMPA: en `finish` la pila de routers ya se desenrollo, asi que se lee `originalUrl`
      (no `path`, que volveria a ser "/api/..."). Escribe con `ejecutarConTenant` (el contexto
      de la peticion ya se cerro) y es fire-and-forget: nunca rompe la operacion.
- [x] No audita: GETs, login/refresh, webhooks, `/pagar`, operaciones fallidas (>=400) ni al
      super_admin (opera la plataforma, no un gimnasio).
- [x] `/api/auditoria` (GET, SOLO dueño) lista los ultimos 300 movimientos de TODAS sus sedes.
      Frontend: `PaginaAuditoria.vue` con buscador (usuario/accion/detalle), chip de rol y
      banda de color por recurso. En el nav y el router (solo dueño).
- [x] 4 pruebas (`auditoria.prueba.js`, con poll por la escritura async). Suite: 220 en verde.

### Etapa 3.1 — Reportes de maquinas para el dueño · HECHO y desplegado
- [x] `modelos/ReporteMaquina.js` tenant-scoped: se crea cuando un `sede_admin` marca una
      maquina en mantenimiento/dañada (`maquinas.servicio` lo dispara pasando el `actor` desde
      el controlador). Guarda foto del nombre/estado/nota, quien reporto y `leido`.
- [x] Solo cuando el ESTADO cambia a mantenimiento/dañada: editar la nota de una maquina ya
      reportada no genera aviso nuevo. Si el propio dueño cambia el estado, no se reporta (no
      hace falta avisarse a si mismo).
- [x] `reportesMaquina.servicio` + rutas `/api/reportes-maquina` (GET lista, GET /no-leidos,
      POST /marcar-leidos), SOLO dueño (`requiereDuenoGimnasio`). Ve los de TODAS sus sedes.
- [x] Frontend: `PaginaReportes.vue` (lista con estado, sede, quien y nota); al abrirla se
      marcan leidos (updateMany, cubierto por el plugin). Badge de no leidos en el nav.
- [x] Al iniciar sesion, si el dueño tiene reportes SIN LEER, se le avisa y se le lleva directo
      a Reportes. Marcarlos leidos apaga la notificacion aunque la maquina siga sin arreglarse;
      para verlos de nuevo entra a Reportes. (`useAutenticacion.iniciarSesion`).
- [x] 5 pruebas (`reportesMaquina.prueba.js`). Suite completa: 216 en verde.

### Etapa 3 — Mantenimiento de maquinas · HECHO y desplegado
- [x] `modelos/Maquina.js` tenant-scoped por sede: `nombre`, `estado`
      (`operativa`/`mantenimiento`/`danada`, en `ESTADOS_MAQUINA`), `nota` libre, `activo`.
      Indice `{ tenant, sede, nombre }` unico. Mismo patron de aislamiento que Producto.
- [x] `maquinas.servicio.js` con contrato `filtroSede`: un sede_admin solo ve/toca las de SU
      sede (maquina de otra sede = 404) y al crear se le fuerza su sede. Rutas
      `GET/POST /maquinas`, `PATCH /:id`, `DELETE /:id` (archiva).
- [x] Frontend: `PaginaMaquinas.vue` con estado en chip de color (verde/ambar/rojo, reusando las
      bandas de disco), banner de "N equipos requieren atencion", cambio rapido de estado por
      dialogo de radios, editar (con nota) y archivar. En el store, el nav y el router.
- [x] 6 pruebas (`maquinas.prueba.js`): arranca operativa, se marca dañada con nota, rechaza
      estado invalido, aislamiento por sede (lista y 404), filtro por estado. Suite: 205 en verde.
- [x] Seed con maquinas de demo por sede (una en mantenimiento, una dañada).

---

## Deuda tecnica conocida

Cosas que funcionan pero tienen un borde afilado. No son bugs; son decisiones con coste.

- [ ] **Login ambiguo por email.** El indice es `{ tenant, email }` unico, asi que un correo
      puede existir en varios gimnasios. Hoy el backend responde 400 pidiendo `slugGimnasio`.
      Alternativa: hacer el email unico globalmente.
- [ ] **`$lookup` no lo cubre el plugin.** Todo `$lookup` a coleccion tenant-scoped debe
      llevar su propio `$match` de tenant. Riesgo real a partir de la Fase 4.
- [ ] **`Model.bulkWrite()` no esta interceptado.** Si alguien lo usa, filtra a mano.
- [ ] **Indices en produccion.** `syncIndexes()` solo corre fuera de produccion. Hace falta
      una migracion controlada antes del primer despliegue.
- [ ] **Sin rate limiting en el login.** Un atacante puede probar contrasenas sin freno.
- [ ] **El registro publico no tiene freno anti-abuso.** Cualquiera puede crear gimnasios en
      masa (cada uno con sus 2 meses gratis) sin captcha ni rate limiting, y el correo de
      verificacion no reenvia ni caduca al gimnasio sin verificar. Antes de abrirlo al
      publico hacen falta: rate limit por IP, captcha, y un barrido que borre los tenants
      que nunca verificaron.
- [ ] **La suscripcion unica es una convencion, no un candado.** El registro publico usa el
      `PlanPlataforma` llamado `'Estandar'`; el super_admin puede seguir creando otros planes
      y asignarlos a mano. Si se renombra o archiva 'Estandar', el registro publico responde
      503 hasta que exista uno activo con ese nombre.
- [ ] **Migracion del plan unico.** Una base existente con varios `PlanPlataforma` no se
      consolida sola en 'Estandar' a $100.000; hay que migrar los tenants al plan unico
      antes de desplegar este cambio.
- [ ] **La cedula opcional no se valida contra el digito de verificacion.** Se acepta
      cualquier cadena de 4 a 15 digitos; no se comprueba que sea una cedula colombiana real.
- [ ] **`Tenant.finTrial` no migra bases viejas.** Los tenants creados antes de la Fase 7
      tienen `finTrial: null` (default), asi que el cron los factura de inmediato. Es el
      comportamiento correcto para gimnasios ya de pago, pero conviene revisarlo caso a caso.
- [ ] **Sin `.env` de produccion.** Al desplegar: `sameSite: 'none'` + `secure: true` solo si
      frontend y API viven en dominios distintos; si comparten dominio, bajar a `'lax'`.
- [ ] **Un envio fallido se reintenta cada dia, para siempre.** No hay tope de reintentos
      ni backoff: un telefono invalido genera una `Notificacion` fallida diaria.
- [ ] **Baileys sin implementar.** Su fabrica lanza. Ver la decision abierta de la Fase 5.
- [ ] **La plantilla de Cloud API es una convencion, no configurable por gimnasio.** El
      proveedor envia `type: 'template'` con `PLANTILLA_VENCIMIENTO` (nombre `aviso_vencimiento`,
      idioma `es_CO`) fija en `config/constantes.js`. Todos los gimnasios deben registrar en su
      WABA una plantilla con ESE nombre e idioma. Si alguno necesita otro nombre/idioma, habria
      que moverlo a `tenant.config.whatsapp.plantilla` (el proveedor ya acepta el override por
      parametro; solo falta exponerlo en el esquema del Tenant y en la fabrica).
- [ ] **Sin llaves de Wompi no hay cobro.** `WOMPI_LLAVE_PUBLICA`, `WOMPI_SECRETO_INTEGRIDAD`
      y `WOMPI_SECRETO_EVENTOS` son opcionales para que el proyecto arranque en local; sin
      ellas el enlace de pago responde 503 y el webhook tambien. Antes de desplegar hay que
      registrar la URL del webhook en el panel de Wompi.
- [ ] **La factura del mes se emite el dia que corre el cron, no el dia 1.** Si el proceso
      estuvo caido los primeros dias del mes, la primera corrida las emite con su plazo de
      gracia contado desde ese dia. Es intencional (evita facturas que nacen vencidas), pero
      corre la fecha de cobro.
- [ ] **No hay reintento ni notificacion de impago.** Un gimnasio se entera de que lo
      suspendieron cuando intenta entrar. Falta avisarle antes de que venza la factura.
- [ ] **Cambiar de plan no reprorratea.** Subir o bajar de `PlanPlataforma` cambia el precio
      de la SIGUIENTE factura; la del mes en curso no se ajusta.
- [ ] **`PlanMembresia.duracionDias` -> `duracionMeses` no tiene migracion.** Los documentos
      viejos de una base existente quedarian sin `duracionMeses` (campo `required`). En
      desarrollo lo resuelve `npm run sembrar:prueba`; antes de tocar una base con datos hay
      que escribir la migracion (p. ej. `duracionMeses = Math.round(duracionDias / 30)`).
- [ ] **Las fuentes de marca vienen de Google Fonts por CDN** (`css/app.scss`). Sin red
      caen a la pila del sistema; para un despliegue offline habria que empaquetarlas.
- [ ] **El onboarding compensa, no transacciona.** Si algun dia hay replica set (Atlas),
      migrar `onboarding.servicio.js` a una transaccion real.
- [ ] **El corte de mes usa la zona horaria del servidor, no la del tenant.**
      `reportes.servicio.js` calcula "este mes" con `new Date(y, m, 1)`, que es hora local
      del proceso. Cada tenant ya declara su `config.zonaHoraria` (`America/Bogota` por
      defecto) y nadie la lee. Un gimnasio veria mal los ingresos de los primeros/ultimos
      dias del mes si el servidor corre en otra zona (p. ej. UTC en produccion).

---

## Como cerrar una fase

1. Marcar todas las casillas de la fase, verificando contra el codigo.
2. `npm run prueba` desde la raiz, en verde.
3. `node backend/graph.js detective` sin dependencias contra el flujo de capas.
4. Actualizar `CLAUDE.md` con los flujos y convenciones nuevas (sin duplicar lo que
   graphify ya muestra) y `README.md` si cambiaron los comandos.
5. Actualizar el **Estado global** de la cabecera de este archivo.
6. Commit.
