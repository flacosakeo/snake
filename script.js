const canvas = document.getElementById("lienzoJuego");
const ctx = canvas.getContext("2d");
const marcador = document.getElementById("marcador");
const marcadorFrutas = document.getElementById("marcadorFrutas");
const marcadorNivel = document.getElementById("marcadorNivel");
const marcadorMaximo = document.getElementById("marcadorMaximo");
const btnPausa = document.getElementById("btnPausa");

const TAMANO_CUADRO = 20;
const TOTAL_BLOQUES = 28;
const FRUTAS_POR_NIVEL = 5;
const frutas = [
    { icono: "🍇", puntos: 10, color: "rgba(168, 85, 247, 0.4)" },
    { icono: "🍊", puntos: 15, color: "rgba(249, 115, 22, 0.4)" },
    { icono: "🍓", puntos: 20, color: "rgba(239, 68, 68, 0.4)" },
    { icono: "🍋", puntos: 25, color: "rgba(234, 179, 8, 0.4)" },
    { icono: "🍒", puntos: 30, color: "rgba(244, 63, 94, 0.4)" },
    { icono: "🍉", puntos: 35, color: "rgba(34, 197, 94, 0.4)" },
    { icono: "🥝", puntos: 40, color: "rgba(132, 204, 22, 0.4)" },
    { icono: "🍑", puntos: 45, color: "rgba(251, 146, 60, 0.4)" },
    { icono: "🍍", puntos: 50, color: "rgba(250, 204, 21, 0.4)" },
    { icono: "🍎", puntos: 55, color: "rgba(220, 38, 38, 0.4)" }
];
const DIRECCIONES = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
];
const COLORES_ENEMIGOS = ["#ef4444", "#f97316", "#b91c1c", "#ec4899"];

let snake;
let comida;
let dx = 1;
let dy = 0;
let colaDirecciones = [];
let frutasRecolectadas = 0;
let puntuacion = 0;
let nivelActual = 1;
let obstaculos = [];
let enemigos = [];
let record = obtenerRecordGuardado();
let juegoPausado = true;
let juegoTerminado = false;
let esperandoInicio = true;
let temporizadorJuego = null;
let turnosEnemigos = 0;

canvas.width = TOTAL_BLOQUES * TAMANO_CUADRO;
canvas.height = TOTAL_BLOQUES * TAMANO_CUADRO;
marcadorMaximo.textContent = record;

document.addEventListener("keydown", cambiarDireccion);
btnPausa.addEventListener("click", alternarPausa);
configurarControlesTactiles();

function obtenerRecordGuardado() {
    try {
        return Number(localStorage.getItem("snakeHighScorePoints")) || 0;
    } catch {
        return 0;
    }
}

function guardarRecordEnStorage(valor) {
    try {
        localStorage.setItem("snakeHighScorePoints", String(valor));
    } catch {
        // Modo privado o almacenamiento no disponible
    }
}

function iniciarJuego() {
    reiniciarEstado();
    dibujar();
    programarSiguienteTurno();
}

function reiniciarEstado() {
    clearTimeout(temporizadorJuego);
    snake = [
        { x: 14, y: 14 },
        { x: 13, y: 14 },
        { x: 12, y: 14 }
    ];
    dx = 1;
    dy = 0;
    colaDirecciones = [];
    frutasRecolectadas = 0;
    puntuacion = 0;
    nivelActual = 1;
    turnosEnemigos = 0;
    obstaculos = [];
    enemigos = [];
    comida = null;
    juegoPausado = true;
    juegoTerminado = false;
    esperandoInicio = true;
    actualizarMarcadores();
    actualizarBotonPausa();
    configurarNivel();
    generarComida();
}

function programarSiguienteTurno() {
    clearTimeout(temporizadorJuego);
    if (juegoPausado || juegoTerminado) return;
    const velocidad = Math.max(75, 140 - (nivelActual - 1) * 6);
    temporizadorJuego = setTimeout(turno, velocidad);
}

