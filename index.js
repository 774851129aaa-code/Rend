// --- كود الحماية لمنع توقف البوت عند حدوث أخطاء ---
process.on("uncaughtException", (err) => console.error("Caught exception: " + err));
process.on("unhandledRejection", (reason, promise) => console.error("Unhandled Rejection at:", promise, "reason:", reason));

// --- كود الخادم لضمان عدم خمول البوت على Render ---
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <html dir="rtl">
        <body style="text-align:center; margin-top:100px; font-family: Tahoma;">
            <h2>🤖 AN GPT WhatsApp Bot is Running!</h2>
            <p>البوت يعمل بنجاح ومحمي ضد السبام وتسريب الذاكرة وتكاليف الـ Tokens الزائدة.</p>
        </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// --- الكود الأساسي للبوت ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');

// --- (1) تهيئة قاعدة البيانات والملفات والجلسات ---
const DB_FILE = './bankDB.json';
let globalData = { bank: {}, companies: {}, stockMarket: {}, activity: {}, lastReset: Date.now() };

// لحفظ الألعاب الشغالة حالياً لكل شات (تسمح بأكثر من لعبة في نفس الوقت)
const activeGames = {};

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            globalData = JSON.parse(fs.readFileSync(DB_FILE));
        }
    } catch (e) {
        console.error("خطأ في تحميل قاعدة البيانات:", e);
    }
    if (!globalData.bank) globalData.bank = {};
    if (!globalData.companies) globalData.companies = {};
    if (!globalData.stockMarket) globalData.stockMarket = { price: 100, trend: "استقرار ⚖️" };
    if (!globalData.activity) globalData.activity = {};
    if (!globalData.lastReset) globalData.lastReset = Date.now();
    
    // التأكد من وجود الخصائص الجديدة للشركات القديمة
    for (let compName in globalData.companies) {
        if (!globalData.companies[compName].investors) {
            globalData.companies[compName].investors = {};
        }
        if (globalData.companies[compName].level === undefined) {
            globalData.companies[compName].level = 1;
        }
        if (globalData.companies[compName].isInsured === undefined) {
            globalData.companies[compName].isInsured = false;
        }
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(globalData, null, 2));
}

