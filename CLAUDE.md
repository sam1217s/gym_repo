# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GymSaaS es una plataforma SaaS multi-tenant para la gestion y contabilidad de gimnasios.
Cada gimnasio es un *tenant*; cada tenant tiene una o varias sedes; cada sede tiene miembros
que pagan mensualidades.

> Este archivo documenta lo que **no se ve en el grafo de dependencias**. Para saber que
> archivos existen, quien importa a quien, o cuantas dependencias tiene un modulo, usa
> graphify (`node graph.js cerebro`), que se inyecta automaticamente al abrir sesion.

## Antes de empezar: lee FASE.md

[FASE.md](FASE.md) es la fuente de verdad sobre que esta hecho y que falta, fase por fase,
con una checklist por cada una y la deuda tecnica conocida.

- **Al empezar** cualquier trabajo, leelo para saber en que fase estamos y que hay pendiente.
- **Al terminar**, actualizalo: marca lo hecho y anota lo que hayas descubierto.
- **Antes de dar una fase por cerrada**, recorre su checklist entera y verifica cada casilla
  contra el codigo real, no contra el recuerdo de la conversacion. Si algo esta marcado y no
  existe, desmarcarlo y decirlo.

Los tres archivos se reparten el trabajo asi, y no deben duplicarse:
`FASE.md` = que falta · `CLAUDE.md` = como funciona · graphify = que existe.

---

## Comandos

```bash
# Backend y frontend se levantan por separado, cada uno en su terminal.

# Backend (desde /backend) -> :3000
npm run dev            # API contra la MONGO_URI del .env (hoy: Mongo local; manana: Atlas)
npm run sembrar        # Crea el super_admin inicial. Idempotente.
npm run sembrar:prueba # BORRA y resiembra 2 gimnasios de demo. Solo desarrollo.

# Frontend (desde /frontend) -> :9000
npm run dev            # Dev-server con proxy /api -> :3000
npm run build

# Pruebas (desde la raiz; un solo Vitest para todo el monorepo)
npm run prueba
npm run prueba:observar

# graphify (desde /backend)
node graph.js mapa       # Archivos y sus dependencias directas
node graph.js cerebro    # Capas, hubs y modulos de dominio
node graph.js detective  # Ciclos, huerfanos y dependencias contra el flujo
```

Sin `.env` valido el backend **no arranca**: `src/config/entorno.js` valida las variables con
Zod al importarse. Es intencional. Copia `.env.example` a `.env`.

---

## Convencion #1: aislamiento por tenant

Es la regla de la que depende el producto entero. Si se rompe, un gimnasio ve los datos de otro.

### Como funciona

Tres piezas que se apoyan entre si:

1. **`src/contexto/contextoTenant.js`** — un `AsyncLocalStorage` guarda
   `{ tenantId, usuarioId, rol, sedeId, omitirAislamiento }` durante toda la peticion, incluso
   a traves de `await`. Nadie pasa `tenantId` de capa en capa.

2. **`src/modelos/complementos/aislamientoTenant.js`** — un plugin de Mongoose que se aplica
   **solo** a los esquemas de negocio. Inyecta `{ tenant }` en el filtro de toda consulta,
   antepone `{ $match: { tenant } }` a todo pipeline de agregacion, y asigna el `tenant` del
   contexto al crear documentos.

3. **La regla sagrada** — si no hay contexto de tenant, el plugin **lanza**
   `ErrorSinContextoTenant`. No existe una rama del codigo donde "sin tenant" signifique
   "no filtres". El manejador de errores lo traduce a un 500, porque llegar ahi es un bug.

### Que colecciones llevan el plugin

| Nivel plataforma (SIN plugin) | Tenant-scoped (CON plugin) |
| --- | --- |
| `PlanPlataforma`, `Tenant`, `Usuario` | `Sede`, `PlanMembresia`, `Miembro`, `Pago`, `Notificacion` |

`Usuario` **no** lleva el plugin a proposito: el login ocurre antes de que exista contexto de
tenant, asi que la busqueda por email tiene que poder correr sin filtro. Su aislamiento se hace
a mano en los servicios.

### La escotilla explicita

```js
ejecutarConTenant(tenantId, fn)  // cron, scripts, pruebas
ejecutarSinTenant(fn)            // super_admin, seed: DESACTIVA el filtro
ejecutarConContexto(datos, fn)   // middleware de Express (no envuelve el resultado)
```

