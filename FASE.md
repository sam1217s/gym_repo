# FASE.md — Plan de fases y estado

Documento de control del proyecto GymSaaS. **Es la fuente de verdad sobre que esta hecho
y que falta.**

> **Para Claude Code:** lee este archivo ANTES de empezar cualquier trabajo, y
> actualizalo AL TERMINAR. Antes de dar una fase por cerrada, recorre su checklist
> entera y verifica cada casilla contra el codigo real, no contra el recuerdo de la
> conversacion. Si encuentras algo sin marcar que ya existe, marcalo. Si encuentras
> algo marcado que no existe, desmarcarlo y decirlo.

**Leyenda:** `[x]` hecho y verificado · `[~]` hecho a medias · `[ ]` pendiente

**Estado global:** Fase 1 completa. Fase 2 sin empezar.

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

## Fase 2 — Plataforma · PENDIENTE

Objetivo: que un `super_admin` pueda dar de alta y administrar gimnasios.
Es el primer flujo que cruza la frontera plataforma → tenant.

### Backend
- [ ] `validaciones/plataforma.validacion.js` (Zod)
- [ ] `servicios/planesPlataforma.servicio.js` — CRUD de `PlanPlataforma`
- [ ] `servicios/tenants.servicio.js` — listar, ver, suspender, reactivar, cancelar
- [ ] `servicios/onboarding.servicio.js` — crear tenant + primer `tenant_owner` + primera sede
      (los pasos 1 y 2 sin contexto; el 3 dentro de `ejecutarConTenant`)
- [ ] `controladores/` y `rutas/plataforma.rutas.js` protegidas con `requiereSuperAdmin`
- [ ] Montar `autenticar` + `abrirContextoTenant` en el router de negocio
      (hoy ambos middlewares existen pero no los usa nadie)
- [ ] Transaccionalidad del onboarding: si falla la sede, no debe quedar el tenant huerfano
- [ ] Pruebas: un `tenant_owner` recibe 403 en todas las rutas de plataforma

### Frontend
- [ ] `servicios/plataforma.servicio.js` (cliente HTTP)
- [ ] `stores/plataforma.js`
- [ ] `PanelPlataforma.vue`: tabla real de gimnasios con estado y plan
- [ ] `FormularioOnboarding.vue`: alta de gimnasio + su primer dueno
- [ ] Acciones de suspender / reactivar con confirmacion
- [ ] Aplicar el skill `frontend-design` (hoy la UI es Quasar por defecto)

---

## Fase 3 — Core del gimnasio · PENDIENTE

Objetivo: que un gimnasio opere de verdad. Aqui el aislamiento se ejercita a diario.

### Backend
- [ ] CRUD de `Sede` (respetando `maxSedes` del plan — o dejarlo para Fase 6)
- [ ] CRUD de `Usuario` dentro del tenant (crear `sede_admin` con `debeCambiarContrasena: true`)
- [ ] CRUD de `PlanMembresia`
- [ ] CRUD de `Miembro`, filtrado por sede para el rol `sede_admin`
- [ ] `servicios/pagos.servicio.js`: al registrar un pago,
      `periodoFin = periodoInicio + planMembresia.duracionDias`
- [ ] `servicios/vencimientos.servicio.js`: derivar el estado del miembro del
      `periodoFin` de su ULTIMO pago. Una sola consulta, reutilizada por el panel y el cron
- [ ] Aplicar `limitarASede` en las rutas donde el `sede_admin` no debe ver todo
- [ ] Pruebas: un `sede_admin` no ve miembros de la otra sede del mismo tenant

### Frontend
- [ ] Pantallas de sedes, usuarios, planes de membresia y miembros
- [ ] `FormularioPago.vue`: al elegir plan, calcular y mostrar `periodoFin`
- [ ] Distinguir efectivo vs transferencia (`referencia` obligatoria en transferencia)
- [ ] `useVencimientos.js`

---

## Fase 4 — Panel y reportes · PENDIENTE

- [ ] Ingresos del mes por sede (aggregate; recordar el `$match` de tenant automatico)
- [ ] Split efectivo vs transferencia
- [ ] Conteo de miembros activos / vencidos / proximos a vencer
- [ ] Filtro por sede: `super_admin` y `tenant_owner` ven consolidado; `sede_admin` solo la suya
- [ ] Cuidado: todo `$lookup` a coleccion tenant-scoped necesita su propio `$match` de tenant
- [ ] Dashboard con graficas (usar la skill `dataviz`)

---

## Fase 5 — Notificaciones WhatsApp · PENDIENTE

- [ ] Interfaz `NotificacionProvider`
- [ ] Implementaciones intercambiables: Baileys, Cloud API, n8n, ninguno
- [ ] El proveedor se lee de `tenant.config.whatsapp.proveedor`
- [ ] Cron diario con `node-cron`
- [ ] El cron itera tenants activos y envuelve CADA uno en `ejecutarConTenant`
- [ ] Busca pagos con `periodoFin <= hoy + DIAS_AVISO_VENCIMIENTO` y `notificado: false`
- [ ] Registra en `Notificacion` y marca `Pago.notificado = true`
- [ ] Respetar `PlanPlataforma.features.whatsapp`: si el plan no lo incluye, no enviar
- [ ] Pruebas del cron con un proveedor falso

> **Decision abierta:** que proveedor de WhatsApp se usa en produccion. No asumir.
> Los datos de prueba ya dejan 2 miembros por gimnasio proximos a vencer.

---

## Fase 6 — Facturacion de plataforma y limites · PENDIENTE

- [ ] Middleware que verifique `PlanPlataforma.limites` antes de crear sede/miembro/usuario
- [ ] Estado de suscripcion del tenant y transiciones (`trial` → `activo` → `suspendido`)
- [ ] Suspension automatica por impago
- [ ] Historico de facturacion de plataforma

> **Decision abierta:** pasarela de pago para el cobro plataforma → gimnasio. No asumir.

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
- [ ] **La UI es Quasar por defecto.** Ya esta instalado el skill `frontend-design`.
- [ ] **`Notificacion` existe pero nadie escribe en ella** hasta la Fase 5.

---

## Como cerrar una fase

1. Marcar todas las casillas de la fase, verificando contra el codigo.
2. `npm run prueba` desde la raiz, en verde.
3. `node backend/graph.js detective` sin dependencias contra el flujo de capas.
4. Actualizar `CLAUDE.md` con los flujos y convenciones nuevas (sin duplicar lo que
   graphify ya muestra) y `README.md` si cambiaron los comandos.
5. Actualizar el **Estado global** de la cabecera de este archivo.
6. Commit.
