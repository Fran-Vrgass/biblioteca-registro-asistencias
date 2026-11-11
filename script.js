
"use strict";

// =====================================
// ELEMENTOS DEL FORMULARIO
// =====================================

const formulario = document.getElementById("formularioAsistencia");
const selector = document.getElementById("actividad");
const mensaje = document.getElementById("mensaje");
const canvas = document.getElementById("lienzoFirma");
const botonLimpiar = document.getElementById("limpiarFirma");
const botonEnviar = formulario.querySelector('button[type="submit"]');

const ctx = canvas.getContext("2d");

let firmaRealizada = false;
let dibujando = false;
let pointerActivo = null;

// =====================================
// FIRMA DIGITAL
// =====================================

function configurarPincel() {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#245b45";
    ctx.fillStyle = "#245b45";
}

function ajustarLienzo() {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const escala = window.devicePixelRatio || 1;
    const ancho = Math.round(rect.width * escala);
    const alto = Math.round(rect.height * escala);

    if (canvas.width === ancho && canvas.height === alto) {
        return;
    }

    const copia = document.createElement("canvas");
    copia.width = canvas.width;
    copia.height = canvas.height;

    if (canvas.width && canvas.height) {
        copia.getContext("2d").drawImage(canvas, 0, 0);
    }

    canvas.width = ancho;
    canvas.height = alto;

    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    configurarPincel();

    if (copia.width && copia.height) {
        ctx.drawImage(
            copia,
            0, 0, copia.width, copia.height,
            0, 0, rect.width, rect.height
        );
    }
}

canvas.style.touchAction = "none";

ajustarLienzo();

window.addEventListener("resize", ajustarLienzo);

function posicion(evento) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: evento.clientX - rect.left,
        y: evento.clientY - rect.top
    };
}

canvas.addEventListener("pointerdown", (evento) => {
    if (pointerActivo !== null || !evento.isPrimary) return;

    if (evento.pointerType === "mouse" && evento.button !== 0) {
        return;
    }

    evento.preventDefault();

    pointerActivo = evento.pointerId;
    dibujando = true;

    const punto = posicion(evento);

    ctx.beginPath();
    ctx.arc(punto.x, punto.y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(punto.x, punto.y);

    firmaRealizada = true;

    canvas.setPointerCapture(evento.pointerId);
});

canvas.addEventListener("pointermove", (evento) => {
    if (!dibujando || evento.pointerId !== pointerActivo) return;

    evento.preventDefault();

    const punto = posicion(evento);

    ctx.lineTo(punto.x, punto.y);
    ctx.stroke();
});

function terminarFirma(evento) {
    if (evento.pointerId !== pointerActivo) return;

    dibujando = false;
    pointerActivo = null;
    ctx.beginPath();
}

canvas.addEventListener("pointerup", terminarFirma);
canvas.addEventListener("pointercancel", terminarFirma);
canvas.addEventListener("lostpointercapture", terminarFirma);

function limpiarFirma() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    firmaRealizada = false;
    dibujando = false;
    pointerActivo = null;

    ctx.beginPath();
}

botonLimpiar.addEventListener("click", () => {
    limpiarFirma();
    mensaje.textContent = "";
});

// =====================================
// SUPABASE
// =====================================

const SUPABASE_URL =
    "https://yhzoryuhrrkggtlyppjt.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_Kaw2rZJutbc5BmrIrEmN6Q_A7kSUebl";

let supabaseClient = null;

function iniciarSupabase() {
    if (!window.supabase) {
        throw new Error(
            "No se pudo cargar la biblioteca de Supabase."
        );
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}

// =====================================
// ACTIVIDADES
// =====================================

async function cargarActividades() {
    selector.disabled = true;

    selector.innerHTML =
        '<option value="">Cargando actividades...</option>';

    try {
        iniciarSupabase();

        const { data, error } = await supabaseClient
            .from("actividades")
            .select("nombre")
            .eq("activa", true)
            .order("nombre", { ascending: true });

        if (error) throw error;

        selector.innerHTML =
            '<option value="">Seleccione una actividad</option>';

        if (!data || data.length === 0) {
            selector.innerHTML =
                '<option value="">No hay actividades disponibles</option>';

            mensaje.textContent =
                "No hay actividades activas registradas.";

            return;
        }

        data.forEach((actividad) => {
            const opcion = document.createElement("option");

            opcion.value = actividad.nombre;
            opcion.textContent = actividad.nombre;

            selector.appendChild(opcion);
        });

        selector.disabled = false;

        console.log(
            "Actividades cargadas correctamente:",
            data.length
        );

    } catch (error) {
        console.error("Error al cargar actividades:", error);

        selector.innerHTML =
            '<option value="">Error al cargar actividades</option>';

        mensaje.textContent =
            "Error al cargar actividades: " + error.message;

        mensaje.style.color = "red";
    }
}

cargarActividades();

// =====================================
// REGISTRAR ASISTENCIA
// =====================================

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const carnet = document.getElementById("carnet").value.trim();
    const actividad = selector.value;

    if (!carnet || !actividad || !firmaRealizada) {
        mensaje.textContent =
            "Completá el carné, la actividad y la firma.";
        mensaje.style.color = "red";
        return;
    }

    const tokenTurnstile = document.querySelector(
        '[name="cf-turnstile-response"]'
    )?.value;

    if (!tokenTurnstile) {
        mensaje.textContent =
            "Completá la verificación de seguridad.";
        mensaje.style.color = "red";
        return;
    }

    if (!supabaseClient) {
        mensaje.textContent =
            "No hay conexión con Supabase.";
        mensaje.style.color = "red";
        return;
    }

    const firma = canvas.toDataURL("image/png");

    botonEnviar.disabled = true;
    mensaje.textContent = "Registrando asistencia...";
    mensaje.style.color = "#333333";

    try {
        const { data, error } =
            await supabaseClient.functions.invoke(
                "registrar-asistencia",
                {
                    body: {
                        carnet,
                        actividad,
                        firma,
                        tokenTurnstile
                    }
                }
            );

        if (error) {
            let detalle = null;

            try {
                detalle = await error.context?.json?.();
            } catch (_) {}

            throw new Error(
                detalle?.error ||
                error.message ||
                "No se pudo registrar la asistencia."
            );
        }

        mensaje.textContent =
            data?.mensaje ||
            "Asistencia registrada correctamente.";

        mensaje.style.color = "green";

        formulario.reset();
        limpiarFirma();

        if (window.turnstile) {
            window.turnstile.reset();
        }

    } catch (error) {
        console.error("Error al registrar:", error);

        mensaje.textContent =
            error.message || "No se pudo registrar.";

        mensaje.style.color = "red";

    } finally {
        botonEnviar.disabled = false;
    }
});
