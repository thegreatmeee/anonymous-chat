/* ============================================================
   ChatSphere — Anonymous Global Chat
   ============================================================ */

/* ---------- 🔑 PASTE YOUR FIREBASE CONFIG HERE ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBydGt9IMcf7OOgl7GZZ9Zo26esNZKlBGU",
  authDomain: "anonymous-chat-5c18c.firebaseapp.com",
  databaseURL: "https://anonymous-chat-5c18c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anonymous-chat-5c18c",
  storageBucket: "anonymous-chat-5c18c.firebasestorage.app",
  messagingSenderId: "147858771968",
  appId: ""1:147858771968:web:4b315cf05e4d15343448e5""
};
/* -------------------------------------------------------- */

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---------- STATE ---------- */
const state = {
  userId: null,
  username: null,
  room: null,
  messagesRef: null,
  presenceRef: null,
  typingRef: null,
  typingTimeout: null,
  lastSendTime: 0,
  theme: localStorage.getItem('theme') || 'dark'
};

/* ---------- ANONYMOUS USERNAME GENERATOR ---------- */
const adjectives = ['Silent','Mystic','Cosmic','Lucky','Swift','Brave','Clever','Wild','Happy','Chill','Noble','Quick','Bright','Cool','Gentle','Bold','Witty','Calm','Kind','Zen'];
const animals = ['Fox','Wolf','Owl','Panda','Tiger','Eagle','Lion','Bear','Hawk','Raven','Otter','Lynx','Falcon','Dragon','Phoenix','Shark','Dolphin','Koala','Jaguar','Lemur'];

function generateUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const ani = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${ani}${num}`;
}

function generateUserId() {
  return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ---------- ROOMS ---------- */
const ROOMS = {
  global: { name: '🌍 Global', emoji: '🌍' },
  chill:  { name: '☕ Chill',  emoji: '☕' },
  gaming: { name: '🎮 Gaming', emoji: '🎮' },
  music:  { name: '🎵 Music',  emoji: '🎵' },
  tech:   { name: '💻 Tech',   emoji: '💻' },
  random: { name: '🎲 Random', emoji: '🎲' }
};

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';

  // Generate anonymous identity (stored in sessionStorage so each tab is a "new person")
  state.userId = sessionStorage.getItem('userId') || generateUserId();
  state.username = sessionStorage.getItem('username') || generateUsername();
  sessionStorage.setItem('userId', state.userId);
  sessionStorage.setItem('username', state.username);

  setupJoinScreen();
  setupChatScreen();
});

/* ---------- JOIN SCREEN ---------- */
function setupJoinScreen() {
  const grid = document.getElementById('roomGrid');
  const joinBtn = document.getElementById('joinBtn');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.room-btn');
    if (!btn) return;
    grid.querySelectorAll('.room-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.room = btn.dataset.room;
    joinBtn.disabled = false;
  });

  joinBtn.addEventListener('click', () => {
    if (!state.room) return;
    enterRoom(state.room);
  });
}

/* ---------- ENTER ROOM ---------- */
function enterRoom(roomKey) {
  state.room = roomKey;
  document.getElementById('roomTitle').textContent = ROOMS[roomKey].name;
  document.getElementById('myName').textContent = `You: ${state.username}`;

  document.getElementById('joinScreen').classList.remove('active');
  document.getElementById('chatScreen').classList.add('active');

  attachListeners();
  setupPresence();
  setupTyping();

  // Focus input
  setTimeout(() => document.getElementById('msgInput').focus(), 100);
}

/* ---------- LEAVE ROOM ---------- */
function leaveRoom() {
  if (state.messagesRef) state.messagesRef.off();
  if (state.presenceRef) {
    state.presenceRef.onDisconnect().cancel();
    state.presenceRef.remove();
  }
  if (state.typingRef) {
    state.typingRef.onDisconnect().cancel();
    state.typingRef.remove();
  }
  state.room = null;
  document.getElementById('messages').innerHTML = '';
  document.getElementById('chatScreen').classList.remove('active');
  document.getElementById('joinScreen').classList.add('active');
}

/* ---------- CHAT SCREEN ---------- */
function setupChatScreen() {
  document.getElementById('backBtn').addEventListener('click', leaveRoom);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  const input = document.getElementById('msgInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener('input', () => {
    autoResize(input);
    triggerTyping();
  });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', state.theme);
}

/* ---------- MESSAGES ---------- */
function attachListeners() {
  const messagesEl = document.getElementById('messages');
  messagesEl.innerHTML = '<div class="msg system">Connecting to room...</div>';

  state.messagesRef = db.ref(`rooms/${state.room}/messages`);

  // Load last 100 messages
  state.messagesRef.orderByKey().limitToLast(100).on('child_added', (snap) => {
    const msg = snap.val();
    if (!msg) return;
    // Remove "Connecting..." placeholder
    const placeholder = messagesEl.querySelector('.msg.system');
    if (placeholder && placeholder.textContent.includes('Connecting')) placeholder.remove();
    renderMessage(msg);
    scrollToBottom();
  });

  // Online count
  db.ref(`rooms/${state.room}/presence`).on('value', (snap) => {
    const count = snap.numChildren();
    document.getElementById('onlineCount').textContent = count;
  });
}

function renderMessage(msg) {
  const messagesEl = document.getElementById('messages');
  const div = document.createElement('div');
  const isMine = msg.userId === state.userId;
  div.className = `msg ${isMine ? 'mine' : 'other'}`;

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const safeText = escapeHtml(msg.text);

  div.innerHTML = `
    ${!isMine ? `<div class="author">${escapeHtml(msg.username)}</div>` : ''}
    <div class="text">${safeText}</div>
    <div class="time">${time}</div>
  `;
  messagesEl.appendChild(div);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

/* ---------- SEND MESSAGE ---------- */
function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !state.room) return;

  // Rate limit: 1 msg per second
  const now = Date.now();
  if (now - state.lastSendTime < 1000) {
    alert('Please wait a moment before sending another message.');
    return;
  }
  state.lastSendTime = now;

  // Basic filter (optional)
  if (text.length > 500) {
    alert('Message too long (max 500 chars).');
    return;
  }

  const newMsg = {
    userId: state.userId,
    username: state.username,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  state.messagesRef.push(newMsg).catch(err => {
    console.error(err);
    alert('Failed to send message.');
  });

  input.value = '';
  autoResize(input);
  clearTyping();
}

/* ---------- PRESENCE (online count) ---------- */
function setupPresence() {
  const myPresenceRef = db.ref(`rooms/${state.room}/presence/${state.userId}`);
  state.presenceRef = myPresenceRef;

  // Set presence on connect
  const connectedRef = db.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    if (snap.val() === true && state.room) {
      myPresenceRef.set({
        username: state.username,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
      });
      myPresenceRef.onDisconnect().remove();

      // Add system join message (throttled)
      const joinMsgRef = db.ref(`rooms/${state.room}/messages`).push();
      joinMsgRef.set({
        userId: 'system',
        username: 'System',
        text: `${state.username} joined the room`,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        system: true
      });
    }
  });
}

/* ---------- TYPING INDICATOR ---------- */
function setupTyping() {
  state.typingRef = db.ref(`rooms/${state.room}/typing/${state.userId}`);

  // Listen to others typing
  db.ref(`rooms/${state.room}/typing`).on('value', (snap) => {
    const indicator = document.getElementById('typingIndicator');
    let count = 0;
    snap.forEach(child => {
      if (child.key !== state.userId) count++;
    });
    if (count > 0) {
      indicator.classList.remove('hidden');
      indicator.querySelector('span').textContent =
        count === 1 ? 'Someone is typing' : `${count} people are typing`;
    } else {
      indicator.classList.add('hidden');
    }
  });
}

function triggerTyping() {
  if (!state.typingRef) return;
  state.typingRef.set(firebase.database.ServerValue.TIMESTAMP);
  state.typingRef.onDisconnect().remove();

  clearTimeout(state.typingTimeout);
  state.typingTimeout = setTimeout(clearTyping, 3000);
}

function clearTyping() {
  if (state.typingRef) state.typingRef.remove();
  clearTimeout(state.typingTimeout);
}
