import koffi from 'koffi';

/**
 * Envoltura del ZKFinger SDK 5.3 (`libzkfp.dll`, lo instala el setup del SDK en
 * System32) para el lector USB ZK9500.
 *
 * Dos trampas de koffi que costaron una tarde:
 * - Los buffers se declaran `uint8_t*` (sin `_Out_`): asi koffi pasa la memoria
 *   del Buffer tal cual. Con `_Out_ uint8_t*` lo trata como UN byte de salida y
 *   la captura nunca llega (todo devuelve -8).
 * - Los tamanos de entrada/salida van en un `Uint32Array(1)`.
 *
 * Codigos del SDK: 0 = ok; -8 = no hay dedo (lo normal mientras se espera).
 */

const TAMANO_PLANTILLA = 2048;

/**
 * Luces y pitido del propio lector (manual del SDK, apendice de parametros):
 * se escribe 1 para encender/hacer sonar y 0 para apagar. Son la respuesta que ve
 * quien pone el dedo cuando NO hay pantalla en la puerta.
 */
const PARAMETRO_LUZ = { blanca: 101, verde: 102, roja: 103 };
const PARAMETRO_PITIDO = 104;
const MS_PITIDO = 140;
const MS_ENTRE_PITIDOS = 110;

const espera = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const PARAMETRO_ANCHO = 1;
const PARAMETRO_ALTO = 2;

const lib = koffi.load('libzkfp.dll');
const sdk = {
  init: lib.func('int ZKFPM_Init()'),
  terminate: lib.func('int ZKFPM_Terminate()'),
  contarLectores: lib.func('int ZKFPM_GetDeviceCount()'),
  abrir: lib.func('void* ZKFPM_OpenDevice(int)'),
  cerrar: lib.func('int ZKFPM_CloseDevice(void*)'),
  parametro: lib.func('int ZKFPM_GetParameters(void*, int, uint8_t*, uint32_t*)'),
  fijarParametro: lib.func('int ZKFPM_SetParameters(void*, int, uint8_t*, uint32_t)'),
  capturar: lib.func('int ZKFPM_AcquireFingerprint(void*, uint8_t*, uint32_t, uint8_t*, uint32_t*)'),
  dbInit: lib.func('void* ZKFPM_DBInit()'),
  dbFree: lib.func('int ZKFPM_DBFree(void*)'),
  dbClear: lib.func('int ZKFPM_DBClear(void*)'),
  dbAdd: lib.func('int ZKFPM_DBAdd(void*, uint32_t, uint8_t*, uint32_t)'),
  dbIdentify: lib.func('int ZKFPM_DBIdentify(void*, uint8_t*, uint32_t, uint32_t*, uint32_t*)'),
  dbMatch: lib.func('int ZKFPM_DBMatch(void*, uint8_t*, uint32_t, uint8_t*, uint32_t)'),
  dbMerge: lib.func('int ZKFPM_DBMerge(void*, uint8_t*, uint8_t*, uint8_t*, uint8_t*, uint32_t*)'),
};

export class Lector {
  #dispositivo = null;
  #cache = null;
  #imagen = null;

