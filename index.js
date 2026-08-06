const http = require('http');

// --- خادم ويب وهمي لمنع منصة Render من إيقاف البوت ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is active and running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Server is running on port ${PORT}`);
});

// --- كود بوت الواتساب ---
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

// --- قائمة الكلمات المسيئة للطرد التلقائي ---
const badWords = [
    'كلب', 'حمار', 'قحبة', 'وسخ', 'حقير', 'سافل', 'منيوك', 'عرص', 
    'خرا', 'زفت', 'قليل الأدب', 'احا', 'عاهرة', 'شرموطة', 'كلب ابن كلب',
    'متناك', 'ينعن', 'يزق', 'قحب', 'ابن الكلب', 'قواد'
];

// --- معالجة الأوامر والرسائل ---
async function handleCommands(sock, msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || from;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const textLower = text.toLowerCase();
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!isGroup) return;

    saveMessage(from, sender);

    let groupMetadata;
    try {
        groupMetadata = await sock.groupMetadata(from);
    } catch (e) {
        return;
    }

    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
    
    // فحص أدمن البوت بطريقة دقيقة وصحيحة
    const botJid = sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id;
    const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid || p.id === sock.user.id)?.admin;

    // --- نظام فلترة الشتائم والطرد التلقائي ---
    const hasBadWord = badWords.some(word => textLower.includes(word));
    if (hasBadWord && !isAdmin) {
        if (isBotAdmin) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], 'remove');
                await sock.sendMessage(from, { text: `🚫 تم طرد @${sender.id ? sender.id.split('@')[0] : sender.split('@')[0]} بسبب استخدام ألفاظ نابية!`, mentions: [sender] });
            } catch (err) {
                console.error("فشل في الطرد التلقائي:", err);
            }
        }
        return;
    }

    if (textLower === 'قائمة') {
        await sock.sendMessage(from, { text: `📜 القائمة:\n\nبوت - فحص\nالسلام عليكم - رد تلقائي\nترحيب تفعيل / تعطيل\nطرد @\nمعلومات @\nرسائلي\nالمجموعة\nمنشن\n\n🛡️ (ملاحظة: البوت يطرد تلقائياً من يشتم)` });
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

    if (textLower === 'ترحيب تفعيل') {
        if (!isAdmin) return;
        if (!groupData[from]) groupData[from] = { messages: {}, welcome: false };
        groupData[from].welcome = true;
        saveDB();
        await sock.sendMessage(from, { text: '✅ تم تفعيل الترحيب بالأعضاء الجدد' });
        return;
    }
    if (textLower === 'ترحيب تعطيل') {
        if (!isAdmin) return;
        if (groupData[from]) groupData[from].welcome = false;
        saveDB();
        await sock.sendMessage(from, { text: '❌ تم تعطيل الترحيب' });
        return;
    }
    if (textLower.startsWith('طرد')) {
        if (!isAdmin) return;
        if (!isBotAdmin) return sock.sendMessage(from, { text: '❌ البوت يجب أن يكون مشرفاً (أدمن) لكي أستطيع طرد الأعضاء!' });
        const target = mentioned[0] || quoted;
        if (!target) return sock.sendMessage(from, { text: '⚠️ قم بمنشن الشخص المراد طرده هكذا: طرد @شخص' });
        
        try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            await sock.sendMessage(from, { text: `✅ تم طرد @${target.split('@')[0]}`, mentions: [target] });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ حدث خطأ أثناء محاولة الطرد، تأكد أن البوت مشرف.' });
        }
        return;
    }
    if (textLower.startsWith('معلومات')) {
        const target = mentioned[0] || quoted || sender;
        let pfp;
        try { pfp = await sock.profilePictureUrl(target, 'image'); } catch { pfp = null; }
        const count = groupData[from]?.messages?.[target] || 0;
        const cap = `👤 معلومات العضو:\nالرقم: @${target.split('@')[0]}\nالرسائل المرسلة: ${count}`;
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
            await sock.sendMessage(from, { text: `📊 عدد رسائلك في هذه المجموعة: ${c}` });
        }
        if (textLower === 'المجموعة') {
            await sock.sendMessage(from, { text: `📌 اسم المجموعة: ${groupMetadata.subject}\n👥 عدد الأعضاء: ${groupMetadata.participants.length}` });
        }
        if (['منشن', 'الجميع'].includes(textLower)) {
            if (!isAdmin) return;
            const all = groupMetadata.participants.map(p => p.id);
            await sock.sendMessage(from, { text: '📢 منشن جماعي للأعضاء:', mentions: all });
        }
        return;
    }
}

// --- الترحيب بالأعضاء الجدد ---
async function welcomeNew(sock, update) {
    try {
        const { id, participants, action } = update;
        if (action !== 'add') return;
        
        // التحقق من تفعيل الترحيب في قاعدة البيانات لهذا القروب
        if (!groupData[id] || groupData[id].welcome !== true) return;
        
        for (let user of participants) {
            await sock.sendMessage(id, { text: `هلا وغلآ بـ @${user.split('@')[0]} 🌸 نورت المجموعة!`, mentions: [user] });
        }
    } catch (err) {
        console.error("خطأ في حدث الترحيب:", err);
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
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            await handleCommands(sock, msg);
        } catch (e) {
            console.error("خطأ في معالجة الرسائل:", e);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        await welcomeNew(sock, update);
    });

    let hasRequestedPairing = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`⚠️ انقطع الاتصال بسبب: ${lastDisconnect?.error?.message || 'غير معروف'} (رمز الخطأ: ${statusCode})`);
            
            if (shouldReconnect) {
                setTimeout(() => {
                    startBot();
                }, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وحسابك جاهز للعمل!');
        }

        if (!sock.authState.creds.registered && !hasRequestedPairing) {
            hasRequestedPairing = true;
            
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
                    console.error("حدث خطأ أثناء طلب كود الربط:", error.message || error);
                    hasRequestedPairing = false;
                }
            }, 5000);
        }
    });
}

startBot();