// --- (2) بنك الأسئلة للألعاب ---
const GAMES_BANK = {
    دمج: [
        { q: "م د ر س ة", a: "مدرسة", reward: 400 },
        { q: "ح ا س ب", a: "حاسب", reward: 350 },
        { q: "ب ر م ج ة", a: "برمجة", reward: 500 },
        { q: "أ م ن س ي ب ر ا ن ي", a: "أمن سيبراني", reward: 800 },
        { q: "ش ط ر ن ج", a: "شطرنج", reward: 450 },
        { q: "ع ض ل ا ت", a: "عضلات", reward: 400 },
        { q: "ك م ب ي و ت ر", a: "كمبيوتر", reward: 600 },
        { q: "خ و ا ر ز م ي ة", a: "خوارزمية", reward: 700 },
        { q: "ذ ك ا ء ا ص ط ن ا ع ي", a: "ذكاء اصطناعي", reward: 900 },
        { q: "س ي ا ر ة", a: "سيارة", reward: 300 },
        { q: "ع د ن", a: "عدن", reward: 350 },
        { q: "ط ا ئ ر ة", a: "طائرة", reward: 400 },
        { q: "ا ن ت ر ن ت", a: "انترنت", reward: 500 },
        { q: "ك ر ة ق د م", a: "كرة قدم", reward: 500 },
        { q: "ج ا م ع ة", a: "جامعة", reward: 450 },
        { q: "م س ت ش ف ى", a: "مستشفى", reward: 550 },
        { q: "م ه ن د س", a: "مهندس", reward: 400 },
        { q: "ح م ا ي ة", a: "حماية", reward: 350 },
        { q: "ب ر و ت ي ن", a: "بروتين", reward: 500 },
        { q: "ا خ ت ب ا ر", a: "اختبار", reward: 450 },
        { q: "ت ل ي ج ر ا م", a: "تليجرام", reward: 400 },
        { q: "س ي ر ف ر", a: "سيرفر", reward: 450 },
        { q: "ب و ت", a: "بوت", reward: 250 },
        { q: "ه ا ك ر", a: "هاكر", reward: 500 },
        { q: "ف ل س ط ي ن", a: "فلسطين", reward: 600 },
        { q: "م ل ع ب", a: "ملعب", reward: 300 },
        { q: "ت ش ف ي ر", a: "تشفير", reward: 550 },
        { q: "ك ي ب و ر د", a: "كيبورد", reward: 400 },
        { q: "ش ا ش ة", a: "شاشة", reward: 350 },
        { q: "ا ل ي م ن", a: "اليمن", reward: 400 },
        { q: "ب ح ر", a: "بحر", reward: 200 },
        { q: "س م ك ة", a: "سمكة", reward: 250 },
        { q: "ت ن ي ن", a: "تنين", reward: 350 },
        { q: "م ك ت ب ة", a: "مكتبة", reward: 400 },
        { q: "س ك ر ي ب ت", a: "سكريبت", reward: 500 },
        { q: "ص ح ر ا ء", a: "صحراء", reward: 300 },
        { q: "ق ه و ة", a: "قهوة", reward: 300 },
        { q: "ك ا م ي ر ا", a: "كاميرا", reward: 400 },
        { q: "ط ب ي ب", a: "طبيب", reward: 350 },
        { q: "ا س ت ث م ا ر", a: "استثمار", reward: 600 },
        { q: "ع ب ق ر ي", a: "عبقري", reward: 450 },
        { q: "ن ج ا ح", a: "نجاح", reward: 300 },
        { q: "س ي ف", a: "سيف", reward: 250 },
        { q: "ا ن د ر و ي د", a: "اندرويد", reward: 450 },
        { q: "ا ي ف و ن", a: "ايفون", reward: 400 },
        { q: "ب ل ا ي س ت ي ش ن", a: "بلايستيشن", reward: 700 },
        { q: "ت ك ن و ل و ج ي ا", a: "تكنولوجيا", reward: 650 },
        { q: "د ف ا ع ص ق ل ي", a: "دفاع صقلي", reward: 750 },
        { q: "ج د ا ر ح م ا ي ة", a: "جدار حماية", reward: 700 },
        { q: "ك ش م ل ك", a: "كش ملك", reward: 500 },
        { q: "ت م ر ي ن ص د ر", a: "تمرين صدر", reward: 600 },
        { q: "م ي ك ا ن ي ك ا", a: "ميكانيكا", reward: 650 },
        { q: "ا ق ت ص ا د", a: "اقتصاد", reward: 550 },
        { q: "ق ا ن و ن", a: "قانون", reward: 450 },
        { q: "ف ي ز ي ا ء", a: "فيزياء", reward: 500 },
        { q: "م ق ا و م ة", a: "مقاومة", reward: 550 },
        { q: "ك ر ي س ت ي ا ن و", a: "كريستيانو", reward: 700 },
        { q: "ر ي ا ل م د ر ي د", a: "ريال مدريد", reward: 650 },
        { q: "ب ر ش ل و ن ة", a: "برشلونة", reward: 600 },
        { q: "ا ل م ح ي ط", a: "المحيط", reward: 450 },
        { q: "د ي ن ا ص و ر", a: "ديناصور", reward: 550 },
        { q: "م ي ك ر و ف و ن", a: "ميكروفون", reward: 600 },
        { q: "ب ل و ت و ث", a: "بلوتوث", reward: 500 },
        { q: "ا س ت ر ا ت ي ج ي ة", a: "استراتيجية", reward: 900 },
        { q: "ب ي ا د ق", a: "بيادق", reward: 400 },
        { q: "م ك م ل ا ت", a: "مكملات", reward: 500 },
        { q: "س ع ر ا ت", a: "سعرات", reward: 450 },
        { q: "ا خ ت ر ا ق", a: "اختراق", reward: 500 },
        { q: "ش ب ك ا ت", a: "شبكات", reward: 450 },
        { q: "م س ت ق ب ل", a: "مستقبل", reward: 550 },
        { q: "ت ط و ي ر", a: "تطوير", reward: 450 },
        { q: "ك و د م ص د ر ي", a: "كود مصدري", reward: 750 },
        { q: "ن و د ج ي اس", a: "نود جي اس", reward: 650 },
        { q: "خ ا د م", a: "خادم", reward: 350 },
        { q: "ق ا ع د ة ب ي ا ن ا ت", a: "قاعدة بيانات", reward: 850 }
    ],
    فكك: [
        { q: "العلم نور والمستقبل", a: "ا ل ع ل م ن و ر و ا ل م س ت ق ب ل", reward: 600 },
        { q: "القراءة تغذي العقل", a: "ا ل ق ر ا ء ة ت غ ذ ي ا ل ع ق ل", reward: 600 },
        { q: "الرياضة تقوي الجسم", a: "ا ل ر ي ا ض ة ت ق و ي ا ل ج س م", reward: 600 },
        { q: "الصبر مفتاح الفرج", a: "ا ل ص ب ر م ف ت ا ح ا ل ف ر ج", reward: 600 },
        { q: "العقل السليم أمانة", a: "ا ل ع ق ل ا ل س ل ي م أ م ا ن ة", reward: 600 },
        { q: "الكلمة الطيبة صدقة", a: "ا ل ك ل م ة ا ل ط ي ب ة ص د ق ة", reward: 600 },
        { q: "التعلم أساس النجاح", a: "ا ل ت ع ل م أ س ا س ا ل ن ج ا ح", reward: 600 },
        { q: "العمل عبادة وإتقان", a: "ا ل ع م ل ع ب ا د ة و إ ت ق ا ن", reward: 600 },
        { q: "الصدق ينجي دائما", a: "ا ل ص د ق ي ن ج ي د ا ئ م ا", reward: 600 },
        { q: "الأمل يضيء الحياة", a: "ا ل أ م ل ي ض ي ء ا ل ح ي ا ة", reward: 600 },
        { q: "الوقت ثروة غالية", a: "ا ل و ق ت ث ر و ة غ ا ل ي ة", reward: 600 },
        { q: "الجد يصنع المعجزات", a: "ا ل ج د ي ص ن ع ا ل م ع ج ز ا ت", reward: 600 },
        { q: "الوفاء خصلة حميدة", a: "ا ل و ف ا ء خ ص ل ة ح م ي د ة", reward: 600 },
        { q: "الإيمان يبعث الطمأنينة", a: "ا ل إ ي م ا ن ي ب ع ث ا ل ط م أ ن ي ن ة", reward: 600 },
        { q: "الشجاعة صفة الفرسان", a: "ا ل ش ج ا ع ة ص ف ة ا ل ف ر س ا ن", reward: 600 },
        { q: "التواضع يرفع القدر", a: "ا ل ت و ا ض ع ي ر ف ع ا ل ق د ر", reward: 600 },
        { q: "الحكمة ضالة المؤمن", a: "ا ل ح ك م ة ض ا ل ة ا ل م ؤ م ن", reward: 600 },
        { q: "الأخلاق عنوان الشعوب", a: "ا ل أ خ ل ا ق ع ن و ا ن ا ل ش ع و ب", reward: 600 },
        { q: "الابتسامة تجلب المحبة", a: "ا ل ا ب ت س ا م ة ت ج ل ب ا ل م ح ب ة", reward: 600 },
        { q: "النظام يختصر الوقت", a: "ا ل ن ظ ا م ي خ ت ص ر ا ل و ق ت", reward: 600 },
        { q: "التعاون يثمر النجاح", a: "ا ل ت ع ا و ن ي ث م ر ا ل ن ج ا ح", reward: 600 },
        { q: "الإصرار يهزم الصعاب", a: "ا ل إ ص ر ا ر ي ه ز م ا ل ص ع ا ب", reward: 600 },
        { q: "الكرم يطيب النفوس", a: "ا ل ك ر م ي ط ي ب ا ل ن ف و س", reward: 600 },
        { q: "الأمانة تاج الأخلاق", a: "ا ل أ م ا ن ة ت ا ج ا ل أ خ ل ا ق", reward: 600 },
        { q: "القناعة كنز لايفنى", a: "ا ل ق ن ا ع ة ك ن ز ل ا ي ف ن ى", reward: 600 },
        { q: "التأني يجلب السلامة", a: "ا ل ت أ ن ي ي ج ل ب ا ل س ل ا م ة", reward: 600 },
        { q: "الحلم يطفئ الغضب", a: "ا ل ح ل م ي ط ف ئ ا ل غ ض ب", reward: 600 },
        { q: "العزيمة تكسر المستحيل", a: "ا ل ع ز ي م ة ت ك س ر ا ل م س ت ح ي ل", reward: 600 },
        { q: "العدل أساس الملك", a: "ا ل ع د ل أ س ا س ا ل م ل ك", reward: 600 },
        { q: "النصيحة أغلى هدية", a: "ا ل ن ص ي ح ة أ غ ل ى ه د ي ة", reward: 600 },
        { q: "المعرفة قوة عظيمة", a: "ا ل م ع ر ف ة ق و ة ع ظ ي م ة", reward: 600 },
        { q: "الاحترام يبني الجسور", a: "ا ل ا ح ت ر ا م ي ب ن ي ا ل ج س و ر", reward: 600 },
        { q: "الهدوء يمنح التفكير", a: "ا ل ه د و ء ي م ن ح ا ل ت ف ك ي ر", reward: 600 },
        { q: "الصداقة زهرة الحياة", a: "ا ل ص د ا ق ة ز ه ر ة ا ل ح ي ا ة", reward: 600 },
        { q: "النشاط يطرد الخمول", a: "ا ل ن ش ا ط ي ط ر د ا ل خ م و ل", reward: 600 },
        { q: "الصدق ركيزة الثقة", a: "ا ل ص د ق ر ك ي ز ة ا ل ث ق ة", reward: 600 },
        { q: "العفو عند المقدرة", a: "ا ل ع ف و ع ن د ا ل م ق د ر ة", reward: 600 },
        { q: "الطمأنينة في الذكر", a: "ا ل ط م أ ن ي ن ة ف ي ا ل ذ ك ر", reward: 600 },
        { q: "النجاح يبدأ برؤية", a: "ا ل ن ج ا ح ي ب د أ ب ر ؤ ي ة", reward: 600 },
        { q: "الطموح يرفع الإنسان", a: "ا ل ط م و ح ي ر ف ع ا ل إ ن س ا ن", reward: 600 },
        { q: "الحق يعلو دائما", a: "ا ل ح ق ي ع ل و د ا ئ م ا", reward: 600 },
        { q: "الصحة أغلى ثروة", a: "ا ل ص ح ة أ غ ل ى ث ر و ة", reward: 600 },
        { q: "الأخوة رباط وثيق", a: "ا ل أ خ و ة ر ب ا ط و ث ي ق", reward: 600 },
        { q: "الوفاء يرفع القيمة", a: "ا ل و ف ا ء ي ر ف ع ا ل ق ي م ة", reward: 600 },
        { q: "العطاء يثمر البسمة", a: "ا ل ع ط ا ء ي ث م ر ا ل ب س م ة", reward: 600 },
        { q: "الأمل ينير الظلام", a: "ا ل أ م ل ي ن ي ر ا ل ظ ل ا م", reward: 600 },
        { q: "الجهد يصنع الفارق", a: "ا ل ج ه د ي ص ن ع ا ل ف ا ر ق", reward: 600 },
        { q: "الشكر يديم النعم", a: "ا ل ش ك ر ي د ي م ا ل ن ع م", reward: 600 },
        { q: "التفاؤل يبعث الأمل", a: "ا ل ت ف ا ؤ ل ي ب ع ث ا ل أ م ل", reward: 600 },
        { q: "العقل يزن الأمور", a: "ا ل ع ق ل ي ز ن ا ل أ م و ر", reward: 600 },
        { q: "البداية تصنع النهاية", a: "ا ل ب د ا ي ة ت ص ن ع ا ل ن ه ا ي ة", reward: 600 },
        { q: "الخبرة تكسب المهارة", a: "ا ل خ ب ر ة ت ك س ب ا ل م ه ا ر ة", reward: 600 },
        { q: "الإتقان يضمن الجودة", a: "ا ل إ ت ق ا ن ي ض م ن ا ل ج و د ة", reward: 600 },
        { q: "الأدب يسحر العقول", a: "ا ل أ د ب ي س ح ر ا ل ع ق و ل", reward: 600 },
        { q: "السلام يجمع القلوب", a: "ا ل س ل ا م ي ج م ع ا ل ق ل و ب", reward: 600 },
        { q: "الكرامة لا تقدر", a: "ا ل ك ر ا م ة ل ا ت ق د ر", reward: 600 },
        { q: "المستقبل ينتظر المجتهد", a: "ا ل م س ت ق ب ل ي ن ت ظ ر ا ل م ج ت ه د", reward: 600 },
        { q: "الحب يحيي الأرواح", a: "ا ل ح ب ي ح ي ي ا ل أ ر و ا ح", reward: 600 },
        { q: "النقاء يزين النفس", a: "ا ل ن ق ا ء ي ز ي ن ا ل ن ف س", reward: 600 },
        { q: "الشغف يولد الإبداع", a: "ا ل ش غ ف ي و ل د ا ل إ ب د ا ع", reward: 600 },
        { q: "الفكر يرتقي بالأمم", a: "ا ل ف ك ر ي ر ت ق ي ب ا ل أ م م", reward: 600 },
        { q: "الحقيقة تظهر جلية", a: "ا ل ح ق ي ق ة ت ظ ه ر ج ل ي ة", reward: 600 },
        { q: "الإيمان يصنع الثبات", a: "ا ل إ ي م ا ن ي ص ن ع ا ل ث ب ا ت", reward: 600 },
        { q: "الرحمة تغمر القلوب", a: "ا ل ر ح م ة ت غ م ر ا ل ق ل و ب", reward: 600 },
        { q: "العدالة تحمي الجميع", a: "ا ل ع د ا ل ة ت ح م ي ا ل ج م ي ع", reward: 600 },
        { q: "الاستمرار يصنع النجاح", a: "ا ل ا س ت م ر ا ر ي ص ن ع ا ل ن ج ا ح", reward: 600 },
        { q: "الإخلاص يرفع الأعمال", a: "ا ل إ خ ل ا ص ي ر ف ع ا ل أ ع م ا ل", reward: 600 },
        { q: "الفهم يسبق التطبيق", a: "ا ل ف ه م ي س ب ق ا ل ت ط ب ي ق", reward: 600 },
        { q: "المعرفة تفتح الأبواب", a: "ا ل م ع ر ف ة ت ف ت ح ا ل أ ب و ا ب", reward: 600 },
        { q: "الكلمة تغير مسارات", a: "ا ل ك ل م ة ت غ ي ر م س ا ر ا ت", reward: 600 },
        { q: "الصمت أحيانا حكمة", a: "ا ل ص م ت أ ح ي ا ن ا ح ك م ة", reward: 600 },
        { q: "الحلم يحقق الذات", a: "ا ل ح ل م ي ح ق ق ا ل ذ ا ت", reward: 600 },
        { q: "الطيب يترك أثرا", a: "ا ل ط ي ب ي ت ر ك أ ث ر ا", reward: 600 },
        { q: "الإرادة تقهر الظروف", a: "ا ل إ ر ا د ة ت ق ه ر ا ل ظ ر و ف", reward: 600 },
        { q: "البساطة جمال الحاضر", a: "ا ل ب س ا ط ة ج م ا ل ا ل ح ا ض ر", reward: 600 },
        { q: "التركيز يمنح القوة", a: "ا ل ت ر ك ي ز ي م ن ح ا ل ق و ة", reward: 600 },
        { q: "الصبر ينير الطريق", a: "ا ل ص ب ر ي ن ي ر ا ل ط ر ي ق", reward: 600 },
        { q: "الشجاعة تفتح الآفاق", a: "ا ل ش ج ا ع ة ت ف ت ح ا ل آ ف ا ق", reward: 600 },
        { q: "الوفاء أصل الكرامة", a: "ا ل و ف ا ء أ ص ل ا ل ك ر ا م ة", reward: 600 },
        { q: "الابتكار يجدد الحياة", a: "ا ل ا ب ت ك ا ر ي ج د د ا ل ح ي ا ة", reward: 600 },
        { q: "التسامح يمحو الأحقاد", a: "ا ل ت س ا م ح ي م ح و ا ل أ ح ق ا د", reward: 600 },
        { q: "الوعي يحمي المجتمعات", a: "ا ل و ع ي ي ح م ي ا ل م ج ت م ع ا ت", reward: 600 },
        { q: "الإتقان يبني الحضارات", a: "ا ل إ ت ق ا ن ث ي ب ن ي ا ل ح ض ا ر ا ت", reward: 600 },
        { q: "الهدف يوجه الخطوات", a: "ا ل ه د ف ي و ج ه ا ل خ ط و ا ت", reward: 600 },
        { q: "الثبات يحقق الفوز", a: "ا ل ث ب ا ت ي ح ق ق ا ل ف و ز", reward: 600 },
        { q: "العزم يذلل الصعوبات", a: "ا ل ع ز م ي ذ ل ل ا ل ص ع و ب ا ت", reward: 600 },
        { q: "الحكمة ترشد العقول", a: "ا ل ح ك م ة ت ر ش د ا ل ع ق و ل", reward: 600 },
        { q: "الطموح يدفع للقمة", a: "ا ل ط م و ح ي د ف ع ل ل ق م ة", reward: 600 },
        { q: "الأمل شمس دافئة", a: "ا ل أ م ل ش م س د ا ف ئ ة", reward: 600 },
        { q: "العمل يثمر النجاحات", a: "ا ل ع م ل ي ث م ر ا ل ن ج ا ح ا ت", reward: 600 },
        { q: "الحقيقة تمنح الثقة", a: "ا ل ح ق ي ق ة ت م ن ح ا ل ث ق ة", reward: 600 },
        { q: "النبل يعلي المكانة", a: "ا ل ن ب ل ي ع ل ي ا ل م ك ا ن ة", reward: 600 },
        { q: "العطاء يضاعف الرزق", a: "ا ل ع ط ا ء ي ض ا ع ف ا ل ر ز ق", reward: 600 },
        { q: "الجهد يلغي الفشل", a: "ا ل ج ه د ي ل غ ي ا ل ف ش ل", reward: 600 },
        { q: "الإيمان يمنح الأمان", a: "ا ل إ ي م ا ن ي م ن ح ا ل أ م ا ن", reward: 600 },
        { q: "التعلم يستمر أبدًا", a: "ا ل ت ع ل م ي س ت م ر أ ب د ً ا", reward: 600 },
        { q: "التفكير يسبق القرار", a: "ا ل ت ف ك ي ر ي س ب ق ا ل ق ر ا ر", reward: 600 },
        { q: "الكلمة تبني البيوت", a: "ا ل ك ل م ة ت ب ن ي ا ل ب ي و ت", reward: 600 },
        { q: "الصحة تاج الأبدان", a: "ا ل ص ح ة ت ا ج ا ل أ ب د ا ن", reward: 600 },
        { q: "الخير ينعكس دائمًا", a: "ا ل خ ي ر ي ن ع ك س د ا ئ م ً ا", reward: 600 }
    ],
    سرعة: [
        { q: "اكتب بسرعة: صقر الجزيرة", a: "صقر الجزيرة", reward: 450 },
        { q: "اكتب بسرعة: تحدي الذكاء الاصطناعي", a: "تحدي الذكاء الاصطناعي", reward: 600 },
        { q: "اكتب بسرعة: بوت CR7 الأسطوري", a: "بوت cr7 الأسطوري", reward: 500 },
        { q: "اكتب بسرعة: الأمن السيبراني هو تخصص المستقبل", a: "الأمن السيبراني هو تخصص المستقبل", reward: 800 },
        { q: "اكتب بسرعة: الملك يحتاج حماية في الشطرنج", a: "الملك يحتاج حماية في الشطرنج", reward: 750 },
        { q: "اكتب بسرعة: تمرين الظهر والباي يقوي العضلات", a: "تمرين الظهر والباي يقوي العضلات", reward: 700 },
        { q: "اكتب بسرعة: من جد وجد ومن زرع حصد", a: "من جد وجد ومن زرع حصد", reward: 550 },
        { q: "اكتب بسرعة: القهوة سر النشاط والتركيز", a: "القهوة سر النشاط والتركيز", reward: 600 },
        { q: "اكتب بسرعة: سبحان الله وبحمده سبحان الله العظيم", a: "سبحان الله وبحمده سبحان الله العظيم", reward: 800 },
        { q: "اكتب بسرعة: لا إله إلا الله", a: "لا إله إلا الله", reward: 400 },
        { q: "اكتب بسرعة: البحر هادئ والموج عالي", a: "البحر هادئ والموج عالي", reward: 500 },
        { q: "اكتب بسرعة: أسرع لاعب في العالم", a: "أسرع لاعب في العالم", reward: 450 },
        { q: "اكتب بسرعة: الكتاب خير جليس في الزمان", a: "الكتاب خير جليس في الزمان", reward: 600 },
        { q: "اكتب بسرعة: الرياضيات لغة الكون الأساسية", a: "الرياضيات لغة الكون الأساسية", reward: 700 },
        { q: "اكتب بسرعة: العمل بذكاء أفضل من العمل بجهد", a: "العمل بذكاء أفضل من العمل بجهد", reward: 750 },
        { q: "اكتب بسرعة: تعلم البرمجة يفتح لك آفاق جديدة", a: "تعلم البرمجة يفتح لك آفاق جديدة", reward: 800 },
        { q: "اكتب بسرعة: الوقت كالسيف إن لم تقطعه قطعك", a: "الوقت كالسيف إن لم تقطعه قطعك", reward: 650 },
        { q: "اكتب بسرعة: العقل السليم في الجسم السليم", a: "العقل السليم في الجسم السليم", reward: 550 },
        { q: "اكتب بسرعة: تطوير الذات يبدأ بخطوة", a: "تطوير الذات يبدأ بخطوة", reward: 500 },
        { q: "اكتب بسرعة: البدايات دائما تكون صعبة", a: "البدايات دائما تكون صعبة", reward: 550 },
        { q: "اكتب بسرعة: من طلب العلا سهر الليالي", a: "من طلب العلا سهر الليالي", reward: 600 },
        { q: "اكتب بسرعة: العجلة من الشيطان", a: "العجلة من الشيطان", reward: 450 },
        { q: "اكتب بسرعة: ابتسم فالحياة جميلة", a: "ابتسم فالحياة جميلة", reward: 500 },
        { q: "اكتب بسرعة: لا تؤجل عمل اليوم إلى الغد", a: "لا تؤجل عمل اليوم إلى الغد", reward: 550 },
        { q: "اكتب بسرعة: خير الكلام ما قل ودل", a: "خير الكلام ما قل ودل", reward: 400 },
        { q: "اكتب بسرعة: الجار قبل الدار", a: "الجار قبل الدار", reward: 350 },
        { q: "اكتب بسرعة: الصبر مفتاح الفرج", a: "الصبر مفتاح الفرج", reward: 400 },
        { q: "اكتب بسرعة: الطيور على أشكالها تقع", a: "الطيور على أشكالها تقع", reward: 500 },
        { q: "اكتب بسرعة: في التأني السلامة وفي العجلة الندامة", a: "في التأني السلامة وفي العجلة الندامة", reward: 700 },
        { q: "اكتب بسرعة: كلما زادت المعرفة قل الكلام", a: "كلما زادت المعرفة قل الكلام", reward: 650 },
        { q: "اكتب بسرعة: لغة جافا سكريبت من أقوى اللغات", a: "لغة جافا سكريبت من أقوى اللغات", reward: 700 },
        { q: "اكتب بسرعة: البوت شغال بدون توقف", a: "البوت شغال بدون توقف", reward: 450 },
        { q: "اكتب بسرعة: سرعة البديهة تنقذك من المواقف", a: "سرعة البديهة تنقذك من المواقف", reward: 600 },
        { q: "اكتب بسرعة: السكوت علامة الرضا", a: "السكوت علامة الرضا", reward: 400 },
        { q: "اكتب بسرعة: درهم وقاية خير من قنطار علاج", a: "درهم وقاية خير من قنطار علاج", reward: 650 },
        { q: "اكتب بسرعة: الدفاع الصقلي من أقوى الافتتاحيات في الشطرنج", a: "الدفاع الصقلي من أقوى الافتتاحيات في الشطرنج", reward: 900 },
        { q: "اكتب بسرعة: حماية الشبكات من الاختراق مهمة جدا", a: "حماية الشبكات من الاختراق مهمة جدا", reward: 850 },
        { q: "اكتب بسرعة: الاستمرارية في التمرين تصنع الأبطال", a: "الاستمرارية في التمرين تصنع الأبطال", reward: 750 },
        { q: "اكتب بسرعة: عدن ثغر اليمن الباسم", a: "عدن ثغر اليمن الباسم", reward: 600 },
        { q: "اكتب بسرعة: الشجرة المثمرة ترمى بالحجارة", a: "الشجرة المثمرة ترمى بالحجارة", reward: 650 },
        { q: "اكتب بسرعة: من يزرع الريح يحصد العاصفة", a: "من يزرع الريح يحصد العاصفة", reward: 700 },
        { q: "اكتب بسرعة: العلم يبني بيوتا لا عماد لها", a: "العلم يبني بيوتا لا عماد لها", reward: 750 },
        { q: "اكتب بسرعة: القناعة كنز لا يفنى أبدا", a: "القناعة كنز لا يفنى أبدا", reward: 600 },
        { q: "اكتب بسرعة: الكلمة الطيبة مفتاح القلوب", a: "الكلمة الطيبة مفتاح القلوب", reward: 650 },
        { q: "اكتب بسرعة: لا يأس مع الحياة ولا حياة مع اليأس", a: "لا يأس مع الحياة ولا حياة مع اليأس", reward: 800 },
        { q: "اكتب بسرعة: تفاءلوا بالخير تجدوه أمامكم", a: "تفاءلوا بالخير تجدوه أمامكم", reward: 700 },
        { q: "اكتب بسرعة: الصديق الحقيقي يظهر وقت الضيق", a: "الصديق الحقيقي يظهر وقت الضيق", reward: 750 },
        { q: "اكتب بسرعة: البرمجة تحتاج إلى صبر وتركيز عالي", a: "البرمجة تحتاج إلى صبر وتركيز عالي", reward: 850 },
        { q: "اكتب بسرعة: من لم يذق مر التعلم ساعة تجرع ذل الجهل طول حياته", a: "من لم يذق مر التعلم ساعة تجرع ذل الجهل طول حياته", reward: 1000 },
        { q: "اكتب بسرعة: الأخطاء البرمجية تعلمنا الكثير", a: "الأخطاء البرمجية تعلمنا الكثير", reward: 650 },
        { q: "اكتب بسرعة: الضربة التي لا تقتلك تقويك", a: "الضربة التي لا تقتلك تقويك", reward: 650 },
        { q: "اكتب بسرعة: الوقت ذهب إن لم تدركه ذهب", a: "الوقت ذهب إن لم تدركه ذهب", reward: 700 },
        { q: "اكتب بسرعة: الأهداف الكبيرة تحتاج جهودا جبارة", a: "الأهداف الكبيرة تحتاج جهودا جبارة", reward: 750 },
        { q: "اكتب بسرعة: تعلم من أخطاء الأمس لتبني الغد", a: "تعلم من أخطاء الأمس لتبني الغد", reward: 750 }
    ],
    عواصم: [
        { q: "ما هي عاصمة السعودية؟", a: "الرياض", reward: 300 },
        { q: "ما هي عاصمة الإمارات؟", a: "ابوظبي", reward: 300 },
        { q: "ما هي عاصمة مصر؟", a: "القاهرة", reward: 300 },
        { q: "ما هي عاصمة اليمن؟", a: "صنعاء", reward: 350 },
        { q: "ما هي عاصمة فرنسا؟", a: "باريس", reward: 400 },
        { q: "ما هي عاصمة بريطانيا؟", a: "لندن", reward: 400 },
        { q: "ما هي عاصمة إيطاليا؟", a: "روما", reward: 400 },
        { q: "ما هي عاصمة اليابان؟", a: "طوكيو", reward: 500 },
        { q: "ما هي عاصمة كوريا الجنوبية؟", a: "سيول", reward: 500 },
        { q: "ما هي عاصمة الصين؟", a: "بكين", reward: 450 },
        { q: "ما هي عاصمة أمريكا؟", a: "واشنطن", reward: 400 },
        { q: "ما هي عاصمة ألمانيا؟", a: "برلين", reward: 450 },
        { q: "ما هي عاصمة روسيا؟", a: "موسكو", reward: 450 },
        { q: "ما هي عاصمة العراق؟", a: "بغداد", reward: 350 },
        { q: "ما هي عاصمة سوريا؟", a: "دمشق", reward: 350 },
        { q: "ما هي عاصمة الأردن؟", a: "عمان", reward: 350 },
        { q: "ما هي عاصمة الكويت؟", a: "الكويت", reward: 300 },
        { q: "ما هي عاصمة عمان؟", a: "مسقط", reward: 350 },
        { q: "ما هي عاصمة البحرين؟", a: "المنامة", reward: 350 },
        { q: "ما هي عاصمة قطر؟", a: "الدوحة", reward: 300 },
        { q: "ما هي عاصمة المغرب؟", a: "الرباط", reward: 400 },
        { q: "ما هي عاصمة الجزائر؟", a: "الجزائر", reward: 300 },
        { q: "ما هي عاصمة تونس؟", a: "تونس", reward: 300 },
        { q: "ما هي عاصمة تركيا؟", a: "انقرة", reward: 450 },
        { q: "ما هي عاصمة إسبانيا؟", a: "مدريد", reward: 450 },
        { q: "ما هي عاصمة فلسطين؟", a: "القدس", reward: 600 },
        { q: "ما هي عاصمة لبنان؟", a: "بيروت", reward: 400 },
        { q: "ما هي عاصمة السودان؟", a: "الخرطوم", reward: 400 },
        { q: "ما هي عاصمة ليبيا؟", a: "طرابلس", reward: 350 },
        { q: "ما هي عاصمة موريتانيا؟", a: "نواكشوط", reward: 450 },
        { q: "ما هي عاصمة جيبوتي؟", a: "جيبوتي", reward: 300 },
        { q: "ما هي عاصمة الصومال؟", a: "مقديشو", reward: 400 },
        { q: "ما هي عاصمة البرازيل؟", a: "برازيليا", reward: 500 },
        { q: "ما هي عاصمة الأرجنتين؟", a: "بوينس آيرس", reward: 550 },
        { q: "ما هي عاصمة كندا؟", a: "أوتاوا", reward: 500 },
        { q: "ما هي عاصمة أستراليا؟", a: "كانبرا", reward: 550 },
        { q: "ما هي عاصمة الهند؟", a: "نيودلهي", reward: 500 },
        { q: "ما هي عاصمة باكستان؟", a: "إسلام آباد", reward: 500 },
        { q: "ما هي عاصمة السويد؟", a: "ستوكهولم", reward: 550 },
        { q: "ما هي عاصمة النرويج؟", a: "أوسلو", reward: 550 },
        { q: "ما هي عاصمة الدنمارك؟", a: "كوبنهاجن", reward: 600 },
        { q: "ما هي عاصمة هولندا؟", a: "أمستردام", reward: 500 },
        { q: "What is the capital of Portugal?", a: "لشبونة", reward: 500 },
        { q: "ما هي عاصمة اليونان؟", a: "أثينا", reward: 450 },
        { q: "ما هي عاصمة سويسرا؟", a: "بيرن", reward: 600 },
        { q: "ما هي عاصمة النمسا؟", a: "فيينا", reward: 500 },
        { q: "ما هي عاصمة بلجيكا؟", a: "بروكسل", reward: 550 },
        { q: "ما هي عاصمة المكسيك؟", a: "مكسيكو سيتي", reward: 450 },
        { q: "ما هي عاصمة ماليزيا؟", a: "كوالالمبور", reward: 550 },
        { q: "ما هي عاصمة إندونيسيا؟", a: "جاكرتا", reward: 500 },
        { q: "ما هي عاصمة تشيلي؟", a: "سانتياغو", reward: 650 },
        { q: "ما هي عاصمة بيرو؟", a: "ليما", reward: 600 },
        { q: "ما هي عاصمة كولومبيا؟", a: "بوغوتا", reward: 650 },
        { q: "ما هي عاصمة فنزويلا؟", a: "كاراكاس", reward: 700 },
        { q: "ما هي عاصمة كوبا؟", a: "هافانا", reward: 600 },
        { q: "ما هي عاصمة نيوزيلندا؟", a: "ويلينغتون", reward: 800 },
        { q: "ما هي عاصمة الفلبين؟", a: "مانيلا", reward: 650 },
        { q: "ما هي عاصمة تايلاند؟", a: "بانكوك", reward: 600 },
        { q: "ما هي عاصمة فيتنام؟", a: "هانوي", reward: 650 },
        { q: "ما هي عاصمة كوريا الشمالية؟", a: "بيونغ يانغ", reward: 850 },
        { q: "ما هي عاصمة جنوب أفريقيا؟", a: "بريتوريا", reward: 750 },
        { q: "ما هي عاصمة كينيا؟", a: "نيروبي", reward: 700 },
        { q: "ما هي عاصمة نيجيريا؟", a: "أبوجا", reward: 700 },
        { q: "ما هي عاصمة غانا؟", a: "أكرا", reward: 650 },
        { q: "ما هي عاصمة السنغال؟", a: "داكار", reward: 650 },
        { q: "ما هي عاصمة مالي؟", a: "باماكو", reward: 700 },
        { q: "ما هي عاصمة إثيوبيا؟", a: "أديس أبابا", reward: 750 },
        { q: "ما هي عاصمة أوغندا؟", a: "كمبالا", reward: 700 },
        { q: "ما هي عاصمة مدغشقر؟", a: "أنتاناناريفو", reward: 900 },
        { q: "ما هي عاصمة أيسلندا؟", a: "ريكيافيك", reward: 850 },
        { q: "ما هي عاصمة بولندا؟", a: "وارسو", reward: 650 },
        { q: "ما هي عاصمة رومانيا؟", a: "بوخارست", reward: 650 },
        { q: "ما هي عاصمة المجر؟", a: "بودابست", reward: 650 },
        { q: "ما هي عاصمة أوكرانيا؟", a: "كييف", reward: 600 },
        { q: "ما هي عاصمة كرواتيا؟", a: "زغرب", reward: 700 },
        { q: "ما هي عاصمة صربيا؟", a: "بلغراد", reward: 650 },
        { q: "ما هي عاصمة أيرلندا؟", a: "دبلن", reward: 600 },
        { q: "ما هي عاصمة سنغافورة؟", a: "سنغافورة", reward: 400 },
        { q: "ما هي عاصمة بنغلاديش؟", a: "دكا", reward: 650 },
        { q: "ما هي عاصمة أفغانستان؟", a: "كابول", reward: 550 },
        { q: "ما هي عاصمة طاجيكستان؟", a: "دوشنبه", reward: 850 },
        { q: "ما هي عاصمة أوزبكستان؟", a: "طشقند", reward: 800 }
    ]
};