`ejecutarSinTenant()` es la unica forma de salir del aislamiento, y es auditable con un grep.
Dentro de ella `save()` exige que el `tenant` venga puesto a mano: el campo sigue siendo
`required` en el esquema.

Un `super_admin` opera siempre dentro de `ejecutarSinTenant`, porque su trabajo es la
plataforma, no un gimnasio. El middleware `abrirContextoTenant` lo decide por el.

### Cuatro trampas que el plugin NO puede tapar

1. **`$lookup` hacia otra coleccion tenant-scoped** no dispara el plugin de la coleccion
   destino. Todo `$lookup` debe llevar su propio `$match` de tenant en el sub-pipeline.

2. **`Model.bulkWrite()`** no esta interceptado. Si lo necesitas, filtra a mano.

3. **`estimatedDocumentCount()`** esta **prohibido** en colecciones tenant-scoped: no acepta
   filtro, asi que siempre contaria la coleccion entera. El plugin lanza. Usa `countDocuments()`.

4. **Las Query de Mongoose son perezosas.** `ejecutarConTenant(id, () => Miembro.find())`
   construye la query dentro del contexto pero la ejecutaria fuera, al hacer `await`. Por eso
   `ejecutarConTenant` y `ejecutarSinTenant` envuelven el retorno en `Promise.resolve()` dentro
   del contexto: adoptan el thenable mientras el `AsyncLocalStorage` sigue abierto.
   **No quites ese `Promise.resolve()`.**

### Indices: `tenant` siempre primero

Todo indice compuesto de una coleccion tenant-scoped empieza por `tenant`, porque toda consulta
lleva ese filtro. Ej.: `{ tenant: 1, documento: 1 }` unico, `{ tenant: 1, periodoFin: 1 }`,
`{ tenant: 1, miembro: 1, periodoFin: -1 }`.

### La prueba que lo sostiene

`backend/pruebas/aislamientoTenant.prueba.js`. Prueba en negativo (A no ve lo de B, ni leyendo
ni escribiendo ni agregando) y en positivo (dentro de `ejecutarSinTenant` un `super_admin` si ve
ambos). **Ninguna funcionalidad se construye encima si esta en rojo.**

### Migracion futura a base-por-tenant

Los servicios no importan modelos ni `mongoose` directamente: piden `obtenerModelo('Miembro')`
a `src/modelos/indice.js`. Hoy eso resuelve siempre a la conexion compartida. El dia que un
tenant grande necesite su propia base, solo cambian `obtenerConexion()` en `config/baseDatos.js`
y `obtenerModelo()`. La logica de negocio no se toca.

---

## Los DOS niveles de cobro (no mezclarlos)

Son dos flujos de dinero distintos que se parecen y se confunden:

| | Quien paga | A quien | Modelos |
| --- | --- | --- | --- |
| **Facturacion de plataforma** | El gimnasio | A GymSaaS | `PlanPlataforma` + `Tenant.estado` |
| **Facturacion de miembros** | El miembro | Al gimnasio | `PlanMembresia` + `Pago` |

`PlanPlataforma` es de nivel plataforma y define **limites** (`maxSedes`, `maxMiembros`) y
**features** (`whatsapp`, `reportes`). `PlanMembresia` es tenant-scoped y lo configura cada
gimnasio ("Mensual" 60000 / 30 dias).

Un `Tenant.estado` de `suspendido` o `cancelado` **bloquea el login** con 403, tanto en
`servicios/auth.servicio.js` como en el middleware `autenticar`. Solo `trial` y `activo` operan.

---

## El vencimiento se DERIVA, no se guarda

`Miembro` **no tiene** campo de vencimiento. El vencimiento de un miembro es el `periodoFin` de
su **ultimo `Pago`**. Guardarlo en el miembro crearia dos fuentes de verdad que acaban
divergiendo cuando alguien registra un pago retroactivo o corrige un error.

`servicios/reportes.servicio.js` (Fase 4) reutiliza esa misma funcion para el conteo de
miembros del dashboard: cero logica de vencimiento duplicada, solo un `reduce` que agrupa
por estado. Los ingresos del mes SI son un aggregate propio sobre `Pago`, pero sin
`$lookup`: el nombre de cada sede sale de una consulta aparte a `Sede` y se cruza en
memoria (mismo patron que `contarSedesPorTenant()` en `tenants.servicio.js`). El
`super_admin` no tiene acceso a `/api/reportes`: los reportes son tenant-scoped y el
opera sobre la plataforma, no dentro de un gimnasio.

