/**
 * 🔥 HACKER HELL — نظام تعذيب الهاكرز
 * كل رسالة مسجّلة مع IP وتُرسل لتيليغرام
 */
import { sendTelegramMessage } from "./telegram.js";

// رسائل تصاعدية — كلما حاولوا أكثر كلما أصبحت أشد سخرية
const SARCASTIC_MESSAGES = [
  // المحاولة الأولى
  "🙋 أهلاً! يبدو أنك ضايع، هل تريد خريطة؟",
  // المحاولة الثانية
  "🤔 مازلت تحاول؟ الباب مغلق يا صاحبي.",
  // المحاولة الثالثة
  "☕ خذ استراحة وشرب قهوة، موقعنا ليس هنا.",
  // المحاولة الرابعة
  "📸 ابتسم! لقد صوّرناك — IP: {IP}",
  // المحاولة الخامسة
  "🕵️ نعم، نحن نعرف كل شيء. IP: {IP} — الوقت: {TIME}",
  // المحاولة السادسة
  "😴 يبدو أنك لا تفهم كلمة 'لا'. هل تريد ترجمة؟",
  // المحاولة السابعة
  "🎮 هل تعتقد أن هذا لعبة فيديو؟ Game Over.",
  // المحاولة الثامنة
  "📞 لقد أخبرنا الشرطة، استمتع بانتظار الطرق على الباب.",
  // المحاولة التاسعة
  "🤡 أنت أفضل مهرج قابلناه هذا الأسبوع.",
  // العاشرة فأكثر
  "🏆 تهانينا! فزت بجائزة 'أكثر شخص يضيع وقته' لهذا الشهر. سنتصل بك... لا، لن نتصل.",
];

// رسائل للـ honeypot endpoints
const HONEYPOT_MESSAGES: Record<string, string> = {
  "/.env": "🍯 آه، كنت تبحث عن .env؟ هذا الملف أعددناه خصيصاً لك. استمتع بالمفاتيح المزيفة 🔑 نراك قريباً في التيليغرام.",
  "/wp-admin": "👻 ووردبريس؟ نحن لا نستخدم ووردبريس يا حبيبي. لكن شكراً على الزيارة!",
  "/phpmyadmin": "🗃️ phpMyAdmin؟ عام 2010 اتصل يريد تقنيته التي نسيتها.",
  "/admin.php": "🔐 كلمة السر هي: 'توقف عن محاولة الاختراق'. جرّبها.",
  "/.git/config": "📁 هل تحب git؟ إليك repo رائعة: github.com/يوقف-الاختراق",
  "/backup.sql": "💾 قاعدة بيانات كاملة مزيفة لك! فيها 10 ملايين صف من البيانات العشوائية. استمتع بتحليلها 😄",
  "/xmlrpc.php": "📡 xmlrpc؟ هل أنت من الماضي؟ هذا الثغرة ماتت قبل ما تولد.",
  "/api/v1/users": "👥 إليك قائمة المستخدمين: [{name: 'الهاكر الفاشل', email: 'you@wasted-your-time.dz'}]",
};

// رسائل إضافية ساخرة — للجولات المتقدمة
const EXTRA_ROASTS = [
  "🔍 لقد بحثنا عنك في غوغل. لم نجد شيئاً. حتى الإنترنت لا يعرفك.",
  "🤖 ربما أنت بوت. البوتات ليس لها مشاعر. لكن نحن نتألم من ضحكنا عليك.",
  "🎓 هل دفعت أموالاً لتتعلم الاختراق؟ اطلب استرداد أموالك.",
  "📱 أمك تتصل. انتهز الفرصة وأخبرها ماذا تفعل.",
  "☁️ بياناتك محفوظة في سحابتنا السرية. سحابة الاختراقات الفاشلة.",
  "🎪 لقد أضفناك إلى متحف الهاكرز الفاشلين. الدخول مجاني.",
  "🌡️ درجة خطورتك: أقل من قرصنة حساب الألعاب.",
  "🔐 الباب مقفل، والمفتاح في المريخ، وأنت في الأرض.",
  "🎭 اللحظة التي تعتقد فيها أنك اخترقت شيئاً: هذه اللحظة.",
  "🛑 تحذير: الاستمرار قد يسبب إحباطاً مزمناً وخسارة في الوقت.",
];