// --- (3) الوظائف المساعدة العامة ---

function checkUserLoan(userId, u) {
    if (u && u.loan && Date.now() > u.loan.dueTime) {
        let loanAmt = u.loan.amount;
        if (u.money >= loanAmt) {
            u.money -= loanAmt;
            u.loan = null;
        } else {
            let remainingLoan = loanAmt - u.money;
            u.money = 0;

            let userCompName = null;
            for (let cName in globalData.companies) {
                if (globalData.companies[cName].ownerId === String(userId)) {
                    userCompName = cName;
                    break;
                }
            }

            if (userCompName) {
                let comp = globalData.companies[userCompName];
                if (comp.treasury >= remainingLoan) {
                    comp.treasury -= remainingLoan;
                    u.loan = null;
                } else {
                    if (comp.investors) {
                        for (let invId in comp.investors) {
                            let invAmount = comp.investors[invId];
                            if (globalData.bank[invId]) {
                                globalData.bank[invId].money += invAmount;
                            }
                        }
                    }
                    if (comp.employees) {
                        comp.employees.forEach(empId => {
                            if (globalData.bank[empId] && globalData.bank[empId].job === userCompName) {
                                globalData.bank[empId].job = null;
                            }
                        });
                    }
                    delete globalData.companies[userCompName];
                    u.loan = null;
                }
            } else {
                u.loan = null;
            }
        }
        saveDB();
    }
}

