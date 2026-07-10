# FASE.md — Plan de fases y estado

Documento de control del proyecto GymSaaS. **Es la fuente de verdad sobre que esta hecho
y que falta.**

> **Para Claude Code:** lee este archivo ANTES de empezar cualquier trabajo, y
> actualizalo AL TERMINAR. Antes de dar una fase por cerrada, recorre su checklist
> entera y verifica cada casilla contra el codigo real, no contra el recuerdo de la
> conversacion. Si encuentras algo sin marcar que ya existe, marcalo. Si encuentras
> algo marcado que no existe, desmarcarlo y decirlo.

**Leyenda:** `[x]` hecho y verificado · `[~]` hecho a medias · `[ ]` pendiente

**Estado global:** Fases 1 a 6 completas. El producto esta funcionalmente cerrado;
lo que queda es la deuda tecnica de abajo, indispensable antes de desplegar.

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
> Si se elige Cloud API, hay que registrar una **plantilla aprobada** por Meta: el envio de
> texto libre solo funciona dentro de la ventana de 24 h, y un aviso de vencimiento casi
> nunca cae dentro de ella (ver el comentario en `cloudApi.proveedor.js`).

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
- [ ] **Sin `.env` de produccion.** Al desplegar: `sameSite: 'none'` + `secure: true` solo si
      frontend y API viven en dominios distintos; si comparten dominio, bajar a `'lax'`.
- [ ] **Un envio fallido se reintenta cada dia, para siempre.** No hay tope de reintentos
      ni backoff: un telefono invalido genera una `Notificacion` fallida diaria.
- [ ] **Baileys sin implementar.** Su fabrica lanza. Ver la decision abierta de la Fase 5.
- [ ] **Cloud API envia texto libre**, que Meta solo acepta dentro de la ventana de 24 h.
      Para produccion hace falta una plantilla aprobada (`type: 'template'`).
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