  /** Abre el primer lector conectado. Lanza si no hay ninguno. */
  abrir() {
    const codigo = sdk.init();
    if (codigo !== 0 && codigo !== 1) throw new Error(`No se pudo iniciar el SDK de huella (codigo ${codigo})`);
    if (sdk.contarLectores() < 1) throw new Error('No hay ningun lector de huella conectado');

    this.#dispositivo = sdk.abrir(0);
    if (!this.#dispositivo) throw new Error('No se pudo abrir el lector de huella');

    const ancho = this.#leerParametro(PARAMETRO_ANCHO);
    const alto = this.#leerParametro(PARAMETRO_ALTO);
    this.#imagen = Buffer.alloc(ancho * alto);
    this.#cache = sdk.dbInit();
  }

  get abierto() {
    return Boolean(this.#dispositivo);
  }

  #leerParametro(codigo) {
    const valor = Buffer.alloc(4);
    sdk.parametro(this.#dispositivo, codigo, valor, new Uint32Array([4]));
    return valor.readInt32LE(0);
  }

  #fijar(codigo, valor) {
    if (!this.#dispositivo) return;
    const dato = Buffer.alloc(4);
    dato.writeInt32LE(valor, 0);
    sdk.fijarParametro(this.#dispositivo, codigo, dato, 4);
  }

  /**
   * Senal en el lector: una luz (`verde` | `roja` | `blanca`) durante `ms` y
   * `pitidos` cortos. Verde + 1 pitido = adelante; roja + varios = no. No bloquea
   * la lectura: corre en segundo plano y nunca lanza.
   */
  async senal(luz, { ms = 1200, pitidos = 1 } = {}) {
    try {
      this.#fijar(PARAMETRO_LUZ[luz], 1);
      for (let i = 0; i < pitidos; i += 1) {
        this.#fijar(PARAMETRO_PITIDO, 1);
        await espera(MS_PITIDO);
        this.#fijar(PARAMETRO_PITIDO, 0);
        await espera(MS_ENTRE_PITIDOS);
      }
      await espera(Math.max(ms - pitidos * (MS_PITIDO + MS_ENTRE_PITIDOS), 0));
      this.#fijar(PARAMETRO_LUZ[luz], 0);
    } catch {
      // Una senal fallida no debe tumbar el control de acceso.
    }
  }

  /** Una lectura NO bloqueante: la plantilla si hay un dedo puesto, `null` si no. */
  capturar() {
    const plantilla = Buffer.alloc(TAMANO_PLANTILLA);
    const tamano = new Uint32Array([TAMANO_PLANTILLA]);
    const codigo = sdk.capturar(this.#dispositivo, this.#imagen, this.#imagen.length, plantilla, tamano);
    return codigo === 0 ? Buffer.from(plantilla.subarray(0, tamano[0])) : null;
  }

  /** Reemplaza las huellas en memoria. `huellas`: [{ fid, plantilla: Buffer }]. */
  cargar(huellas) {
    sdk.dbClear(this.#cache);
    let cargadas = 0;
    for (const { fid, plantilla } of huellas) {
      if (sdk.dbAdd(this.#cache, fid, plantilla, plantilla.length) === 0) cargadas += 1;
    }
    return cargadas;
  }

  /** 1:N contra las huellas cargadas: `{ fid, puntaje }` o `null` si no es de nadie. */
  identificar(plantilla) {
    const fid = new Uint32Array(1);
    const puntaje = new Uint32Array(1);
    const codigo = sdk.dbIdentify(this.#cache, plantilla, plantilla.length, fid, puntaje);
    return codigo === 0 ? { fid: fid[0], puntaje: puntaje[0] } : null;
  }

  /** Puntaje de parecido entre dos capturas (>0 = mismo dedo). */
  comparar(a, b) {
    return sdk.dbMatch(this.#cache, a, a.length, b, b.length);
  }

  /** Fusiona 3 capturas del mismo dedo en la plantilla de registro. */
  fusionar([a, b, c]) {
    const resultado = Buffer.alloc(TAMANO_PLANTILLA);
    const tamano = new Uint32Array([TAMANO_PLANTILLA]);
    const codigo = sdk.dbMerge(this.#cache, a, b, c, resultado, tamano);
    if (codigo !== 0) throw new Error(`No se pudieron fusionar las capturas (codigo ${codigo})`);
    return Buffer.from(resultado.subarray(0, tamano[0]));
  }

  cerrar() {
    if (this.#cache) sdk.dbFree(this.#cache);
    if (this.#dispositivo) sdk.cerrar(this.#dispositivo);
    sdk.terminate();
    this.#cache = null;
    this.#dispositivo = null;
  }
}