function getUser(userId, username, firstName) {
    const uKey = String(userId);

    if (!globalData.bank[uKey]) {
        globalData.bank[uKey] = {
            money: 100,
            hasAccount: false,
            accountNumber: null,
            marriage: null,
            loan: null,
            lastSalary: 0,
            lastBakhsh: 0,
            jailUntil: 0,
            fine: 0,
            job: null, 
            lastWorkTime: 0, 
            shieldUntil: 0, 
            isVip: false,
            username: username || null,
            name: firstName || 'مستخدم'
        };
    }

    if (!globalData.bank[uKey].loan) globalData.bank[uKey].loan = null;
    if (!globalData.bank[uKey].jailUntil) globalData.bank[uKey].jailUntil = 0;
    if (!globalData.bank[uKey].fine) globalData.bank[uKey].fine = 0;
    if (globalData.bank[uKey].shieldUntil === undefined) globalData.bank[uKey].shieldUntil = 0;
    if (globalData.bank[uKey].job === undefined) globalData.bank[uKey].job = null;
    if (globalData.bank[uKey].isVip === undefined) globalData.bank[uKey].isVip = false;
    if (username) globalData.bank[uKey].username = username;
    if (firstName) globalData.bank[uKey].name = firstName;

    const userObj = globalData.bank[uKey];
    checkUserLoan(uKey, userObj);

    return userObj;
}

function generateAccount() {
    return 'SA' + Math.floor(1000000000 + Math.random() * 9000000000);
}

function formatMoney(n) {
    return `${n.toLocaleString('ar-SA')} ﷼`;
}

function saveUserMoney(userId, newTotal) {
    const uKey = String(userId);
    if (globalData.bank[uKey]) {
        globalData.bank[uKey].money = newTotal;
        saveDB();
    }
}

// --- (4) دوال البنك والألعاب ---

function createAccount(userId, username, firstName) {
    const u = getUser(userId, username, firstName);
    if (u.hasAccount) {
        return `⚠️ لديك حساب بالفعل!\nرقم حسابك: \`${u.accountNumber}\``;
    }
    u.hasAccount = true;
    u.accountNumber = generateAccount();
    saveDB();
    return `✅ **تم إنشاء حسابك البنكي بنجاح!**\n💳 رقم الحساب: \`${u.accountNumber}\`\n💰 الرصيد الأول: ${formatMoney(u.money)}`;
}

function getAccountInfo(userId, username, firstName) {
    const u = getUser(userId, username, firstName);
    let vipBadge = u.isVip ? `\n⭐ *الرتبة:* VIP المميزة ✨` : `\n👤 *الرتبة:* عادية`;
    let loanInfo = u.loan ? `\n📌 *قرض غير مسدد:* ${formatMoney(u.loan.amount)} (بنسبة 110%)` : `\n📌 *القروض:* لا يوجد`;
    let jailInfo = (u.jailUntil && u.jailUntil > Date.now()) ? `\n🚨 *الحالة:* مسجون في السجن 🚔 (باقي ${Math.ceil((u.jailUntil - Date.now())/(60*1000))} دقيقة، والغرامة: ${formatMoney(u.fine || 2000)})` : `\n🟢 *الحالة:* طليق وحر`;
    let jobInfo = u.job ? `\n💼 *الوظيفة:* موظف في شركة (${u.job})` : `\n💼 *الوظيفة:* عاطل عن العمل (ابحث عن شركة لتوظيفك)`;
    let shieldInfo = (u.shieldUntil && u.shieldUntil > Date.now()) ? `\n🛡️ *درع الحماية:* مفعل (باقي ${Math.ceil((u.shieldUntil - Date.now()) / (60 * 60 * 1000))} ساعة)` : `\n🛡️ *درع الحماية:* غير مفعل`;
    return `🏦 *بيانات حسابك البنكي:*\n👤 الاسم: ${u.name}${vipBadge}\n💳 رقم الحساب: \`${u.accountNumber || 'لا يوجد (اكتب: فتح حساب)'}\`\n💰 الرصيد الحالي: *${formatMoney(u.money)}*${jobInfo}${shieldInfo}${loanInfo}${jailInfo}`;
}

function buyVIP(userId) {
    const u = getUser(userId);
    if (!u.hasAccount) return '❌ يجب أن يكون لديك حساب بنكي لشراء رتبة VIP! اكتب `فتح حساب`';
    if (u.isVip) return '⭐ أنت تمتلك رتبة VIP بالفعل!';

    const vipCost = 1000000;
    if (u.money < vipCost) {
        return `❌ رصيدك غير كافٍ لشراء رتبة VIP! سعرها ${formatMoney(vipCost)}، ورصيدك الحالي ${formatMoney(u.money)}`;
    }

    u.money -= vipCost;
    u.isVip = true;
    saveDB();

    return `⭐ *مبروك! لقد حصلت على رتبة VIP المميزة بنجاح!* 🎉\n💰 **التكلفة:** ${formatMoney(vipCost)}\n✨ **الميزات المكتسبة:**\n🔹 خصم كامل على ضرائب البنك (0% رسوم تحويل).\n🔹 أرباح مضاعفة عند تنفيذ أمر \`عمل\`.\n💳 رصيدك الحالي: ${formatMoney(u.money)}`;
}

function transferMoney(senderId, targetId, amount) {
    if (senderId === targetId) return '❌ لا يمكنك تحويل الأموال لنفسك!';
    const sender = getUser(senderId);

    if (sender.loan) {
        return `❌ لا يمكنك تحويل الأموال ولديك قرض غير مسدد! يرجى سداد القرض أولاً عبر كتابة \`سداد القرض\`.`;
    }

    const target = getUser(targetId);
    const transAmt = parseInt(amount);
    if (isNaN(transAmt) || transAmt <= 0) return '❌ يرجى كتابة مبلغ صحيح للتحويل!\nمثال: `تحويل 1000` (مع منشن)';

    let taxRate = sender.isVip ? 0 : 0.05;
    let taxAmount = Math.floor(transAmt * taxRate);
    let totalDeduction = transAmt + taxAmount;

    if (sender.money < totalDeduction) {
        return `❌ رصيدك غير كافٍ للتحويل! المبلغ المطلوب مع الضريبة (${taxRate * 100}%) هو ${formatMoney(totalDeduction)}، ورصيدك الحالي: ${formatMoney(sender.money)}`;
    }

    sender.money -= totalDeduction;
    target.money += transAmt;
    saveDB();

    let taxInfo = sender.isVip ? `\n🛡️ *ضريبة البنك:* مجانية (ميزة VIP ⭐)` : `\n📉 *ضريبة البنك (5%):* ${formatMoney(taxAmount)}`;
    return `💸 *تم التحويل بنجاح!* ✅\n📤 **المحول:** ${sender.name}${sender.isVip ? ' [VIP ⭐]' : ''}\n📥 **المستلم:** ${target.name}\n💰 **المبلغ المحول:** ${formatMoney(transAmt)}${taxInfo}`;
}

function takeLoan(userId, amount) {
    const u = getUser(userId);
    if (u.loan) return `❌ لديك قرض سابق بقيمة ${formatMoney(u.loan.amount)} لم تقم بسداده بعد! اكتب ` + '`سداد القرض`';

    const loanAmt = parseInt(amount);
    if (isNaN(loanAmt) || loanAmt <= 0) return '❌ يرجى تحديد مبلغ القرض بشكل صحيح!\nمثال: `قرض 5000`';

    const maxLimit = 50000;
    if (loanAmt > maxLimit) return `❌ الحد الأقصى المسموح به للاستدانة هو ${formatMoney(maxLimit)}`;

    u.money += loanAmt;
    u.loan = {
        amount: Math.floor(loanAmt * 1.1),
        dueTime: Date.now() + (48 * 60 * 60 * 1000)
    };

    saveDB();
    return `🏦 *تم الموافقة على طلب القرض!* ✅\n💰 **المبلغ المضاف لرصيدك:** ${formatMoney(loanAmt)}\n📈 **المبلغ الواجب سداده (بنسبة 110%):** ${formatMoney(u.loan.amount)}\n⏳ **مدة السداد:** 48 ساعة\n⚠️ *تنبيه:* إذا لم تقم بالسداد خلال 48 ساعة، سيتم سحب المبلغ من رصيدك أو من شركتك تلقائياً.`;
}

function payLoan(userId) {
    const u = getUser(userId);
    if (!u.loan) return '❌ ليس عليك أي قروض مسجلة!';

    if (u.money < u.loan.amount) {
        return `❌ رصيدك الحالي (${formatMoney(u.money)}) لا يكفي لسداد القرض المطلوب بقيمة ${formatMoney(u.loan.amount)}`;
    }

    u.money -= u.loan.amount;
    u.loan = null;
    saveDB();

    return `✅ *تم سداد القرض بنجاح وإبراء ذمتك البنكية!* 🎉\n💰 رصيدك الحالي: ${formatMoney(u.money)}`;
}

function buyShield(userId) {
    const u = getUser(userId);
    if (!u.hasAccount) return '❌ يجب أن يكون لديك حساب بنكي لشراء درع الحماية! اكتب `فتح حساب`';

    const shieldCost = 5000;
    if (u.shieldUntil && u.shieldUntil > Date.now()) {
        let remainingHours = Math.ceil((u.shieldUntil - Date.now()) / (60 * 60 * 1000));
        return `🛡️ *درع الحماية مفعل لديك بالفعل!* باقي على انتهائه ${remainingHours} ساعة.`;
    }

    if (u.money < shieldCost) {
        return `❌ رصيدك غير كافٍ لشراء درع الحماية! سعره ${formatMoney(shieldCost)}، ورصيدك الحالي ${formatMoney(u.money)}`;
    }

    u.money -= shieldCost;
    u.shieldUntil = Date.now() + (24 * 60 * 60 * 1000);
    saveDB();

    return `🛡️ *تم شراء وتفعيل درع الحماية بنجاح!* ✅\n💰 **التكلفة:** ${formatMoney(shieldCost)}\n⏳ **المدة:** 24 ساعة كاملة (أنت محمي تماماً من سرقات الآخرين).\n💳 رصيدك الحالي: ${formatMoney(u.money)}`;
}