El panel de "proximos a vencer" y el cron de WhatsApp usan **la misma consulta**:
`obtenerUltimoPagoPorMiembro()` en `servicios/vencimientos.servicio.js`. Si cambias
una, cambias la otra. La implementacion evita `$lookup` a proposito (la trampa #1 del
plugin): el ultimo pago sale de un aggregate sobre `Pago` y se cruza con los miembros
en memoria. `derivarEstado()` es la unica funcion que traduce un pago a
`al_dia | por_vencer | vencido | sin_pagos` (constantes en `ESTADOS_VENCIMIENTO`).

`Pago.periodoFin` se calcula una vez, al registrar el pago
(`periodoInicio + planMembresia.duracionDias`), y despues es historia: no se muta.

---

## Roles y resolucion del scope

| Rol | `tenant` | `sede` | Alcance |
| --- | --- | --- | --- |
| `super_admin` | `null` | `null` | La plataforma. Corre en `ejecutarSinTenant`. |
| `tenant_owner` | si | `null` | Todo su gimnasio, todas las sedes. |
| `sede_admin` | si | si | Solo su sede. |

El scope se resuelve en dos niveles independientes:

- **tenant** → automatico, por el plugin de Mongoose. Nadie puede olvidarlo.
- **sede** → manual, por el middleware `limitarASede`, que deja el filtro en
  `peticion.filtroSede` (`{}` o `{ sede: <id> }`) para que el servicio lo aplique.

Contrato de `filtroSede` en los servicios (miembros, pagos, vencimientos):

- Va **en la busqueda**, no despues: para un `sede_admin`, un miembro de otra sede es un
  404, no un 403. Asi no se filtra ni la existencia del recurso.
- Al **crear**, `filtroSede.sede` gana sobre lo que mande el cuerpo: un `sede_admin`
  registra siempre en SU sede. Mover un miembro de sede es exclusivo del dueno.
- El filtro del rol gana sobre el de la query (`?sede=` de otro solo devuelve vacio).
- `Usuario` no tiene plugin de tenant: `usuarios.servicio.js` filtra `{ tenant }` a mano
  en CADA consulta, y ademas restringe el CRUD del dueno a `rol: sede_admin` (no puede
  tocarse a si mismo ni a otros duenos). Desactivar sube `versionToken`: mata la sesion.

Orden obligatorio de middlewares en una ruta protegida:

```js
autenticar               // verifica la cookie -> peticion.usuario
abrirContextoTenant      // abre el AsyncLocalStorage. SIEMPRE despues de autenticar
bloquearSiDebeCambiarContrasena
requiereRol(...)         // o limitarASede
```

---

## Autenticacion

- JWT en **cookies HttpOnly**, nunca en `localStorage`. El token no llega jamas a JavaScript.
- Acceso: 15 min, cookie `gs_acceso`, `path=/`.
- Refresco: 7 dias, cookie `gs_refresco`, `path=/api/auth/refrescar` — el navegador **no lo
  adjunta al resto de la API**, asi que un fallo en otro endpoint no lo expone.
- Los refresh tokens **no se guardan en la base de datos**. La revocacion se hace con
  `Usuario.versionToken`: cerrar sesion o cambiar la contrasena lo incrementa, lo que invalida
  de golpe todos los tokens emitidos antes.
- `autenticar` consulta `Usuario` y `Tenant` en **cada peticion**. Es deliberado: sin eso,
  desactivar un usuario o suspender un gimnasio no surtiria efecto hasta que expirara su token.

### El email es unico POR TENANT, no globalmente

Indice `{ tenant: 1, email: 1 }` unico. Dos gimnasios distintos pueden tener un recepcionista
con el mismo correo. Consecuencia: el login por email solo es ambiguo si el correo existe en
varios gimnasios. En ese caso el backend responde 400 con
`detalles: [{ campo: 'slugGimnasio' }]`, y el frontend muestra un campo extra para que el usuario
diga en cual entra. No es un caso raro que se pueda ignorar.

### Cambio de contrasena obligatorio

`Usuario.debeCambiarContrasena` arranca en `true` para todo usuario creado por un admin. Mientras
sea `true`, `bloquearSiDebeCambiarContrasena` cierra la API entera salvo `/auth/yo`,
`/auth/cerrar-sesion` y `/auth/cambiar-contrasena`. Cambiar la contrasena sube `versionToken`, asi
que el controlador **reemite las cookies** para no expulsar a quien acaba de cambiarla.

