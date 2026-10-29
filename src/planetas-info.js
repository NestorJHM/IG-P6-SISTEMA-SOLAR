// Resúmenes propios basados en NASA Science y JPL, consultados el 27/10/2026.
// Descubrimientos: https://ssd.jpl.nasa.gov/planets/discovery.html
const ANTIGUEDAD = "Conocido desde la Antigüedad: no se conserva una fecha de descubrimiento ni puede atribuirse a una sola persona.";
export const HISTORIAS_PLANETAS = {
  Mercurio: { descubrimiento: ANTIGUEDAD, fuente: "https://science.nasa.gov/mercury/facts/", datos: [
    "Es el planeta más pequeño y el más próximo al Sol. Su nombre recuerda al veloz mensajero de los dioses romanos.",
    "Un año dura solo 88 días terrestres. Sin embargo, de un amanecer al siguiente transcurren 176 días terrestres.",
    "Aunque está más cerca del Sol, Venus es más caliente. Su superficie está llena de cráteres y su atmósfera es extremadamente tenue."
  ] },
  Venus: { descubrimiento: ANTIGUEDAD, fuente: "https://science.nasa.gov/venus/venus-facts/", datos: [
    "Su atmósfera densa atrapa el calor y lo convierte en el planeta más caliente. Las nubes ocultan su superficie a simple vista.",
    "Gira en sentido contrario al de la mayoría de los planetas: allí el Sol sale por el oeste y se pone por el este.",
    "Su rotación tarda unos 243 días terrestres, más que su año de 225 días. Puede verse como lucero del alba o del atardecer."
  ] },
  Tierra: { descubrimiento: "Nuestro mundo no tiene descubridor ni fecha de descubrimiento. Su reconocimiento como planeta forma parte del desarrollo histórico del modelo heliocéntrico.", fuente: "https://science.nasa.gov/earth/facts/", datos: [
    "Es el único mundo donde se ha confirmado vida. El agua líquida cubre aproximadamente el 71 % de su superficie.",
    "La atmósfera y el campo magnético contribuyen a proteger la superficie. La tectónica de placas transforma sus continentes a lo largo del tiempo.",
    "La Tierra tiene un satélite natural, la Luna. Su nombre, a diferencia del de los demás planetas, no procede de un dios griego o romano."
  ] },
  Marte: { descubrimiento: ANTIGUEDAD, fuente: "https://science.nasa.gov/mars/facts/", datos: [
    "Su tono rojizo procede de minerales de hierro oxidados. Su día dura algo más de 24 horas, muy parecido al terrestre.",
    "Alberga Olympus Mons, un enorme volcán, y Valles Marineris, un sistema de cañones de miles de kilómetros.",
    "Sus lunas se llaman Fobos y Deimos. Los cauces y minerales de su superficie muestran que en el pasado hubo agua líquida."
  ] },
  "Júpiter": { descubrimiento: ANTIGUEDAD, fuente: "https://science.nasa.gov/jupiter/jupiter-facts/", datos: [
    "Es el planeta más grande. Está compuesto principalmente de hidrógeno y helio, y carece de una superficie sólida como la terrestre.",
    "La Gran Mancha Roja es una tormenta gigantesca. Su rápida rotación hace que un día dure unas diez horas.",
    "En 1610 Galileo observó cuatro de sus grandes lunas: Ío, Europa, Ganimedes y Calisto. Aquello mostró que no todo giraba alrededor de la Tierra."
  ] },
  Saturno: { descubrimiento: ANTIGUEDAD, fuente: "https://science.nasa.gov/saturn/facts/", datos: [
    "Sus anillos contienen innumerables fragmentos de hielo y roca. No forman un disco sólido: cada fragmento sigue su propia órbita.",
    "Galileo vio sus extrañas formas en 1610, pero su telescopio no permitía distinguir claramente los anillos. Huygens explicó su forma en 1655.",
    "Su densidad media es menor que la del agua. Titán, una de sus lunas, tiene una atmósfera densa y lagos de hidrocarburos."
  ] },
  Urano: { descubrimiento: "William Herschel lo identificó en 1781. Inicialmente creyó que podía tratarse de un cometa; las observaciones posteriores revelaron un planeta.", fuente: "https://science.nasa.gov/uranus/facts/", datos: [
    "Fue el primer planeta descubierto con telescopio. Herschel quiso darle un nombre que honrara al rey Jorge III.",
    "Su eje está tan inclinado que parece rodar de lado. Esta orientación produce estaciones extremas durante su órbita de unos 84 años.",
    "El metano de su atmósfera contribuye a su color azul verdoso. También posee anillos tenues."
  ] },
  Neptuno: { descubrimiento: "Johann Galle y Heinrich d’Arrest lo localizaron en 1846 siguiendo la predicción de Urbain Le Verrier. John Couch Adams había realizado cálculos independientes.", fuente: "https://science.nasa.gov/neptune/neptune-facts/", datos: [
    "Su posición se dedujo por las perturbaciones de la órbita de Urano: fue un triunfo de la predicción matemática.",
    "Su año dura unos 165 años terrestres. En 2011 completó su primera órbita desde que fue descubierto.",
    "Voyager 2 lo visitó en 1989. Tritón, su luna mayor, orbita en sentido retrógrado y podría ser un objeto capturado."
  ] },
  "Plutón": { descubrimiento: "Clyde Tombaugh lo descubrió en 1930 comparando fotografías del cielo en el Observatorio Lowell. Desde 2006 se clasifica como planeta enano.", fuente: "https://science.nasa.gov/dwarf-planets/pluto/facts/", datos: [
    "Su nombre fue propuesto por Venetia Burney, una niña de once años. Pertenece al cinturón de Kuiper.",
    "New Horizons pasó junto a él en 2015 y reveló montañas de hielo y una llamativa región clara con forma de corazón.",
    "Su órbita es excéntrica e inclinada. Caronte es tan grande respecto a Plutón que ambos giran alrededor de un centro situado fuera de Plutón."
  ] }
};

export function crearHistoriador() {
  let current = null;
  let elapsed = 0;
  return (panel, nombre, delta, visible) => {
    const history = HISTORIAS_PLANETAS[nombre];
    panel.style.display = history ? "block" : "none";
    if (!history) { current = null; elapsed = 0; return; }
    if (nombre !== current) {
      current = nombre;
      elapsed = 0;
      panel.innerHTML = `<h3>Historia y curiosidades · ${nombre}</h3><p>${history.descubrimiento}</p>`
        + history.datos.map(text => `<p>${text}</p>`).join("")
        + `<p><a href="${history.fuente}" target="_blank" rel="noopener noreferrer">Fuente: NASA Science</a></p>`;
      panel.scrollTop = 0;
    }
    if (!visible) return;
    elapsed += delta;
    const range = Math.max(0, panel.scrollHeight - panel.clientHeight);
    // 9 píxeles/s, con tres segundos de lectura al principio y al final.
    const cycle = range / 9 + 6;
    panel.scrollTop = Math.min(range, Math.max(0, (elapsed % cycle - 3) * 9));
  };
}
