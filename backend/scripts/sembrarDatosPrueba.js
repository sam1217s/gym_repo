import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import {
  ESTADOS_TENANT,
  METODOS_PAGO,
  PLAN_SUSCRIPCION_NOMBRE,
  PLAN_SUSCRIPCION_PRECIO,
  ROLES,
} from '../src/config/constantes.js';
import { entorno, esProduccion } from '../src/config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo, registrarModelos, sincronizarIndices } from '../src/modelos/indice.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { sumarMeses } from '../src/utilidades/fechas.js';

/**
 * Siembra datos de prueba para poder entrar al panel y ver lo construido.
 *
 *   npm run sembrar:prueba
 *
 * BORRA Y REESCRIBE las colecciones que siembra. No usa dropDatabase: solo
 * vacia las colecciones de este producto, para no tocar otras bases ni otras
 * colecciones que compartan la instancia de MongoDB.
 *
 * El super_admin NO se borra: se crea o actualiza con upsert.
 */

/** Todos los usuarios sembrados comparten contrasena. Solo para desarrollo. */
const CONTRASENA_DEMO = 'ClaveInicial1';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Colecciones tenant-scoped que se vacian antes de sembrar. */
const COLECCIONES_TENANT = ['Notificacion', 'Pago', 'Miembro', 'PlanMembresia', 'Sede'];

const NOMBRES_MIEMBROS = [
  ['Ana', 'Ramirez'], ['Carlos', 'Mejia'], ['Diana', 'Torres'], ['Esteban', 'Rojas'],
  ['Fabiola', 'Nieto'], ['Gabriel', 'Suarez'], ['Helena', 'Vargas'], ['Ivan', 'Castro'],
];

/**
 * Definicion declarativa de los dos gimnasios. Cada pago dice a cuantos dias de
 * hoy vence, lo que hace evidente de un vistazo el escenario que se esta creando.
 *
 * `diasHastaVencer` negativo = ya vencido. Entre 1 y 3 = proximo a vencer (lo que
 * busca el cron de notificaciones). Mayor = vigente.
 */
const GIMNASIOS = [
  {
    nombre: 'GymFuerza',
    slug: 'gymfuerza',
    nit: '900111222-1',
    plan: 'Estandar',
    dominio: 'gymfuerza.co',
    // Cedulas de demo: sirven para entrar con cedula ademas del correo.
    cedulaDueno: '1010101010',
    cedulaRecepcion: '2020202020',
    miembros: [
      { indice: 0, sede: 'norte', plan: 'Mensual', diasHastaVencer: -10, metodo: 'efectivo', historial: true },
      { indice: 1, sede: 'norte', plan: 'Mensual', diasHastaVencer: -3, metodo: 'transferencia' },
      { indice: 2, sede: 'norte', plan: 'Mensual', diasHastaVencer: 2, metodo: 'efectivo' },
      { indice: 3, sede: 'norte', plan: 'Mensual', diasHastaVencer: 25, metodo: 'transferencia' },
      { indice: 4, sede: 'norte', plan: 'Trimestral', diasHastaVencer: 60, metodo: 'efectivo' },
      { indice: 5, sede: 'sur', plan: 'Mensual', diasHastaVencer: 1, metodo: 'efectivo' },
      { indice: 6, sede: 'sur', plan: 'Mensual', diasHastaVencer: 15, metodo: 'transferencia' },
      { indice: 7, sede: 'sur', plan: 'Mensual', diasHastaVencer: -20, metodo: 'efectivo' },
    ],
  },
  {
    nombre: 'IronHouse',
    slug: 'ironhouse',
    nit: '900333444-2',
    plan: 'Estandar',
    dominio: 'ironhouse.co',
    cedulaDueno: '3030303030',
    cedulaRecepcion: '4040404040',
    miembros: [
      { indice: 0, sede: 'norte', plan: 'Trimestral', diasHastaVencer: -30, metodo: 'transferencia' },
      { indice: 1, sede: 'norte', plan: 'Mensual', diasHastaVencer: -1, metodo: 'efectivo' },
      { indice: 2, sede: 'norte', plan: 'Mensual', diasHastaVencer: 3, metodo: 'transferencia' },
      { indice: 3, sede: 'norte', plan: 'Mensual', diasHastaVencer: 10, metodo: 'efectivo', historial: true },
      { indice: 4, sede: 'norte', plan: 'Trimestral', diasHastaVencer: 45, metodo: 'transferencia' },
      { indice: 5, sede: 'sur', plan: 'Mensual', diasHastaVencer: 2, metodo: 'efectivo' },
      { indice: 6, sede: 'sur', plan: 'Trimestral', diasHastaVencer: 80, metodo: 'transferencia' },
      { indice: 7, sede: 'sur', plan: 'Mensual', diasHastaVencer: -6, metodo: 'efectivo' },
    ],
  },
];