---

## CORS y cookies: desarrollo vs produccion

Esta es la parte que mas tiempo hace perder si no esta escrita.

**En desarrollo** el dev-server de Quasar (`quasar.config.js` → `devServer.proxy`) manda `/api`
al backend. El navegador ve todo saliendo de `localhost:9000`: es **same-origin**. No hay CORS,
y `sameSite: 'lax'` basta.

**En produccion** no existe ese proxy. Si el frontend y la API viven en dominios distintos:

```js
// backend/src/servidor.js
app.use(cors({ origin: entorno.ORIGEN_FRONTEND, credentials: true }));
```

- `credentials: true` es obligatorio o el navegador no manda las cookies.
- `origin` debe ser un **origen explicito**. El navegador rechaza `Access-Control-Allow-Origin: *`
  en peticiones con credenciales. De ahi la variable `ORIGEN_FRONTEND`.
- Las cookies pasan a `sameSite: 'none'` + `secure: true` (ver `utilidades/token.js`). El
  navegador rechaza `none` sin HTTPS.
- **Si despliegas frontend y API bajo el mismo dominio**, baja `sameSite` a `'lax'`: es mas
  seguro y evita `none` por completo. Es la opcion preferible.

En el frontend, `withCredentials: true` en la instancia de Axios (`src/boot/axios.js`).

---

## Flujos completos

### Registro de pago → vencimiento → WhatsApp

```
[Recepcion registra un pago]
        |
        v
POST /api/pagos ──> validar (Zod) ──> autenticar ──> abrirContextoTenant
        |                                                    |
        |                            (a partir de aqui todas las queries llevan {tenant})
        v
pagos.controlador.js ──> pagos.servicio.js
        |
        |  1. carga el PlanMembresia elegido (ya filtrado por tenant)
        |  2. periodoFin = periodoInicio + plan.duracionDias   <-- unica fuente de verdad
        |  3. crea el Pago { monto, metodoPago, referencia, notificado: false }
        v
   [Pago guardado]

        ...

[Cron diario a las 9:00, node-cron, fuera de toda peticion HTTP]
        |                                    (tareas/vencimientos.tarea.js)
        v
ejecutarSinTenant(() => Tenant.find({ estado: { $in: ESTADOS_TENANT_OPERATIVOS } }))
        |                                             ^ trial + activo. Escotilla explicita.
        v  por cada tenant (un fallo NO tumba a los demas):
ejecutarConTenant(tenant._id, async () => {
        |
        |  si !plan.features.whatsapp  -> omitido
        |  si proveedor === 'ninguno'  -> omitido
        |
        |  listarVencimientos()   <-- LA MISMA consulta que pinta el panel de miembros
        |     filtra estado ∈ {por_vencer, vencido} y !ultimoPago.notificado
        v
   NotificacionProvider  <-- interfaz; la implementacion sale de tenant.config.whatsapp.proveedor
        |                    (cloud_api | n8n | ninguno; baileys aun no implementado)
        v
   exito -> Notificacion.create({ estado: 'enviado' }) + Pago.updateOne({ notificado: true })
   fallo -> Notificacion.create({ estado: 'fallido' })   (el pago NO se marca: se reintenta)
})
```

`DIAS_AVISO_VENCIMIENTO = 3` vive en `config/constantes.js`. El cron **debe** envolver cada
tenant en `ejecutarConTenant`, porque no hay peticion HTTP que abra el contexto por el.

**La trampa del aviso.** Lo obvio seria
`Pago.find({ periodoFin: { $lte: umbral }, notificado: false })`. Esta mal: un miembro que ya
renovo conserva su pago viejo, con `periodoFin` pasado y `notificado: false`, y recibiria un
aviso de que su mensualidad vencio estando al dia. El aviso sale del **ultimo pago**, igual
que el panel. `notificado` se marca sobre ese ultimo pago, y solo **despues** de que el
proveedor confirme el envio: marcarlo antes perderia el aviso cuando el canal falle.

Solo una instancia debe programar el cron (`HABILITAR_CRON`), o cada miembro recibe el aviso
tantas veces como procesos haya corriendo.

### Onboarding de un gimnasio nuevo

