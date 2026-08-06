# استخدام إصدار نود الحديث والمستقر على Alpine
FROM node:20-alpine

# تثبيت الأدوات الضرورية (tzdata للوقت و git لتحميل الاعتماديات التي تعتمد على مستودعات خارجية)
RUN apk add --no-cache tzdata git

# إنشاء مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات الاعتماديات أولاً
COPY package*.json ./

# تثبيت الحزم المطلوبة مع استخدام --omit=dev بدلاً من --production
RUN npm install --omit=dev

# نسخ باقي ملفات المشروع إلى داخل الحاوية
COPY . .

# أمر تشغيل البوت عند بدء الحاوية
CMD ["npm", "start"]
