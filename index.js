global.crypto = require('crypto');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// --- نظام قاعدة البيانات المحلي ---
let groupData = {};
const DB_FILE = './groupDB.json';

async function loadGroupData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            groupData = JSON.parse(fs.readFileSync(DB_FILE));
        }
    } catch {}
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(groupData, null, 2));
}

function saveMessage(g, s) {
    if (!groupData[g]) groupData[g] = { messages: {}, welcome: false };
    if (!groupData[g].messages[s]) groupData[g].messages[s] = 0;
    groupData[g].messages[s]++;
    saveDB();
}

// --- معالجة الأوامر ---
async function handleCommands(sock, msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || from;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const textLower = text.toLowerCase();
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (isGroup) saveMessage(from, sender);

    if (textLower === 'قائمة') {
        await sock.sendMessage(from, { text: `📜 القائمة:\n\nبوت - فحص\nالسلام عليكم - رد تلقائي\nترحيب تفعيل / تعطيل\nطرد @\nمعلومات @\nرسائلي\nالمجموعة\nمنشن` });
        return;
    }
    if (textLower === 'بوت') {
        await sock.sendMessage(from, { text: `هلا انا شغال 🤖 @${sender.split('@')[0]}`, mentions: [sender] });
        return;
    }
    if (['السلام عليكم', 'سلام', 'هلا'].includes(textLower)) {
        await sock.sendMessage(from, { text: `وعليكم السلام @${sender.split('@')[0]} ❤️`, mentions: [sender] });
        return;
    }

    if (!isGroup) return;

    let groupMetadata = await sock.groupMetadata(from);
    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = groupMetadata.participants.find(p => p.id === sock.user.id)?.admin;

    if (textLower === 'ترحيب تفعيل') {
        if (!isAdmin) return;
        if (!groupData[from]) groupData[from] = { messages: {}, welcome: false };
        groupData[from].welcome = true;
        saveDB();
        await sock.sendMessage(from, { text: '✅ تم تفعيل الترحيب' });
        return;
    }
    if (textLower === 'ترحيب تعطيل') {
        if (groupData[from]) groupData[from].welcome = false;
        saveDB();
        await sock.sendMessage(from, { text: '❌ تم تعطيل الترحيب' });
        return;
    }
    if (textLower.startsWith('طرد')) {
        if (!isAdmin) return;
        if (!isBotAdmin) return sock.sendMessage(from, { text: 'البوت لازم ادمن' });
        const target = mentioned[0] || quoted;
        if (!target) return sock.sendMessage(from, { text: 'طرد @شخص' });
        await sock.groupParticipantsUpdate(from, [target], 'remove');
        await sock.sendMessage(from, { text: `تم طرد @${target.split('@')[0]}`, mentions: [target] });
        return;
    }
    if (textLower.startsWith('معلومات')) {
        const target = mentioned[0] || quoted || sender;
        let pfp;
        try { pfp = await sock.profilePictureUrl(target, 'image'); } catch { pfp = null; }
        const count = groupData[from]?.messages?.[target] || 0;
        const cap = `👤 معلومات\nالرقم: @${target.split('@')[0]}\nالرسائل: ${count}`;
        if (pfp) {
            await sock.sendMessage(from, { image: { url: pfp }, caption: cap, mentions: [target] });
        } else {
            await sock.sendMessage(from, { text: cap, mentions: [target] });
        }
        return;
    }
    if (['رسائلي', 'المجموعة', 'منشن', 'الجميع'].includes(textLower)) {
        if (textLower === 'رسائلي') {
            const c = groupData[from]?.messages?.[sender] || 1;
            await sock.sendMessage(from, { text: `رسائلك: ${c}` });
        }
        if (textLower === 'المجموعة') {
            await sock.sendMessage(from, { text: `الاسم: ${groupMetadata.subject}\nالاعضاء: ${groupMetadata.participants.length}` });
        }
        if (['منشن', 'الجميع'].includes(textLower)) {
            if (!isAdmin) return;
            const all = groupMetadata.participants.map(p => p.id);
            await sock.sendMessage(from, { text: 'منشن للجميع', mentions: all });
        }
        return;
    }
}

// --- الترحيب بالأعضاء الجدد ---
async function welcomeNew(sock, update) {
    const { id, participants, action } = update;
    if (action !== 'add') return;
    if (!groupData[id]?.welcome) return;
    for (let user of participants) {
        await sock.sendMessage(id, { text: `هلا @${user.split('@')[0]} نورت`, mentions: [user] });
    }
}

// --- تشغيل البوت والربط برقم الهاتف ---
async function startBot() {
    await loadGroupData();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleCommands(sock, msg);
    });

    sock.ev.on('group-participants.update', async (update) => {
        await welcomeNew(sock, update);
    });

    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وحسابك جاهز للعمل!');
            pairingRequested = true; // منع طلب الكود نهائياً إذا تم الاتصال بنجاح
        }

        // طلب كود الربط مرة واحدة فقط بشكل آمن ومستقل عن تحديثات الحالة المتكررة
        if (!sock.authState.creds.registered && !pairingRequested) {
            pairingRequested = true;
            setTimeout(async () => {
                try {
                    const phoneNumber = "249900891702";
                    console.log("⏳ جاري طلب كود الربط من واتساب...");
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(`\n========================================`);
                    console.log(`🔐 كود الربط الخاص بك هو: ${code}`);
                    console.log(`========================================\n`);
                } catch (error) {
                    console.error("حدث خطأ أثناء طلب كود الربط:", error);
                    // إعادة ضبط المتغير للسماح بإعادة المحاولة حصرياً في حال فشل الطلب الأول خطأ اتصال
                    pairingRequested = false; 
                }
            }, 4000);
        }
    });
}

startBot();
