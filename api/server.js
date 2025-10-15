const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");

// Configuración base
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Endpoint de salud (opcional)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebSocket (Socket.IO)
io.use((socket, next) => {
  const { username } = socket.handshake.auth;

  // Validar formato de username
  if (!username) {
    return next(new Error("Username requerido"));
  }

  if (typeof username !== "string") {
    return next(new Error("Username debe ser string"));
  }

  if (username.trim().length === 0) {
    return next(new Error("Username no puede estar vacío"));
  }

  if (username.length > 50) {
    return next(new Error("Username demasiado largo"));
  }

  // Validar formato "Adjetivo Sustantivo" (opcional, ajusta según necesites)
  const parts = username.trim().split(" ");
  if (parts.length !== 2) {
    return next(new Error("Username debe tener formato: Adjetivo Sustantivo"));
  }

  // Guardar username en el socket
  socket.username = username.trim();
  next();
});

io.on("connection", (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.username} (${socket.id})`);

  // Recibir y retransmitir mensaje
  socket.on("chat:message", (data) => {
    const { message } = data;

    // Validaciones básicas
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return;
    }

    if (message.length > 5000) {
      return; // Mensaje demasiado largo
    }

    const msg = {
      id: crypto.randomUUID(),
      username: socket.username,
      content: message.trim(),
      created_at: new Date().toISOString(),
    };

    console.log(`💬 Mensaje de ${msg.username}: ${msg.content}`);

    // Retransmitir a TODOS los clientes conectados (incluyendo el emisor)
    io.emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Usuario desconectado: ${socket.username} (${socket.id})`);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor relay corriendo en http://localhost:${PORT}`);
  console.log(`WebSocket activo - Chat efímero y anónimo`);
});
