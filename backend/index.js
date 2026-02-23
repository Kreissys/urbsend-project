require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const { calculateETA, recalculateETAFromLocation, detectZone } = require("./etaCalculator");

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Configuración de Socket.io para chat en vivo
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// ============ CONFIGURACIÓN DE NOTIFICACIONES ============

// Configuración de Email (usando Gmail como ejemplo - se puede cambiar)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'urbsend.notifications@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Función para enviar Email
async function sendEmail(to, subject, htmlContent) {
  try {
    // Si no hay credenciales configuradas, simular envío
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('📧 [SIMULACIÓN] Email enviado a:', to);
      console.log('   Asunto:', subject);
      return { success: true, simulated: true };
    }

    const mailOptions = {
      from: `"URBSEND" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };

    await emailTransporter.sendMail(mailOptions);
    console.log('📧 Email enviado exitosamente a:', to);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
}

// Función para generar URL de WhatsApp
function generateWhatsAppUrl(phone, message) {
  // Limpiar número de teléfono (solo dígitos)
  let cleanPhone = phone.replace(/\D/g, '');

  // Si el número empieza con 9 y tiene 9 dígitos, agregar código de Perú
  if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
    cleanPhone = '51' + cleanPhone;
  }

  // Codificar mensaje para URL
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// Plantillas de mensajes
const notificationTemplates = {
  // Para el cliente cuando se crea un pedido
  orderCreated: (order) => ({
    subject: `URBSEND - Pedido #${order.id.slice(0, 8)} Confirmado`,
    email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #D71920; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">URBSEND</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Servicio de Mensajería Express</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none;">
          <h2 style="color: #16a34a; margin-top: 0;">✅ ¡Pedido Confirmado!</h2>

          <p style="color: #666;">Hola <strong>${order.customerName}</strong>,</p>
          <p style="color: #666;">Tu pedido ha sido registrado exitosamente. Pronto un conductor lo recogerá.</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2C3E50;">Detalles del Pedido</h3>
            <p style="margin: 5px 0;"><strong>ID:</strong> ${order.id.slice(0, 8)}</p>
            <p style="margin: 5px 0;"><strong>Origen:</strong> ${order.originAddress}</p>
            <p style="margin: 5px 0;"><strong>Destino:</strong> ${order.destAddress}</p>
            <p style="margin: 5px 0;"><strong>Precio:</strong> S/ ${order.price.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${order.urgency ? 'Express ⚡' : 'Normal'}</p>
          </div>

          <a href="http://localhost:5173/tracking?id=${order.id}"
             style="display: inline-block; background: #D71920; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Rastrear Pedido
          </a>
        </div>

        <div style="background: #2C3E50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 12px;">URBSEND - Envíos rápidos en Arequipa</p>
        </div>
      </div>
    `,
    whatsapp: `🚀 *URBSEND - Pedido Confirmado*

¡Hola ${order.customerName}!

Tu pedido ha sido registrado:
📦 *ID:* ${order.id.slice(0, 8)}
📍 *Origen:* ${order.originAddress}
🎯 *Destino:* ${order.destAddress}
💰 *Precio:* S/ ${order.price.toFixed(2)}
${order.urgency ? '⚡ *Express*' : '🕐 *Normal*'}

Pronto un conductor lo recogerá.

Rastrear: http://localhost:5173/tracking?id=${order.id}`
  }),

  // Cuando un conductor acepta el pedido
  orderAssigned: (order, driverName) => ({
    subject: `URBSEND - Conductor asignado a tu pedido #${order.id.slice(0, 8)}`,
    email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">URBSEND</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none;">
          <h2 style="color: #3b82f6; margin-top: 0;">🏍️ ¡Conductor Asignado!</h2>

          <p style="color: #666;">Tu pedido <strong>#${order.id.slice(0, 8)}</strong> ha sido aceptado por un conductor.</p>

          <div style="background: #EFF6FF; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0;"><strong>Conductor:</strong> ${driverName || 'Asignado'}</p>
          </div>

          <p style="color: #666;">El conductor se dirigirá a recoger tu paquete pronto.</p>

          <a href="http://localhost:5173/tracking?id=${order.id}"
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Ver en Mapa
          </a>
        </div>

        <div style="background: #2C3E50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 12px;">URBSEND - Envíos rápidos en Arequipa</p>
        </div>
      </div>
    `,
    whatsapp: `🏍️ *URBSEND - Conductor Asignado*

Tu pedido *#${order.id.slice(0, 8)}* ha sido aceptado.

👤 *Conductor:* ${driverName || 'Asignado'}

El conductor se dirigirá pronto a recoger tu paquete.

📍 Rastrear: http://localhost:5173/tracking?id=${order.id}`
  }),

  // Cuando el conductor inicia la ruta
  orderEnRoute: (order) => ({
    subject: `URBSEND - Tu pedido #${order.id.slice(0, 8)} está en camino`,
    email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">URBSEND</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none;">
          <h2 style="color: #8b5cf6; margin-top: 0;">🚀 ¡En Camino!</h2>

          <p style="color: #666;">El conductor ya recogió tu paquete y está en camino al destino.</p>

          <div style="background: #FAF5FF; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
            <p style="margin: 0;"><strong>Destino:</strong> ${order.destAddress}</p>
          </div>

          <a href="http://localhost:5173/tracking?id=${order.id}"
             style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Rastrear en Vivo
          </a>
        </div>

        <div style="background: #2C3E50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 12px;">URBSEND - Envíos rápidos en Arequipa</p>
        </div>
      </div>
    `,
    whatsapp: `🚀 *URBSEND - Pedido en Camino*

¡Tu pedido *#${order.id.slice(0, 8)}* está en camino!

El conductor ya recogió tu paquete y se dirige a:
🎯 ${order.destAddress}

📍 Rastrear: http://localhost:5173/tracking?id=${order.id}`
  }),

  // Cuando se entrega el pedido
  orderDelivered: (order) => ({
    subject: `URBSEND - Pedido #${order.id.slice(0, 8)} Entregado ✅`,
    email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">URBSEND</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none;">
          <h2 style="color: #16a34a; margin-top: 0;">✅ ¡Pedido Entregado!</h2>

          <p style="color: #666;">Tu pedido <strong>#${order.id.slice(0, 8)}</strong> ha sido entregado exitosamente.</p>

          <div style="background: #F0FDF4; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <p style="margin: 5px 0;"><strong>Total pagado:</strong> S/ ${order.price.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Método:</strong> ${order.paymentMethod || 'Efectivo'}</p>
          </div>

          <p style="color: #666;">¡Gracias por confiar en URBSEND! 🙏</p>

          <a href="http://localhost:5173/client/history"
             style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Ver Historial
          </a>
        </div>

        <div style="background: #2C3E50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 12px;">URBSEND - Envíos rápidos en Arequipa</p>
        </div>
      </div>
    `,
    whatsapp: `✅ *URBSEND - Pedido Entregado*

¡Tu pedido *#${order.id.slice(0, 8)}* ha sido entregado!

💰 *Total:* S/ ${order.price.toFixed(2)}
💳 *Método:* ${order.paymentMethod || 'Efectivo'}

¡Gracias por confiar en URBSEND! 🙏`
  })
};

// Función principal para enviar notificaciones
async function sendNotification(type, order, extraData = {}) {
  try {
    // Obtener datos del cliente
    let clientEmail = null;
    let clientPhone = null;

    if (order.userId) {
      const user = await prisma.user.findUnique({ where: { id: order.userId } });
      if (user) {
        clientEmail = user.email;
        clientPhone = user.phone;
      }
    }

    // Obtener plantilla
    let template;
    switch (type) {
      case 'created':
        template = notificationTemplates.orderCreated(order);
        break;
      case 'assigned':
        template = notificationTemplates.orderAssigned(order, extraData.driverName);
        break;
      case 'enroute':
        template = notificationTemplates.orderEnRoute(order);
        break;
      case 'delivered':
        template = notificationTemplates.orderDelivered(order);
        break;
      default:
        return { success: false, error: 'Tipo de notificación no válido' };
    }

    const results = {
      email: null,
      whatsapp: null
    };

    // Enviar Email si hay email del cliente
    if (clientEmail) {
      results.email = await sendEmail(clientEmail, template.subject, template.email);
    }

    // Generar URL de WhatsApp si hay teléfono
    if (clientPhone) {
      results.whatsapp = {
        success: true,
        url: generateWhatsAppUrl(clientPhone, template.whatsapp)
      };
    }

    console.log(`📬 Notificación "${type}" procesada para pedido ${order.id.slice(0, 8)}`);
    return { success: true, results };

  } catch (error) {
    console.error('❌ Error en sendNotification:', error.message);
    return { success: false, error: error.message };
  }
}

// ============ CONFIGURACIÓN DE SUBIDA DE ARCHIVOS ============
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ RUTAS DE AUTENTICACIÓN ============

// REGISTRO DE CLIENTE
app.post("/api/register/client", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'client'
      }
    });

    res.status(201).json({ 
      message: "Cliente registrado exitosamente",
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// REGISTRO DE CONDUCTOR (con archivos)
app.post("/api/register/driver", upload.fields([
  { name: 'driverLicense', maxCount: 1 },
  { name: 'vehicleSOAT', maxCount: 1 },
  { name: 'criminalRecord', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      name, email, phone, password,
      vehicleType, vehiclePlate, vehicleBrand, vehicleModel, vehicleYear
    } = req.body;

    const existing = await prisma.driver.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const driverLicense = req.files['driverLicense'] ? `/uploads/${req.files['driverLicense'][0].filename}` : null;
    const vehicleSOAT = req.files['vehicleSOAT'] ? `/uploads/${req.files['vehicleSOAT'][0].filename}` : null;
    const criminalRecord = req.files['criminalRecord'] ? `/uploads/${req.files['criminalRecord'][0].filename}` : null;

    const driver = await prisma.driver.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        vehicleType,
        vehiclePlate,
        vehicleBrand,
        vehicleModel,
        vehicleYear: parseInt(vehicleYear),
        driverLicense,
        vehicleSOAT,
        criminalRecord,
        isOnline: false,
        isVerified: false
      }
    });

    res.status(201).json({ 
      message: "Solicitud de conductor enviada. Será revisada en máximo 48 horas.",
      driver: { id: driver.id, name: driver.name, email: driver.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// LOGIN DE CLIENTE
app.post("/api/login/client", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    res.json({
      message: "Login exitoso",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// LOGIN DE CONDUCTOR
app.post("/api/login/driver", async (req, res) => {
  try {
    const { email, password } = req.body;

    const driver = await prisma.driver.findUnique({ where: { email } });
    if (!driver) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (!driver.isVerified) {
      return res.status(403).json({ error: "Tu cuenta aún no ha sido aprobada. Por favor espera la verificación del equipo." });
    }

    const validPassword = await bcrypt.compare(password, driver.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    res.json({
      message: "Login exitoso",
      user: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ RUTAS ADMIN (GESTIÓN DE CONDUCTORES) ============

// LISTAR CONDUCTORES PENDIENTES
app.get("/api/admin/drivers/pending", async (req, res) => {
  try {
    const pendingDrivers = await prisma.driver.findMany({
      where: { isVerified: false },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pendingDrivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APROBAR/RECHAZAR CONDUCTOR
app.patch("/api/admin/drivers/:id/verify", async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const driver = await prisma.driver.update({
      where: { id },
      data: { isVerified, isOnline: isVerified }
    });

    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ RUTAS ANTERIORES (MANTENIDAS) ============

// Semilla de Conductores
app.get("/api/seed-drivers", async (req, res) => {
  try {
    await prisma.driver.deleteMany(); 
    
    const hashedPass = await bcrypt.hash("moto123", 10);
    
    await prisma.driver.createMany({
      data: [
        { 
          name: "Juan Pérez", 
          email: "juan@urbsend.com",
          password: hashedPass,
          phone: "900100100", 
          vehicleType: "moto",
          vehiclePlate: "ABC-123",
          vehicleBrand: "Honda",
          vehicleModel: "CB 150",
          vehicleYear: 2020,
          isOnline: true,
          isVerified: true
        },
        { 
          name: "Maria López", 
          email: "maria@urbsend.com",
          password: hashedPass,
          phone: "900200200", 
          vehicleType: "auto",
          vehiclePlate: "XYZ-456",
          vehicleBrand: "Toyota",
          vehicleModel: "Yaris",
          vehicleYear: 2021,
          isOnline: true,
          isVerified: true
        },
        { 
          name: "Pedro Castillo", 
          email: "pedro@urbsend.com",
          password: hashedPass,
          phone: "900300300", 
          vehicleType: "moto",
          vehiclePlate: "DEF-789",
          vehicleBrand: "Yamaha",
          vehicleModel: "FZ 150",
          vehicleYear: 2019,
          isOnline: true,
          isVerified: true
        },
      ]
    });
    res.json({ msg: "✅ Conductores de prueba creados" });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});

// Listar Conductores (SOLO VERIFICADOS)
app.get("/api/drivers", async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({ 
      where: { 
        isOnline: true,
        isVerified: true 
      } 
    });
    res.json(drivers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar Pedidos
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ 
      orderBy: { createdAt: 'desc' }, 
      take: 20 
    });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Buscar un pedido
app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear Pedido
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, origin, destination, urgency, packageSize, price, paymentMethod, userId } = req.body;

    const order = await prisma.order.create({
      data: {
        userId: userId || null,
        customerName: customerName || "Cliente",
        originAddress: origin.address,
        originLat: +origin.lat,
        originLng: +origin.lng,
        destAddress: destination.address,
        destLat: +destination.lat,
        destLng: +destination.lng,
        packageSize: packageSize || "mediano",
        urgency: urgency || false,
        price: Number(price),
        status: "PENDIENTE",
        paymentMethod: paymentMethod || "Efectivo"
      },
    });

    // 📬 Enviar notificación de pedido creado
    sendNotification('created', order).catch(err => {
      console.error('Error enviando notificación de creación:', err);
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar Estado e Imagen
app.patch("/api/orders/:id/status", upload.single('evidence'), async (req, res) => {
  const { id } = req.params;
  const { status, driverId, driverName } = req.body;

  let updateData = { status: status };

  if (driverId) updateData.driverId = driverId;

  if (req.file) {
    updateData.proofImage = `/uploads/${req.file.filename}`;
    console.log("📸 Evidencia guardada:", updateData.proofImage);
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: id },
      data: updateData
    });

    // 📬 Enviar notificación según el nuevo estado
    const normalizedStatus = status.toLowerCase().replace(/_/g, ' ').replace(/ /g, '');

    if (normalizedStatus === 'asignado') {
      sendNotification('assigned', updatedOrder, { driverName }).catch(err => {
        console.error('Error enviando notificación de asignación:', err);
      });
    } else if (normalizedStatus === 'encamino') {
      sendNotification('enroute', updatedOrder).catch(err => {
        console.error('Error enviando notificación de en camino:', err);
      });
    } else if (normalizedStatus === 'entregado') {
      sendNotification('delivered', updatedOrder).catch(err => {
        console.error('Error enviando notificación de entrega:', err);
      });
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

// ============ 🆕 ENDPOINTS ADICIONALES ============

// HISTORIAL DE PEDIDOS DE UN CLIENTE
app.get("/api/users/:userId/orders", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PEDIDOS DE UN CONDUCTOR (para ganancias)
app.get("/api/drivers/:driverId/orders", async (req, res) => {
  try {
    const { driverId } = req.params;
    const orders = await prisma.order.findMany({
      where: { 
        driverId,
        status: 'ENTREGADO'
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ NOTIFICACIONES - ENDPOINTS ============

// Obtener URL de WhatsApp para un pedido
app.get("/api/orders/:id/whatsapp", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'created', 'assigned', 'enroute', 'delivered'

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verificar si hay teléfono
    const phone = order.user?.phone;
    if (!phone) {
      return res.status(400).json({ error: "El cliente no tiene teléfono registrado" });
    }

    // Obtener plantilla según el tipo
    let template;
    switch (type || 'created') {
      case 'created':
        template = notificationTemplates.orderCreated(order);
        break;
      case 'assigned':
        template = notificationTemplates.orderAssigned(order, 'Conductor asignado');
        break;
      case 'enroute':
        template = notificationTemplates.orderEnRoute(order);
        break;
      case 'delivered':
        template = notificationTemplates.orderDelivered(order);
        break;
      default:
        template = notificationTemplates.orderCreated(order);
    }

    const whatsappUrl = generateWhatsAppUrl(phone, template.whatsapp);

    res.json({
      success: true,
      phone,
      url: whatsappUrl,
      message: template.whatsapp
    });

  } catch (err) {
    console.error('Error generando URL de WhatsApp:', err);
    res.status(500).json({ error: err.message });
  }
});

// Enviar notificación manual (para re-enviar o pruebas)
app.post("/api/orders/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, email, phone } = req.body; // type: 'created', 'assigned', 'enroute', 'delivered'

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Usar email/phone proporcionados o los del usuario
    const targetEmail = email || order.user?.email;
    const targetPhone = phone || order.user?.phone;

    // Obtener plantilla
    let template;
    switch (type || 'created') {
      case 'created':
        template = notificationTemplates.orderCreated(order);
        break;
      case 'assigned':
        template = notificationTemplates.orderAssigned(order, 'Conductor');
        break;
      case 'enroute':
        template = notificationTemplates.orderEnRoute(order);
        break;
      case 'delivered':
        template = notificationTemplates.orderDelivered(order);
        break;
      default:
        return res.status(400).json({ error: "Tipo de notificación no válido" });
    }

    const results = {
      email: null,
      whatsapp: null
    };

    // Enviar email si hay destinatario
    if (targetEmail) {
      results.email = await sendEmail(targetEmail, template.subject, template.email);
    }

    // Generar URL de WhatsApp si hay teléfono
    if (targetPhone) {
      results.whatsapp = {
        success: true,
        url: generateWhatsAppUrl(targetPhone, template.whatsapp),
        phone: targetPhone
      };
    }

    res.json({
      success: true,
      type,
      results
    });

  } catch (err) {
    console.error('Error enviando notificación:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ ETA - ESTIMACIÓN DE LLEGADA ============

// Calcular ETA inicial para un pedido
app.post("/api/orders/:id/calculate-eta", async (req, res) => {
  try {
    const { id } = req.params;
    const { osrmDuration, distanceKm } = req.body;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Calcular ETA con factores inteligentes
    const eta = calculateETA(osrmDuration, {
      hour: new Date().getHours(),
      destLat: order.destLat,
      destLng: order.destLng,
      isExpress: order.urgency,
      distanceKm: parseFloat(distanceKm) || 0
    });

    // Actualizar pedido con ETA
    const updated = await prisma.order.update({
      where: { id },
      data: {
        etaMinutes: eta.etaMinutes,
        estimatedArrival: eta.estimatedArrival,
        osrmDuration: osrmDuration ? Math.round(osrmDuration) : null
      }
    });

    console.log(`⏱️ ETA calculado para pedido ${id.slice(0, 8)}: ${eta.etaMinutes} min`);

    res.json({
      success: true,
      order: updated,
      eta: eta
    });

  } catch (err) {
    console.error('Error calculando ETA:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener ETA actual de un pedido
app.get("/api/orders/:id/eta", async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Si el conductor está en camino y tenemos su ubicación, recalcular
    const normalizedStatus = order.status?.toUpperCase().replace(/\s+/g, '_');

    if (normalizedStatus === 'EN_CAMINO' && order.lastLocationLat && order.lastLocationLng) {
      const liveEta = recalculateETAFromLocation(
        order.lastLocationLat,
        order.lastLocationLng,
        order.destLat,
        order.destLng,
        order.urgency
      );

      return res.json({
        etaMinutes: liveEta.etaMinutes,
        estimatedArrival: liveEta.estimatedArrival,
        remainingKm: liveEta.remainingKm,
        isLive: true,
        driverLocation: {
          lat: order.lastLocationLat,
          lng: order.lastLocationLng,
          updatedAt: order.lastLocationTime
        }
      });
    }

    // Retornar ETA guardado
    res.json({
      etaMinutes: order.etaMinutes,
      estimatedArrival: order.estimatedArrival,
      isLive: false
    });

  } catch (err) {
    console.error('Error obteniendo ETA:', err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar ubicación del conductor
app.patch("/api/orders/:id/driver-location", async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Se requieren lat y lng" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        lastLocationLat: parseFloat(lat),
        lastLocationLng: parseFloat(lng),
        lastLocationTime: new Date()
      }
    });

    // Emitir actualización por WebSocket
    io.to(`order_${id}`).emit('driver-location-update', {
      orderId: id,
      lat: updated.lastLocationLat,
      lng: updated.lastLocationLng,
      timestamp: updated.lastLocationTime
    });

    res.json({ success: true, order: updated });

  } catch (err) {
    console.error('Error actualizando ubicación:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ CHAT EN VIVO - WEBSOCKETS ============

// Namespace para chat de pedidos
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', (socket) => {
  console.log('💬 Cliente conectado al chat:', socket.id);

  // Unirse a sala del pedido
  socket.on('join-order', async (orderId) => {
    socket.join(orderId);
    console.log(`📱 Socket ${socket.id} unido a orden ${orderId}`);

    // Enviar historial de mensajes
    try {
      const messages = await prisma.message.findMany({
        where: { orderId },
        orderBy: { timestamp: 'asc' }
      });
      socket.emit('message-history', messages);
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  });

  // Enviar mensaje
  socket.on('send-message', async (data) => {
    const { orderId, sender, content } = data;

    if (!orderId || !sender || !content) {
      socket.emit('error', { message: 'Datos incompletos' });
      return;
    }

    try {
      // Guardar en BD
      const message = await prisma.message.create({
        data: {
          orderId,
          sender,
          content: content.trim(),
          read: false
        }
      });

      // Emitir a todos en la sala del pedido
      chatNamespace.to(orderId).emit('new-message', message);
      console.log(`💬 Mensaje en orden ${orderId.slice(0, 8)}: "${content.slice(0, 30)}..."`);

    } catch (error) {
      console.error('Error guardando mensaje:', error);
      socket.emit('error', { message: 'Error al enviar mensaje' });
    }
  });

  // Marcar mensajes como leídos
  socket.on('mark-read', async (data) => {
    const { orderId, sender } = data;

    try {
      const otherSender = sender === 'CLIENT' ? 'DRIVER' : 'CLIENT';
      await prisma.message.updateMany({
        where: { orderId, sender: otherSender, read: false },
        data: { read: true }
      });

      chatNamespace.to(orderId).emit('messages-read', { orderId, by: sender });
    } catch (err) {
      console.error('Error marcando como leído:', err);
    }
  });

  // Indicador de "escribiendo"
  socket.on('typing', (data) => {
    socket.to(data.orderId).emit('user-typing', { sender: data.sender });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.orderId).emit('user-stop-typing', { sender: data.sender });
  });

  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
  });
});

// REST Endpoints para mensajes (backup/historial)
app.get("/api/orders/:id/messages", async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { orderId: req.params.id },
      orderBy: { timestamp: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:id/unread-count", async (req, res) => {
  try {
    const { sender } = req.query;
    const otherSender = sender === 'CLIENT' ? 'DRIVER' : 'CLIENT';

    const count = await prisma.message.count({
      where: { orderId: req.params.id, sender: otherSender, read: false }
    });

    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ FACTURACIÓN - GENERAR COMPROBANTE PDF ============
app.get("/api/orders/:id/invoice", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'boleta' o 'factura'

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Crear documento PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Configurar headers para descarga
    const fileName = `comprobante_${id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // ============ DISEÑO DEL COMPROBANTE ============

    // Header - Logo y datos de empresa
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#D71920').text('URBSEND', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
       .text('Servicio de Mensajería Express', 50, 80)
       .text('RUC: 20XXXXXXXXX (Simulado)', 50, 95)
       .text('Arequipa, Perú', 50, 110);

    // Tipo de comprobante
    const docType = type === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA';
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2C3E50')
       .text(docType, 350, 50, { align: 'right' });

    // Número de comprobante (simulado)
    const invoiceNumber = `B001-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    doc.fontSize(12).font('Helvetica').fillColor('#333')
       .text(invoiceNumber, 350, 70, { align: 'right' });

    // Fecha
    const fecha = new Date(order.createdAt).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.fontSize(10).fillColor('#666')
       .text(`Fecha: ${fecha}`, 350, 90, { align: 'right' });

    // Línea separadora
    doc.moveTo(50, 140).lineTo(550, 140).strokeColor('#ddd').stroke();

    // Datos del cliente
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2C3E50')
       .text('DATOS DEL CLIENTE', 50, 160);

    doc.fontSize(10).font('Helvetica').fillColor('#333')
       .text(`Nombre: ${order.customerName || order.user?.name || 'Cliente'}`, 50, 180)
       .text(`Email: ${order.user?.email || 'No registrado'}`, 50, 195)
       .text(`Teléfono: ${order.user?.phone || 'No registrado'}`, 50, 210);

    // Línea separadora
    doc.moveTo(50, 240).lineTo(550, 240).strokeColor('#ddd').stroke();

    // Detalle del servicio
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2C3E50')
       .text('DETALLE DEL SERVICIO', 50, 260);

    // Tabla de detalle
    const tableTop = 290;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#666')
       .text('Descripción', 50, tableTop)
       .text('Cantidad', 350, tableTop)
       .text('Precio', 450, tableTop, { align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#ddd').stroke();

    // Fila del servicio
    const urgencyText = order.urgency ? '(Express)' : '(Normal)';
    doc.fontSize(10).font('Helvetica').fillColor('#333')
       .text(`Servicio de mensajería ${urgencyText}`, 50, tableTop + 25)
       .text('1', 370, tableTop + 25)
       .text(`S/ ${order.price.toFixed(2)}`, 450, tableTop + 25, { align: 'right' });

    // Detalles de la ruta
    doc.fontSize(9).fillColor('#666')
       .text(`Origen: ${order.originAddress}`, 60, tableTop + 45)
       .text(`Destino: ${order.destAddress}`, 60, tableTop + 60)
       .text(`Tamaño: ${order.packageSize}`, 60, tableTop + 75)
       .text(`Método de pago: ${order.paymentMethod || 'Efectivo'}`, 60, tableTop + 90);

    // Línea separadora
    doc.moveTo(50, tableTop + 115).lineTo(550, tableTop + 115).strokeColor('#ddd').stroke();

    // Totales
    const totalsTop = tableTop + 130;
    const subtotal = order.price / 1.18; // IGV 18%
    const igv = order.price - subtotal;

    doc.fontSize(10).font('Helvetica').fillColor('#666')
       .text('Subtotal:', 350, totalsTop)
       .text(`S/ ${subtotal.toFixed(2)}`, 450, totalsTop, { align: 'right' });

    doc.text('IGV (18%):', 350, totalsTop + 18)
       .text(`S/ ${igv.toFixed(2)}`, 450, totalsTop + 18, { align: 'right' });

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#16a34a')
       .text('TOTAL:', 350, totalsTop + 40)
       .text(`S/ ${order.price.toFixed(2)}`, 450, totalsTop + 40, { align: 'right' });

    // Estado del pedido
    doc.moveTo(50, totalsTop + 70).lineTo(550, totalsTop + 70).strokeColor('#ddd').stroke();

    const statusColors = {
      'PENDIENTE': '#f59e0b',
      'ASIGNADO': '#3b82f6',
      'EN_CAMINO': '#8b5cf6',
      'EN CAMINO': '#8b5cf6',
      'ENTREGADO': '#16a34a'
    };
    const statusColor = statusColors[order.status] || '#666';

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2C3E50')
       .text('Estado del pedido:', 50, totalsTop + 85);
    doc.font('Helvetica').fillColor(statusColor)
       .text(order.status, 150, totalsTop + 85);

    // Pie de página
    doc.fontSize(8).font('Helvetica').fillColor('#999')
       .text('Este documento es una representación impresa de un comprobante electrónico.', 50, 700, { align: 'center' })
       .text('URBSEND - Servicio de Mensajería Express | www.urbsend.com', 50, 715, { align: 'center' })
       .text('*** DOCUMENTO SIMULADO - NO VÁLIDO PARA SUNAT ***', 50, 730, { align: 'center', fillColor: '#D71920' });

    // Código QR simulado (un cuadro con texto)
    doc.rect(480, 620, 60, 60).stroke();
    doc.fontSize(6).fillColor('#666').text('QR Code', 495, 645);

    doc.end();

  } catch (err) {
    console.error('Error generando comprobante:', err);
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(3001, () => {
  console.log("🚀 URBSEND Backend + WebSockets en http://localhost:3001");
  console.log("   ├─ REST API: /api/*");
  console.log("   ├─ WebSocket Chat: /chat");
  console.log("   └─ ETA Calculator: Activo");
});