function stealMoney(thiefId, targetId) {
    if (thiefId === targetId) return '❌ لا يمكنك سرقة نفسك!';
    const thief = getUser(thiefId);
    const target = getUser(targetId);

    if (!thief.hasAccount) return '❌ يجب أن يكون لديك حساب بنكي لتتمكن من السرقة! اكتب `فتح حساب`';
    if (!target.hasAccount) return '❌ هذا الشخص ليس لديه حساب بنكي!';
    if (target.money < 500) return '❌ هذا الشخص فقير جداً، لا يملك ما يكفي للسرقة!';

    if (target.shieldUntil && target.shieldUntil > Date.now()) {
        let remainingHours = Math.ceil((target.shieldUntil - Date.now()) / (60 * 60 * 1000));
        return `🛡️ *فشلت محاولة السرقة!* هذا الشخص محمي بدرع الحماية (${remainingHours} ساعة متبقية)، ولا يمكنك سرقته حالياً!`;
    }

    let isSuccess = Math.random() < 0.45;
    if (isSuccess) {
        let stealPercent = Math.floor(Math.random() * 15) + 10;
        let stolenAmount = Math.floor(target.money * (stealPercent / 100));
        if (stolenAmount < 100) stolenAmount = 100;

        target.money -= stolenAmount;
        thief.money += stolenAmount;
        saveDB();
        return `🥷 *عملية سرقة ناجحة بامتياز!* 💰\nتمكن ${thief.name} من سرقة ${formatMoney(stolenAmount)} من ${target.name}! 😎`;
    } else {
        thief.jailUntil = Date.now() + (2 * 60 * 60 * 1000);
        thief.fine = 2000;
        saveDB();
        return `🚨 *فشلت عملية السرقة وتم القبض عليك!* 🚔\n👮‍♂️ تم زجك في **السجن** لمدة *ساعتين* ولا يمكنك اللعب بالبوت، وعليك غرامة ${formatMoney(thief.fine)}!\n💡 يمكنك دفع غرامتك بنفسك عبر كتابة \`دفع الغرامة\`، أو توكيل محامي لصديقك بالمنشن.`;
    }
}

function payBail(payerId, targetId) {
    const payer = getUser(payerId);
    const target = getUser(targetId);

    if (!target.jailUntil || target.jailUntil <= Date.now()) {
        return `❌ هذا الشخص ليس مسجوناً أصلاً!`;
    }

    let bailAmount = target.fine || 2000;
    if (payer.money < bailAmount) {
        return `❌ رصيدك غير كافٍ لدفع الغرامة (${formatMoney(bailAmount)}) للإفراج عن ${target.name}!`;
    }

    payer.money -= bailAmount;
    target.jailUntil = 0;
    target.fine = 0;
    saveDB();

    if (payerId === targetId) {
        return `⚖️ *تم دفع غرامتك والإفراج عنك بنجاح!* 🎉\n💰 المبلغ المقتطع: ${formatMoney(bailAmount)}\n💳 رصيدك الحالي: ${formatMoney(payer.money)}`;
    } else {
        return `⚖️ *تم توكيل المحامي ودفع الغرامة بنجاح!* 🏛️\n🤝 قام ${payer.name} بدفع غرامة وقدرها ${formatMoney(bailAmount)} وتم الإفراج عن ${target.name} من السجن! 🎉`;
    }
}

function createCompany(userId, compName) {
    if (!compName) return '❌ يرجى كتابة اسم الشركة!\nمثال: `انشاء شركة [الاسم]`';
    if (globalData.companies[compName]) return '❌ هذه الشركة مسجلة مسبقاً، اختر اسمًا آخر!';

    const u = getUser(userId);
    const cost = 10000;
    if (u.money < cost) return `❌ تكلفة إنشاء الشركة هي ${formatMoney(cost)}، رصيدك غير كافٍ!`;

    u.money -= cost;
    globalData.companies[compName] = {
        ownerId: String(userId),
        ownerName: u.name,
        level: 1,
        treasury: 0,
        employees: [],
        investors: {},
        isInsured: false
    };
    saveDB();

    return `🏢 *مبروك! تم تأسيس شركتك بنجاح* 🎉\n📛 **اسم الشركة:** ${compName}\n👤 **المالك:** ${u.name}\n💰 **تكلفة التأسيس:** ${formatMoney(cost)}`;
}

function sellCompany(userId, compName) {
    if (!compName) return '❌ يرجى كتابة اسم الشركة المراد بيعها!\nمثال: `بيع شركة [الاسم]`';
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';

    let comp = globalData.companies[compName];
    if (comp.ownerId !== String(userId)) {
        return '❌ لست مالك هذه الشركة لكي تستطيع بيعها!';
    }

    let totalRefunded = 0;
    if (comp.investors) {
        for (let invId in comp.investors) {
            let invAmount = comp.investors[invId];
            if (globalData.bank[invId]) {
                globalData.bank[invId].money += invAmount;
                totalRefunded += invAmount;
            }
        }
    }

    const u = getUser(userId);
    let ownerBonus = comp.treasury;
    if (ownerBonus > 0) {
        u.money += ownerBonus;
    }

    if (comp.employees) {
        comp.employees.forEach(empId => {
            if (globalData.bank[empId] && globalData.bank[empId].job === compName) {
                globalData.bank[empId].job = null;
            }
        });
    }

    delete globalData.companies[compName];
    saveDB();

    return `✅ *تم بيع وتصفية الشركة بنجاح!* 🏢\n📛 **اسم الشركة:** ${compName}\n🤝 **تم إرجاع أموال جميع المستثمرين:** ${formatMoney(totalRefunded)}\n💰 **رصيدك الحالي بعد البيع والتصفية:** ${formatMoney(u.money)}`;
}

function investCompany(userId, compName, amount) {
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة! تأكد من الاسم عبر كتابة `قائمة الشركات`';
    const comp = globalData.companies[compName];
    const u = getUser(userId);

    const invAmt = parseInt(amount);
    if (isNaN(invAmt) || invAmt <= 0) return '❌ يرجى كتابة مبلغ استثمار صحيح!\nمثال: `استثمار شركة [الاسم] [المبلغ]`';

    if (u.money < invAmt) return `❌ رصيدك غير كافٍ (${formatMoney(u.money)})`;

    u.money -= invAmt;
    comp.treasury += invAmt;

    if (!comp.investors) comp.investors = {};
    comp.investors[String(userId)] = (comp.investors[String(userId)] || 0) + invAmt;

    saveDB();

    return `📈 *تم ضخ استثمار بنجاح في شركة (${compName})* 💼\n👤 **المستثمر:** ${u.name}\n➕ **المبلغ المودع:** ${formatMoney(invAmt)}\n💰 **خزينة الشركة الإجمالية:** ${formatMoney(comp.treasury)}\n💡 *ملاحظة:* يمكنك الآن سحب أرباح استثمارك في أي وقت عبر أمر \`سحب أرباح ${compName}\`.`;
}

function claimInvestmentProfit(userId, compName) {
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';
    const comp = globalData.companies[compName];

    if (!comp.investors || !comp.investors[String(userId)] || comp.investors[String(userId)] <= 0) {
        return `❌ ليس لديك أي استثمارات مسجلة في شركة (${compName})!`;
    }

    let investedAmount = comp.investors[String(userId)];
    let profitPercent = Math.floor(Math.random() * 26) + 10;
    let profitAmount = Math.floor(investedAmount * (profitPercent / 100));

    if (comp.treasury < profitAmount) {
        return `⚠️ عذراً، خزينة شركة (${compName}) حالياً تعاني ولا تحتوي على رصيد كافٍ لدفع الأرباح (${formatMoney(comp.treasury)}). انتظر حتى تنتعش خزينة الشركة!`;
    }

    comp.treasury -= profitAmount;
    const u = getUser(userId);
    u.money += profitAmount;
    saveDB();

    return `💰 *تم سحب أرباح الاستثمار بنجاح!* 🎉\n🏢 **الشركة المستثمر بها:** ${compName}\n📈 **نسبة الربح المحققة:** +${profitPercent}%\n💵 **المبلغ المسحوب (أرباحك):** ${formatMoney(profitAmount)}\n💳 رصيدك الحالي: ${formatMoney(u.money)}`;
}

function getCompaniesList() {
    let list = Object.keys(globalData.companies);
    if (list.length === 0) return '🏢 لا توجد شركات مسجلة حالياً. قم بإنشاء شركتك عبر: `انشاء شركة [الاسم]`';

    let msg = '🏢 *قائمة الشركات المتاحة والموظفين والمستثمرين:* \n━━━━━━━━━━━━━━━\n\n';
    list.forEach((name, i) => {
        let c = globalData.companies[name];
        let investorsCount = c.investors ? Object.keys(c.investors).length : 0;
        let insuredStatus = c.isInsured ? "🛡️ مؤمنة بالكامل" : "⚠️ غير مؤمنة";
        msg += `🔹 *${i + 1}.* ${name}\n   👤 المالك: ${c.ownerName}\n   ⭐ المستوى: ${c.level || 1}\n   🛡️ التأمين: ${insuredStatus}\n   👥 عدد الموظفين: ${c.employees.length}\n   🤝 عدد المستثمرين: ${investorsCount}\n   💰 الخزينة: ${formatMoney(c.treasury)}\n━━━━━━━━━━━━━━━\n`;
    });
    return msg;
}

function employMember(ownerId, targetId, compName) {
    if (ownerId === targetId) return '❌ لا يمكنك تعيين نفسك موظفاً في شركتك!';
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';
    
    let comp = globalData.companies[compName];
    if (comp.ownerId !== String(ownerId)) {
        return '❌ لست مالك هذه الشركة لتقوم بتعيين موظفين فيها!';
    }

    const target = getUser(targetId);
    if (target.job) {
        return `❌ هذا الشخص يعمل بالفعل في شركة أخرى (${target.job})! يجب عليه الاستقالة أولاً.`;
    }

    target.job = compName;
    if (!comp.employees.includes(String(targetId))) {
        comp.employees.push(String(targetId));
    }
    saveDB();

    return `🤝 *تم تعيين الموظف بنجاح!* ✅\n👤 **الموظف الجديد:** ${target.name}\n🏢 **الشركة:** ${compName}\n💡 يمكنه الآن كتابة \`عمل\` لزيادة أرباح الشركة والحصول على راتبه اليومي!`;
}

function fireMember(ownerId, targetId, compName) {
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';
    let comp = globalData.companies[compName];
    if (comp.ownerId !== String(ownerId)) {
        return '❌ لست مالك هذه الشركة!';
    }

    const target = getUser(targetId);
    if (target.job !== compName) {
        return '❌ هذا الشخص ليس موظفاً في شركتك!';
    }

    target.job = null;
    comp.employees = comp.employees.filter(id => id !== String(targetId));
    saveDB();

    return `🛑 *تم فصل الموظف* ${target.name} من شركة ${compName} بنجاح.`;
}

function insureCompany(userId, compName) {
    if (!compName) return '❌ يرجى كتابة اسم الشركة المراد تأمينها!\nمثال: `أمر تأمين شركة [الاسم]`';
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';
    
    let comp = globalData.companies[compName];
    if (comp.ownerId !== String(userId)) return '❌ لست مالك هذه الشركة!';
    if (comp.isInsured) return '🛡️ هذه الشركة مؤمنة بالفعل ولا تحتاج إلى تأمين إضافي حالياً!';

    let insuranceCost = 15000;
    if (comp.treasury < insuranceCost) {
        return `❌ خزينة الشركة لا تحتوي على المبلغ الكافي لشراء التأمين! التكلفة المطلوبة: ${formatMoney(insuranceCost)} (رصيد الخزينة: ${formatMoney(comp.treasury)})`;
    }

    comp.treasury -= insuranceCost;
    comp.isInsured = true;
    saveDB();

    return `🛡️ *تم شراء تأمين الشركة بنجاح!* ✅\n🏢 **الشركة:** ${compName}\n💰 **التكلفة المقتطعة من الخزينة:** ${formatMoney(insuranceCost)}\n✨ أصبحت شركتك محمية تماماً ومحصنة ضد خسائر الدورات العشوائية القادمة!`;
}

function upgradeCompany(userId, compName) {
    if (!compName) return '❌ يرجى كتابة اسم الشركة المراد ترقيتها!\nمثال: `أمر تطوير شركة [الاسم]`';
    if (!globalData.companies[compName]) return '❌ هذه الشركة غير موجودة!';
    
    let comp = globalData.companies[compName];
    if (comp.ownerId !== String(userId)) return '❌ لست مالك هذه الشركة!';

    let currentLevel = comp.level || 1;
    if (currentLevel >= 5) return '⭐ لقد وصلت شركتك إلى الحد الأقصى من الترقية (المستوى 5)!';

    let upgradeCost = currentLevel * 20000;
    if (comp.treasury < upgradeCost) {
        return `❌ خزينة الشركة (${formatMoney(comp.treasury)}) لا تكفي للترقية إلى المستوى ${currentLevel + 1}!\n💰 التكلفة المطلوبة: ${formatMoney(upgradeCost)}`;
    }

    comp.treasury -= upgradeCost;
    comp.level = currentLevel + 1;
    saveDB();

    return `🚀 *تمت ترقية الشركة بنجاح!* 🎉\n🏢 **الشركة:** ${compName}\n⭐ **المستوى الجديد:** ${comp.level}\n💰 **التكلفة:** ${formatMoney(upgradeCost)}\n📈 أصبحت شركتك الآن أكثر استقراراً وأقل عرضة للخسائر الكبيرة!`;
}

