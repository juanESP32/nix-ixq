
import express from "express";
import cors from "cors";
import path from "path";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";

// Carga las variables de entorno desde el archivo .env
dotenv.config();

const app = express();

// Configura el cliente de MercadoPago
const client = new MercadoPagoConfig({
  accessToken: "APP_USR-4296293350131401-040121-37fa7c66fcf90871a2b3a779b19531ae-2364394386", // Reemplaza con tu Access Token
  options: { timeout: 5000 }, // Opcional: Configuración de tiempo de espera
});

// Inicializa la API de preferencias
const preference = new Preference(client);

// Obtén la ruta del directorio actual
const __dirname = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/|\/$/g, ""));

// Configura express
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // Habilita JSON parsing
app.use(cors());

// Servir archivos estáticos desde la carpeta Client
app.use(express.static(path.join(__dirname, "..", "Client")));

// Usa la ruta absoluta para servir los archivos estáticos
app.get("/", function (req, res) {
  console.log("Ruta absoluta del archivo index.html:", path.join(__dirname, "..", "Client", "index.html"));
  res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

// Ruta para crear una preferencia
app.post("/create_preference", async (req, res) => {
  try {
    const { description, price, quantity, orderId } = req.body;

    if (!description || !price || !quantity) {
      return res.status(400).json({ error: "Faltan datos requeridos (description, price, quantity)" });
    }

    const preferenceData = {
      items: [
        {
          title: description,
          unit_price: Number(price),
          quantity: Number(quantity),
        },
      ],
      back_urls: {
        success: "https://8cbd-2803-9800-b4c0-7d22-60d9-ae90-5e12-aa72.ngrok-free.app",
        failure: "https://8cbd-2803-9800-b4c0-7d22-60d9-ae90-5e12-aa72.ngrok-free.app",
        pending: "https://8cbd-2803-9800-b4c0-7d22-60d9-ae90-5e12-aa72.ngrok-free.app",
      },
      notification_url: "https://8cbd-2803-9800-b4c0-7d22-60d9-ae90-5e12-aa72.ngrok-free.app/update-payment", // Importante para notificaciones atravez de tune ngrok
      auto_return: "approved",
      external_reference: orderId || "ID_GENERICO",
    };

    console.log("Datos enviados a MercadoPago:", preferenceData);

    const response = await preference.create({ body: preferenceData });
    console.log("Respuesta completa de MercadoPago:", response);

    if (!response.id) {
      console.error("Error: La respuesta de MercadoPago no contiene un id válido:", response);
      return res.status(500).json({ error: "La respuesta de MercadoPago no contiene un id válido" });
    }

    res.json({ id: response.id });
  } catch (error) {
    console.error("Error al crear la preferencia:", error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para manejar el feedback (respuesta del pago)
app.get("/feedback", (req, res) => {
  res.json({
    Payment: req.query.payment_id,
    Status: req.query.status,
    MerchantOrder: req.query.merchant_order_id,
  });
});

// Variable global para almacenar el último ID de pago
let lastPaymentId = "";

// Endpoint para recibir datos de MercadoPago y actualizar el ID
app.post("/update-payment", (req, res) => {
  const newPaymentId = req.body.id; // El ID enviado por MercadoPago
  if (newPaymentId && newPaymentId !== lastPaymentId) {
    lastPaymentId = newPaymentId; // Actualiza el último ID
    console.log("Nuevo ID de pago recibido:", lastPaymentId);
    res.status(200).json({ message: "ID de pago actualizado exitosamente" });
  } else {
    res.status(400).json({ message: "No se proporcionó un ID válido o ya es el mismo" });
  }
});

// Endpoint para consultar el estado del último pago
app.get("/payment-status", (req, res) => {
  res.json({
    id: lastPaymentId,
    paymentConfirmed: !!lastPaymentId,
  });
});

// Inicia el servidor
app.listen(8080, "0.0.0.0", () => {
  console.log("Servidor corriendo en http://0.0.0.0:8080");
});