```
[super_admin, autenticado, corriendo en ejecutarSinTenant]
        |
        v
POST /api/plataforma/tenants ──> requiereSuperAdmin
        |
        v
onboarding.servicio.js  (compensacion manual: sin replica set no hay
                         transacciones; si fallan los pasos 2 o 3 se BORRA
                         lo ya creado y se relanza el error)
        |
        |  1. Tenant.create({ slug, nit, planPlataforma, estado: 'trial' })
        |       ^ sin plugin: es coleccion de plataforma
        |
        |  2. Usuario.create({ tenant: nuevoTenant._id, rol: 'tenant_owner',
        |                      debeCambiarContrasena: true })
        |       ^ sin plugin tambien; el tenant se asigna a mano
        |
        |  3. ejecutarConTenant(nuevoTenant._id, () => Sede.create({ ... }))
        |       ^ la primera sede SI es tenant-scoped: necesita contexto
        v
   [Gimnasio listo. El owner entra y lo primero que ve es "cambia tu contrasena"]
```

El punto no obvio: dentro del mismo endpoint se cruza la frontera de plataforma a tenant. Los
pasos 1 y 2 corren sin contexto; el paso 3 **necesita** abrir uno.

Reglas del ciclo de vida que no estan en el esquema:

- `cancelado` es **terminal**: ninguna transicion sale de ahi. Suspender solo aplica a
  `trial`/`activo`; reactivar lleva a `activo`.
- Los `PlanPlataforma` **no se borran**: los tenants los referencian. `DELETE /planes/:id`
  archiva (`activo: false`), lo que solo impide asignarlos a gimnasios nuevos.
- `tenants.servicio.js` agrega sobre `Sede` **sin filtro de tenant** (conteo global por
  gimnasio). Es legal unicamente porque ese servicio corre siempre como `super_admin` con
  `omitirAislamiento`; no copiar ese patron en servicios de negocio.

---

## Convenciones de codigo

### Nomenclatura: todo el codigo propio en espanol

Archivos, variables, funciones, campos de esquema, componentes, stores y composables van en
espanol: `calcularVencimiento()`, `estaVencido`, `TablaPagos.vue`, `useVencimientos.js`,
`pagos.controlador.js`.

Se mantienen en su idioma original **solo** los identificadores que el lenguaje o el framework
exigen: palabras reservadas de JS, API de Vue/Quasar, metodos de Express/Mongoose, opciones de
esquema (`required`, `immutable`, `unique`), nombres de paquetes npm, campos de APIs de terceros,
y los archivos que un framework detecta por convencion:

- `frontend/src/stores/index.js` y `frontend/src/router/index.js` — Quasar los busca por nombre.
- `frontend/src/boot/`, `layouts/`, `pages/`, `components/`, `composables/`, `css/` — idem.

Dentro de esas carpetas, los archivos van en espanol (`autenticacion.js`, `rutas.js`,
`guardias.js`, `LayoutPrincipal.vue`).

### Backend: capas estrictas

```
rutas/ -> controladores/ -> servicios/ -> modelos/
```

- La **logica de negocio vive en `servicios/`**. Un controlador solo lee la peticion, delega y
  responde. Si aparece un `if` sobre reglas del dominio en un controlador, esta en el sitio
  equivocado.
- `middlewares/` es transversal: puede importar `modelos/` y `utilidades/` sin que sea una
  violacion de capas (por eso `graph.js detective` lo excluye de la deteccion).
- `validaciones/` son esquemas **Zod** (validacion de entrada HTTP). No confundir con los
  esquemas de **Mongoose**, que estan en `modelos/`. De ahi el nombre distinto.
- Todo controlador async va envuelto en `manejadorAsync` o su promesa rechazada muere sin que
  nadie la vea.
- `proveedores/` es infraestructura intercambiable (hoy, los canales de WhatsApp). Un servicio
  conoce el **contrato**, nunca la implementacion: `crearProveedor(tenant.config.whatsapp)` es
  el unico sitio que sabe cual es cual. Los servicios reciben la fabrica por parametro, para
  que una prueba pueda pasar un proveedor falso sin tocar la red.
- `tareas/` son procesos programados. No tienen contexto de tenant: se lo abren ellos, tenant
  por tenant. Cada tarea exporta su funcion de trabajo aparte del `cron.schedule`, para poder
  probarla y dispararla a mano.

### Forma de respuesta

Siempre `{ ok, data, error }`, con las tres claves presentes. El frontend nunca tiene que
preguntar si una propiedad existe.

```json
{ "ok": true,  "data": { }, "error": null }
{ "ok": false, "data": null, "error": { "mensaje": "...", "detalles": [ ] } }
```