function workForCompany(userId) {
    const u = getUser(userId);
    if (!u.job) return '❌ أنت لست موظفاً في أي شركة حالياً!';

    const now = Date.now();
    if (now - u.lastWorkTime < 30 * 60 * 1000) {
        let remainingMins = Math.ceil((30 * 60 * 1000 - (now - u.lastWorkTime)) / (60 * 1000));
        return `⏳ لقد قمت بعملك مؤخراً! يجدر بك الانتظار ${remainingMins} دقيقة أخرى للعمل مجدداً.`;
    }

    let compName = u.job;
    let comp = globalData.companies[compName];
    if (!comp) {
        u.job = null;
        saveDB();
        return '❌ للأسف، الشركة التي تعمل بها تم إغلاقها أو حذفها!';
    }

    let salary = u.isVip ? 1600 : 800; 
    let companyProfit = u.isVip ? 5000 : 2500; 

    if (comp.treasury < salary) {
        return `❌ خزينة الشركة (${formatMoney(comp.treasury)}) لا تكفي لدفع راتبك (${formatMoney(salary)})!`;
    }

    comp.treasury -= salary;
    comp.treasury += companyProfit;
    u.money += salary;
    u.lastWorkTime = now;
    saveDB();

    let treasuryWelcome = "";
    let treasury = comp.treasury;
    if (treasury > 50000) {
        treasuryWelcome = `🌟 أهلاً بك يا بطل! شركتنا غنية جداً وخزنتها تزخر بـ ${formatMoney(treasury)}, استمر في التألق!`;
    } else if (treasury > 15000) {
        treasuryWelcome = `👍 أهلاً بك في الشركة. وضع الخزينة مستقر وتضم ${formatMoney(treasury)}.`;
    } else {
        treasuryWelcome = `⚠️ تنبيه: خزينة الشركة تعاني قليلاً ولا يوجد فيها سوى ${formatMoney(treasury)}, شد حيلك لترفع أرباحنا!`;
    }

    let vipBadge = u.isVip ? ' ⭐ [ميزة VIP: أرباح مضاعفة]' : '';
    return `💼 *أديت عملك بنجاح في شركة ${compName}!* 👏${vipBadge}\n\n${treasuryWelcome}\n\n💰 **راتبك المستلم:** +${formatMoney(salary)}\n📈 **أرباح أُضيفت للخزينة:** +${formatMoney(companyProfit)}\n💳 رصيدك الحالي: ${formatMoney(u.money)}`;
}

function updateLiveStockMarket() {
    if (!globalData.stockMarket) globalData.stockMarket = { price: 100, trend: "استقرار ⚖️" };
    
    let changePercent = Math.floor(Math.random() * 36) - 15;
    let oldPrice = globalData.stockMarket.price;
    
    let newPrice = Math.round(oldPrice * (1 + (changePercent / 100)));
    if (newPrice < 10) newPrice = 10; 

    let trendText = changePercent > 0 ? `صعود 📈 (+${changePercent}%)` : changePercent < 0 ? `هبوط 📉 (${changePercent}%)` : `استقرار ⚖️ (0%)`;
    
    globalData.stockMarket.price = newPrice;
    globalData.stockMarket.trend = trendText;
    saveDB();
}

setInterval(() => {
    updateLiveStockMarket();
}, 5 * 60 * 1000);

function getStockMarketInfo() {
    if (!globalData.stockMarket) globalData.stockMarket = { price: 100, trend: "استقرار ⚖️" };
    return `📊 *بورصة الأسهم الحية* 📉📈\n━━━━━━━━━━━━━━━\n💵 **سعر السهم الحالي:** ${formatMoney(globalData.stockMarket.price)}\n📉 **اتجاه السوق:** ${globalData.stockMarket.trend}\n⏳ *(تتغير أسعار الأسهم تلقائياً كل 5 دقائق)*\n━━━━━━━━━━━━━━━\n💡 يمكنك الاستثمار عبر أمر \`استثمار [المبلغ]\`.`;
}

function processCompaniesRandomProfits() {
    if (!globalData.companies || Object.keys(globalData.companies).length === 0) return null;

    let report = '📊 *تقرير سوق الشركات والأرباح العشوائية:* 📉📈\n━━━━━━━━━━━━━━━\n';
    let hasChanges = false;

    for (let compName in globalData.companies) {
        let comp = globalData.companies[compName];
        if (comp.treasury <= 0) continue;

        hasChanges = true;

        if (comp.isInsured) {
            let percent = Math.floor(Math.random() * 41); 
            let amountChange = Math.floor(comp.treasury * (percent / 100));
            comp.treasury += amountChange;
            comp.isInsured = false; 

            report += `🏢 *${compName}* 🛡️ (محمية بالتأمين) 📈 ربحت بنسبة (+${percent}%)\n💰 الأرباح المضافة: +${formatMoney(amountChange)}\n`;
        } else {
            let level = comp.level || 1;
            let minLoss = -40 + (level * 5); 
            let percent = Math.floor(Math.random() * (101 - Math.abs(minLoss))) + minLoss; 
            
            let employeesCount = comp.employees ? comp.employees.length : 0;
            if (employeesCount > 0 && percent < 0) {
                percent += employeesCount * 2; 
                if (percent > 0) percent = 2; 
            } else if (employeesCount > 0 && percent >= 0) {
                percent += employeesCount * 3; 
            }

            let amountChange = Math.floor(comp.treasury * (percent / 100));
            comp.treasury += amountChange;
            if (comp.treasury < 0) comp.treasury = 0;

            if (percent > 0) {
                report += `🏢 *${compName}* (مستوى ${level} | موظفين: ${employeesCount}) 📈 ربحت (+${percent}%)\n💰 الأرباح: +${formatMoney(amountChange)}\n`;
            } else if (percent < 0) {
                report += `🏢 *${compName}* (مستوى ${level} | موظفين: ${employeesCount}) 📉 خسرت (${percent}%)\n💸 الخسارة: -${formatMoney(Math.abs(amountChange))}\n`;
            } else {
                report += `🏢 *${compName}* ⚖️ استقرار السوق (0%)\n`;
            }
        }
        report += `💼 الخزينة الجديدة: ${formatMoney(comp.treasury)}\n━━━━━━━━━━━━━━━\n`;
    }

    if (hasChanges) {
        saveDB();
        return report;
    }
    return null;
}

setInterval(() => {
    processCompaniesRandomProfits();
}, 4 * 60 * 60 * 1000);

function playLuck(userId, amount) {
    const u = getUser(userId);
    if (isNaN(amount) || amount <= 0) return '❌ يرجى كتابة مبلغ صحيح! مثال: `حظ 1000`';
    if (u.money < amount) return `❌ رصيدك غير كافٍ! رصيدك الحالي: ${formatMoney(u.money)}`;

    let isWin = Math.random() < 0.5;
    if (isWin) {
        let newTotal = u.money + amount;
        saveUserMoney(userId, newTotal);
        return `🎰 *يا حظك العالي!* 🎉\n\nربحت: +${formatMoney(amount)}\n💰 رصيدك الحالي: ${formatMoney(newTotal)}`;
    } else {
        let newTotal = u.money - amount;
        saveUserMoney(userId, newTotal);
        return `💥 *الحظ ما حالفك هذه المرة!* 💔\n\nخسرت: -${formatMoney(amount)}\n💰 رصيدك الحالي: ${formatMoney(newTotal)}`;
    }
}

function playInvestment(userId, amount) {
    const u = getUser(userId);
    if (isNaN(amount) || amount <= 0) return '❌ يرجى كتابة مبلغ صحيح! مثال: `استثمار 1000`';
    if (u.money < amount) return `❌ رصيدك غير كافٍ للاستثمار! رصيدك الحالي: ${formatMoney(u.money)}`;

    let isWin = Math.random() < 0.5;
    let profitPercent = Math.floor(Math.random() * 50) + 10;
    let changeAmount = Math.floor(amount * (profitPercent / 100));

    if (isWin) {
        let newTotal = u.money + changeAmount;
        saveUserMoney(userId, newTotal);
        return `📈 *صفقة استثمارية ناجحة عبر البورصة الحية!* 🎉\n\nربحت نسبة ${profitPercent}%: +${formatMoney(changeAmount)}\n💰 رصيدك الحالي: ${formatMoney(newTotal)}`;
    } else {
        let newTotal = u.money - changeAmount;
        saveUserMoney(userId, newTotal);
        return `📉 *تراجع السوق وخسر استثمارك في البورصة!* 💔\n\nخسرت نسبة ${profitPercent}%: -${formatMoney(changeAmount)}\n💰 رصيدك الحالي: ${formatMoney(newTotal)}`;
    }
}

function getTopData() {
    let topCompanies = [];
    for (let cName in globalData.companies) {
        let comp = globalData.companies[cName];
        let ownerData = globalData.bank[comp.ownerId];
        let realOwnerName = ownerData ? ownerData.name : (comp.ownerName || 'مالك الشركة');
        topCompanies.push({
            name: cName,
            ownerId: comp.ownerId,
            ownerName: realOwnerName,
            treasury: comp.treasury
        });
    }
    topCompanies.sort((a, b) => b.treasury - a.treasury);
    let top10Companies = topCompanies.slice(0, 10);

    let usersList = [];
    for (let id in globalData.bank) {
        let userObj = globalData.bank[id];
        if (userObj.money !== undefined) {
            usersList.push({
                id: id,
                name: userObj.name || 'مستخدم',
                username: userObj.username ? userObj.username : null,
                money: userObj.money,
                isVip: userObj.isVip || false
            });
        }
    }
    usersList.sort((a, b) => b.money - a.money);
    let top10Users = usersList.slice(0, 10);

    let msg = '🏆 *[1] توب 10 الشركات الأقوى*\n━━━━━━━━━━━━━━━\n';
    let mentions = [];

    if (top10Companies.length === 0) {
        msg += 'لا توجد شركات مسجلة حالياً.\n';
    } else {
        top10Companies.forEach((c, i) => {
            let badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏢';
            let ownerJid = c.ownerId.includes('@') ? c.ownerId : c.ownerId + '@s.whatsapp.net';
            mentions.push(ownerJid);
            msg += `${badge} *${i + 1}.* شركة: *${c.name}*\n   👤 المالك: ${c.ownerName} (@${c.ownerId.split('@')[0]})\n   💰 الخزينة: \`${formatMoney(c.treasury)}\`\n\n`;
        });
    }

    msg += '━━━━━━━━━━━━━━━\n💵 *[2] توب 10 أغنياء البنك*\n━━━━━━━━━━━━━━━\n';

    if (top10Users.length === 0) {
        msg += 'لا توجد بيانات مستخدمين كافية.\n';
    } else {
        top10Users.forEach((u, i) => {
            let badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
            let userJid = u.id.includes('@') ? u.id : u.id + '@s.whatsapp.net';
            mentions.push(userJid);
            let userTag = u.username ? ` (${u.username})` : '';
            let vipMark = u.isVip ? ' ⭐ [VIP]' : '';
            msg += `${badge} *${i + 1}.* ${u.name}${userTag}${vipMark}\n   🏦 الرصيد: \`${formatMoney(u.money)}\`\n\n`;
        });
    }

    return { text: msg, mentions: [...new Set(mentions)] };
}

// دالة جلب المتفاعلين في المجموعة
function getActiveMembers(chatId) {
    if (!globalData.activity[chatId]) {
        return '📊 لا توجد بيانات تفاعل مسجلة لهذه المجموعة بعد!';
    }

    let chatUsers = globalData.activity[chatId];
    let list = [];

    for (let userId in chatUsers) {
        let userObj = getUser(userId);
        list.push({
            id: userId,
            name: userObj.name || 'مستخدم',
            messagesCount: chatUsers[userId]
        });
    }

    list.sort((a, b) => b.messagesCount - a.messagesCount);
    let topMembers = list.slice(0, 15);

    let msg = '📊 *قائمة أكثر الأعضاء تفاعلاً في القروب:* 🔥\n━━━━━━━━━━━━━━━\n';
    let mentions = [];

    topMembers.forEach((m, i) => {
        let badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
        let userJid = m.id.includes('@') ? m.id : m.id + '@s.whatsapp.net';
        mentions.push(userJid);
        msg += `${badge} *${i + 1}.* ${m.name}\n   💬 عدد الرسائل: *${m.messagesCount.toLocaleString('ar-SA')} رسالة*\n\n`;
    });

    return { text: msg, mentions: [...new Set(mentions)] };
}

