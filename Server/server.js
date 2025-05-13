import express from "express";
import cors from "cors";
import path from "path";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import fetch from "node-fetch";

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

    const external_reference = `${orderId}|${price}`;

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
      external_reference,
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
const processedPayments = new Map();

app.post("/update-payment", async (req, res) => {
  console.log("🔔 Webhook recibido:", req.body);

  // Ignorar notificaciones que no sean 'payment'
  if (req.body.topic && req.body.topic !== "payment") {
    console.log("ℹ️ Notificación ignorada (tipo no relevante):", req.body.topic);
    return res.status(200).json({ message: "Tipo de notificación no procesado" });
  }

  try {
    const paymentId = req.body?.data?.id || req.body?.resource;
    if (!paymentId) {
      console.warn("❌ No se recibió un ID de pago válido en el webhook.");
      return res.status(400).json({ message: "Webhook sin ID válido" });
    }

    // Verifica si el pago ya fue procesado
    if (processedPayments.has(paymentId)) {
      console.log("🔁 Pago ya procesado, ignorando:", paymentId);
      return res.status(200).json({ message: "Pago ya procesado" });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("❌ Error al consultar el pago:", errorText);
      return res.status(500).json({ error: "No se pudo consultar el pago a MP" });
    }

    const paymentData = await mpResponse.json();

    const externalRef = paymentData.external_reference;
    const newPaymentId = paymentData.id;

    if (!externalRef || newPaymentId === lastPaymentId) {
      console.warn("🔁 Webhook duplicado o sin external_reference");
      return res.status(400).json({ message: "ID inválido o repetido" });
    }

    lastPaymentId = newPaymentId;

    const [orderId, precioStr] = externalRef.split("|");
    const precio = parseInt(precioStr) || 0;
    const cantidad = paymentData.transaction_details?.total_paid_amount ? 1 : "¿?";
    const producto = orderId;

    const payload = {
      producto,
      precio,
      cantidad,
    };

    console.log(`🛒 Producto comprado: ${producto}`);
    console.log(`💵 Precio: $${precio}`);
    console.log(`📦 Cantidad: ${cantidad}`);
    console.log("📤 Publicando mensaje MQTT:", payload);

    mqttClient.publish("expendedora/snacko/venta", JSON.stringify(payload), { qos: 1 }, err => {
      if (err) {
        console.error("❌ Error al publicar en MQTT:", err);
      } else {
        console.log("✅ Mensaje MQTT publicado:", payload);
      }
    });

    // Marca el pago como procesado con un tiempo de expiración
    processedPayments.set(paymentId, Date.now());

    res.status(200).json({ message: "Webhook procesado correctamente" });
  } catch (error) {
    console.error("❌ Error en update-payment:", error);
    res.status(500).json({ error: "Error procesando el webhook" });
  }
});

// Limpieza periódica de pagos procesados
setInterval(() => {
  const expirationTime = 60 * 60 * 1000; // 1 hora en milisegundos
  const now = Date.now();

  for (const [paymentId, timestamp] of processedPayments.entries()) {
    if (now - timestamp > expirationTime) {
      processedPayments.delete(paymentId);
      console.log(`🧹 Eliminado paymentId procesado: ${paymentId}`);
    }
  }
}, 10 * 60 * 1000); // Ejecutar cada 10 minutos

app.get("/payment-status", (req, res) => {
  res.json({
    id: lastPaymentId,
    paymentConfirmed: !!lastPaymentId,
  });
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Servidor corriendo en http://0.0.0.0:8080");
});
