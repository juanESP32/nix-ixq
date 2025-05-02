import express from "express";
import cors from "cors";
import path from "path";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import fetch from "node-fetch"; // 👈 Requiere instalar: npm install node-fetch

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
console.log("Access Token cargado desde .env:", process.env.ACCESS_TOKEN);

const app = express();

// MQTT Configuración
const mqttClient = mqtt.connect("mqtts://736ca49d528b4c41bfd924bc491b6878.s1.eu.hivemq.cloud:8883", {
  username: "snacko",
  password: "Qwertyuiop1",
});
mqttClient.on("connect", () => console.log("✅ Conectado al broker MQTT"));
mqttClient.on("error", err => console.error("❌ Error MQTT:", err));

// Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN,
  options: { timeout: 5000 },
});
const preference = new Preference(client);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "Client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

app.post("/create_preference", async (req, res) => {
  try {
    const { description, price, quantity, orderId } = req.body;

    if (!description || !price || !quantity || !orderId) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
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
      external_reference: orderId,
    };

    const response = await preference.create({ body: preferenceData });
    if (!response.id) {
      return res.status(500).json({ error: "La respuesta de MercadoPago no contiene un id válido" });
    }

    res.json({ id: response.id });
  } catch (error) {
    console.error("❌ Error en create_preference:", error);
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

app.post("/update-payment", async (req, res) => {
  const newPaymentId = req.body.id;

  if (!newPaymentId || newPaymentId === lastPaymentId) {
    return res.status(400).json({ message: "ID inválido o repetido" });
  }

  lastPaymentId = newPaymentId;
  console.log("✅ Nuevo ID de pago recibido:", newPaymentId);

  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${newPaymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const paymentData = await mpResponse.json();

    const externalRef = paymentData.external_reference;
    const producto = paymentData.description || paymentData.external_reference || "desconocido";
    const precio = paymentData.transaction_details?.total_paid_amount || paymentData.transaction_amount || 0;


    const payload = {
      producto,
      precio,
      paymentId: newPaymentId,
      referencia: externalRef,
    };

    mqttClient.publish("expendedora/snacko/venta", JSON.stringify(payload), { qos: 1 }, err => {
      if (err) {
        console.error("❌ Error al publicar en MQTT:", err);
      } else {
        console.log("📤 Mensaje MQTT publicado:", payload);
      }
    });

    res.status(200).json({ message: "Mensaje MQTT enviado correctamente" });

  } catch (err) {
    console.error("❌ Error al consultar la API de MercadoPago:", err);
    res.status(500).json({ error: "Fallo al consultar datos del pago" });
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