function checkMonthlyReset() {
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - globalData.lastReset >= ONE_MONTH) {
        globalData.bank = {};
        globalData.companies = {};
        globalData.activity = {};
        globalData.lastReset = Date.now();
        saveDB();
        return true;
    }
    return false;
}

// --- (5) نظام الزواج والشحن والسحب الجديد ---

function marry(senderId, targetId, customDowry) {
    const sender = getUser(senderId);
    const target = getUser(targetId);

    if (senderId === targetId) return '❌ لا يمكنك الزواج من نفسك!';
    if (sender.marriage) return '⚠️ أنت متزوج بالفعل! لا يمكنك الزواج مجدداً.';
    if (target.marriage) return '⚠️ الشخص الذي تحاول الزواج منه متزوج بالفعل!';

    const dowry = parseInt(customDowry);
    if (isNaN(dowry) || dowry <= 0) {
        return '❌ يرجى تحديد قيمة المهر بشكل صحيح!\nمثال: `زواج 1000`';
    }

    if (sender.money < dowry) {
        return `❌ رصيدك غير كافٍ لدفع هذا المهر! رصيدك الحالي: ${formatMoney(sender.money)}`;
    }

    sender.money -= dowry;
    target.money += dowry;

    const marriageDate = new Date().toLocaleDateString('ar-SA');

    sender.marriage = { 
        spouseId: String(targetId), 
        spouseName: target.name || 'الشريك', 
        role: 'husband', 
        dowry: dowry,
        date: marriageDate 
    };

    target.marriage = { 
        spouseId: String(senderId), 
        spouseName: sender.name || 'الشريك', 
        role: 'wife', 
        dowry: dowry,
        date: marriageDate 
    };

    saveDB();

    return `💍 *مبروك! تم عقد القران بنجاح* 🎉\n\n🤵‍♂️ **الزوج:** ${sender.name}\n👰‍♀️ **الزوجة:** ${target.name}\n📅 **تاريخ العقد:** ${marriageDate}\n💰 **المهر المدفوع:** ${formatMoney(dowry)}`;
}

function divorce(userId) {
    const user = getUser(userId);
    if (!user.marriage) return '❌ أنت لست متزوجاً أصلاً لتطلق!';

    const spouseId = user.marriage.spouseId;
    const spouse = globalData.bank[spouseId];
    const dowry = user.marriage.dowry || 100000;

    if (user.money < dowry) {
        return `❌ رصيدك الحالي (${formatMoney(user.money)}) لا يكفي لدفع قيمة المهر/المؤخر (${formatMoney(dowry)}). تم رفض الطلاق!`;
    }

    user.money -= dowry;
    user.marriage = null;

    if (spouse) {
        spouse.marriage = null;
        spouse.money += dowry; 
    }

    saveDB();
    return `💔 *تم الطلاق رسمياً.*\n💰 تم خصم مبلغ ${formatMoney(dowry)} وتحويله للطرف الآخر كمؤخر صداق. نرجو لكم التوفيق!`;
}

function khul(userId) {
    const user = getUser(userId);
    if (!user.marriage) return '❌ أنت لست متزوجاً لرفع دعوى خلع!';

    const spouseId = user.marriage.spouseId;
    const spouse = globalData.bank[spouseId];
    const dowry = user.marriage.dowry || 100000;

    if (user.money < dowry) {
        return `❌ لطلب الخلع يجب إرجاع المهر كاملاً (${formatMoney(dowry)}). رصيدك الحالي لا يكفي! (${formatMoney(user.money)})`;
    }

    user.money -= dowry;
    user.marriage = null;

    if (spouse) {
        spouse.marriage = null;
        spouse.money += dowry;
    }

    saveDB();
    return `⚖️ *تم الخلع بنجاح.*\n💸 تم رد المهر وقدره ${formatMoney(dowry)} للزوج وإلغاء عقد الزواج.`;
}

function getStatus(userId) {
    const user = getUser(userId);
    if (user.marriage) {
        const partnerTitle = user.marriage.role === 'husband' ? 'الزوجة' : 'الزوج';
        return `❤️ *الحالة الاجتماعية:* متزوج/ة\n👤 **${partnerTitle}:** ${user.marriage.spouseName}\n📅 **تاريخ الزواج:** ${user.marriage.date}`;
    } else {
        return '💔 *الحالة الاجتماعية:* أعزب / غير متزوج';
    }
}

function addMoney(targetId, amount) {
    const target = getUser(targetId);
    const addAmt = parseInt(amount);
    if (isNaN(addAmt) || addAmt <= 0) return '❌ يرجى كتابة مبلغ شحن صحيح!';

    target.money += addAmt;
    saveDB();
    return `✅ **تم شحن الرصيد بنجاح!**\n👤 **المستفيد:** ${target.name}\n➕ **المبلغ المضاف:** ${formatMoney(addAmt)}\n💰 **الرصيد الجديد:** ${formatMoney(target.money)}`;
}

function subtractMoney(targetId, amount) {
    const target = getUser(targetId);
    const subAmt = parseInt(amount);
    if (isNaN(subAmt) || subAmt <= 0) return '❌ يرجى كتابة مبلغ سحب صحيح!';

    if (target.money < subAmt) {
        target.money = 0; 
    } else {
        target.money -= subAmt;
    }
    saveDB();
    return `🔻 **تم سحب الرصيد بنجاح!**\n👤 **المستهدف:** ${target.name}\n➖ **المبلغ المسحوب:** ${formatMoney(subAmt)}\n💰 **الرصيد المتبقي:** ${formatMoney(target.money)}`;
}

function getHelpMenu() {
    return `📜 *قائمة أوامر وعلاوات البوت الشاملة (AN GPT)* 🤖
━━━━━━━━━━━━━━━

🏦 *أوامر البنك والحسابات:*
🔹 \`فتح حساب\` ⟵ لإنشاء حساب بنكي جديد برقم فريد ورصيد ابتدائي.
🔹 \`رصيدي\` أو \`بنكي\` ⟵ لعرض تفاصيل حسابك ورصيدك ووظيفتك وقروضك وحالة الدرع.
🔹 \`تحويل [المبلغ]\` (مع منشن/رد) ⟵ لتحويل أموال لشخص آخر.
🔹 \`قرض [المبلغ]\` ⟵ لاقتراض أموال بنسبة 110% (يجب السداد خلال 48 ساعة).
🔹 \`سداد القرض\` ⟵ لسداد القرض المستحق عليك.
🔹 \`التوب\` ⟵ لعرض قائمة أغنى 10 شركات وأغنى 10 أثرياء.
🔹 \`المتفاعلين\` ⟵ لعرض قائمة أكثر الأعضاء تفاعلاً وعدد رسائل كل شخص.

⭐ *أوامر الترقيات الخاصة (VIP):*
🔹 \`شراء vip\` ⟵ لشراء رتبة VIP المميزة بمبلغ 1,000,000 ريال (تمنحك خصم ضرائب التحويل بالكامل وأرباح مضاعفة من أمر العمل).

🛡️ *أوامر الحماية والدفاع:*
🔹 \`درع حماية\` أو \`شراء درع\` ⟵ لشراء درع حماية يمنع أي شخص من سرقتك تماماً لمدة 24 ساعة (السعر: 5,000 ريال).

📊 *أوامر البورصة والاستثمار:*
🔹 \`البورصة\` ⟵ لعرض سعر سهم البورصة الحية واتجاه السوق (تتغير كل 5 دقائق).
🔹 \`استثمار [المبلغ]\` ⟵ استثمار أموالك في البورصة الحية (بين ربح وخسارة).

🎮 *أوامر الألعاب التنافسية:*
🔹 \`دمج\` ⟵ لعبة دمج الحروف المبعثرة.
🔹 \`فكك\` ⟵ لعبة تفكيك الجمل والكلمات.
🔹 \`سرعة\` ⟵ لعبة كتابة النصوص بسرعة للربح.
🔹 \`عواصم\` ⟵ لعبة الإجابة على عواصم الدول.
🔹 \`حظ [المبلغ]\` ⟵ لعبة الحظ السريع (ربح أو خسارة عشوائية).

🥷 *أوامر السرقة والسجن والمحامي:*
🔹 \`سرقة\` (مع منشن/رد) ⟵ لمحاولة سرقة أموال شخص آخر (احذر من السجن لساعتين!).
🔹 \`دفع الغرامة\` أو \`فك اسري\` ⟵ لدفع غرامتك بنفسك والخروج من السجن فوراً.
🔹 \`محامي\` (مع منشن/رد) ⟵ لدفع غرامة شخص مسجون آخر وإخراجه.

🏢 *أوامر الشركات والموظفين والاستثمار:*
🔹 \`انشاء شركة [الاسم]\` ⟵ لتأسيس شركتك الخاصة (التكلفة 10,000 ريال).
🔹 \`بيع شركة [الاسم]\` ⟵ لبيع وتصفية شركتك وإرجاع أموال المستثمرين بالكامل.
🔹 \`قائمة الشركات\` ⟵ لعرض الشركات المتاحة وأرصدتها وموظفيها والمستثمرين.
🔹 \`استثمار شركة [الاسم] [المبلغ]\` ⟵ الاستثمار في شركة صديقك وزيادة خزينتها.
🔹 \`سحب أرباح [اسم الشركة]\` ⟵ سحب أرباح استثمارك من شركة صديقك وجني العوائد!
🔹 \`تعيين [منشن] [اسم الشركة]\` ⟵ لتعيين عضو بالقروب موظفاً في شركتك.
🔹 \`طرد [منشن] [اسم الشركة]\` ⟵ لفصل موظف من شركتك.
🔹 \`عمل\` ⟵ أداء العمل اليومي كموظف (يزيد أرباح الشركة ويمنحك راتبك الثابت).
🔹 \`أمر تأمين شركة [الاسم]\` ⟵ شراء تأمين لحماية الشركة تماماً من خسائر الدورات العشوائية.
🔹 \`أمر تطوير شركة [الاسم]\` ⟵ ترقية الشركة لتصبح أكثر استقراراً وأقل عرضة للخسائر الكبيرة.

💍 *أوامر الزواج والعلاقات:*
🔹 \`زواج [المهر]\` (مع منشن/رد) ⟵ لطلب الزواج ودفع المهر.
🔹 \`طلاق\` ⟵ لإنهاء الزواج وتحويل مؤخر الصداق.
🔹 \`خلع\` ⟵ لرفع دعوى خلع ورد المهر.
🔹 \`زواجي\` أو \`حالي\` ⟵ لعرض حالتك الاجتماعية.

🔄 *معلومات النظام:*
📌 يتم تصفير الحسابات والشركات تلقائياً مع بداية كل شهر جديد لإتاحة المنافسة من جديد!
━━━━━━━━━━━━━━━`;
}

// --- (6) تشغيل البوت مع دمج نظام Pairing Code المعزز ---

let pairingCodeRequested = false;

