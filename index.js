const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { loadGroupData, handleCommands, welcomeNew } = require('./bot');
const pino = require('pino');

async function startBot() {
    // تحميل بيانات الجروبات المخزنة مسبقاً
    await loadGroupData();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // تعطيل QR لاستخدام كود الارتباط برقم الهاتف
        logger: pino({ level: 'silent' }) // لإخفاء سجلات البايلز المزعجة في الشاشة
    });

    // طلب كود الربط للرقم المخصص
    if (!sock.authState.creds.registered) {
        const phoneNumber = "249900891702"; // الرقم المحدد
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                // تنسيق الكود بالشكل المطلوب (مثلاً: 5H5K-1S4W)
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n========================================`);
                console.log(`🔐 كود الربط الخاص بك هو: ${code}`);
                console.log(`========================================\n`);
            } catch (error) {
                console.error("حدث خطأ أثناء طلب كود الربط:", error);
            }
        }, 4000);
    }

    sock.ev.on('creds.update', saveCreds);

    // استقبال الرسائل ومعالجة الأوامر
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleCommands(sock, msg);
    });

    // استقبال تحديثات أعضاء المجموعات (للترحيب)
    sock.ev.on('group-participants.update', async (update) => {
        await welcomeNew(sock, update);
    });

    // مراقبة حالة الاتصال وإعادة المحاولة عند الانقطاع
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وحسابك جاهز للعمل!');
        }
    });
}

startBot();
