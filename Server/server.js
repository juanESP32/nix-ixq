import express from "express";
import cors from "cors";
import path from "path";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mqtt from "mqtt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

console.log("Ruta del archivo .env:", envPath);
console.log("Access Token cargado desde .env:", process.env.ACCESS_TOKEN);

const app = express();

// Mapa para asociar ID de preferencia con los datos del producto
const preferenceTracking = new Map();

// Configurar MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN,
  options: { timeout: 5000 },
});
const preference = new Preference(client);

// Configurar MQTT
const mqttClient = mqtt.connect("mqtts://736ca49d528b4c41bfd924bc491b6878.s1.eu.hivemq.cloud:8883", {
  username: "snacko",
  password: "Qwertyuiop1",
});
mqttClient.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");
});
mqttClient.on("error", err => {
  console.error("❌ Error MQTT:", err);
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "Client")));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

// Ruta para crear preferencia
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
        success: "https://electronica2-maquina-expendedora.onrender.com",
        failure: "https://electronica2-maquina-expendedora.onrender.com",
        pending: "https://electronica2-maquina-expendedora.onrender.com",
      },
      notification_url: "https://electronica2-maquina-expendedora.onrender.com/update-payment",
      auto_return: "approved",
      external_reference: orderId || "ID_GENERICO",
    };

    console.log("Datos enviados a MercadoPago:", preferenceData);

    const response = await preference.create({ body: preferenceData });
    console.log("Respuesta completa de MercadoPago:", response);

    if (!response.id) {
      return res.status(500).json({ error: "La respuesta de MercadoPago no contiene un id válido" });
    }

    // Guardar en el mapa: ID de preferencia → datos del producto
    preferenceTracking.set(response.id, {
      producto: preferenceData.items[0].title,
      precio: preferenceData.items[0].unit_price,
    });

    res.json({ id: response.id });

  } catch (error) {
    console.error("Error al crear la preferencia:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/feedback", (req, res) => {
  res.json({
    Payment: req.query.payment_id,
    Status: req.query.status,
    MerchantOrder: req.query.merchant_order_id,
  });
});

let lastPaymentId = "";

app.post("/update-payment", (req, res) => {
  const newPaymentId = req.body.id;

  if (newPaymentId && newPaymentId !== lastPaymentId) {
    lastPaymentId = newPaymentId;
    console.log("✅ Nuevo ID de pago recibido:", lastPaymentId);

    const data = preferenceTracking.get(newPaymentId);

    if (!data) {
      console.error("❌ No se encontró información del producto para:", newPaymentId);
      return res.status(500).json({ error: "No se encontró información del producto" });
    }

    const payload = {
      producto: data.producto,
      precio: data.precio,
      paymentId: newPaymentId,
    };

    mqttClient.publish("expendedora/snacko/venta", JSON.stringify(payload), { qos: 1 }, err => {
      if (err) {
        console.error("❌ Error al publicar en MQTT:", err);
      } else {
        console.log("📤 Mensaje MQTT publicado:", payload);
      }
    });

    res.status(200).json({ message: "ID de pago actualizado y mensaje MQTT enviado" });
  } else {
    res.status(400).json({ message: "ID inválido o ya procesado" });
  }
});

app.get("/payment-status", (req, res) => {
  res.json({
    id: lastPaymentId,
    paymentConfirmed: !!lastPaymentId,
  });
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Servidor corriendo en http://0.0.0.0:8080");
});