// Suscripcion unica y plana: la misma para todo gimnasio. Topes altos como red
// de seguridad, no como escalon de precio. Todo incluido.
const PLANES_PLATAFORMA = [
  {
    nombre: PLAN_SUSCRIPCION_NOMBRE,
    precioMensual: PLAN_SUSCRIPCION_PRECIO,
    limites: { maxSedes: 10, maxMiembros: 2000, maxUsuarios: 50 },
    features: { whatsapp: true, reportes: true },
  },
];

const PLANES_MEMBRESIA = [
  { nombre: 'Mensual', precio: 60_000, duracionMeses: 1 },
  { nombre: 'Trimestral', precio: 160_000, duracionMeses: 3 },
];

// ---------------------------------------------------------------------------

function enDias(dias) {
  return new Date(Date.now() + dias * MILISEGUNDOS_POR_DIA);
}

async function limpiarColecciones() {
  await ejecutarSinTenant(async () => {
    // Los usuarios de plataforma (super_admin) sobreviven: solo se borran los
    // que pertenecen a un gimnasio.
    await obtenerModelo('Usuario').deleteMany({ tenant: { $ne: null } });

    for (const nombre of COLECCIONES_TENANT) {
      await obtenerModelo(nombre).deleteMany({});
    }

    await obtenerModelo('Tenant').deleteMany({});
    await obtenerModelo('PlanPlataforma').deleteMany({});
  });
}

/** Crea o actualiza el super_admin. Nunca lo duplica. */
async function sembrarSuperAdmin(contrasenaHash) {
  return ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');

    return Usuario.findOneAndUpdate(
      { email: entorno.SEMILLA_SUPERADMIN_EMAIL, rol: ROLES.SUPER_ADMIN },
      {
        $set: {
          tenant: null,
          sede: null,
          nombres: 'Super',
          apellidos: 'Admin',
          contrasenaHash,
          activo: true,
          // A diferencia de `sembrarSuperAdmin.js`, aqui entra directo: este
          // script existe para poder ver el panel sin tramites.
          debeCambiarContrasena: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });
}

async function sembrarPlanesPlataforma() {
  const planes = await ejecutarSinTenant(() =>
    obtenerModelo('PlanPlataforma').insertMany(PLANES_PLATAFORMA),
  );

  return new Map(planes.map((plan) => [plan.nombre, plan]));
}

async function sembrarGimnasio(definicion, planPlataforma, contrasenaHash) {
  const tenant = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant').create({
      nombre: definicion.nombre,
      nit: definicion.nit,
      slug: definicion.slug,
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: planPlataforma._id,
      // Gimnasios de demo ya establecidos: su prueba gratis quedo atras, asi que
      // el cron de cobranza SI les factura (es lo que muestra la Fase 6).
      finTrial: sumarMeses(new Date(), -1),
    }),
  );

  // Las sedes son tenant-scoped: necesitan contexto.
  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const [norte, sur] = await Promise.all([
      Sede.create({ nombre: 'Sede Norte', direccion: 'Calle 100 #15-20', telefono: '6011234567' }),
      Sede.create({ nombre: 'Sede Sur', direccion: 'Carrera 30 #4-50', telefono: '6017654321' }),
    ]);
    return { norte, sur };
  });

  // `Usuario` no es tenant-scoped: el tenant se asigna a mano.
  const usuarios = await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');

    const dueno = await Usuario.create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: definicion.nombre,
      email: `owner@${definicion.dominio}`,
      cedula: definicion.cedulaDueno,
      contrasenaHash,
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });

    const recepcion = await Usuario.create({
      tenant: tenant._id,
      sede: sedes.norte._id,
      nombres: 'Carlos',
      apellidos: definicion.nombre,
      email: `recepcion@${definicion.dominio}`,
      cedula: definicion.cedulaRecepcion,
      contrasenaHash,
      rol: ROLES.SEDE_ADMIN,
      debeCambiarContrasena: false,
    });

    return { dueno, recepcion };
  });

  const resumenPagos = await ejecutarConTenant(tenant._id, async () => {
    const planesMembresia = await sembrarPlanesMembresia();
    const miembros = await sembrarMiembros(definicion, sedes);
    return sembrarPagos(definicion, miembros, planesMembresia, sedes, usuarios.dueno);
  });

  return { tenant, sedes, usuarios, resumenPagos };
}

