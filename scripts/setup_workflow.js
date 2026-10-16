const https = require('https');

const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MTNiYjFjYi05N2I5LTQzN2ItODhhNi1jYmE3MWE3NDY3NGQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTI3MTY4YzAtODE3ZS00NDVkLWI0ZTctYzUxMzY4ZmFhZDI5IiwiaWF0IjoxNzkxOTQ1MzMwfQ.wAUFfvXCiRpVG2zXHAnT3O_FvlcZE9DLZMNxng0k45E';
const n8nHost = 'https://desarrollo-n8n.hostlapaz.com';

const workflowData = {
  name: "ChatBot Assistant Webhook",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "chatbot",
        responseMode: "responseNode",
        options: {
          responseHeaders: {
            entries: [
              { name: "Access-Control-Allow-Origin", value: "*" },
              { name: "Access-Control-Allow-Headers", value: "*" },
              { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" }
            ]
          }
        }
      },
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [-100, 0],
      name: "Webhook Trigger",
      webhookId: "chatbot-webhook-v1"
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: `={{ JSON.stringify({
          reply: "¡Hola! Conexión exitosa desde n8n en desarrollo-n8n.hostlapaz.com 🚀. Recibí tu mensaje: '" + ($json.body.message || '') + "'. El sistema está listo para enlazarlo con tu modelo de IA.",
          timestamp: new Date().toISOString(),
          status: "connected",
          sessionId: $json.body.sessionId || "default"
        }) }}`,
        options: {
          responseHeaders: {
            entries: [
              { name: "Access-Control-Allow-Origin", value: "*" },
              { name: "Access-Control-Allow-Headers", value: "*" }
            ]
          }
        }
      },
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.5,
      position: [180, 0],
      name: "Respond to Webhook"
    }
  ],
  connections: {
    "Webhook Trigger": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

async function run() {
  console.log("Creando workflow en n8n VPS...");
  const res = await fetch(`${n8nHost}/api/v1/workflows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": n8nApiKey
    },
    body: JSON.stringify(workflowData)
  });

  const data = await res.json();
  if (data.id) {
    console.log(`Workflow creado con éxito! ID: ${data.id}, Nombre: ${data.name}`);
    console.log("Activando workflow...");
    const actRes = await fetch(`${n8nHost}/api/v1/workflows/${data.id}/activate`, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": n8nApiKey
      }
    });
    const actData = await actRes.json();
    console.log(`Estado activo: ${actData.active}`);
    console.log(`Webhook URL: ${n8nHost}/webhook/chatbot`);
  } else {
    console.error("Error al crear:", data);
  }
}

run();
