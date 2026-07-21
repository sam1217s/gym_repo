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
| `PlanPlataforma`, `Tenant`, `Usuario`, `FacturaPlataforma` | `Sede`, `PlanMembresia`, `Miembro`, `Pago`, `Notificacion` |

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

## Los TRES flujos de dinero (no mezclarlos)

Se parecen y se confunden. Los dos primeros son "cobros" con ciclo de vida; el tercero es
una venta simple de mostrador:

| | Quien paga | A quien | Modelos |
| --- | --- | --- | --- |
| **Facturacion de plataforma** | El gimnasio | A GymSaaS | `PlanPlataforma` + `Tenant.estado` + `FacturaPlataforma` (Wompi de la PLATAFORMA, en el entorno) |
| **Facturacion de miembros** | El miembro | Al gimnasio | `PlanMembresia` + `Pago` (efectivo/transferencia, o Wompi DEL GIMNASIO en `tenant.config.wompi`) |
| **Venta de productos** | Quien compra en el mostrador | Al gimnasio | `Producto` + `VentaProducto` (tenant-scoped POR SEDE; efectivo, sin pasarela) |

La **venta de productos** (`servicios/ventas.servicio.js`) es un mini punto de venta, no un
cobro con estados: `registrarVenta` descuenta el stock y crea una `VentaProducto` que guarda la
FOTO del `nombreProducto` y el `precioUnitario` del momento (`total = cantidad * precioUnitario`),
mas el `registradoPor` (el encargado). Sin transacciones, compensa a mano: si falla el registro
de la venta, devuelve el stock. `listarVentas` agrupa por dia y devuelve el resumen
(`total`/`unidades`/`operaciones`) para el panel de "ventas de hoy". Respeta `filtroSede` igual
que Miembro/Pago. `Producto.precio` es **obligatorio**: sin el no se puede vender.

### Finanzas: los egresos (la otra cara de los tres flujos de arriba)

Los tres flujos anteriores son plata que ENTRA. `Gasto` es la que sale, y `Deuda` lo que se
debe. Reglas no obvias:

- **`Gasto.sede` es OPCIONAL y ahi esta todo el modulo**: con sede es un gasto de ESA sede
  (arriendo, servicios, nomina); con `sede: null` es del GIMNASIO entero, que es donde caen
  las obligaciones del dueño. De ahi salen las dos trazabilidades que pide el negocio.
  Un `sede_admin` **nunca** ve ni crea los generales: su `filtroSede` es `{ sede: X }`, que no
  casa con `null`. No hace falta ninguna regla extra.
- **`Deuda` NO guarda cuanto lleva pagado.** El pagado es la SUMA de sus abonos y el saldo se
  deriva (`deudas.servicio → conSaldo`), igual que el vencimiento sale del ultimo pago y por el
  mismo motivo. Borrar un abono devuelve el saldo solo.
- **Un abono ES un gasto**: `abonarDeuda` crea un `Gasto` con `categoria: 'deuda'` ligado a la
  deuda, asi que baja el saldo Y cuenta como egreso del mes, sin duplicar el dato. Hereda la
  sede de la deuda para que el resumen lo impute donde toca. Por eso un abono no se edita desde
  Gastos (se borra y se vuelve a abonar) y no se puede abonar mas que el saldo.
