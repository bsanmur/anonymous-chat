import { Chat, MessageType } from "@flyerhq/react-native-chat-ui";
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://192.168.1.12:3000";

// Generador de username aleatorio
function generateUsername() {
  const adjectives = [
    "Happy", "Clever", "Swift", "Brave", "Wise", "Cool", "Smart", "Quick",
    "Calm", "Fierce", "Bold", "Gentle", "Lucky", "Mighty", "Bright", "Chill",
    "Fearless", "Sharp", "Kind", "Loyal", "Nimble", "Epic", "Strong", "Creative",
  ];
  const nouns = [
    "Panda", "Tiger", "Eagle", "Dolphin", "Wolf", "Fox", "Bear", "Lion",
    "Falcon", "Leopard", "Hawk", "Shark", "Panther", "Owl", "Cheetah", "Otter",
    "Raven", "Dragon", "Lynx", "Husky", "Stallion", "Jaguar", "Cougar", "Penguin",
  ];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`;
}

export default function Index() {
  const [messages, setMessages] = useState<MessageType.Any[]>([]);
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const receivedIds = useRef<Set<string>>(new Set());
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  // Inicializar base de datos local
  const initDatabase = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("chat.db");
      dbRef.current = db;

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          is_own INTEGER DEFAULT 0
        );
      `);

      console.log("✅ Base de datos local inicializada");
      return db;
    } catch (err) {
      console.error("❌ Error inicializando BD:", err);
      throw err;
    }
  };

  // Cargar mensajes desde SQLite local
  const loadLocalMessages = async (db: SQLite.SQLiteDatabase) => {
    try {
      const rows = await db.getAllAsync(
        "SELECT * FROM messages ORDER BY created_at DESC LIMIT 100"
      );

      const loadedMessages: MessageType.Text[] = rows.map((row: any) => {
        const parts = row.username.split(" ");
        return {
          author: {
            id: row.is_own ? userId : row.username,
            firstName: parts[0] || "",
            lastName: parts[1] || "",
          },
          createdAt: new Date(row.created_at).getTime(),
          id: row.id,
          text: row.content,
          type: "text",
        };
      });

      setMessages(loadedMessages);
      console.log(`📚 Cargados ${loadedMessages.length} mensajes locales`);
    } catch (err) {
      console.error("❌ Error cargando mensajes:", err);
    }
  };

  // Guardar mensaje en SQLite local
  const saveMessageLocally = async (
    msg: any,
    isOwn: boolean = false
  ) => {
    const db = dbRef.current;
    if (!db) return;

    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO messages (id, username, content, created_at, is_own)
         VALUES (?, ?, ?, ?, ?)`,
        [msg.id, msg.username, msg.content, msg.created_at, isOwn ? 1 : 0]
      );
      console.log("💾 Mensaje guardado localmente");
    } catch (err) {
      console.error("❌ Error guardando mensaje:", err);
    }
  };

  const addMessage = (message: MessageType.Any) => {
    setMessages((prev) => [message, ...prev]);
  };

  const disconnectSocket = useCallback(() => {
    try {
      const s = socketRef.current;
      if (s) {
        s.removeAllListeners();
        s.disconnect();
      }
    } catch (e) {
      console.error("Error desconectando socket:", e);
    }
    socketRef.current = null;
    receivedIds.current.clear();
  }, []);

  const connectSocket = useCallback((user: string) => {
    if (!user) return;

    try {
      const s = io(API_BASE, { 
        auth: { username: user }
      });
      socketRef.current = s;

      s.on("connect", () => {
        console.log("🟢 Socket conectado como:", user);
      });

      s.on("disconnect", () => {
        console.log("🔴 Socket desconectado");
      });

      s.on("connect_error", (err) => {
        console.error("❌ Error de conexión:", err.message);
        setError(`Error: ${err.message}`);
      });

      s.on("chat:message", async (m: any) => {
        // Evitar duplicados
        if (receivedIds.current.has(m.id)) return;
        receivedIds.current.add(m.id);

        const isOwn = m.username === user;
        const parts = m.username.split(" ");

        const incoming: MessageType.Text = {
          author: {
            id: isOwn ? user : m.username,
            firstName: parts[0] || "",
            lastName: parts[1] || "",
          },
          createdAt: new Date(m.created_at).getTime(),
          id: m.id,
          text: m.content,
          type: "text",
        };

        addMessage(incoming);
        
        // Guardar en SQLite local
        await saveMessageLocally(m, isOwn);
      });
    } catch (err) {
      console.error("❌ Error conectando socket:", err);
    }
  }, [username]);

  const handleSendPress = (message: MessageType.PartialText) => {
    const s = socketRef.current;
    if (s && s.connected) {
      s.emit("chat:message", {
        message: message.text,
      });
    }
  };

  const handleNewUser = async () => {
    disconnectSocket();
    setMessages([]);
    receivedIds.current.clear();

    const newUsername = generateUsername();
    const newUserId = Crypto.randomUUID();
    
    setUsername(newUsername);
    setUserId(newUserId);

    // Cargar mensajes locales del nuevo usuario
    if (dbRef.current) {
      await loadLocalMessages(dbRef.current);
    }

    connectSocket(newUsername);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // Inicializar BD local
        const db = await initDatabase();

        // Generar username aleatorio y userId único
        const initialUsername = generateUsername();
        const initialUserId = Crypto.randomUUID();
        
        setUsername(initialUsername);
        setUserId(initialUserId);

        // Cargar mensajes locales existentes
        await loadLocalMessages(db);

        // Conectar socket
        connectSocket(initialUsername);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      disconnectSocket();
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <Text>Cargando...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <Text style={{ color: "red", marginBottom: 16 }}>{error}</Text>
          <Button title="Reintentar" onPress={handleNewUser} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={"height"}
        keyboardVerticalOffset={50}
      >
        <View style={styles.header}>
          <Text style={styles.username}>{username}</Text>
          <View style={{ marginLeft: "auto" }}>
            <Button title="Nuevo Usuario" onPress={handleNewUser} />
          </View>
        </View>
        <Chat
          messages={messages}
          onSendPress={handleSendPress}
          user={{
            id: userId,
            firstName: username.split(" ")[0],
            lastName: username.split(" ")[1] || "",
          }}
          showUserAvatars={true}
          showUserNames={true}
        />
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});