async function startBot() {
    loadDB();
    checkMonthlyReset();

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (!state.creds.registered && !pairingCodeRequested && (connection === 'connecting' || qr)) {
            pairingCodeRequested = true;
            setTimeout(async () => {
                try {
                    const phoneNumber = "16046792848"; 
                    console.log("⏳ جاري طلب كود الاقتران من خوادم الواتساب...");
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code; 
                    console.log(`\n========================================`);
                    console.log(`🔑 كود الربط الخاص بك هو: ${code}`);
                    console.log(`========================================\n`);
                } catch (err) {
                    console.error("❌ فشل طلب كود الربط:", err.message || err);
                    pairingCodeRequested = false;
                }
            }, 4000);
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("🔄 انقطع الاتصال، جاري إعادة المحاولة...");
            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            }
        } else if (connection === "open") {
            console.log("✅ تم الاتصال بنجاح بـ WhatsApp!");
        }
    });

    // --- (7.1) ترحيب الأعضاء الجدد ---
    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === 'add') {
                for (let num of participants) {
                    let cleanNum = num.split('@')[0];
                    let profilePicUrl;
                    try {
                        profilePicUrl = await sock.profilePictureUrl(num, 'image');
                    } catch {
                        profilePicUrl = "https://i.ibb.co/3W9Kq5K/default-avatar.png";
                    }

                    let welcomeText = `أهلاً بك @${cleanNum} في القروب!\n╭━━━━━━━〔 👑 ༊ෆ SS7 ꕥ SHAMOKH ෆ༊ 👑 〕━━━━━━━╮✨ أهــلاً وســهــلاً بــك ✨\n  فــي قــروب SS7 ꕥ SHAMOKH 🤍\n\nيــســرّنــا انــضــمــامــك إلــى عــائــلــتــنــا 💎\nونــتــمــنــى لــك وقــتًــا مــلــيــئًــا \nبــالــمــتــعــة والــتــفــاعــل والاحــتــرام 🌟\n\n    ━━━━━━━━◇👑◇━━━━━━━━\n\n\n\n📜 قــانــونــنــا:\nالاحــتــرام • الالــتــزام • الــروقــان 😌\nلــلــحــفــاظ عــلــى أجــواء جــمــيــلــة لــلــجــمــيــع\n\n💬 اســتــمــتــع • شــارك • كــوّن صــداقــات\nوكــن جــزءًا مــن مــجــتــمــع SS7 ꕥ SHAMOKH 👑\n\n    ✨ نــتــمــنــى لــك إقــامــة مــمــتــعــة ✨\n           أهــلًا بــك بــيــنــنــا 🤍\n\n╰━━━━━━━━━━━━━━╯`;

                    await sock.sendMessage(id, {
                        image: { url: profilePicUrl },
                        caption: welcomeText,
                        mentions: [num]
                    });
                }
            }
        } catch (e) {
            console.error("خطأ في رسالة الترحيب:", e);
        }
    });

    // --- (7.2) معالجة الرسائل والأوامر ---

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const rawSender = msg.key.participant || msg.key.remoteJid;
        const cleanSenderId = rawSender.split('@')[0].split(':')[0];
        const pushName = msg.pushName || "مستخدم";
        const jid = msg.key.remoteJid;

        // --- تتبع عدد رسائل الأعضاء تلقائياً لكل قروب ---
        if (jid.endsWith('@g.us')) {
            if (!globalData.activity[jid]) {
                globalData.activity[jid] = {};
            }
            if (!globalData.activity[jid][cleanSenderId]) {
                globalData.activity[jid][cleanSenderId] = 0;
            }
            globalData.activity[jid][cleanSenderId] += 1;
            saveDB();
        }

        const text = (
            msg.message?.conversation || 
            msg.message?.extendedTextMessage?.text || 
            ""
        ).trim();

        if (!text) return;

        const user = getUser(cleanSenderId, null, pushName);

        // --- نظام السجن ---
        if (user.jailUntil && user.jailUntil > Date.now()) {
            if (text !== 'بنكي' && text !== 'رصيدي' && text !== 'حسابي' && !text.startsWith('محامي') && !text.startsWith('دفع الغرامة') && !text.startsWith('فك اسري')) {
                let remainingMins = Math.ceil((user.jailUntil - Date.now()) / (60 * 1000));
                await sock.sendMessage(jid, { text: `🚨 *أنت مسجون خلف القضبان!* 🚔\n⏳ باقي على خروجك: ${remainingMins} دقيقة.\n💡 يمكنك دفع غرامتك بنفسك عبر كتابة \`دفع الغرامة\`، أو توكيل محامي لصديقك بالمنشن.` }, { quoted: msg });
                return;
            }
        }

        // --- (A) التحقق من الإجابة على أي لعبة نشطة ---
        if (activeGames[jid] && activeGames[jid].length > 0) {
            const userAnswer = text.trim().toLowerCase();
            const matchedIndex = activeGames[jid].findIndex(g => g.answer.trim().toLowerCase() === userAnswer);

            if (matchedIndex !== -1) {
                const currentGame = activeGames[jid][matchedIndex];
                clearTimeout(currentGame.timeout);

                activeGames[jid].splice(matchedIndex, 1);
                if (activeGames[jid].length === 0) {
                    delete activeGames[jid];
                }

                const userObj = getUser(cleanSenderId, null, pushName);
                const newTotal = userObj.money + currentGame.reward;
                saveUserMoney(cleanSenderId, newTotal);

                const winMsg = `🎉 *إجابة صحيحة يا بطل!* (${pushName})\n\n💰 **الجائزة:** +${formatMoney(currentGame.reward)}\n💳 **رصيدك الجديد:** ${formatMoney(newTotal)}`;
                await sock.sendMessage(jid, { text: winMsg }, { quoted: msg });
                return;
            }
        }

        // --- (B) بدء لعبة جديدة ---
        const gameType = text.trim();
        if (GAMES_BANK[gameType]) {
            if (!activeGames[jid]) {
                activeGames[jid] = [];
            }

            const questions = GAMES_BANK[gameType];
            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

            const gameObj = {
                id: Date.now() + Math.random(),
                question: randomQuestion.q,
                answer: randomQuestion.a,
                reward: randomQuestion.reward,
                type: gameType
            };

            const timer = setTimeout(() => {
                if (activeGames[jid]) {
                    activeGames[jid] = activeGames[jid].filter(g => g.id !== gameObj.id);
                    if (activeGames[jid].length === 0) {
                        delete activeGames[jid];
                    }
                }
            }, 100000);

            gameObj.timeout = timer;
            activeGames[jid].push(gameObj);

            const promptMsg = `🎮 *لعبة ${gameType.toUpperCase()}*\n\n❓ **السؤال:**\n${randomQuestion.q}\n\n💰 **الجائزة:** ${formatMoney(randomQuestion.reward)}\n✍️ أرسل الإجابة الصحيحة للفوز!`;
            await sock.sendMessage(jid, { text: promptMsg }, { quoted: msg });
            return;
        }

        // --- (C) الأوامر والخدمات البنكية والقروض والشركات ---

        if (text === 'فتح حساب' || text === 'إنشاء حساب' || text === 'انشاء حساب') {
            const res = createAccount(cleanSenderId, null, pushName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'بنكي' || text === 'رصيدي' || text === 'حسابي') {
            const res = getAccountInfo(cleanSenderId, null, pushName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'شراء vip' || text === 'اشتراك vip' || text === 'vip') {
            const res = buyVIP(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'الاوامر' || text === 'اوامر' || text === 'الأوامر' || text === 'تعليمات') {
            const res = getHelpMenu();
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'البورصة' || text === 'بورصة') {
            const res = getStockMarketInfo();
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'درع حماية' || text === 'شراء درع' || text === 'درع') {
            const res = buyShield(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('حظ ')) {
            const amount = parseInt(text.split(' ')[1]);
            const res = playLuck(cleanSenderId, amount);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('استثمار ') && !text.startsWith('استثمار شركة')) {
            const amount = parseInt(text.split(' ')[1]);
            const res = playInvestment(cleanSenderId, amount);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('سرقة')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid) {
                await sock.sendMessage(jid, { text: '❌ يرجى عمل منشن أو رد على رسالة الشخص المراد سرقته!\nمثال: `سرقة` (مع منشن)' }, { quoted: msg });
                return;
            }

            const targetId = targetJid.split('@')[0].split(':')[0];
            const res = stealMoney(cleanSenderId, targetId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        // --- دفع الغرامة (للسجين نفسه أو توكيل محامي لشخص آخر) ---
        else if (text === 'دفع الغرامة' || text === 'فك اسري' || text.startsWith('محامي')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            let targetId = cleanSenderId; 

            if (targetJid) {
                targetId = targetJid.split('@')[0].split(':')[0];
            }

            const res = payBail(cleanSenderId, targetId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('تحويل') || text.startsWith('.تحويل')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid) {
                await sock.sendMessage(jid, { text: '❌ يرجى عمل منشن أو رد على رسالة الشخص المراد التحويل له!\nمثال: `تحويل 1000` (مع منشن)' }, { quoted: msg });
                return;
            }

            const args = text.split(' ');
            const amount = args.find(arg => !isNaN(arg) && parseInt(arg) > 0);
            if (!amount) {
                await sock.sendMessage(jid, { text: '❌ يرجى تحديد المبلغ المراد تحويله!\nمثال: `تحويل 500`' }, { quoted: msg });
                return;
            }

            const targetId = targetJid.split('@')[0].split(':')[0];
            const res = transferMoney(cleanSenderId, targetId, amount);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('قرض ')) {
            const amount = text.split(' ')[1];
            const res = takeLoan(cleanSenderId, amount);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'سداد القرض' || text === 'سداد') {
            const res = payLoan(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('انشاء شركة ')) {
            const compName = text.replace('انشاء شركة', '').trim();
            const res = createCompany(cleanSenderId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('بيع شركة ')) {
            const compName = text.replace('بيع شركة', '').trim();
            const res = sellCompany(cleanSenderId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('استثمار شركة ')) {
            const parts = text.replace('استثمار شركة', '').trim().split(' ');
            const compName = parts[0];
            const amount = parts[1];
            const res = investCompany(cleanSenderId, compName, amount);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('سحب أرباح ')) {
            const compName = text.replace('سحب أرباح', '').trim();
            const res = claimInvestmentProfit(cleanSenderId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('أمر تأمين شركة ')) {
            const compName = text.replace('أمر تأمين شركة', '').trim();
            const res = insureCompany(cleanSenderId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('أمر تطوير شركة ')) {
            const compName = text.replace('أمر تطوير شركة', '').trim();
            const res = upgradeCompany(cleanSenderId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'قائمة الشركات' || text === 'الشركات') {
            const res = getCompaniesList();
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('تعيين')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid) {
                await sock.sendMessage(jid, { text: '❌ يرجى عمل منشن أو رد على العضو المراد تعيينه مع كتابة اسم الشركة!\nمثال: `تعيين [منشن] [اسم الشركة]`' }, { quoted: msg });
                return;
            }

            const compName = text.replace('تعيين', '').replace('@' + targetJid.split('@')[0], '').trim();
            const targetId = targetJid.split('@')[0].split(':')[0];
            const res = employMember(cleanSenderId, targetId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text.startsWith('طرد')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid) {
                await sock.sendMessage(jid, { text: '❌ يرجى عمل منشن أو رد على الموظف المراد طرده مع اسم الشركة!\nمثال: `طرد [منشن] [اسم الشركة]`' }, { quoted: msg });
                return;
            }

            const compName = text.replace('طرد', '').replace('@' + targetJid.split('@')[0], '').trim();
            const targetId = targetJid.split('@')[0].split(':')[0];
            const res = fireMember(cleanSenderId, targetId, compName);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'عمل' || text.startsWith('عمل ')) {
            const res = workForCompany(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'التوب') {
            const topData = getTopData();
            await sock.sendMessage(jid, { 
                text: topData.text, 
                mentions: topData.mentions 
            }, { quoted: msg });
        }

        else if (text === 'المتفاعلين' || text === 'التفاعل' || text === 'نشاط') {
            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, { text: '❌ هذا الأمر يعمل داخل المجموعات فقط!' }, { quoted: msg });
                return;
            }
            const activeData = getActiveMembers(jid);
            if (typeof activeData === 'string') {
                await sock.sendMessage(jid, { text: activeData }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { 
                    text: activeData.text, 
                    mentions: activeData.mentions 
                }, { quoted: msg });
            }
        }

        else if (text.startsWith('زواج')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid) {
                await sock.sendMessage(jid, { text: '❌ يرجى عمل منشن أو رد على رسالة الشخص الذي تريد الزواج منه وتحديد المبلغ!\nمثال: `زواج 5000`' }, { quoted: msg });
                return;
            }

            const args = text.split(' ');
            const customDowry = args.find(arg => !isNaN(arg) && parseInt(arg) > 0);

            if (!customDowry) {
                await sock.sendMessage(jid, { text: '❌ يرجى كتابة قيمة المهر بعد كلمة زواج!\nمثال: `زواج 1000`' }, { quoted: msg });
                return;
            }

            const targetId = targetJid.split('@')[0].split(':')[0];
            const res = marry(cleanSenderId, targetId, customDowry);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        // --- أوامر الزواج المضافة (طلاق، خلع، حالي/زواجي) ---
        else if (text === 'طلاق') {
            const res = divorce(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'خلع') {
            const res = khul(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        else if (text === 'حالي' || text === 'زواجي') {
            const res = getStatus(cleanSenderId);
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }

        // --- نظام الشحن والسحب المفتوح في كل المجموعات بالرمز السري ---
        else if (text.startsWith('شحن ') || text.startsWith('سحب ')) {
            if (!text.includes("annoor77485")) {
                await sock.sendMessage(jid, { text: '❌ عذراً، خطأ في الرمز السري أو صيغة الأمر غير صحيحة!' }, { quoted: msg });
                return;
            }
            const parts = text.split(' ');
            const amount = parseInt(parts.find(p => !isNaN(p) && parseInt(p) > 0));
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;
            const targetJid = mentionedJid || quotedParticipant;

            if (!targetJid || isNaN(amount)) {
                await sock.sendMessage(jid, { text: '❌ صيغة الأمر غير صحيحة! استخدم: شحن/سحب [المبلغ] [الرمز] مع منشن.' }, { quoted: msg });
                return;
            }

            const targetId = targetJid.split('@')[0].split(':')[0];
            let res = "";
            if (text.startsWith('شحن')) {
                res = addMoney(targetId, amount);
            } else {
                res = subtractMoney(targetId, amount);
            }
            await sock.sendMessage(jid, { text: res }, { quoted: msg });
        }
    });
}

startBot();
