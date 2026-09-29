const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

const JOBS = {
  farmer: "🌾 المزارع",
  miner: "⛏️ المعدّن",
  blacksmith: "🔨 الحداد",
  tailor: "🧵 الخياط",
  clothing_merchant: "👔 تاجر الملابس",
  restaurant: "🍽️ المطعم",
  police: "👮 الشرطة"
};

const CHALLENGES = [
  "بوابة المدينة", "حي الفقير", "حي الغني", "السوق", "الميناء",
  "منطقة المصانع", "الطريق الشرقي", "المستودعات"
];

module.exports = function buildCommands(config) {
  const commands = [
    new SlashCommandBuilder().setName("شخصيتي").setDescription("عرض ملف شخصيتك"),
    new SlashCommandBuilder().setName("حقيبتي").setDescription("عرض المنتجات التي تملكها"),
    new SlashCommandBuilder().setName("رصيدي").setDescription("عرض رصيدك"),

    new SlashCommandBuilder()
      .setName("مهنة")
      .setDescription("إدارة مهنتك")
      .addSubcommand(s => s.setName("اختيار").setDescription("اختيار مهنة")
        .addStringOption(o => o.setName("المهنة").setDescription("المهنة").setRequired(true)
          .addChoices(...Object.entries(JOBS).map(([value,name]) => ({name,value})))))
      .addSubcommand(s => s.setName("معلومات").setDescription("عرض معلومات المهنة")),

    new SlashCommandBuilder()
      .setName("تعدين").setDescription("استخراج خام — مرة كل 4 ساعات"),

    new SlashCommandBuilder()
      .setName("زراعة").setDescription("تنفيذ دورة زراعية")
      .addStringOption(o => o.setName("المنتج").setDescription("نوع المحصول").setRequired(true)
        .addChoices(
          {name:"قمح",value:"wheat"},{name:"ذرة",value:"corn"},
          {name:"خضروات",value:"vegetables"},{name:"خشب",value:"wood"},
          {name:"جلد",value:"leather"},{name:"حليب",value:"milk"},
          {name:"بيض",value:"eggs"},{name:"لحم",value:"meat"}
        ))
      .addIntegerOption(o => o.setName("الكمية").setDescription("الكمية").setMinValue(1).setMaxValue(20).setRequired(true)),

    new SlashCommandBuilder()
      .setName("تصنيع").setDescription("تصنيع منتج")
      .addStringOption(o => o.setName("المنتج").setDescription("المنتج").setRequired(true)
        .addChoices(
          {name:"عربة جر حصان",value:"horse_cart"},
          {name:"درع",value:"shield"},
          {name:"سيف",value:"sword"}
        ))
      .addIntegerOption(o => o.setName("الكمية").setDescription("الكمية").setMinValue(1).setMaxValue(10).setRequired(true)),

    new SlashCommandBuilder()
      .setName("طبخ").setDescription("طبخ وجبة")
      .addStringOption(o => o.setName("المنتج").setDescription("الوجبة").setRequired(true)
        .addChoices({name:"وجبة لحم",value:"meal_meat"},{name:"وجبة خضار",value:"meal_vegetable"}))
      .addIntegerOption(o => o.setName("الكمية").setDescription("الكمية").setMinValue(1).setMaxValue(20).setRequired(true)),

    new SlashCommandBuilder()
      .setName("إنتاج_قماش").setDescription("إنتاج القماش — للخياط")
      .addIntegerOption(o => o.setName("الكمية").setDescription("الكمية").setMinValue(1).setMaxValue(30).setRequired(true)),

    new SlashCommandBuilder()
      .setName("صناعة_ملابس").setDescription("صناعة ملابس من القماش")
      .addStringOption(o => o.setName("المنتج").setDescription("الملابس").setRequired(true)
        .addChoices({name:"قميص",value:"shirt"},{name:"بنطال",value:"pants"},{name:"معطف",value:"coat"}))
      .addIntegerOption(o => o.setName("الكمية").setDescription("الكمية").setMinValue(1).setMaxValue(10).setRequired(true)),

    new SlashCommandBuilder()
      .setName("تأمين").setDescription("تأمين Challenge — للشرطة")
      .addStringOption(o => o.setName("المنطقة").setDescription("المنطقة").setRequired(true)
        .addChoices(...CHALLENGES.map(c => ({name:c,value:c})))),

    new SlashCommandBuilder()
      .setName("متجر").setDescription("إدارة المتجر")
      .addSubcommand(s => s.setName("إنشاء").setDescription("إنشاء متجر")
        .addStringOption(o=>o.setName("الاسم").setDescription("اسم المتجر").setRequired(true))
        .addStringOption(o=>o.setName("النوع").setDescription("نوع المتجر").setRequired(true)
          .addChoices(
            {name:"مطعم",value:"restaurant"},
            {name:"ملابس",value:"clothing"},
            {name:"حدادة",value:"blacksmith"},
            {name:"مواد خام",value:"raw_materials"},
            {name:"متجر عام",value:"general"}
          )))
      .addSubcommand(s => s.setName("مخزون").setDescription("عرض مخزون متجرك"))
      .addSubcommand(s => s.setName("إضافة").setDescription("إضافة منتج لكتالوج المتجر")
        .addIntegerOption(o=>o.setName("المتجر").setDescription("رقم المتجر").setRequired(true))
        .addStringOption(o=>o.setName("المنتج").setDescription("كود المنتج").setRequired(true)))
      .addSubcommand(s => s.setName("توريد").setDescription("توريد منتجات من حقيبتك إلى المتجر")
        .addIntegerOption(o=>o.setName("المتجر").setDescription("رقم المتجر").setRequired(true))
        .addStringOption(o=>o.setName("المنتج").setDescription("كود المنتج").setRequired(true))
        .addIntegerOption(o=>o.setName("الكمية").setDescription("الكمية").setMinValue(1).setRequired(true))),

    new SlashCommandBuilder()
      .setName("بيع_منتج").setDescription("إرسال طلب بيع لمستخدم")
      .addIntegerOption(o=>o.setName("المتجر").setDescription("رقم المتجر").setRequired(true))
      .addUserOption(o=>o.setName("المشتري").setDescription("المشتري").setRequired(true))
      .addStringOption(o=>o.setName("المنتج").setDescription("كود المنتج").setRequired(true))
      .addIntegerOption(o=>o.setName("الكمية").setDescription("الكمية").setMinValue(1).setRequired(true))
      .addIntegerOption(o=>o.setName("السعر").setDescription("السعر الإجمالي").setMinValue(1).setRequired(true)),

    new SlashCommandBuilder()
      .setName("تحويل").setDescription("تحويل وحدات ذكاء")
      .addUserOption(o=>o.setName("المستلم").setDescription("المستلم").setRequired(true))
      .addIntegerOption(o=>o.setName("المبلغ").setDescription("المبلغ").setMinValue(1).setRequired(true)),

    new SlashCommandBuilder().setName("أكل").setDescription("استهلاك الطعام لتخفيف الجوع"),
    new SlashCommandBuilder()
      .setName("بنك").setDescription("إدارة البنك")
      .addSubcommand(s=>s.setName("إيداع").setDescription("إيداع مبلغ"))
      .addSubcommand(s=>s.setName("سحب").setDescription("سحب مبلغ")),
    new SlashCommandBuilder()
      .setName("سكن").setDescription("إدارة السكن")
      .addStringOption(o=>o.setName("النوع").setDescription("نوع السكن").setRequired(true)
        .addChoices(
          {name:"غرفة متواضعة",value:"room"},
          {name:"شقة صغيرة",value:"apartment"},
          {name:"شقة فاخرة",value:"luxury"},
          {name:"منزل",value:"house"}
        )),
    new SlashCommandBuilder().setName("خدمات").setDescription("دفع الماء والكهرباء"),
    new SlashCommandBuilder().setName("سوق").setDescription("عرض المنتجات المسجلة"),
    new SlashCommandBuilder().setName("المهام").setDescription("عرض مهامك")
  ];

  return commands.map(c => c.toJSON());
};

module.exports.JOBS = JOBS;
module.exports.CHALLENGES = CHALLENGES;
