# GymSaaS

Plataforma SaaS multi-tenant para la gestion y contabilidad de gimnasios: cada gimnasio es un tenant, con sus sedes, miembros y el control de las mensualidades que estos le pagan.

## Requisitos

- **Node.js** 20 o superior (probado con 24).
- **MongoDB**: una instancia local o un cluster de MongoDB Atlas.

## Puesta en marcha

```bash
# 1. Dependencias (raiz, backend y frontend son instalaciones independientes)
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Variables de entorno
cp backend/.env.example backend/.env
```

Abre `backend/.env` y rellena:

- `MONGO_URI` — tu cadena de conexion (local o Atlas).
- `JWT_SECRETO_ACCESO` y `JWT_SECRETO_REFRESCO` — dos secretos **distintos**, de 32 caracteres como minimo. Genera cada uno con:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Sin un `.env` valido el backend no arranca: las variables se validan con Zod al iniciar.

```bash
# 3. Crea el super_admin inicial (idempotente)
npm --prefix backend run sembrar
```

## Arrancar

Backend y frontend se levantan por separado, cada uno en su terminal.

```bash
# Terminal 1 - API en :3000
cd backend && npm run dev

# Terminal 2 - Panel en :9000
cd frontend && npm run dev
```

Abre <http://localhost:9000>. El dev-server de Quasar hace de proxy de `/api` hacia el backend, asi que todo sale del mismo origen y las cookies de sesion funcionan sin CORS.

En el primer acceso, el `super_admin` debe cambiar su contrasena.

## Pruebas

Un unico Vitest para todo el monorepo, desde la raiz. Usa un MongoDB efimero en memoria: no toca tu base de datos.

```bash
npm run prueba           # una pasada
npm run prueba:observar  # modo watch
```

## Arquitectura

El aislamiento entre tenants es el requisito #1: ninguna consulta a una coleccion de negocio se ejecuta sin filtro de tenant, y si falta el contexto la operacion falla en vez de devolver datos de otros gimnasios.

Los detalles (plugin de Mongoose + `AsyncLocalStorage`, roles, flujos de pago y notificacion, convenciones) estan en [CLAUDE.md](CLAUDE.md).

Para inspeccionar el grafo de dependencias del codigo:

```bash
node backend/graph.js cerebro    # capas, hubs y modulos de dominio
node backend/graph.js detective  # ciclos y dependencias contra el flujo
```

## Stack

Vue 3 + Quasar + Pinia + Axios en el frontend. Node + Express + Mongoose + Zod en el backend. Autenticacion con JWT en cookies HttpOnly.