// رسائل وهمية للأدمن (للمن يحاول اختراق لوحة التحكم)
const FAKE_ADMIN_MESSAGES = [
  "✅ تسجيل دخول ناجح! جاري تحميل البيانات السرية...",
  "⏳ يرجى الانتظار، نقوم بتحميل 847,293 طلب...",
  "🔄 جارٍ التحميل... 1%... 2%... 3%...",
  "💾 تصدير قاعدة البيانات: 0 bytes/s — ربما الإنترنت بطيء؟",
  "🎉 مرحباً بك في لوحة التحكم السرية! للأسف لا يوجد شيء هنا.",
];

const attackCounts = new Map<string, { count: number; firstSeen: number }>();

export function getHackerMessage(ip: string): string {
  const now = Date.now();
  const data = attackCounts.get(ip) ?? { count: 0, firstSeen: now };
  data.count++;
  attackCounts.set(ip, data);

  const idx = Math.min(data.count - 1, SARCASTIC_MESSAGES.length - 1);
  const msg = SARCASTIC_MESSAGES[idx]
    .replace("{IP}", ip)
    .replace("{TIME}", new Date().toLocaleString("ar-DZ"));

  // Add extra roast every 3rd attempt
  let finalMsg = msg;
  if (data.count % 3 === 0) {
    const roastIdx = Math.floor(data.count / 3 - 1) % EXTRA_ROASTS.length;
    finalMsg = msg + "\n\n" + EXTRA_ROASTS[roastIdx];
  }

  // Alert in Telegram after 3rd attempt
  if (data.count >= 3) {
    void sendTelegramMessage(
      `🔥 <b>هاكر يعاني!</b>\n` +
      `🌐 IP: <code>${ip}</code>\n` +
      `🔢 المحاولة رقم: ${data.count}\n` +
      `⏱ منذ: ${Math.round((now - data.firstSeen) / 60000)} دقيقة\n` +
      `💬 الرسالة: ${finalMsg.slice(0, 200)}`,
    );
  }

  return finalMsg;
}

export function getHoneypotMessage(path: string, ip: string): string {
  const msg = HONEYPOT_MESSAGES[path] ?? `🍯 وقعت في الفخ يا ${ip}! هذا المسار مراقب.`;

  void sendTelegramMessage(
    `🍯 <b>هاكر وقع في الفخ!</b>\n` +
    `🌐 IP: <code>${ip}</code>\n` +
    `📂 المسار: ${path}\n` +
    `🕐 الوقت: ${new Date().toLocaleString("ar-DZ")}`,
  );

  return msg;
}

// تأخير تصاعدي — كلما حاولوا أكثر تأخرنا أكثر (بالثواني)
export async function tarpit(ip: string): Promise<void> {
  const data = attackCounts.get(ip);
  const count = data?.count ?? 1;
  const delaySeconds = Math.min(count * 8, 120); // max 2 minutes
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}

export function getFakeAdminMessage(): string {
  return FAKE_ADMIN_MESSAGES[Math.floor(Math.random() * FAKE_ADMIN_MESSAGES.length)];
}

// Canary token — مفتاح وهمي يحذّرنا لما يستخدمه أحد
export const CANARY_TOKEN = "sk_VISADZ_CANARY_IF_YOU_USE_THIS_WE_KNOW_YOU";

export async function checkCanaryToken(token: string, ip: string): Promise<boolean> {
  if (token === CANARY_TOKEN || token.includes("CANARY")) {
    await sendTelegramMessage(
      `🚨 <b>CANARY TOKEN USED!</b>\n` +
      `IP: <code>${ip}</code> استخدم الـ canary token!\n` +
      `هذا الشخص وجد مفاتيحنا المزيفة وحاول استخدامها.`,
    );
    return true;
  }
  return false;
}