function turno() {
    if (juegoPausado || juegoTerminado) return;

    // Procesar siguiente dirección del buffer para evitar giros de 180° por tecleo rápido
    if (colaDirecciones.length > 0) {
        const siguienteDir = colaDirecciones.shift();
        dx = siguienteDir.x;
        dy = siguienteDir.y;
    }

    const nuevaCabeza = { x: snake[0].x + dx, y: snake[0].y + dy };
    const comeraFruta = comida && comida.x === nuevaCabeza.x && comida.y === nuevaCabeza.y;

    // Detección detallada de tipo de choque
    if (chocaConLimites(nuevaCabeza) || chocaConCuerpoPropio(nuevaCabeza, comeraFruta) || chocaConObstaculo(nuevaCabeza)) {
        dibujarImpacto(nuevaCabeza);
        terminarJuego(`¡Fin del juego! Recolectaste ${frutasRecolectadas} frutas y obtuviste ${puntuacion} puntos.`);
        return;
    }

    if (chocaConEnemigo(nuevaCabeza)) {
        dibujarImpacto(nuevaCabeza);
        terminarJuego(`¡Chocaste contra una víbora enemiga! Recolectaste ${frutasRecolectadas} frutas y obtuviste ${puntuacion} puntos.`);
        return;
    }

    snake.unshift(nuevaCabeza);
    if (!comeraFruta) snake.pop();

    turnosEnemigos += 1;
    const frutaComidaPorEnemigo = turnosEnemigos % 2 === 0 && moverEnemigos();

    if (comeraFruta) recolectarFruta();
    else if (frutaComidaPorEnemigo) generarComida();

    dibujar();
    programarSiguienteTurno();
}

function chocaConLimites(posicion) {
    return posicion.x < 0 || posicion.x >= TOTAL_BLOQUES ||
           posicion.y < 0 || posicion.y >= TOTAL_BLOQUES;
}

function chocaConCuerpoPropio(posicion, estaCreciendo) {
    const cuerpoARevisar = estaCreciendo ? snake : snake.slice(0, -1);
    return cuerpoARevisar.some(segmento => mismaPosicion(segmento, posicion));
}

function chocaConObstaculo(posicion) {
    return obstaculos.some(obstaculo => mismaPosicion(obstaculo, posicion));
}

function chocaConEnemigo(posicion) {
    return enemigos.some(enemigo =>
        enemigo.cuerpo.some(segmento => mismaPosicion(segmento, posicion))
    );
}

function recolectarFruta() {
    frutasRecolectadas += 1;
    puntuacion += comida.puntos;
    actualizarMarcadores();
    actualizarRecord();

    if (frutasRecolectadas === FRUTAS_POR_NIVEL * 10) {
        dibujar();
        terminarJuego(`¡Ganaste! Completaste los 10 niveles con ${frutasRecolectadas} frutas y ${puntuacion} puntos.`);
        return;
    }

    const nuevoNivel = Math.floor(frutasRecolectadas / FRUTAS_POR_NIVEL) + 1;
    if (nuevoNivel !== nivelActual) {
        nivelActual = nuevoNivel;
        configurarNivel();
        actualizarMarcadores();
    }

    generarComida();
}

function configurarNivel() {
    const cabezaJugador = snake[0];

    // Evitar que aparezcan obstáculos sobre el cuerpo de la serpiente o justo frente a su cabeza al cambiar de nivel
    obstaculos = crearObstaculos(nivelActual).filter(posicion => {
        const sobreJugador = snake.some(segmento => mismaPosicion(segmento, posicion));
        const frenteACabeza = Math.abs(posicion.x - cabezaJugador.x) <= 2 && Math.abs(posicion.y - cabezaJugador.y) <= 2;
        return !sobreJugador && !frenteACabeza;
    });

    const cantidadEnemigos = nivelActual < 2
        ? 0
        : Math.min(4, Math.ceil((nivelActual - 1) / 2));
    enemigos = [];

    for (let i = 0; i < cantidadEnemigos; i += 1) {
        const enemigo = crearEnemigo(i);
        if (enemigo) enemigos.push(enemigo);
    }

    actualizarMarcadores();
}