async function sembrarPlanesMembresia() {
  const planes = await obtenerModelo('PlanMembresia').insertMany(PLANES_MEMBRESIA);
  return new Map(planes.map((plan) => [plan.nombre, plan]));
}

async function sembrarMiembros(definicion, sedes) {
  const Miembro = obtenerModelo('Miembro');

  const documentos = definicion.miembros.map((miembro, posicion) => {
    const [nombres, apellidos] = NOMBRES_MIEMBROS[miembro.indice];
    return {
      sede: sedes[miembro.sede]._id,
      nombres,
      apellidos,
      // Documento unico dentro del gimnasio; puede repetirse entre gimnasios.
      documento: `10${definicion.slug.length}${String(posicion).padStart(6, '0')}`,
      telefono: `5730012${String(posicion).padStart(5, '0')}`,
    };
  });

  return Miembro.insertMany(documentos);
}

async function sembrarPagos(definicion, miembros, planesMembresia, sedes, registradoPor) {
  const Pago = obtenerModelo('Pago');
  const pagos = [];

  definicion.miembros.forEach((definicionMiembro, posicion) => {
    const miembro = miembros[posicion];
    const plan = planesMembresia.get(definicionMiembro.plan);
    const sede = sedes[definicionMiembro.sede];

    // Algunos miembros arrastran un pago anterior ya consumido. Sirve para
    // comprobar que el vencimiento se deriva del ULTIMO pago, no de cualquiera.
    if (definicionMiembro.historial) {
      pagos.push(
        construirPago({
          miembro, plan, sede, registradoPor,
          // El periodo anterior termino donde empieza el vigente.
          periodoFin: sumarMeses(enDias(definicionMiembro.diasHastaVencer), -plan.duracionMeses),
          metodo: METODOS_PAGO.EFECTIVO,
        }),
      );
    }

    pagos.push(
      construirPago({
        miembro, plan, sede, registradoPor,
        periodoFin: enDias(definicionMiembro.diasHastaVencer),
        metodo: definicionMiembro.metodo,
      }),
    );
  });

  await Pago.insertMany(pagos);

  return {
    total: pagos.length,
    vencidos: pagos.filter((pago) => pago.periodoFin < new Date()).length,
    proximos: pagos.filter((pago) => estaProximoAVencer(pago.periodoFin)).length,
  };
}

