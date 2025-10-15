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
    // Expected payload from client: { id, type, content, created_at }
    if (!data || typeof data !== "object") return;

    const incomingId =
      typeof data.id === "string" && data.id.trim() !== ""
        ? data.id.trim()
        : null;
    const type = typeof data.type === "string" ? data.type.trim() : "text";
    const content = typeof data.content === "string" ? data.content : null;
    const createdAt =
      typeof data.created_at === "string" && data.created_at.trim() !== ""
        ? data.created_at.trim()
        : new Date().toISOString();

    // Basic validations
    if (!content || content.length === 0) return;
    if (content.length > 2000000) return; // protect against extremely large payloads

    // Ensure id and created_at exist; accept client's id if provided (useful for dedup)
    const msgId = incomingId || crypto.randomUUID();
    const msgCreatedAt = createdAt;

    const msg = {
      id: msgId,
      username: socket.username, // enforce server-side username
      type: type === "image" ? "image" : "text",
      content: content,
      created_at: msgCreatedAt,
    };

    // Log summary
    if (msg.type === "text") {
      console.log(
        `💬 Mensaje de ${msg.username}: ${String(msg.content).slice(0, 200)}`
      );
    } else {
      console.log(
        `�️ Imagen recibida de ${msg.username} (id=${msg.id}, size=${msg.content.length} bytes approx)`
      );
    }

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
