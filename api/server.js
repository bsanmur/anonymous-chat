const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const { Server } = require("socket.io");

// Configuración base
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Base de datos SQLite
const db = new sqlite3.Database("./api/chat.db", (err) => {
  if (err) console.error("Error al abrir SQLite:", err);
  else {
    console.log("🗄️  Base de datos SQLite conectada.");
    db.run(
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        content TEXT,
        created_at TEXT
      )`
    );
  }
});

// Funciones auxiliares
function generateUsername() {
  const adjectives = [
    "Happy",
    "Clever",
    "Swift",
    "Brave",
    "Wise",
    "Cool",
    "Smart",
    "Quick",
    "Calm",
    "Fierce",
    "Bold",
    "Gentle",
    "Lucky",
    "Mighty",
    "Bright",
    "Chill",
    "Fearless",
    "Sharp",
    "Kind",
    "Loyal",
    "Nimble",
    "Epic",
    "Strong",
    "Creative",
    "Curious",
    "Dynamic",
    "Quiet",
    "Wild",
    "Heroic",
    "Playful",
    "Courageous",
    "Patient",
    "Adventurous",
    "Cheerful",
    "Daring",
    "Graceful",
    "Witty",
    "Charming",
    "Vivid",
  ];
  const nouns = [
    "Panda",
    "Tiger",
    "Eagle",
    "Dolphin",
    "Wolf",
    "Fox",
    "Bear",
    "Lion",
    "Falcon",
    "Leopard",
    "Hawk",
    "Shark",
    "Panther",
    "Owl",
    "Cheetah",
    "Otter",
    "Raven",
    "Dragon",
    "Lynx",
    "Husky",
    "Stallion",
    "Jaguar",
    "Cougar",
    "Penguin",
    "Koala",
    "Bison",
    "Rhino",
    "Cobra",
    "Phoenix",
    "Orca",
    "Viper",
    "Moose",
    "Crane",
    "Raccoon",
    "Puma",
    "Turtle",
    "Frog",
  ];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`;
}

// Endpoint principal
app.post("/api/users/random", (req, res) => {
  const id = crypto.randomUUID();
  const username = generateUsername();

  const token = jwt.sign({ id, username }, JWT_SECRET, {
    expiresIn: "2h",
  });

  res.status(201).json({
    token,
    id,
    username,
  });
});

// WebSocket (Socket.IO)
io.use((socket, next) => {
  const { token } = socket.handshake.auth;

  if (!token) {
    return next(new Error("Token requerido."));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Token inválido o expirado."));
  }
});

io.on("connection", (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.user.username}`);

  const lastSeenAt = socket.handshake.auth.lastSeenAt ?? '1970-01-01T00:00:00.000Z';

  // Enviar mensajes no recibidos (según lastSeenAt)
  db.all(
    "SELECT * FROM messages WHERE created_at > ? ORDER BY created_at ASC",
    [lastSeenAt],
    (err, rows) => {
      if (!err && rows.length) {
        rows.forEach((msg) => socket.emit("chat:message", msg));
      }
    }
  );

  // Recibir nuevo mensaje
  socket.on("chat:message", (data) => {
    const { message } = data;
    const msg = {
      id: crypto.randomUUID(),
      user_id: socket.user.id,
      username: socket.user.username,
      content: message,
      created_at: new Date().toISOString(),
    };
    console.log(`💬 Nuevo mensaje de ${msg.username}: ${msg.content}`);
    
    db.run(
      `INSERT INTO messages (id, user_id, username, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [msg.id, msg.user_id, msg.username, msg.content, msg.created_at],
      (err) => {
        if (!err) {
          io.emit("chat:message", msg);
        }
      }
    );
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Usuario desconectado: ${socket.user.username}`);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Endpoint activo: POST /api/users/random`);
});
