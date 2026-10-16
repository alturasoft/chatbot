/**
 * n8n AI ChatBot Web Application
 * Real-time frontend logic, session handling, audio synth & Markdown parsing
 */

(() => {
  'use strict';

  // --- DEFAULT CONFIGURATION & STATE ---
  const DEFAULT_SETTINGS = {
    webhookUrl: 'https://desarrollo-n8n.hostlapaz.com/webhook/chatbot',
    routeMode: 'proxy', // 'proxy' | 'direct'
    sessionId: 'session_' + Math.random().toString(36).substring(2, 9),
    soundEnabled: true
  };

  let state = {
    settings: { ...DEFAULT_SETTINGS },
    messages: [],
    isWaitingResponse: false,
    pingInterval: null
  };

  // --- DOM ELEMENTS ---
  const elements = {
    chatMain: document.getElementById('chat-main'),
    messagesContainer: document.getElementById('messages-container'),
    welcomeHero: document.getElementById('welcome-hero'),
    typingIndicator: document.getElementById('typing-indicator'),
    chatForm: document.getElementById('chat-form'),
    userInput: document.getElementById('user-input'),
    btnSend: document.getElementById('btn-send'),
    charCounter: document.getElementById('char-counter'),
    btnScrollBottom: document.getElementById('btn-scroll-bottom'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    latencyDisplay: document.getElementById('latency-display'),
    statusDot: document.getElementById('status-dot'),
    headerStatusText: document.getElementById('header-status-text'),
    toast: document.getElementById('toast-notification'),
    toastText: document.getElementById('toast-text'),
    // Modal
    settingsModal: document.getElementById('settings-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    inputWebhookUrl: document.getElementById('setting-webhook-url'),
    modeProxy: document.getElementById('mode-proxy'),
    modeDirect: document.getElementById('mode-direct'),
    labelModeProxy: document.getElementById('label-mode-proxy'),
    labelModeDirect: document.getElementById('label-mode-direct'),
    inputSessionId: document.getElementById('setting-session-id'),
    btnRegenerateSession: document.getElementById('btn-regenerate-session'),
    btnPingTest: document.getElementById('btn-ping-test'),
    testResultBox: document.getElementById('test-result-box'),
    btnResetSettings: document.getElementById('btn-reset-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings')
  };

  // --- INITIALIZATION ---
  function init() {
    loadSettings();
    loadMessages();
    setupEventListeners();
    setupAutoResize();
    startHealthCheck();
    renderAllMessages();
    checkScroll();
  }

  // --- SETTINGS MANAGEMENT ---
  function loadSettings() {
    try {
      const saved = localStorage.getItem('n8n_chat_settings');
      if (saved) {
        state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('No se pudo cargar settings de localStorage:', e);
    }
    updateSettingsModalFields();
    updateSoundButtonIcon();
  }

  function saveSettings() {
    try {
      localStorage.setItem('n8n_chat_settings', JSON.stringify(state.settings));
      showToast('Configuración guardada');
    } catch (e) {
      console.error('Error al guardar settings:', e);
    }
  }

  function updateSettingsModalFields() {
    elements.inputWebhookUrl.value = state.settings.webhookUrl;
    elements.inputSessionId.value = state.settings.sessionId;
    
    if (state.settings.routeMode === 'direct') {
      elements.modeDirect.checked = true;
      elements.labelModeDirect.classList.add('active');
      elements.labelModeProxy.classList.remove('active');
    } else {
      elements.modeProxy.checked = true;
      elements.labelModeProxy.classList.add('active');
      elements.labelModeDirect.classList.remove('active');
    }
  }

  // --- MESSAGE HISTORY MANAGEMENT ---
  function loadMessages() {
    try {
      const saved = localStorage.getItem('n8n_chat_history');
      if (saved) {
        state.messages = JSON.parse(saved);
      }
    } catch (e) {
      state.messages = [];
    }
  }

  function persistMessages() {
    try {
      localStorage.setItem('n8n_chat_history', JSON.stringify(state.messages.slice(-50)));
    } catch (e) {
      console.warn('Error al guardar historial de chat:', e);
    }
  }

  // --- SOUND SYNTHESIZER (WEB AUDIO API) ---
  function playNotificationSound(type = 'receive') {
    if (!state.settings.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'receive') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'send') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      // Audio autoplay policy might prevent playback without user interaction
    }
  }

  function updateSoundButtonIcon() {
    if (state.settings.soundEnabled) {
      elements.btnSoundToggle.style.color = 'var(--accent-cyan)';
      elements.btnSoundToggle.title = 'Sonido Activado';
    } else {
      elements.btnSoundToggle.style.color = 'var(--text-muted)';
      elements.btnSoundToggle.title = 'Sonido Desactivado';
    }
  }

  // --- MARKDOWN PARSER (SAFE & CLIENT-SIDE) ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    let text = rawText;

    // Code blocks with syntax copy button: ```lang \n code \n ```
    text = text.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'código';
      const safeCode = escapeHtml(code.trim());
      return `<pre><div class="code-header"><span>${language}</span><button type="button" class="copy-code-btn" data-code="${encodeURIComponent(code.trim())}">Copiar</button></div><code>${safeCode}</code></pre>`;
    });

    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${escapeHtml(code)}</code>`;
    });

    // Bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Markdown Links: [title](url)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Simple bullet points: lines starting with * or -
    const lines = text.split('\n');
    let inList = false;
    let processed = [];

    for (let line of lines) {
      if (line.match(/^[\*\-]\s+(.*)/)) {
        if (!inList) {
          processed.push('<ul>');
          inList = true;
        }
        processed.push(`<li>${line.replace(/^[\*\-]\s+/, '')}</li>`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        // Empty lines or normal text wrapped in <p> if not already pre/code/ul
        if (line.trim().length > 0 && !line.startsWith('<pre') && !line.startsWith('</pre') && !line.startsWith('<div')) {
          processed.push(`<p>${line}</p>`);
        } else if (line.trim().length > 0) {
          processed.push(line);
        }
      }
    }
    if (inList) processed.push('</ul>');

    return processed.join('\n');
  }

  // --- RENDER MESSAGES ---
  function renderAllMessages() {
    if (state.messages.length === 0) {
      elements.welcomeHero.classList.remove('hidden');
      return;
    }

    elements.welcomeHero.classList.add('hidden');
    elements.messagesContainer.innerHTML = '';
    state.messages.forEach(msg => appendMessageElement(msg, false));
    scrollToBottom(false);
  }

  function appendMessageElement(msg, animate = true) {
    elements.welcomeHero.classList.add('hidden');

    const row = document.createElement('div');
    row.className = `message-row ${msg.sender}`;
    row.id = `msg-${msg.id}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (msg.sender === 'bot') {
      avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M12 8V4H8"></path></svg>`;
    } else {
      avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }

    const wrap = document.createElement('div');
    wrap.className = 'message-content-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    if (msg.sender === 'bot') {
      bubble.innerHTML = renderMarkdown(msg.text);
    } else {
      bubble.textContent = msg.text;
    }

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    meta.appendChild(timeSpan);

    // Copy message button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-msg-btn';
    copyBtn.title = 'Copiar mensaje';
    copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.text).then(() => showToast('Mensaje copiado'));
    });
    meta.appendChild(copyBtn);

    wrap.appendChild(bubble);
    wrap.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(wrap);

    elements.messagesContainer.appendChild(row);

    if (animate) {
      scrollToBottom(true);
    }
  }

  // --- SEND MESSAGE FLOW ---
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || state.isWaitingResponse) return;

    // 1. Add user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toISOString()
    };
    state.messages.push(userMsg);
    appendMessageElement(userMsg);
    persistMessages();
    playNotificationSound('send');

    // 2. Clear input
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    updateCharCounter();

    // 3. Set loading state
    state.isWaitingResponse = true;
    elements.btnSend.disabled = true;
    elements.typingIndicator.classList.remove('hidden');
    scrollToBottom(true);

    try {
      let replyText = '';
      const payload = {
        message: trimmed,
        sessionId: state.settings.sessionId,
        context: {
          clientTimestamp: new Date().toISOString(),
          source: 'n8n-chatbot-web'
        }
      };

      if (state.settings.routeMode === 'direct') {
        // Direct fetch to VPS webhook
        const response = await fetch(state.settings.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        replyText = data.reply || data.output || data.message || JSON.stringify(data);
      } else {
        // Through local node proxy
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-n8n-webhook-url': state.settings.webhookUrl
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        replyText = data.reply || data.output || data.message || JSON.stringify(data);
      }

      // Add bot response
      const botMsg = {
        id: 'msg_' + Date.now(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toISOString()
      };
      state.messages.push(botMsg);
      appendMessageElement(botMsg);
      persistMessages();
      playNotificationSound('receive');

    } catch (err) {
      console.error('Error enviando mensaje a n8n:', err);
      const errorMsg = {
        id: 'msg_' + Date.now(),
        sender: 'bot',
        text: `⚠️ **Error de conexión con n8n:**\n${err.message}\n\n*Verifica que el workflow esté activo en tu panel de n8n y que la URL en configuración sea correcta.*`,
        timestamp: new Date().toISOString()
      };
      state.messages.push(errorMsg);
      appendMessageElement(errorMsg);
      persistMessages();
    } finally {
      state.isWaitingResponse = false;
      elements.btnSend.disabled = false;
      elements.typingIndicator.classList.add('hidden');
      scrollToBottom(true);
      elements.userInput.focus();
    }
  }

  // --- HEALTH CHECK / PING TO VPS ---
  async function checkHealth() {
    try {
      const start = performance.now();
      const res = await fetch('/api/health');
      const data = await res.json();
      const duration = Math.round(performance.now() - start);

      if (data.status === 'online') {
        elements.statusDot.className = 'status-indicator online';
        elements.statusDot.title = 'n8n VPS Online';
        elements.latencyDisplay.textContent = `${data.latencyMs || duration} ms`;
        elements.latencyDisplay.style.color = 'var(--accent-cyan)';
        elements.headerStatusText.textContent = 'Conectado a desarrollo-n8n.hostlapaz.com';
      } else {
        throw new Error('VPS warning');
      }
    } catch (e) {
      elements.statusDot.className = 'status-indicator offline';
      elements.statusDot.title = 'Desconectado o Inaccesible';
      elements.latencyDisplay.textContent = 'Offline';
      elements.latencyDisplay.style.color = '#ef4444';
      elements.headerStatusText.textContent = 'Sin conexión con n8n';
    }
  }

  function startHealthCheck() {
    checkHealth();
    if (state.pingInterval) clearInterval(state.pingInterval);
    state.pingInterval = setInterval(checkHealth, 30000); // Check every 30s
  }

  // --- SCROLL HELPERS ---
  function scrollToBottom(smooth = true) {
    elements.chatMain.scrollTo({
      top: elements.chatMain.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function checkScroll() {
    const threshold = 120;
    const isNearBottom = elements.chatMain.scrollHeight - elements.chatMain.scrollTop - elements.chatMain.clientHeight <= threshold;
    if (isNearBottom) {
      elements.btnScrollBottom.classList.add('hidden');
    } else {
      elements.btnScrollBottom.classList.remove('hidden');
    }
  }

  // --- AUTO RESIZE TEXTAREA ---
  function setupAutoResize() {
    elements.userInput.addEventListener('input', () => {
      elements.userInput.style.height = 'auto';
      elements.userInput.style.height = `${Math.min(elements.userInput.scrollHeight, 160)}px`;
      updateCharCounter();
    });
  }

  function updateCharCounter() {
    const len = elements.userInput.value.length;
    elements.charCounter.textContent = `${len} / 2000`;
  }

  // --- TOAST NOTIFICATIONS ---
  let toastTimeout = null;
  function showToast(text, duration = 2500) {
    if (toastTimeout) clearTimeout(toastTimeout);
    elements.toastText.textContent = text;
    elements.toast.classList.remove('hidden');
    toastTimeout = setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, duration);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Form submit
    elements.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(elements.userInput.value);
    });

    // Enter to submit (Shift+Enter for newline)
    elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(elements.userInput.value);
      }
    });

    // Prompt pills delegation
    elements.messagesContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn');
      if (pill) {
        const prompt = pill.getAttribute('data-prompt');
        if (prompt) {
          sendMessage(prompt);
        }
      }

      // Copy code button delegation
      const copyBtn = e.target.closest('.copy-code-btn');
      if (copyBtn) {
        const code = decodeURIComponent(copyBtn.getAttribute('data-code') || '');
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '¡Copiado!';
          setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
        });
      }
    });

    // Scroll listener
    elements.chatMain.addEventListener('scroll', checkScroll);
    elements.btnScrollBottom.addEventListener('click', () => scrollToBottom(true));

    // Sound toggle
    elements.btnSoundToggle.addEventListener('click', () => {
      state.settings.soundEnabled = !state.settings.soundEnabled;
      saveSettings();
      updateSoundButtonIcon();
      showToast(state.settings.soundEnabled ? 'Sonidos activados' : 'Sonidos silenciados');
    });

    // Clear chat
    elements.btnClearChat.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas vaciar el historial de la conversación?')) {
        state.messages = [];
        localStorage.removeItem('n8n_chat_history');
        renderAllMessages();
        showToast('Conversación limpiada');
      }
    });

    // Settings Modal
    elements.btnOpenSettings.addEventListener('click', () => {
      updateSettingsModalFields();
      elements.settingsModal.classList.remove('hidden');
    });

    elements.btnCloseModal.addEventListener('click', () => {
      elements.settingsModal.classList.add('hidden');
    });

    elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === elements.settingsModal) {
        elements.settingsModal.classList.add('hidden');
      }
    });

    // Routing mode cards click
    elements.labelModeProxy.addEventListener('click', () => {
      elements.modeProxy.checked = true;
      elements.labelModeProxy.classList.add('active');
      elements.labelModeDirect.classList.remove('active');
    });

    elements.labelModeDirect.addEventListener('click', () => {
      elements.modeDirect.checked = true;
      elements.labelModeDirect.classList.add('active');
      elements.labelModeProxy.classList.remove('active');
    });

    // Regenerate session
    elements.btnRegenerateSession.addEventListener('click', () => {
      elements.inputSessionId.value = 'session_' + Math.random().toString(36).substring(2, 9);
      showToast('Nueva sesión generada');
    });

    // Reset settings
    elements.btnResetSettings.addEventListener('click', () => {
      elements.inputWebhookUrl.value = DEFAULT_SETTINGS.webhookUrl;
      elements.inputSessionId.value = DEFAULT_SETTINGS.sessionId;
      elements.modeProxy.checked = true;
      elements.labelModeProxy.classList.add('active');
      elements.labelModeDirect.classList.remove('active');
      showToast('Valores por defecto restablecidos');
    });

    // Save settings
    elements.btnSaveSettings.addEventListener('click', () => {
      state.settings.webhookUrl = elements.inputWebhookUrl.value.trim() || DEFAULT_SETTINGS.webhookUrl;
      state.settings.sessionId = elements.inputSessionId.value.trim() || DEFAULT_SETTINGS.sessionId;
      state.settings.routeMode = elements.modeDirect.checked ? 'direct' : 'proxy';
      saveSettings();
      elements.settingsModal.classList.add('hidden');
    });

    // Ping diagnostic test
    elements.btnPingTest.addEventListener('click', async () => {
      elements.testResultBox.className = 'test-result';
      elements.testResultBox.textContent = 'Enviando ping de prueba a n8n VPS...';
      try {
        const start = performance.now();
        const res = await fetch('/api/health');
        const data = await res.json();
        const duration = Math.round(performance.now() - start);

        if (data.status === 'online') {
          elements.testResultBox.className = 'test-result success';
          elements.testResultBox.innerHTML = `✓ Conexión Exitosa con VPS (${data.latencyMs || duration} ms)<br>Host: ${data.targetHost}<br>Estado n8n: ${data.n8nStatus}`;
        } else {
          elements.testResultBox.className = 'test-result error';
          elements.testResultBox.innerHTML = `✗ Error de respuesta: ${data.error || 'No responde'}`;
        }
      } catch (e) {
        elements.testResultBox.className = 'test-result error';
        elements.testResultBox.textContent = `✗ Error de red local: ${e.message}`;
      }
    });
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
