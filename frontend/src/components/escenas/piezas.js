import * as THREE from 'three';

/**
 * Piezas 3D del gimnasio, compartidas por todas las escenas de la portada: el
 * mismo disco aparece cargado en la barra y girando en la franja de la frase.
 *
 * Proporciones reales escaladas a 1 unidad = 22,5 cm: discos de 45 cm, barra de
 * 2,2 m, mangas de 50 mm. Discos de caucho negro con la BANDA DORADA de la marca
 * y un rotulo grabado alrededor del aro.
 */

export const ORO = 0xf5c518;
const CAUCHO = 0x111111;
const ACERO = 0xc9ccd1;

export const LARGO_EJE = 5.8;
const RADIO_EJE = 0.065;
const LARGO_MANGA = 1.85;
export const RADIO_MANGA = 0.11;

/** Lo que va en cada manga de la barra, de adentro hacia afuera. */
export const CARGA = [
  { tipo: 'disco', radio: 1, grosor: 0.34, rotulo: 'GYM BARICHARA · 25 KG · ' },
  { tipo: 'disco', radio: 1, grosor: 0.28, rotulo: 'FUERZA · DISCIPLINA · SALUD · ' },
  { tipo: 'disco', radio: 0.56, grosor: 0.13, rotulo: '5 KG · BARICHARA · ' },
  { tipo: 'seguro' },
];

// --- Texturas hechas a mano (canvas) -----------------------------------------

/** Rotulo circular dorado para la cara del disco. */
function texturaRotulo(texto) {
  const lado = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado;
  const ctx = canvas.getContext('2d');
  const centro = lado / 2;

  ctx.fillStyle = '#f5c518';
  ctx.font = '700 64px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const radioTexto = lado * 0.36;
  const repetido = texto.repeat(Math.max(1, Math.round(70 / texto.length)));
  const paso = (Math.PI * 2) / repetido.length;
  for (let i = 0; i < repetido.length; i += 1) {
    const angulo = i * paso - Math.PI / 2;
    ctx.save();
    ctx.translate(centro + Math.cos(angulo) * radioTexto, centro + Math.sin(angulo) * radioTexto);
    ctx.rotate(angulo + Math.PI / 2);
    ctx.fillText(repetido[i], 0, 0);
    ctx.restore();
  }

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return textura;
}

/** Moleteado del agarre: rombos finos como relieve. */
function texturaMoleteado() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  for (let i = -64; i <= 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.moveTo(i, 64);
    ctx.lineTo(i + 64, 0);
    ctx.stroke();
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(3, 40);
  return textura;
}

/** Punto suave para cada mota de magnesio. */
function texturaMota() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const degradado = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  degradado.addColorStop(0, 'rgba(255,255,255,1)');
  degradado.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// --- Materiales y piezas ------------------------------------------------------

export function crearMateriales() {
  return {
    caucho: new THREE.MeshPhysicalMaterial({ color: CAUCHO, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.5 }),
    cromo: new THREE.MeshStandardMaterial({ color: ACERO, metalness: 1, roughness: 0.18 }),
    moleteado: new THREE.MeshStandardMaterial({ color: ACERO, metalness: 1, roughness: 0.38, bumpMap: texturaMoleteado(), bumpScale: 2 }),
    oro: new THREE.MeshStandardMaterial({ color: ORO, metalness: 0.85, roughness: 0.3 }),
  };
}

/** Perfil de revolucion (radio, eje) -> malla alineada con el eje X. */
function tornear(perfil, material) {
  const geometria = new THREE.LatheGeometry(
    perfil.map(([r, y]) => new THREE.Vector2(r, y)),
    96,
  );
  geometria.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geometria, material);
}