- El resumen (`gastos.servicio → resumenFinanzas`) agrega por `{ sede, categoria }` y cruza los
  nombres de sede **en memoria**, sin `$lookup` (trampa #1 del plugin). Toda sede visible sale
  aunque no haya gastado: un cero es informacion. Las **deudas son solo del dueño**
  (`requiereDuenoGimnasio`); los **gastos** los registra cualquier staff, cada uno en su sede.

### Auditoria: la bitacora del dueño (middleware transversal)

`middlewares/auditoria.js` anota en `Auditoria` (tenant-scoped) CADA operacion que muta datos
y termina bien, para que el dueño vea quien hizo que. Va montado lo primero en el router de
`/api` (`rutas.use(auditar)`) y trabaja en `res.on('finish')`. Trampas y decisiones:

- **Lee `originalUrl`, no `path`.** En `finish` la pila de routers ya se desenrollo, asi que
  `peticion.path` volveria a ser `/api/miembros`. Se parte `originalUrl` y se quita el `api`.
- **Escribe con `ejecutarConTenant(usuario.tenant, ...)`**: el contexto de la peticion ya se
  cerro cuando corre el `finish`. Es **fire-and-forget** (`.catch(() => {})`): la auditoria
  jamas rompe una operacion ya completada.
- **Traduce la ruta a una frase** con el mapa `MOVIMIENTOS` (recurso→metodo→etiqueta). Lo que
  no esta en el mapa no se audita. Los servicios NO saben que la auditoria existe: cero
  acoplamiento, un solo sitio que la conoce.
- **No audita**: GETs, login/refresh, webhooks, `/pagar`, respuestas >=400 ni al `super_admin`
  (opera la plataforma, no un gimnasio). El panel `/api/auditoria` es **solo del dueño** y ve
  los movimientos de todas sus sedes.

### Reportes de maquinas: el aviso al dueño

Cuando un `sede_admin` marca una `Maquina` en `mantenimiento` o `dañada`, `maquinas.servicio`
crea un `ReporteMaquina` (tenant-scoped) para el **dueño**. Reglas no obvias:

- El reporte se crea **solo si el estado CAMBIA** a mantenimiento/dañada, y **solo si el actor
  es `sede_admin`** (si el propio dueño cambia el estado no se avisa a si mismo). El `actor` lo
  pasa el controlador (`peticion.usuario`), no se lee del contexto.
- Es un registro de **evento con foto** (nombre, estado, nota, quien reporto): se sostiene
  aunque la maquina cambie o se archive despues.
- `leido` es del dueño: al abrir `/reportes-maquina` se marcan todos leidos (`updateMany`, que
  el plugin SI intercepta). A partir de ahi dejan de dispararle la notificacion de inicio de
  sesion, **aunque la maquina siga sin arreglarse**; el reporte no se borra. Al entrar, si hay
  reportes sin leer, el frontend lleva al dueño directo a Reportes (`useAutenticacion`).
- El panel es **solo del dueño** (`requiereDuenoGimnasio`) y ve los de TODAS sus sedes (sin
  `filtroSede`): el plugin ya acota al tenant y su alcance es el gimnasio entero.

**Hay DOS integraciones de Wompi, con cuentas y secretos distintos, y confundirlas es un
agujero:** la de plataforma (una sola cuenta de GymSaaS, en el `.env`, webhook `/webhooks/wompi`)
y la de cada gimnasio (las llaves del dueno en `tenant.config.wompi`, webhook
`/webhooks/wompi-miembro`). El miembro paga al Wompi del DUENO, no al de GymSaaS.

`PlanPlataforma` es de nivel plataforma y define **limites** (`maxSedes`, `maxMiembros`) y
**features** (`whatsapp`, `reportes`). `PlanMembresia` es tenant-scoped **y por sede**: cada
sede define los suyos y con su propio precio ("Mensual" 60000 en la Norte, 45000 en la Sur).
El indice unico es `{ tenant, sede, nombre }`, asi que el nombre solo choca dentro de la misma
sede. Consecuencia que hace cumplir `pagos.servicio`: **a un miembro solo se le cobra con un
plan de SU sede** (si no, 400 "Ese plan es de otra sede"), aunque quien cobre sea el dueno y
vea los de todas. El formulario de pago filtra las opciones por la sede del miembro.

Los limites los hace cumplir `middlewares/limitesPlan.js` en las rutas de creacion. Cuenta
solo recursos **activos**: un miembro dado de baja no ocupa cupo.

### Entrar y operar no son lo mismo

Dos listas de estados, y confundirlas rompe el cobro:

| | Estados | Que permite |
| --- | --- | --- |
| `ESTADOS_TENANT_OPERATIVOS` | `trial`, `activo` | usar el gimnasio (miembros, pagos, reportes) |
| `ESTADOS_TENANT_CON_ACCESO` | + `suspendido` | iniciar sesion |

Un gimnasio **suspendido si entra**, y a proposito: dentro solo alcanza `/auth` y
`/facturacion`, porque es donde paga lo que debe. Si se le cerrara el login, la suspension
por impago seria una trampa sin salida. Lo hace cumplir `bloquearSiGimnasioSuspendido`, que
va en TODAS las rutas de negocio y en ninguna de esas dos.

`cancelado` es terminal: no entra, y **pagar una factura vieja no lo revive**.

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
(`periodoInicio + planMembresia.duracionMeses`), y despues es historia: no se muta.

### La mensualidad dura un MES, no 30 dias (pero un plan puede medirse en dias)

Un `PlanMembresia` mide su vigencia en `duracionMeses` **O** en `duracionDias`, exactamente
uno de los dos (lo exige un `pre('validate')` en el esquema y un `.refine` en Zod). Los planes
recurrentes van en meses; un "Pase de dia" va en dias. La verdad para calcular el vencimiento
es `utilidades/fechas.js → sumarDuracion(inicio, plan)`, que despacha a `sumarDias` o
`sumarMeses` segun cual venga; `pagos.servicio.js` y `pagosMiembro.servicio.js` la usan para el
`periodoFin`. **No calcular el vencimiento a mano en ningun sitio: siempre `sumarDuracion`.**

Para los planes en meses la regla de calendario sigue en pie: quien paga el 31 de enero vence
el **28 de febrero**, no el 2 de marzo: `sumarMeses()` recorta el dia al ultimo del mes
destino. `setMonth()` a secas desborda al mes siguiente y le cobraria al miembro dias que no
compro.

Y una fecha sin hora (`"2026-07-09"`, la que manda un `<input type="date">`) es un **dia
civil**, no un instante. `z.coerce.date()` la convierte en medianoche **UTC**, que en Bogota
es el dia anterior; la aritmetica de meses, que trabaja en hora local, caeria un dia antes.
Por eso `validaciones/comunes.validacion.js` exporta `diaCivil`, y `FormularioPago.vue` hace
lo mismo en el navegador. La suma de milisegundos era inmune a esto; la de meses no.

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
autenticar                       // verifica la cookie -> peticion.usuario y peticion.tenant
abrirContextoTenant              // abre el AsyncLocalStorage. SIEMPRE despues de autenticar
bloquearSiDebeCambiarContrasena
bloquearSiGimnasioSuspendido     // salvo en /auth y /facturacion
requiereRol(...)                 // o limitarASede
exigirLimite(RECURSOS.X)         // solo en las rutas que CREAN, y despues de validar
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

### Se entra por correo O por cedula, y ambos son unicos POR TENANT

El login recibe un solo campo `identificador`: el servicio decide si es correo o cedula segun
contenga `@` (`auth.servicio.js → filtroPorIdentificador`). El correo se normaliza a minusculas
al buscar; la cedula se compara tal cual.

- **`email`**: indice `{ tenant: 1, email: 1 }` unico, obligatorio.
- **`cedula`**: indice `{ tenant: 1, cedula: 1 }` unico pero **parcial**
  (`partialFilterExpression: { cedula: { $type: 'string' } }`) porque es **opcional**: sin el,
  varios usuarios sin cedula colisionarian en el mismo valor ausente. Cuando falta se deja
  **sin definir**, no `null`, para que el indice no la cuente.

Los dos son unicos por tenant, no globalmente: dos gimnasios pueden tener un recepcionista con
el mismo correo o la misma cedula. Consecuencia: el login por correo o cedula solo es ambiguo
si ese dato existe en varios gimnasios. En ese caso el backend responde 400 con
`detalles: [{ campo: 'slugGimnasio' }]`, y el frontend muestra un campo extra para que el usuario
diga en cual entra. No es un caso raro que se pueda ignorar.

Solo el **personal** (`Usuario`) tiene cedula y login; los miembros del gimnasio no inician
sesion. La cedula se pide (opcional) en el registro publico, el onboarding del super_admin y el
alta de administradores de sede.

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
        |  2. periodoFin = sumarMeses(periodoInicio, plan.duracionMeses)  <-- fuente de verdad
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

**Texto libre vs. plantilla.** El servicio construye SIEMPRE dos cosas: el `mensaje` de texto
(rico, varia segun el estado) y las `variables` de la plantilla (`[nombre, gimnasio, fecha]`,
en ese orden). Cada proveedor usa lo que le sirve: **n8n** manda el `mensaje`; **cloud_api**
ignora el texto y envia una **PLANTILLA** (`type: 'template'`), porque Meta solo acepta texto
libre dentro de la ventana de 24 h y un aviso de vencimiento casi nunca cae ahi. El nombre y el
idioma de la plantilla son una **convencion** (`PLANTILLA_VENCIMIENTO` = `aviso_vencimiento` /
`es_CO`), igual que el plan `'Estandar'`: cada gimnasio registra en SU WABA una plantilla con
ese nombre y esas 3 variables. El `mensaje` de texto se sigue guardando en `Notificacion` como
registro, aunque cloud_api no lo mande.

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

### Registro publico → 2 meses gratis → verificacion de correo

Cualquiera (no solo el `super_admin`) da de alta su gimnasio. El mismo `onboarding.servicio.js`
sirve a los dos caminos: se le pasa un objeto `opciones` que cambia lo poco que difiere.

```
POST /api/auth/registrar-gimnasio     <-- RUTA PUBLICA. Sin cookie. Sin sesion.
        |                                (registroPublico.servicio.js)
        |  1. obtenerPlanDeSuscripcion()   el PlanPlataforma unico 'Estandar' activo,
        |                                  o 503 si no existe (PLAN_SUSCRIPCION_NOMBRE)
        |  2. crearGimnasio(datos, { emailVerificado: false, debeCambiarContrasena: false })
        |       - Tenant.finTrial = sumarMeses(ahora, MESES_TRIAL_GRATIS)  (2 meses)
        |       - el dueno eligio SU clave: no se le obliga a cambiarla
        |  3. firmarTokenVerificacion(dueno)   JWT prop:'verificacion-email', 2 dias
        |  4. enviarCorreo({ enlace: ORIGEN_FRONTEND/verificar-email?token=... })  (inyectado)
        v
   201 { email, gimnasio }   NO abre sesion: no entrega cookies

[El dueno abre el enlace del correo]
        v
GET /api/auth/verificar-email?token=...   idempotente -> emailVerificado = true
```

Tres reglas que sostienen esto:

- **`emailVerificado` es del `Usuario`, no un estado del tenant.** Por defecto `true`: solo
  el registro publico lo pone en `false`. `iniciarSesion` responde 403
  ("Confirma tu correo…") mientras siga sin verificar. El ciclo de vida del tenant sigue
  siendo puro cobro (`trial`/`activo`/`suspendido`/`cancelado`); la verificacion no lo toca.
- **La prueba gratis la respeta la cobranza.** `generarFacturasDelMes()` salta el tenant si
  `ahora < tenant.finTrial`: no emite factura durante los 2 meses. Cuando el trial termina,
  el mismo cron lo factura y, al pagar, pasa a `activo`.
- **Una sola suscripcion.** El registro publico usa el plan `'Estandar'`
  (`PLAN_SUSCRIPCION_PRECIO = 100_000`). Es una convencion, no un candado: el super_admin
  puede seguir creando otros planes y asignarlos a mano (ver deuda tecnica en FASE.md).

### Cobro plataforma → gimnasio (Wompi)

```
[Cron de cobranza, 3:00, todo dentro de ejecutarSinTenant]
        |                                   (tareas/facturacion.tarea.js)
        |  generarFacturasDelMes()   una por gimnasio operativo, idempotente por el
        |                            indice unico { tenant, periodoInicio }
        |  suspenderMorosos()        pendiente + fechaVencimiento < hoy  ->  suspendido
        v
[El dueno entra a /panel/facturacion y pulsa Pagar]
        |
        v
POST /api/facturacion/:id/enlace-pago   (el tenantId sale de la SESION, nunca del cuerpo)
        |
        |  firma = SHA256(referencia + centavos + moneda + SECRETO_INTEGRIDAD)
        v
   checkout.wompi.co  ──>  el dueno paga  ──>  Wompi llama de vuelta
        |
        v
POST /api/webhooks/wompi          <-- RUTA PUBLICA. Sin cookie. Sin sesion.
        |
        |  1. verificarChecksumEvento()   SHA256(valores de signature.properties
        |                                   + timestamp + SECRETO_EVENTOS)
        |     ^ LO PRIMERO. Es lo unico que separa a Wompi de un impostor.
        |  2. buscar la factura por `reference`
        |  3. si ya esta pagada -> ignorar (Wompi reintenta los webhooks)
        |  4. si el monto no coincide -> fallida (alguien manipulo el checkout)
        |  5. APPROVED -> pagada + tenant a `activo` (salvo si esta cancelado)
        v
   Se responde 200 incluso a lo que se ignora: un error hace que Wompi reintente en bucle.
```

**Dos firmas, dos secretos, y confundirlos es un agujero.** La de *integridad* la calcula
GymSaaS y viaja en la URL del checkout: impide que el gimnasio cambie el monto en la barra
del navegador. La del *evento* la calcula Wompi: sin verificarla, cualquiera podria hacer un
POST y marcarse la factura como pagada. Ninguna de las dos toca el navegador.

`signature.properties` **no se puede quemar en el codigo**: la documentacion de Wompi avisa
de que la lista cambia entre eventos. Se lee del payload y se resuelve contra `data`.

La pasarela es de la **plataforma** (una sola cuenta de Wompi, en el entorno), al reves que
el proveedor de WhatsApp, que se elige **por gimnasio** en `tenant.config.whatsapp`.

El plazo de gracia cuenta desde que se **emite** la factura, no desde el dia 1 del mes: con
`periodoInicio + gracia`, un gimnasio dado de alta un dia 20 nacería con la factura vencida
y el mismo cron lo suspenderia el dia que lo factura por primera vez.

Reglas del ciclo de vida que no estan en el esquema:

- `cancelado` es **terminal**: ninguna transicion sale de ahi. Suspender solo aplica a
  `trial`/`activo`; reactivar lleva a `activo`.
- Los `PlanPlataforma` **no se borran**: los tenants los referencian. `DELETE /planes/:id`
  archiva (`activo: false`), lo que solo impide asignarlos a gimnasios nuevos.
- `tenants.servicio.js` agrega sobre `Sede` **sin filtro de tenant** (conteo global por
  gimnasio). Es legal unicamente porque ese servicio corre siempre como `super_admin` con
  `omitirAislamiento`; no copiar ese patron en servicios de negocio.

### Cobro miembro → gimnasio (Wompi del dueño, por WhatsApp)

El miembro paga su mensualidad EN LINEA al Wompi **del dueño** (no al de la plataforma), desde
el botón "Pagar ahora" del aviso de vencimiento por WhatsApp.

```
[Aviso de vencimiento por WhatsApp con boton URL]
        |  el boton es una base fija + variable:  ORIGEN_PUBLICO/api/pagar/{{1}}
        |  ({{1}} = token JWT del miembro; la URL de Wompi es larga y firmada,
        |   NO cabe en el boton, por eso se pasa por un enlace corto propio)
        v
GET /api/pagar/:token ──> pagosMiembro.servicio.js
        |  1. verifica el token (prop 'pago-miembro') -> miembro + tenant
        |  2. resuelve el plan del ULTIMO pago del miembro -> monto (fresco, no en el token)
        |  3. construirEnlaceCheckout con las llaves del DUENO (tenant.config.wompi),
        |     prellenando nombre/telefono/email del miembro
        |  4. referencia = MB-<tenantId>-<miembroId>-<planId>-<nonce>
        v  302 redirect
[checkout.wompi.co del dueño] ──> el miembro paga ──> Wompi llama de vuelta
        v
POST /api/webhooks/wompi-miembro ──> aplicarEventoPagoMiembro()
        |  1. lee la referencia -> a que gimnasio pertenece (elige CON QUE secreto verificar)
        |  2. verificarChecksumEvento(evento, tenant.config.wompi.secretoEventos)  <-- LA firma
        |  3. si APPROVED: crea el Pago (metodoPago 'wompi', registradoPor null) y renueva:
        |     periodoInicio = fin de la mensualidad vigente (o hoy si ya vencio)
        v
   Se responde 200 a lo que se ignora (Wompi reintenta si no).
```

Cuatro cosas no obvias:

- **La firma se verifica DENTRO del servicio, no en el controlador** (al reves que el webhook de
  plataforma): el secreto es de cada gimnasio y hay que resolver el tenant por la referencia
  primero. Parsear la referencia (dato no confiable) solo elige el secreto; la firma autentica.
- **La firma de integridad ya garantiza el monto**: Wompi rechaza el checkout si no cuadra, asi
  que el miembro no puede cambiar el precio. El webhook lo re-compara con `plan.precio` como
  defensa en profundidad, no por seguridad.
- **Idempotencia por el `id` de transaccion de Wompi** guardado en `Pago.transaccionWompi`
  (indice unico parcial `{ tenant, transaccionWompi }`): Wompi reintenta los webhooks y no se
  puede renovar dos veces por un pago.
- **El monto NO viaja en el token ni en la referencia**: se resuelve fresco al abrir el enlace,
  para no cobrar un precio viejo si el plan cambio entre el aviso y el pago.

`Pago.registradoPor` es `null` en estos pagos: no hay staff detras, lo pagó el propio miembro.
`Miembro.email` es opcional y solo sirve para prellenar el checkout y el recibo.

Las llaves Wompi del gimnasio las configura el **super_admin** (no el dueño), en el panel de
plataforma: son secretos criptograficos y es mas prudente que los maneje el operador. Endpoint
`GET/PUT /api/plataforma/tenants/:id/cobros` (`requiereSuperAdmin`); los secretos **nunca** se
devuelven al cliente (`cobros.servicio.js → describirConfig`), solo si estan puestos y la llave
publica. La misma regla que `tenant.config.whatsapp.credenciales`: `Tenant.toJSON` borra
`config.wompi` entero.

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
- `pasarelas/` es la infraestructura de cobro de la PLATAFORMA (Wompi). No confundir con
  `proveedores/`, que es infraestructura elegida POR GIMNASIO. Ambas fallan ruidosamente si
  les faltan credenciales, y ninguna se prueba contra la red.
- `correos/` es el envio de correo transaccional de la PLATAFORMA (hoy: la verificacion del
  registro publico), sobre nodemailer. `correo.js` cachea el transporte; **sin `SMTP_HOST`
  imprime el contenido en consola en desarrollo, y LANZA en produccion** (dar por registrado
  a quien nunca recibio el enlace seria peor que fallar). El emisor se **inyecta** en el
  servicio (`registrarGimnasioPublico({ enviarCorreo })`), igual que el proveedor de
  WhatsApp, para que las pruebas no toquen la red.

`Usuario` y `FacturaPlataforma` **no llevan el plugin de aislamiento**. Todo servicio que las
consulte en nombre de un gimnasio filtra por `tenant` a mano, en la busqueda, no despues.

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
