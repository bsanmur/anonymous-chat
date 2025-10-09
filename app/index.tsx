import { Chat, MessageType } from "@flyerhq/react-native-chat-ui";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Text, View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://localhost:3000";

export default function Index() {
  const [messages, setMessages] = useState<MessageType.Any[]>([]);
  const [user, setUser] = useState<{ id: string; name: string }>({
    id: "temp",
    name: "Anonymous",
  });
  const [token, setToken] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const receivedIds = useRef<Set<string>>(new Set());

  const addMessage = (message: MessageType.Any) => {
    setMessages((prev) => [message, ...prev]);
  };

  const handleSendPress = (message: MessageType.PartialText) => {
    const s = socketRef.current;
    if (s && s.connected && token) {
      s.emit("chat:message", {
        message: message.text,
        createdAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // Crear usuario aleatorio
        const createResp = await fetch(`${API_BASE}/api/users/random`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!createResp.ok) throw new Error("Error creando usuario");
        const createJson = await createResp.json();

        const receivedToken = createJson.token;
        const receivedId = createJson.id;
        const receivedUsername = createJson.username;

        setToken(receivedToken || null);
        setUser({ id: receivedId, name: receivedUsername });

        // Conectar socket
        const s = io(API_BASE, { auth: { token: receivedToken } });
        socketRef.current = s;

        s.on("connect", async () => {
          console.log("🟢 Socket conectado");
          const lastSeenAt = await SecureStore.getItemAsync("lastSeenAt");
          s.emit("chat:recover", { lastSeenAt });
        });

        s.on("disconnect", () => console.log("🔴 Socket desconectado"));

        s.on("chat:message", async (m: any) => {
          if (receivedIds.current.has(m.id)) return;
          receivedIds.current.add(m.id);

          const incoming: MessageType.Text = {
            author: {
              id: m.user_id,
              firstName: m.username.split(" ")[0],
              lastName: m.username.split(" ")[1] || "",
            },
            createdAt: new Date(m.created_at).getTime(),
            id: m.id,
            text: m.content,
            type: "text",
          };

          addMessage(incoming);
          await SecureStore.setItemAsync("lastSeenAt", m.created_at);
        });
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <SafeAreaProvider>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (error) {
    return (
      <SafeAreaProvider>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text>{error}</Text>
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
          <Text style={styles.username}>{user.name || user.id}</Text>
        </View>
        <Chat
          messages={messages}
          onSendPress={handleSendPress}
          user={user}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  }
});
