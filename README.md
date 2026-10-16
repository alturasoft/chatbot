# 🤖 n8n AI ChatBot - Interfaz Web & Conexión MCP

Una interfaz de chat web moderna, fluida y con diseño premium, conectada en tiempo real a tu instancia propia de **n8n** en tu VPS:
`https://desarrollo-n8n.hostlapaz.com`

---

## 🚀 Inicio Rápido

El servidor ya se encuentra en ejecución en tu equipo.

Para abrir el chat en tu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

### Comandos de control:
* **Iniciar la aplicación:**
  ```powershell
  npm start
  ```
  *(o `node server.js`)*

---

## 🌟 Características de la Interfaz

* **Diseño Obsidian Glassmorphism:** Modo oscuro de alta estética con paleta en tonos profundos, acentos índigo y efectos visuales fluidos.
* **Conexión en Vivo con tu VPS:**
  * Indicador de latencia y estado en tiempo real (`desarrollo-n8n.hostlapaz.com`).
  * Webhook activo en n8n: `https://desarrollo-n8n.hostlapaz.com/webhook/chatbot`.
* **Soporte Markdown & Código:**
  * Renderizado de texto enriquecido, negritas, enlaces y listas.
  * Bloques de código con cabecera de lenguaje y botón de **"Copiar código"** con un clic.
* **Audio Sintetizado:** Sonido sutil de alta fidelidad generado directamente mediante la Web Audio API al enviar y recibir mensajes (configurable con un clic).
* **Gestión de Memoria y Sesiones:**
  * Soporte de `sessionId` para que el flujo de n8n recuerde el contexto.
  * Botón de regeneración de sesión y vaciado de historial.
* **Panel de Configuración:**
  * Permite cambiar la URL del Webhook.
  * Alternar entre modo Proxy Local (evita problemas de CORS) y conexión Directa.
  * Herramienta de diagnóstico de Ping integrada.

---

## 🛠️ ¿Cómo convertirlo en un Chatbot con Inteligencia Artificial (OpenAI / Gemini)?

En tu n8n ya dejamos creado y activo el workflow: **`ChatBot Assistant Webhook`** *(ID: `yH5MF8hEDTvHWuTe`)*.

Para que responda usando un modelo de lenguaje avanzado:

1. Entra a tu n8n: [https://desarrollo-n8n.hostlapaz.com/home/workflows](https://desarrollo-n8n.hostlapaz.com/home/workflows)
2. Abre el workflow **ChatBot Assistant Webhook**.
3. Entre el nodo **Webhook Trigger** y **Respond to Webhook**, agrega un nodo **AI Agent**:
   * En **Chat Input**, coloca: `{{ $json.body.message }}`.
   * Conéctale un **Chat Model** (ej. *Google Gemini Chat Model* o *OpenAI Chat Model*).
   * Conéctale un **Window Buffer Memory** con Session Key `{{ $json.body.sessionId }}`.
4. En el nodo **Respond to Webhook**, actualiza el campo reply para que use la salida del agente:
   ```json
   {
     "reply": "={{ $json.output }}"
   }
   ```
5. Guarda los cambios. ¡Tu chat web en `http://localhost:3000` responderá con IA al instante!