/** Un disco tipo bumper. Su eje es X: las caras miran a -X y +X. */
export function crearDisco({ radio, grosor, rotulo }, materiales) {
  const disco = new THREE.Group();
  const m = grosor / 2;
  const rebaje = Math.min(0.035, grosor * 0.15);

  // Caucho: cara rebajada y aro exterior con labio, como un bumper de competencia.
  disco.add(
    tornear(
      [
        [0.24, -m],
        [0.3, -m + rebaje],
        [radio * 0.86, -m + rebaje],
        [radio * 0.9, -m],
        [radio * 0.985, -m + 0.01],
        [radio, -m + 0.04],
        [radio, m - 0.04],
        [radio * 0.985, m - 0.01],
        [radio * 0.9, m],
        [radio * 0.86, m - rebaje],
        [0.3, m - rebaje],
        [0.24, m],
      ],
      materiales.caucho,
    ),
  );

  // Buje de acero que abraza la manga.
  disco.add(
    tornear(
      [
        [RADIO_MANGA + 0.005, -m - 0.012],
        [0.25, -m - 0.012],
        [0.25, m + 0.012],
        [RADIO_MANGA + 0.005, m + 0.012],
        [RADIO_MANGA + 0.005, -m - 0.012],
      ],
      materiales.cromo,
    ),
  );

  // Banda dorada y rotulo en ambas caras.
  const rotuloTextura = texturaRotulo(rotulo);
  for (const lado of [-1, 1]) {
    const banda = new THREE.Mesh(new THREE.RingGeometry(radio * 0.8, radio * 0.855, 96), materiales.oro);
    banda.rotation.y = (lado * Math.PI) / 2;
    banda.position.x = lado * (m - rebaje + 0.002);
    disco.add(banda);

    const placa = new THREE.Mesh(
      new THREE.PlaneGeometry(radio * 1.7, radio * 1.7),
      new THREE.MeshStandardMaterial({
        map: rotuloTextura,
        transparent: true,
        metalness: 0.7,
        roughness: 0.35,
        depthWrite: false,
      }),
    );
    placa.rotation.y = (lado * Math.PI) / 2;
    placa.position.x = lado * (m - rebaje + 0.004);
    disco.add(placa);
  }

  return disco;
}

function crearSeguro(materiales) {
  const seguro = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 48), materiales.oro);
  cuerpo.rotation.z = Math.PI / 2;
  seguro.add(cuerpo);
  const palanca = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.32), materiales.cromo);
  palanca.position.set(0, 0.2, 0.08);
  seguro.add(palanca);
  return seguro;
}

/**
 * La barra cargada. Devuelve tambien las piezas de la carga con su `destino`
 * (donde quedan) y `origen` (fuera de la manga), para animar el montaje.
 */
export function crearBarra(materiales) {
  const barra = new THREE.Group();

  const eje = new THREE.Mesh(new THREE.CylinderGeometry(RADIO_EJE, RADIO_EJE, LARGO_EJE, 32), materiales.moleteado);
  eje.rotation.z = Math.PI / 2;
  barra.add(eje);

  const piezas = [];
  for (const lado of [-1, 1]) {
    const tope = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 48), materiales.cromo);
    tope.rotation.z = Math.PI / 2;
    tope.position.x = lado * (LARGO_EJE / 2 + 0.045);
    barra.add(tope);

    const manga = new THREE.Mesh(new THREE.CylinderGeometry(RADIO_MANGA, RADIO_MANGA, LARGO_MANGA, 48), materiales.cromo);
    manga.rotation.z = Math.PI / 2;
    manga.position.x = lado * (LARGO_EJE / 2 + 0.09 + LARGO_MANGA / 2);
    barra.add(manga);

    let x = LARGO_EJE / 2 + 0.1;
    CARGA.forEach((item, orden) => {
      const pieza = item.tipo === 'disco' ? crearDisco(item, materiales) : crearSeguro(materiales);
      const grosor = item.tipo === 'disco' ? item.grosor : 0.16;
      const destino = lado * (x + grosor / 2);
      x += grosor + 0.012;
      pieza.position.x = destino;
      pieza.userData = { destino, origen: destino + lado * 7, orden };
      barra.add(pieza);
      piezas.push(pieza);
    });
  }

  return { barra, piezas };
}

/** Polvo de magnesio: motas que suben despacio dentro de una caja. */
export function crearMagnesio({ cantidad = 260, ancho = 16, alto = 8, fondo = 6, color = 0xfff6dc, opacidad = 0.55 } = {}) {
  const posiciones = new Float32Array(cantidad * 3);
  const velocidades = new Float32Array(cantidad);
  for (let i = 0; i < cantidad; i += 1) {
    posiciones[i * 3] = (Math.random() - 0.5) * ancho;
    posiciones[i * 3 + 1] = (Math.random() - 0.5) * alto;
    posiciones[i * 3 + 2] = (Math.random() - 0.5) * fondo;
    velocidades[i] = 0.002 + Math.random() * 0.006;
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  const puntos = new THREE.Points(
    geometria,
    new THREE.PointsMaterial({
      size: 0.05,
      map: texturaMota(),
      color,
      transparent: true,
      opacity: opacidad,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  puntos.userData = { velocidades, techo: alto / 2 };
  return puntos;
}

/** Avanza el magnesio un cuadro: sube, se mece y al salir por arriba vuelve abajo. */
export function moverMagnesio(magnesio, t) {
  const posiciones = magnesio.geometry.attributes.position;
  const { velocidades, techo } = magnesio.userData;
  for (let i = 0; i < velocidades.length; i += 1) {
    let y = posiciones.getY(i) + velocidades[i];
    if (y > techo) y = -techo;
    posiciones.setY(i, y);
    posiciones.setX(i, posiciones.getX(i) + Math.sin(t + i) * 0.0015);
  }
  posiciones.needsUpdate = true;
}