function crearObstaculos(nivel) {
    const posiciones = new Map();
    const agregar = (x, y) => {
        if (x >= 1 && x < TOTAL_BLOQUES - 1 && y >= 1 && y < TOTAL_BLOQUES - 1) {
            posiciones.set(`${x},${y}`, { x, y });
        }
    };
    const lineaHorizontal = (y, desde, hasta) => {
        for (let x = desde; x <= hasta; x += 1) agregar(x, y);
    };
    const lineaVertical = (x, desde, hasta) => {
        for (let y = desde; y <= hasta; y += 1) agregar(x, y);
    };

    if (nivel === 2) {
        lineaVertical(8, 7, 12);
        lineaVertical(19, 15, 20);
    } else if (nivel === 3) {
        lineaHorizontal(9, 4, 10);
        lineaHorizontal(18, 17, 23);
    } else if (nivel === 4) {
        lineaVertical(7, 5, 10);
        lineaVertical(20, 17, 22);
        lineaHorizontal(7, 16, 20);
        lineaHorizontal(20, 7, 11);
    } else if (nivel === 5) {
        lineaHorizontal(6, 5, 9);
        lineaHorizontal(6, 18, 22);
        lineaHorizontal(21, 5, 9);
        lineaHorizontal(21, 18, 22);
        lineaVertical(6, 7, 10);
        lineaVertical(21, 17, 20);
    } else if (nivel === 6) {
        lineaHorizontal(8, 3, 9);
        lineaHorizontal(8, 18, 24);
        lineaHorizontal(19, 3, 9);
        lineaHorizontal(19, 18, 24);
        lineaVertical(13, 4, 9);
        lineaVertical(14, 18, 23);
    } else if (nivel === 7) {
        lineaVertical(6, 4, 10);
        lineaVertical(6, 17, 23);
        lineaVertical(21, 4, 10);
        lineaVertical(21, 17, 23);
        lineaHorizontal(13, 9, 18);
    } else if (nivel === 8) {
        lineaHorizontal(6, 3, 10);
        lineaHorizontal(6, 17, 24);
        lineaHorizontal(21, 3, 10);
        lineaHorizontal(21, 17, 24);
        lineaVertical(10, 10, 17);
        lineaVertical(17, 10, 17);
    } else if (nivel === 9) {
        for (let i = 4; i <= 9; i += 1) agregar(i, i);
        for (let i = 18; i <= 23; i += 1) agregar(i, i);
        for (let i = 4; i <= 9; i += 1) agregar(27 - i, i);
        for (let i = 18; i <= 23; i += 1) agregar(27 - i, i);
        lineaHorizontal(13, 4, 8);
        lineaHorizontal(14, 19, 23);
    } else if (nivel === 10) {
        for (let x = 4; x <= 23; x += 5) {
            for (let y = 4; y <= 23; y += 5) {
                agregar(x, y);
                agregar(x + 1, y);
            }
        }
    }

    return Array.from(posiciones.values());
}

function crearEnemigo(indice) {
    const posiciones = [];
    for (let y = 1; y < TOTAL_BLOQUES - 1; y += 1) {
        for (let x = 1; x < TOTAL_BLOQUES - 1; x += 1) {
            posiciones.push({ x, y });
        }
    }
    mezclar(posiciones);

    for (const cabeza of posiciones) {
        for (const direccion of mezclar(DIRECCIONES.slice())) {
            const cuerpo = [cabeza];
            for (let segmento = 1; segmento < 3; segmento += 1) {
                cuerpo.push({
                    x: cabeza.x - direccion.x * segmento,
                    y: cabeza.y - direccion.y * segmento
                });
            }

            const estaLibre = cuerpo.every(parte =>
                parte.x > 0 && parte.x < TOTAL_BLOQUES - 1 &&
                parte.y > 0 && parte.y < TOTAL_BLOQUES - 1 &&
                !obstaculos.some(obstaculo => mismaPosicion(obstaculo, parte)) &&
                !snake.some(segmentoJugador => mismaPosicion(segmentoJugador, parte)) &&
                !enemigos.some(enemigo =>
                    enemigo.cuerpo.some(segmentoEnemigo => mismaPosicion(segmentoEnemigo, parte))
                )
            );

            if (estaLibre) {
                return {
                    cuerpo,
                    longitud: cuerpo.length,
                    dx: direccion.x,
                    dy: direccion.y,
                    color: COLORES_ENEMIGOS[indice % COLORES_ENEMIGOS.length]
                };
            }
        }
    }

    return null;
}

