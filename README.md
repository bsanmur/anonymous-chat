# Anonymous Chat

Pequeña guía para configurar y ejecutar el proyecto (app Expo).

## Resumen

Este repositorio contiene una API en Node/Express con Socket.IO y una app cliente escrita con Expo (React Native). La comunicación en tiempo real se realiza por Socket.IO; la app crea un usuario aleatorio en el arranque y se autentica con un token retornado por la API.

## Requisitos

- Node.js (recomendado una versión reciente, p. ej. >= 18)
- npm
- Expo CLI / Expo Go para ejecutar la app (opcional si usas emuladores)

## Instalación

1. Clona el repositorio y entra en la carpeta del proyecto.
2. Instala dependencias:

```powershell
npm install
```

## Variables de entorno

Puedes crear un archivo `.env` en la raíz si quieres definir `PORT` o `JWT_SECRET`. El servidor por defecto usa `PORT=3000` y un `JWT_SECRET` por defecto (para desarrollo). En producción asegúrate de configurar `JWT_SECRET` seguro.

## Ejecutar la API

En la raíz del proyecto hay un script para levantar solo la API:

```powershell
npm run start-api
```

La API corre por defecto en `http://localhost:3000` (o la IP/puerto que pongas en `PORT`). El archivo principal de la API está en `api/server.js` y la base de datos SQLite se guarda en `api/chat.db`.

## Ejecutar la app (cliente)

En otra terminal arranca Expo:

```powershell
npm start
```

Opciones útiles que muestra Expo:

- `a` abrir en Android
- `i` abrir en iOS (macOS)
- Escanear QR con Expo Go (teléfono físico)

### Nota sobre networking

- Si ejecutas la app en un emulador Android clásico, la app no puede usar `localhost`. Usa `API_BASE` = `http://10.0.2.2:3000` en `app/index.tsx`.
- En iOS simulator `localhost` suele funcionar.
- En dispositivo físico usa la IP LAN de tu máquina, por ejemplo `http://192.168.1.11:3000`.

Importante: la app cliente tiene una constante `API_BASE` en `app/index.tsx` que debes actualizar según tu entorno. Ejemplos:

- Emulador Android (Android Studio):
```ts
const API_BASE = 'http://10.0.2.2:3000'
```
- iOS Simulator:
```ts
const API_BASE = 'http://localhost:3000'
```
- Dispositivo físico (ejemplo):
```ts
const API_BASE = 'http://192.168.1.11:3000'
```

Edita `app/index.tsx` y cambia la línea correspondiente antes de iniciar la app si es necesario.

## Endpoints importantes

- `POST /api/users/random` — crea un usuario aleatorio y devuelve un token JWT, username, color (la app usa esto al iniciar).
- Socket.IO — la app conecta enviando `{ auth: { token } }` en el handshake; eventos:
  - `chat:message` (emit): enviar mensaje desde el cliente: `{ message, createdAt }`.
  - `chat:message` (on): recibir mensaje en tiempo real (el servidor retransmite a todos).

## Notas rápidas

- El token JWT se usa solo para autenticar el socket y las llamadas protegidas.
- La app guarda `lastSeenAt` en Secure Store para recuperar mensajes pendientes; si prefieres puedes cambiar a AsyncStorage.

## Troubleshooting

- Si la app no recibe mensajes: revisa que `API_BASE` apunte correctamente al servidor.
- Ver errores del servidor en la consola donde ejecutaste `npm run start-api` (morgan muestra logs de requests).

## Siguientes mejoras sugeridas

- Persistir token y reconectar automáticamente al reiniciar la app.
- Añadir tests (supertest) para endpoints HTTP.
- Mejorar la UI del cliente (mostrar color/avatar, estado de conexión, confirmación de entrega).

Si quieres que genere un README más detallado con ejemplos de peticiones cURL o instrucciones de despliegue, dímelo y lo añado.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).
