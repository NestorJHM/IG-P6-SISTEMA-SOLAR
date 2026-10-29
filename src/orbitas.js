// Elementos J2000 de JPL (tabla 1), órbitas keplerianas sin perturbaciones.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
// a [UA], e, i [°], L [°], longitud del perihelio [°], nodo [°], periodo [días].
export const ELEMENTOS = {
  Mercurio: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 87.969],
  Venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 224.701],
  Tierra: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 365.256],
  Marte: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 686.980],
  "Júpiter": [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, 4332.589],
  Saturno: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, 10759.22],
  Urano: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, 30685.4],
  Neptuno: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 60189],
  // Plutón: JPL SBDB, época JD 2457588.5, consultado el 27/10/2026.
  // https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=134340&full-prec=true
  // Convertir la anomalía media de esa época a longitud media en J2000.
  "Plutón": [39.58862938517124, 0.2518378778576892, 17.14771140999114,
    38.68366347318184 + 113.7090015158565 + 110.2923840543057
      - (2457588.5 - 2451545) * 360 / 90981.71647718345,
    113.7090015158565 + 110.2923840543057, 110.2923840543057, 90981.71647718345]
};
export const UA = 45;
// Periodos de rotación en horas (magnitudes); el eje inclinado representa el sentido retrógrado.
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/
export const ROTACION_HORAS = {
  Mercurio: 1407.6, Venus: 5832.5, Tierra: 23.9345, Marte: 24.6,
  "Júpiter": 9.9, Saturno: 10.7, Urano: 17.2, Neptuno: 16.1, "Plutón": 153.3
};
// Periodos orbitales aproximados en días; signo negativo para Tritón retrógrado.
// https://ssd.jpl.nasa.gov/sats/elem/
export const PERIODOS_LUNAS = {
  "La Luna": 27.3217, Fobos: 0.31891, Deimos: 1.26244, "Ío": 1.76914,
  Europa: 3.55118, Ganimedes: 7.15455, Calisto: 16.68902,
  "Titán": 15.94542, "Tritón": -5.87699,
  Caronte: 6.387222, Estigia: 20.16, Nix: 24.85, Cerbero: 32.17, Hidra: 38.20
};
export const VELOCIDADES_SIMULACION = [1, 2, 4, 8, 16];
export const DIAS_POR_SEGUNDO_ANIMACION = 0.25;
export function diasAnimacion(segundos, factor) {
  return segundos * factor * DIAS_POR_SEGUNDO_ANIMACION;
}
export function diasSimulados(segundos, factor) {
  return segundos * factor / 86400;
}
const rad = Math.PI / 180;

export function resolverKepler(meanAnomaly, eccentricity) {
  const m = ((meanAnomaly + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  let e = eccentricity > 0.8 ? (m < 0 ? -Math.PI : Math.PI) : m;
  for (let j = 0; j < 30; j++) {
    const correction = (e - eccentricity * Math.sin(e) - m) / (1 - eccentricity * Math.cos(e));
    e -= correction;
    if (Math.abs(correction) < 1e-12) break;
  }
  return e;
}

export function posicionOrbital(elementos, anomalE) {
  const [a, e, inclination, , perihelion, node] = elementos;
  const w = (perihelion - node) * rad, o = node * rad, i = inclination * rad;
  const xp = a * (Math.cos(anomalE) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(anomalE);
  const x = (Math.cos(w)*Math.cos(o) - Math.sin(w)*Math.sin(o)*Math.cos(i))*xp
    + (-Math.sin(w)*Math.cos(o) - Math.cos(w)*Math.sin(o)*Math.cos(i))*yp;
  const y = (Math.cos(w)*Math.sin(o) + Math.sin(w)*Math.cos(o)*Math.cos(i))*xp
    + (-Math.sin(w)*Math.sin(o) + Math.cos(w)*Math.cos(o)*Math.cos(i))*yp;
  const z = Math.sin(w)*Math.sin(i)*xp + Math.cos(w)*Math.sin(i)*yp;
  // Rotación del plano eclíptico XY al plano horizontal XZ de Three.js.
  return [x * UA, z * UA, -y * UA];
}

export function posicionEnDias(elementos, dias) {
  const m = (elementos[3] - elementos[4]) * rad + dias * 2 * Math.PI / elementos[6];
  return posicionOrbital(elementos, resolverKepler(m, elementos[1]));
}