function moverEnemigos() {
    let frutaComida = false;

    enemigos.forEach((enemigo, indice) => {
        const cabeza = enemigo.cuerpo[0];
        const opciones = mezclar(DIRECCIONES.slice())
            .filter(direccion =>
                !(direccion.x === -enemigo.dx && direccion.y === -enemigo.dy)
            )
            .map(direccion => ({
                x: cabeza.x + direccion.x,
                y: cabeza.y + direccion.y,
                dx: direccion.x,
                dy: direccion.y
            }))
            .filter(posicion => posicionSeguraParaEnemigo(posicion, enemigo, indice));

        if (opciones.length === 0) return;

        // Los enemigos persiguen la fruta; si no hay fruta disponible, eligen un movimiento seguro
        if (comida) {
            opciones.sort((a, b) => distancia(a, comida) - distancia(b, comida));
            const mejorDistancia = distancia(opciones[0], comida);
            const mejoresOpciones = opciones.filter(opcion =>
                distancia(opcion, comida) === mejorDistancia
            );
            const siguiente = mejoresOpciones[Math.floor(Math.random() * mejoresOpciones.length)];

            enemigo.dx = siguiente.dx;
            enemigo.dy = siguiente.dy;
            enemigo.cuerpo.unshift({ x: siguiente.x, y: siguiente.y });
        } else {
            const siguiente = opciones[Math.floor(Math.random() * opciones.length)];
            enemigo.dx = siguiente.dx;
            enemigo.dy = siguiente.dy;
            enemigo.cuerpo.unshift({ x: siguiente.x, y: siguiente.y });
        }

        if (comida && mismaPosicion(enemigo.cuerpo[0], comida)) {
            enemigo.longitud += 1;
            frutaComida = true;
        }

        while (enemigo.cuerpo.length > enemigo.longitud) {
            enemigo.cuerpo.pop();
        }
    });

    return frutaComida;
}

function posicionSeguraParaEnemigo(posicion, enemigoActual, indiceActual) {
    if (
        posicion.x < 0 || posicion.x >= TOTAL_BLOQUES ||
        posicion.y < 0 || posicion.y >= TOTAL_BLOQUES
    ) {
        return false;
    }

    // No chocar contra obstáculos
    if (obstaculos.some(obstaculo => mismaPosicion(obstaculo, posicion))) {
        return false;
    }

    // La víbora enemiga EVITA activamente al jugador (nunca se mueve hacia casillas ocupadas por la serpiente del jugador)
    if (snake.some(segmento => mismaPosicion(segmento, posicion))) {
        return false;
    }

    // Comprobar colisión con otros enemigos
    if (enemigos.some((enemigo, indice) =>
        indice !== indiceActual && enemigo.cuerpo.some(segmento => mismaPosicion(segmento, posicion))
    )) {
        return false;
    }

    // No morder su propio cuerpo (su cola se liberará en este turno)
    return !enemigoActual.cuerpo.slice(0, -1).some(segmento => mismaPosicion(segmento, posicion));
}

function generarComida() {
    const ocupadas = new Set();
    snake.forEach(posicion => ocupadas.add(clavePosicion(posicion)));
    obstaculos.forEach(posicion => ocupadas.add(clavePosicion(posicion)));
    enemigos.forEach(enemigo =>
        enemigo.cuerpo.forEach(posicion => ocupadas.add(clavePosicion(posicion)))
    );

    const libres = [];
    for (let y = 0; y < TOTAL_BLOQUES; y += 1) {
        for (let x = 0; x < TOTAL_BLOQUES; x += 1) {
            const posicion = { x, y };
            if (!ocupadas.has(clavePosicion(posicion))) libres.push(posicion);
        }
    }

    if (libres.length === 0) {
        dibujar();
        terminarJuego("¡Ganaste! No quedan espacios libres en el escenario.");
        return;
    }

    const indiceMaximo = Math.min(frutas.length, nivelActual);
    const frutaDisponible = frutas[Math.floor(Math.random() * indiceMaximo)];
    comida = {
        ...libres[Math.floor(Math.random() * libres.length)],
        ...frutaDisponible
    };
}