function construirPago({ miembro, plan, sede, registradoPor, periodoFin, metodo }) {
  // La mensualidad dura meses de calendario: se retrocede en meses, no en dias.
  const periodoInicio = sumarMeses(periodoFin, -plan.duracionMeses);

  return {
    sede: sede._id,
    miembro: miembro._id,
    planMembresia: plan._id,
    monto: plan.precio,
    metodoPago: metodo,
    // La referencia solo tiene sentido en transferencias.
    referencia: metodo === METODOS_PAGO.TRANSFERENCIA ? `TRF-${Date.now()}-${miembro.documento}` : '',
    fechaPago: periodoInicio,
    periodoInicio,
    periodoFin,
    registradoPor: registradoPor._id,
    notificado: false,
  };
}

function estaProximoAVencer(periodoFin) {
  const ahora = new Date();
  return periodoFin >= ahora && periodoFin <= enDias(3);
}

// ---------------------------------------------------------------------------

function imprimirTablaCredenciales(filas) {
  const columnas = ['rol', 'tenant', 'email', 'cedula', 'contrasena'];
  const anchos = columnas.map((columna) =>
    Math.max(columna.length, ...filas.map((fila) => String(fila[columna] ?? '—').length)),
  );

  const linea = (caracter) => anchos.map((ancho) => caracter.repeat(ancho + 2)).join('+');
  const fila = (valores) =>
    '|' + valores.map((valor, i) => ` ${String(valor).padEnd(anchos[i])} `).join('|') + '|';

  console.log('\nCREDENCIALES DE ACCESO\n');
  console.log('+' + linea('-') + '+');
  console.log(fila(columnas));
  console.log('+' + linea('=') + '+');
  for (const registro of filas) {
    console.log(fila(columnas.map((columna) => registro[columna] ?? '—')));
  }
  console.log('+' + linea('-') + '+');
}

async function sembrar() {
  if (esProduccion) {
    throw new Error('Este script borra datos. Nunca se ejecuta con NODE_ENV=production.');
  }

  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);
  await sincronizarIndices(conexion);

  console.log(`Sembrando en: ${conexion.name}\n`);

  await limpiarColecciones();

  // Un solo hash para todos: bcrypt con 12 rondas es caro y aqui la contrasena
  // es la misma. Ahorra unos segundos.
  const contrasenaHash = await cifrarContrasena(CONTRASENA_DEMO);

  const superAdmin = await sembrarSuperAdmin(contrasenaHash);
  const planesPlataforma = await sembrarPlanesPlataforma();

  const credenciales = [
    { rol: ROLES.SUPER_ADMIN, tenant: '(plataforma)', email: superAdmin.email, contrasena: CONTRASENA_DEMO },
  ];

  for (const definicion of GIMNASIOS) {
    const plan = planesPlataforma.get(definicion.plan);
    const { tenant, resumenPagos, usuarios } = await sembrarGimnasio(definicion, plan, contrasenaHash);

    // Los conteos son de PAGOS, no de miembros: un miembro con historial tiene un
    // pago viejo ya vencido y otro vigente. Quien decide el estado del miembro es
    // su ultimo pago.
    console.log(
      `${tenant.nombre.padEnd(12)} plan ${definicion.plan.padEnd(10)} ` +
        `2 sedes, 8 miembros, ${resumenPagos.total} pagos ` +
        `(${resumenPagos.vencidos} pagos vencidos, ${resumenPagos.proximos} pagos por vencer en <=3 dias)`,
    );

    credenciales.push(
      { rol: ROLES.TENANT_OWNER, tenant: tenant.slug, email: usuarios.dueno.email, cedula: usuarios.dueno.cedula, contrasena: CONTRASENA_DEMO },
      { rol: ROLES.SEDE_ADMIN, tenant: tenant.slug, email: usuarios.recepcion.email, cedula: usuarios.recepcion.cedula, contrasena: CONTRASENA_DEMO },
    );
  }

  imprimirTablaCredenciales(credenciales);
  console.log('\nTodos entran directo: ninguno tiene el cambio de contrasena pendiente.');
}

sembrar()
  .catch((error) => {
    console.error('\nFallo el seed de prueba:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