`error.detalles` es un array de `{ campo, mensaje }` cuando la validacion Zod falla.

### Errores

- Lo que el cliente debe ver se lanza como `ErrorApi` (`ErrorApi.noEncontrado()`,
  `ErrorApi.prohibido()`, ...). Cualquier otra excepcion es un bug y sale como 500 generico.
- `middlewares/manejadorErrores.js` es el **unico** sitio que decide que ve el cliente. Los stack
  traces jamas salen de ahi.
- Sin numeros ni strings magicos: si tiene significado de negocio, es una constante con nombre en
  `config/constantes.js`.

### Frontend

- El store de Pinia persiste **solo el perfil del usuario**, nunca un token — el token vive en la
  cookie HttpOnly. Lo persistido es una copia optimista para pintar el panel sin parpadeo; la
  verdad la tiene el backend, y cualquier 401 la corrige.
- `boot/axios.js` intercepta el 401: intenta **un** refresco (compartido entre peticiones
  simultaneas) y, si falla, limpia el store y redirige al login.
- Quien ya gestiona la navegacion (el guard del router) pasa `omitirRedireccion401: true` para que
  el interceptor no aborte la navegacion en curso con un `push` simultaneo.
- El guard del router es **comodidad, no seguridad**: quien decide de verdad es el backend.

### Sistema visual: la banda de disco

El lenguaje visual sale de los discos de competicion olimpica, que se identifican por su banda
de color. Esa banda es la firma de la marca y el sistema de estado; no inventar otros colores:

- **Accion primaria**: rojo disco `$primary` · **estructura**: tinta `$secondary` (header,
  titulos) · fondo gris frio. Definidos en `css/quasar.variables.scss`.
- **Estados de tenant**: activo = `$positive` (verde), trial = `$info` (azul),
  suspendido = `$warning` (ambar), cancelado = acero `#667085`.
- **Tipografia**: `Barlow Condensed` solo para display (clase `.titulo-display`, mayusculas);
  `Public Sans` para todo lo demas; `.cifra-tabular` en cifras de tablas y contadores.
- El motivo se aplica como banda: borde superior rojo en tarjetas clave, borde inferior del
  header, chips de estado con banda izquierda, contadores circulares tipo disco.
- **Graficas** (skill `dataviz`, `components/GraficaIngresos.vue`): las series categoricas
  (hoy, efectivo/transferencia) usan violeta `#4a3aa7` / naranja `#eb6834`, elegidos y
  validados con `validate_palette.js` **a proposito fuera** de la familia de tonos que ya
  usan los estados de vencimiento (verde/ambar/rojo/azul), para que una serie de pago nunca
  se lea como un estado. Los estados si reutilizan los colores de las bandas de disco. La
  app no tiene modo oscuro, asi que las graficas solo validan la paleta en modo claro.
  Cada sede es una **manga de barra cargada**: riel horizontal, el dinero es el peso
  montado, y la sede que mas cobro llena el riel.
- **Un tooltip nunca es el unico sitio donde vive un dato.** Toda grafica lleva debajo su
  vista de tabla con los mismos numeros. Si un valor solo se alcanza pasando el mouse, es
  un bug de accesibilidad, no una decision de diseno.
- La **cifra heroe** va en la sans del cuerpo (Public Sans), nunca en Barlow Condensed: una
  cara condensada a 3rem se lee como decoracion. La marca entra por la ceja, la banda roja
  y las mangas — la audacia se gasta en un solo sitio.

---

## Cosas que graphify senala y son intencionales

Al correr `node graph.js detective` veras esto. No lo "arregles":

- **Ciclo `boot/axios.js → stores/autenticacion.js → servicios/auth.servicio.js → boot/axios.js`.**
  No existe en tiempo de ejecucion: `boot/axios.js` importa el store con un `import()` **dinamico**,
  dentro del manejador del 401, precisamente para romperlo. graphify cuenta los imports dinamicos
  como aristas.

- **Huerfanos `FE:App.vue` y `FE:stores/index.js`.** Son puntos de entrada que Quasar carga por
  convencion; nadie del codigo propio los importa.

---

## Estado del proyecto

Vive en [FASE.md](FASE.md), no aqui. Ahi estan las fases, sus checklists y la deuda tecnica.

Actualiza `CLAUDE.md` al cierre de cada fase **solo** con los flujos y convenciones nuevas
(modelos, reglas no obvias, trampas). No dupliques lo que graphify ya muestra ni lo que
`FASE.md` ya lleva.