function procesarDireccion(tecla) {
    if (!tecla) return;
    tecla = tecla.toLowerCase();

    if (tecla === " ") {
        alternarPausa();
        return;
    }
    if (juegoTerminado) return;

    const direccionesTeclas = {
        arrowup: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 }
    };
    const nuevaDireccion = direccionesTeclas[tecla];
    if (!nuevaDireccion) return;

    if (esperandoInicio) {
        comenzarConDireccion(nuevaDireccion);
        return;
    }

    if (juegoPausado) return;

    // Obtener la última dirección hacia donde se dirigirá la serpiente (en cola o actual)
    const ultimaDireccion = colaDirecciones.length > 0
        ? colaDirecciones[colaDirecciones.length - 1]
        : { x: dx, y: dy };

    // Evitar giro de 180° y pulsaciones redundantes en la misma dirección
    const esOpuesta = nuevaDireccion.x === -ultimaDireccion.x && nuevaDireccion.y === -ultimaDireccion.y;
    const esMisma = nuevaDireccion.x === ultimaDireccion.x && nuevaDireccion.y === ultimaDireccion.y;

    if (!esOpuesta && !esMisma && colaDirecciones.length < 2) {
        colaDirecciones.push(nuevaDireccion);
    }
}

function cambiarDireccion(evento) {
    const tecla = evento.key.toLowerCase();
    const teclas = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"];
    if (teclas.includes(tecla)) evento.preventDefault();
    procesarDireccion(tecla);
}

function configurarControlesTactiles() {
    // Configurar botones táctiles del D-Pad
    const botonesPad = document.querySelectorAll(".btn-pad");
    botonesPad.forEach(boton => {
        const direccion = boton.getAttribute("data-dir");

        const manejarPulsacion = (e) => {
            if (e.cancelable) e.preventDefault();
            procesarDireccion(direccion);
        };

        boton.addEventListener("pointerdown", manejarPulsacion);
        boton.addEventListener("click", (e) => e.preventDefault());
    });

    // Configurar gestos táctiles (Swipe) en el Canvas
    let touchStartX = 0;
    let touchStartY = 0;

    canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
        // Evitar que el desplazamiento táctil mueva la pantalla mientras juegas
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
        if (e.changedTouches.length === 1) {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            // Mínimo 20px de arrastre para detectar dirección
            if (Math.max(absX, absY) > 20) {
                if (absX > absY) {
                    procesarDireccion(deltaX > 0 ? "arrowright" : "arrowleft");
                } else {
                    procesarDireccion(deltaY > 0 ? "arrowdown" : "arrowup");
                }
            }
        }
    }, { passive: true });
}

function comenzarConDireccion(direccion) {
    // Si intenta arrancar hacia la izquierda (contra su propio cuerpo inicial), ignorar
    if (direccion.x === -1 && direccion.y === 0) return;

    dx = direccion.x;
    dy = direccion.y;
    colaDirecciones = [];
    esperandoInicio = false;
    juegoPausado = false;
    actualizarBotonPausa();
    dibujar();
    programarSiguienteTurno();
}

function alternarPausa() {
    if (juegoTerminado || esperandoInicio) return;
    juegoPausado = !juegoPausado;
    actualizarBotonPausa();
    btnPausa.blur(); // Evitar que el foco en el botón capture la barra espaciadora

    if (juegoPausado) {
        clearTimeout(temporizadorJuego);
    } else {
        programarSiguienteTurno();
    }
}

function actualizarBotonPausa() {
    btnPausa.disabled = esperandoInicio;
    btnPausa.textContent = esperandoInicio
        ? "Presiona una dirección para comenzar"
        : juegoPausado ? "Reanudar Juego" : "Pausar Juego";
    btnPausa.className = juegoPausado ? "en-pausa" : "";
}

function actualizarMarcadores() {
    marcador.textContent = puntuacion;
    marcadorFrutas.textContent = frutasRecolectadas;
    marcadorNivel.textContent = nivelActual;
}

function actualizarRecord() {
    if (puntuacion <= record) return;
    record = puntuacion;
    marcadorMaximo.textContent = record;
    guardarRecordEnStorage(record);
}

function terminarJuego(mensaje) {
    if (juegoTerminado) return;
    juegoTerminado = true;
    clearTimeout(temporizadorJuego);
    actualizarRecord();
    setTimeout(() => {
        alert(mensaje);
        reiniciarEstado();
        dibujar();
    }, 50);
}

function dibujarImpacto(posicionImpacto) {
    dibujar();
    const x = posicionImpacto.x * TAMANO_CUADRO + TAMANO_CUADRO / 2;
    const y = posicionImpacto.y * TAMANO_CUADRO + TAMANO_CUADRO / 2;
    ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
    ctx.beginPath();
    ctx.arc(x, y, TAMANO_CUADRO, 0, Math.PI * 2);
    ctx.fill();
}

function dibujar() {
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cuadrícula nítida alineada con subpíxeles (+0.5px)
    ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= TOTAL_BLOQUES; i += 1) {
        const posicion = Math.floor(i * TAMANO_CUADRO) + 0.5;
        ctx.moveTo(posicion, 0);
        ctx.lineTo(posicion, canvas.height);
        ctx.moveTo(0, posicion);
        ctx.lineTo(canvas.width, posicion);
    }
    ctx.stroke();

    obstaculos.forEach(dibujarObstaculo);
    enemigos.forEach(enemigo => dibujarVibora(enemigo.cuerpo, enemigo.color, enemigo));
    if (comida) dibujarFruta();
    dibujarVibora(snake, "#10b981", { dx, dy }, true);
}

function dibujarObstaculo(obstaculo) {
    const x = obstaculo.x * TAMANO_CUADRO;
    const y = obstaculo.y * TAMANO_CUADRO;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(x, y, TAMANO_CUADRO, TAMANO_CUADRO);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, TAMANO_CUADRO - 2, TAMANO_CUADRO - 2);
}

function dibujarFruta() {
    const x = comida.x * TAMANO_CUADRO + TAMANO_CUADRO / 2;
    const y = comida.y * TAMANO_CUADRO + TAMANO_CUADRO / 2;
    const aura = ctx.createRadialGradient(x, y, 2, x, y, TAMANO_CUADRO / 2 + 4);
    aura.addColorStop(0, comida.color);
    aura.addColorStop(1, "rgba(250, 250, 249, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, TAMANO_CUADRO / 2 + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${TAMANO_CUADRO - 2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(comida.icono, x, y);
}

function dibujarVibora(cuerpo, color, direccion, esJugador = false) {
    cuerpo.forEach((segmento, indice) => {
        const x = segmento.x * TAMANO_CUADRO + TAMANO_CUADRO / 2;
        const y = segmento.y * TAMANO_CUADRO + TAMANO_CUADRO / 2;
        ctx.beginPath();

        if (indice === 0) {
            const gradiente = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, TAMANO_CUADRO / 2);
            gradiente.addColorStop(0, "#ffffff");
            gradiente.addColorStop(0.35, color);
            gradiente.addColorStop(1, esJugador ? "#065f46" : "#7f1d1d");
            ctx.fillStyle = gradiente;
            ctx.arc(x, y, TAMANO_CUADRO / 2, 0, Math.PI * 2);
            ctx.fill();
            dibujarOjos(x, y, direccion.dx, direccion.dy);
            return;
        }

        const proporcion = (cuerpo.length - indice) / cuerpo.length;
        const radio = (TAMANO_CUADRO / 2) * (0.6 + proporcion * 0.4);
        ctx.fillStyle = indice % 2 === 0 ? color : (esJugador ? "#107c41" : "#fda4af");
        ctx.arc(x, y, radio - 0.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function dibujarOjos(x, y, direccionX, direccionY) {
    const perpendicularX = -direccionY * 4;
    const perpendicularY = direccionX * 4;
    const avanceX = direccionX * 3;
    const avanceY = direccionY * 3;

    ctx.fillStyle = "#ffffff";
    [-1, 1].forEach(lado => {
        const ojoX = x + avanceX + perpendicularX * lado;
        const ojoY = y + avanceY + perpendicularY * lado;
        ctx.beginPath();
        ctx.arc(ojoX, ojoY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(ojoX + direccionX, ojoY + direccionY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
    });
}

function mismaPosicion(a, b) {
    return a.x === b.x && a.y === b.y;
}

function clavePosicion(posicion) {
    return `${posicion.x},${posicion.y}`;
}

function distancia(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function mezclar(elementos) {
    for (let i = elementos.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [elementos[i], elementos[j]] = [elementos[j], elementos[i]];
    }
    return elementos;
}

iniciarJuego();
