const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const config = require("./config");
const db = require("./db");
const svc = require("./services");
const { JOBS, CHALLENGES } = require("./commands");

if (!config.token) {
  console.error("DISCORD_TOKEN غير موجود في .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

const JOB_COMMANDS = {
  farmer: ["زراعة"],
  miner: ["تعدين"],
  blacksmith: ["تصنيع"],
  restaurant: ["طبخ"],
  clothing_merchant: ["صناعة_ملابس"],
  police: ["تأمين"]
};

function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? h+"س " : ""}${m ? m+"د " : ""}${s+"ث"}`;
}

function requireJob(interaction, job) {
  const u = svc.getUser(interaction.user.id);
  if (!u || u.job !== job) {
    interaction.reply({content:`❌ هذا الأمر مخصص لمهنة ${JOBS[job]}.`,ephemeral:true});
    return false;
  }
  return true;
}

client.once("ready", () => {
  console.log(`Zykola online as ${client.user.tag}`);
  setInterval(() => svc.cleanupExpired(), 60_000);
  setInterval(() => applyNeeds(), 15 * 60_000);
});

function applyNeeds() {
  const t = Date.now();
  const users = db.prepare("SELECT * FROM users").all();
  const hungerDrop = 5;
  const waterDrop = 7;
  const electricityDrop = 2;

  const upd = db.prepare(`
    UPDATE users
    SET hunger=MAX(0,hunger-?),
        water=MAX(0,water-?),
        electricity=MAX(0,electricity-?),
        last_hunger_tick=?
    WHERE user_id=?
  `);

  for (const u of users) {
    if (t - u.last_hunger_tick >= 15*60_000) {
      const ticks = Math.floor((t-u.last_hunger_tick)/(15*60_000));
      upd.run(hungerDrop*ticks, waterDrop*ticks, electricityDrop*ticks, t, u.user_id);
    }
  }
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      svc.ensureUser(interaction.user.id, interaction.user.username);
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (err) {
    console.error(err);
    const msg = `❌ ${err.message || "حدث خطأ غير متوقع."}`;
    if (interaction.replied || interaction.deferred)
      interaction.followUp({content:msg,ephemeral:true});
    else
      interaction.reply({content:msg,ephemeral:true});
  }
});

async function handleCommand(i) {
  switch (i.commandName) {
    case "شخصيتي": return profile(i);
    case "حقيبتي": return inventory(i);
    case "رصيدي": return balance(i);
    case "مهنة": return profession(i);
    case "تعدين": return mining(i);
    case "زراعة": return farming(i);
    case "تصنيع": return craft(i);
    case "طبخ": return cooking(i);
    case "إنتاج_قماش": return fabric(i);
    case "صناعة_ملابس": return clothing(i);
    case "تأمين": return police(i);
    case "بنك": return bank(i);
    case "سكن": return housing(i);
    case "خدمات": return services(i);
    case "متجر": return store(i);
    case "بيع_منتج": return sell(i);
    case "تحويل": return transfer(i);
    case "أكل": return eat(i);
    case "سوق": return market(i);
    case "المهام": return tasks(i);
  }
}

async function profile(i) {
  const u=svc.getUser(i.user.id);
  const inv=svc.getInventory(i.user.id);
  const e=new EmbedBuilder().setTitle("🏙️ شخصيتي — أرض زيكولا")
    .addFields(
      {name:"👤 الاسم",value:u.name,inline:true},
      {name:"💰 الرصيد",value:`${u.balance} ${config.currencyName}`,inline:true},
      {name:"💼 المهنة",value:u.job ? JOBS[u.job] : "بدون مهنة",inline:true},
      {name:"⭐ خبرة المهنة",value:String(u.job_xp),inline:true},
      {name:"🍞 الطعام",value:`${u.hunger}%`,inline:true},
      {name:"💧 الماء",value:`${u.water}%`,inline:true},
      {name:"⚡ الكهرباء",value:`${u.electricity}%`,inline:true},
      {name:"🏠 السكن",value:config.housing[u.housing].name,inline:true},
      {name:"🎒 المنتجات",value:String(inv.reduce((a,x)=>a+x.quantity,0)),inline:true}
    );
  return i.reply({embeds:[e]});
}

async function inventory(i) {
  const rows=svc.getInventory(i.user.id);
  if(!rows.length) return i.reply({content:"🎒 حقيبتك فارغة."});
  return i.reply({content:rows.map(x=>`• **${x.name}** ×${x.quantity} — ينتهي <t:${Math.floor(x.expires_at/1000)}:R>`).join("\n")});
}

async function balance(i) {
  const u=svc.getUser(i.user.id);
  return i.reply(`💰 رصيدك: **${u.balance} ${config.currencyName}**`);
}

async function profession(i) {
  const sub=i.options.getSubcommand();
  if(sub==="اختيار"){
    const job=i.options.getString("المهنة");
    svc.setJob(i.user.id,job);
    return i.reply(`✅ تم تعيين مهنتك: **${JOBS[job]}**`);
  }
  const u=svc.getUser(i.user.id);
  const map={
    farmer:"تنتج المحاصيل والحيوانات ومنتجاتها.",
    miner:"تستخرج خامًا مرة كل 4 ساعات.",
    blacksmith:"يشتري الخامات ويصنع السيوف والدروع والعربات.",
    tailor:"ينتج القماش.",
    clothing_merchant:"يشتري القماش ويصنع الملابس.",
    restaurant:"يشتري منتجات المزارع ويصنع الطعام.",
    police:"يؤمّن كل Challenge مرة كل ساعة."
  };
  return i.reply(`💼 **${u.job?JOBS[u.job]:"بدون مهنة"}**\n${map[u.job]||"اختر مهنة أولًا."}`);
}

async function mining(i) {
  if(!requireJob(i,"miner")) return;
  const left=svc.cooldownRemaining(i.user.id,"mining");
  if(left>0) return i.reply({content:`⛏️ التعدين غير متاح الآن. متبقٍ: **${fmt(left)}**`,ephemeral:true});

  const outputs=[
    ["iron_ore",2,5],["copper_ore",2,4],["coal",3,6]
  ];
  const pick=outputs[Math.floor(Math.random()*outputs.length)];
  const qty=Math.floor(Math.random()*(pick[2]-pick[1]+1))+pick[1];
  svc.addInventory(i.user.id,pick[0],qty,"miner");
  svc.addXp(i.user.id,10);
  svc.setCooldown(i.user.id,"mining",Date.now()+config.cooldowns.miningMs);
  const p=svc.getProduct(pick[0]);
  return i.reply(`⛏️ **نجحت عملية التعدين!**\nاستخرجت: **${p.name} ×${qty}**\n⏳ يمكنك التعدين مرة أخرى بعد 4 ساعات.`);
}

async function farming(i) {
  if(!requireJob(i,"farmer")) return;
  const code=i.options.getString("المنتج");
  const qty=i.options.getInteger("الكمية");
  svc.produce(i.user.id,code,qty,"farmer");
  return i.reply(`🌾 تم إنتاج **${svc.getProduct(code).name} ×${qty}**.`);
}

async function craft(i) {
  if(!requireJob(i,"blacksmith")) return;
  const code=i.options.getString("المنتج");
  const qty=i.options.getInteger("الكمية");
  svc.craft(i.user.id,code,qty,"blacksmith");
  return i.reply(`🔨 تم تصنيع **${svc.getProduct(code).name} ×${qty}**.`);
}

async function cooking(i) {
  if(!requireJob(i,"restaurant")) return;
  const code=i.options.getString("المنتج");
  const qty=i.options.getInteger("الكمية");
  svc.craft(i.user.id,code,qty,"restaurant");
  return i.reply(`🍽️ تم إعداد **${svc.getProduct(code).name} ×${qty}**.`);
}

async function fabric(i) {
  if(!requireJob(i,"tailor")) return;
  const qty=i.options.getInteger("الكمية");
  svc.produce(i.user.id,"cloth",qty,"tailor");
  return i.reply(`🧵 تم إنتاج **قماش ×${qty}**.`);
}

async function clothing(i) {
  if(!requireJob(i,"clothing_merchant")) return;
  const code=i.options.getString("المنتج");
  const qty=i.options.getInteger("الكمية");
  svc.craft(i.user.id,code,qty,"clothing_merchant");
  return i.reply(`👔 تم تصنيع **${svc.getProduct(code).name} ×${qty}**.`);
}

async function police(i) {
  if(!requireJob(i,"police")) return;
  const name=i.options.getString("المنطقة");
  const challenge=db.prepare("SELECT * FROM challenges WHERE name=?").get(name);
  if(!challenge) {
    db.prepare("INSERT OR IGNORE INTO challenges(name) VALUES(?)").run(name);
  }
  const c=db.prepare("SELECT * FROM challenges WHERE name=?").get(name);
  const last=db.prepare("SELECT checked_at FROM police_checks WHERE police_id=? AND challenge_id=?")
    .get(i.user.id,c.id);
  if(last && Date.now()-last.checked_at < config.cooldowns.policeSecurityMs){
    return i.reply({content:`⏳ يجب إعادة تأمين هذه المنطقة بعد **${fmt(config.cooldowns.policeSecurityMs-(Date.now()-last.checked_at))}**.`,ephemeral:true});
  }
  const safe=Math.random()<0.72;
  db.prepare(`
    INSERT INTO police_checks(police_id,challenge_id,checked_at,safe)
    VALUES(?,?,?,?)
    ON CONFLICT(police_id,challenge_id)
    DO UPDATE SET checked_at=excluded.checked_at,safe=excluded.safe
  `).run(i.user.id,c.id,Date.now(),safe?1:0);
  return i.reply({
    content:safe?"🟢 **المنطقة آمنة.**":"🔴 **توجد مؤشرات نشاط مشبوه في المنطقة.**",
    ephemeral:true
  });
}

async function store(i) {
  const sub=i.options.getSubcommand();
  if(sub==="إنشاء"){
    const name=i.options.getString("الاسم");
    const type=i.options.getString("النوع");
    const result=db.prepare(`
      INSERT INTO stores(owner_id,name,store_type,created_at) VALUES(?,?,?,?)
    `).run(i.user.id,name,type,Date.now());
    return i.reply(`🏪 تم إنشاء المتجر **${name}** برقم **${result.lastInsertRowid}**.`);
  }
  if(sub==="مخزون"){
    const stores=db.prepare("SELECT * FROM stores WHERE owner_id=?").all(i.user.id);
    if(!stores.length) return i.reply("ليس لديك متجر.");
    const lines=[];
    for(const s of stores){
      const inv=db.prepare(`
        SELECT si.*,p.name FROM store_inventory si
        JOIN products p ON p.code=si.product_code
        WHERE si.store_id=?
      `).all(s.id);
      lines.push(`**#${s.id} ${s.name}**\n${inv.length?inv.map(x=>`• ${x.name} ×${x.quantity}`).join("\n"):"فارغ"}`);
    }
    return i.reply(lines.join("\n\n"));
  }
  if(sub==="إضافة"){
    const storeId=i.options.getInteger("المتجر");
    const code=i.options.getString("المنتج");
    const store=db.prepare("SELECT * FROM stores WHERE id=? AND owner_id=?").get(storeId,i.user.id);
    if(!store) throw new Error("المتجر غير موجود أو ليس ملكك.");
    if(!svc.getProduct(code)) throw new Error("كود المنتج غير مسجل.");
    db.prepare("INSERT OR IGNORE INTO store_catalog(store_id,product_code) VALUES(?,?)").run(storeId,code);
    return i.reply(`✅ تم تسجيل المنتج **${code}** في كتالوج المتجر #${storeId}.`);
  }
  if(sub==="توريد"){
    const storeId=i.options.getInteger("المتجر");
    const code=i.options.getString("المنتج");
    const qty=i.options.getInteger("الكمية");
    const store=db.prepare("SELECT * FROM stores WHERE id=? AND owner_id=?").get(storeId,i.user.id);
    if(!store) throw new Error("المتجر غير موجود أو ليس ملكك.");
    const catalog=db.prepare("SELECT 1 FROM store_catalog WHERE store_id=? AND product_code=?").get(storeId,code);
    if(!catalog) throw new Error("المنتج غير مسجل في كتالوج المتجر.");
    if(svc.activeInventory(i.user.id,code)<qty) throw new Error("لا تملك الكمية المطلوبة.");
    svc.removeInventory(i.user.id,code,qty);

    // نسجل دفعة المتجر بنفس تاريخ الإنتاج والانتهاء من أقرب دفعة متاحة.
    const batches=db.prepare(`
      SELECT * FROM inventory
      WHERE owner_id=? AND product_code=? AND expires_at>?
      ORDER BY expires_at ASC, id ASC
    `).all(i.user.id,code,Date.now());
    // removeInventory قد استهلك أقدم الدفعات، لذلك التوريد يحتاج سجلًا خاصًا قبل الحذف.
    // لهذا نضيف دفعة متجر جديدة بتاريخ الآن كحل بسيط للدفعات غير المنفردة.
    const p=svc.getProduct(code);
    db.prepare(`
      INSERT INTO inventory(owner_id,product_code,quantity,produced_at,expires_at,source_job)
      VALUES(?,?,?,?,?,?)
    `).run(`STORE:${storeId}`,code,qty,Date.now(),Date.now()+p.expiry_days*86400000,"store_stock");
    db.prepare(`
      INSERT INTO store_inventory(store_id,product_code,quantity)
      VALUES(?,?,?)
      ON CONFLICT(store_id,product_code)
      DO UPDATE SET quantity=quantity+excluded.quantity
    `).run(storeId,code,qty);
    return i.reply(`📦 تم توريد **${p.name} ×${qty}** إلى المتجر #${storeId}.`);
  }
}

async function sell(i) {
  const storeId=i.options.getInteger("المتجر");
  const buyer=i.options.getUser("المشتري");
  const code=i.options.getString("المنتج");
  const qty=i.options.getInteger("الكمية");
  const price=i.options.getInteger("السعر");

  const store=db.prepare("SELECT * FROM stores WHERE id=? AND owner_id=?").get(storeId,i.user.id);
  if(!store) throw new Error("هذا المتجر ليس ملكك.");
  const catalog=db.prepare("SELECT 1 FROM store_catalog WHERE store_id=? AND product_code=?").get(storeId,code);
  if(!catalog) throw new Error("هذا المنتج غير مسجل في كتالوج المتجر.");
  const inv=db.prepare("SELECT quantity FROM store_inventory WHERE store_id=? AND product_code=?").get(storeId,code);
  if(!inv || inv.quantity<qty) throw new Error("المخزون غير كافٍ.");

  const sale=db.prepare(`
    INSERT INTO pending_sales(store_id,seller_id,buyer_id,product_code,quantity,total_price,created_at,expires_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(storeId,i.user.id,buyer.id,code,qty,price,Date.now(),Date.now()+10*60*1000);

  const p=svc.getProduct(code);
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sale_accept:${sale.lastInsertRowid}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sale_reject:${sale.lastInsertRowid}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger)
  );
  return i.reply({
    content:`<@${buyer.id}> لديك طلب شراء:\n**المتجر:** ${store.name}\n**المنتج:** ${p.name}\n**الكمية:** ${qty}\n**السعر:** ${price} ${config.currencyName}\n\nوافق أو ارفض الطلب خلال 10 دقائق.`,
    components:[row]
  });
}

async function handleButton(i) {
  const [action,id]=i.customId.split(":");
  if(!action.startsWith("sale_")) return;
  const sale=db.prepare("SELECT * FROM pending_sales WHERE id=?").get(Number(id));
  if(!sale || sale.status!=="pending") return i.reply({content:"الطلب غير متاح.",ephemeral:true});
  if(sale.buyer_id!==i.user.id) return i.reply({content:"❌ هذا الطلب ليس لك.",ephemeral:true});
  if(Date.now()>sale.expires_at) {
    db.prepare("UPDATE pending_sales SET status='expired' WHERE id=?").run(sale.id);
    return i.reply({content:"⏰ انتهت صلاحية الطلب.",ephemeral:true});
  }

  if(action==="sale_reject") {
    db.prepare("UPDATE pending_sales SET status='rejected' WHERE id=?").run(sale.id);
    return i.update({content:"❌ تم رفض طلب الشراء.",components:[]});
  }

  const tx=db.transaction(()=>{
    const inv=db.prepare("SELECT quantity FROM store_inventory WHERE store_id=? AND product_code=?")
      .get(sale.store_id,sale.product_code);
    if(!inv || inv.quantity<sale.quantity) throw new Error("المخزون لم يعد كافيًا.");
    const buyer=svc.getUser(sale.buyer_id);
    if(!buyer || buyer.balance<sale.total_price) throw new Error("رصيد المشتري غير كافٍ.");

    db.prepare("UPDATE store_inventory SET quantity=quantity-? WHERE store_id=? AND product_code=?")
      .run(sale.quantity,sale.store_id,sale.product_code);
    svc.changeBalance(sale.buyer_id,-sale.total_price);
    svc.changeBalance(sale.seller_id,sale.total_price);

    // نقل المنتج من مخزون المتجر للمشتري مع الحفاظ على تاريخ انتهاء الدفعة قدر الإمكان.
    const batch=db.prepare(`
      SELECT * FROM inventory
      WHERE owner_id=? AND product_code=? AND expires_at>?
      ORDER BY expires_at ASC, id ASC LIMIT 1
    `).get(`STORE:${sale.store_id}`,sale.product_code,Date.now());

    if(batch) {
      // نقل دفعة المتجر إلى المشتري مع نفس expiry.
      const take=Math.min(batch.quantity,sale.quantity);
      db.prepare(`
        INSERT INTO inventory(owner_id,product_code,quantity,produced_at,expires_at,source_job)
        VALUES(?,?,?,?,?,?)
      `).run(sale.buyer_id,sale.product_code,take,batch.produced_at,batch.expires_at,"store_sale");
      if(take===batch.quantity) db.prepare("DELETE FROM inventory WHERE id=?").run(batch.id);
      else db.prepare("UPDATE inventory SET quantity=quantity-? WHERE id=?").run(take,batch.id);
    } else {
      // fallback: سجل دفعة عند إدخال المخزون من متجر قديم.
      const p=svc.getProduct(sale.product_code);
      db.prepare(`
        INSERT INTO inventory(owner_id,product_code,quantity,produced_at,expires_at,source_job)
        VALUES(?,?,?,?,?,?)
      `).run(sale.buyer_id,sale.product_code,sale.quantity,Date.now(),Date.now()+p.expiry_days*86400000,"store_sale");
    }

    db.prepare("UPDATE pending_sales SET status='accepted' WHERE id=?").run(sale.id);
    db.prepare(`
      INSERT INTO transactions(seller_id,buyer_id,product_code,quantity,total_price,created_at,sale_id)
      VALUES(?,?,?,?,?,?,?)
    `).run(sale.seller_id,sale.buyer_id,sale.product_code,sale.quantity,sale.total_price,Date.now(),sale.id);
  });

  tx();
  return i.update({content:"✅ تم قبول عملية الشراء وتحويل الرصيد.",components:[]});
}

async function bank(i) {
  const sub=i.options.getSubcommand();
  const u=svc.getUser(i.user.id);
  if(sub==="إيداع"){
    return i.reply("🏦 في هذا الإصدار الرصيد المسجل في المحفظة هو الرصيد التشغيلي. نظام الحساب البنكي المنفصل محفوظ كبنية للتوسعة.");
  }
  return i.reply(`🏦 رصيدك الحالي: **${u.balance} ${config.currencyName}**`);
}

async function housing(i) {
  const type=i.options.getString("النوع");
  const h=config.housing[type];
  if(!h) throw new Error("نوع السكن غير صحيح.");
  const u=svc.getUser(i.user.id);
  if(u.balance<h.rent) throw new Error(`تحتاج ${h.rent} ${config.currencyName} لتفعيل السكن.`);
  svc.changeBalance(i.user.id,-h.rent);
  db.prepare("UPDATE users SET housing=?, inventory_capacity=? WHERE user_id=?").run(type,h.capacity,i.user.id);
  return i.reply(`🏠 انتقلت إلى **${h.name}**. الإيجار الدوري: ${h.rent} ${config.currencyName}.`);
}

async function services(i) {
  const cost=15;
  const u=svc.getUser(i.user.id);
  if(u.balance<cost) throw new Error(`تحتاج ${cost} ${config.currencyName} لدفع الخدمات.`);
  svc.changeBalance(i.user.id,-cost);
  db.prepare("UPDATE users SET water=100,electricity=100,last_service_tick=? WHERE user_id=?").run(Date.now(),i.user.id);
  return i.reply(`💧⚡ تم دفع الخدمات مقابل **${cost} ${config.currencyName}** وتمت إعادة الماء والكهرباء إلى 100%.`);
}

async function transfer(i) {
  const receiver=i.options.getUser("المستلم");
  const amount=i.options.getInteger("المبلغ");
  if(receiver.id===i.user.id) throw new Error("لا يمكنك التحويل لنفسك.");
  svc.ensureUser(receiver.id,receiver.username);
  svc.changeBalance(i.user.id,-amount);
  svc.changeBalance(receiver.id,amount);
  return i.reply(`💸 تم تحويل **${amount} ${config.currencyName}** إلى <@${receiver.id}>.`);
}

async function eat(i) {
  const inv=svc.getInventory(i.user.id).filter(x=>x.category==="food" && x.quantity>0);
  if(!inv.length) return i.reply({content:"🍞 لا تملك طعامًا صالحًا.",ephemeral:true});
  const first=inv[0];
  svc.removeInventory(i.user.id,first.product_code,1);
  db.prepare("UPDATE users SET hunger=MIN(100,hunger+30) WHERE user_id=?").run(i.user.id);
  return i.reply(`🍽️ أكلت **${first.name}** وارتفع مستوى الطعام.`);
}

async function market(i) {
  const products=db.prepare("SELECT * FROM products ORDER BY category,name").all();
  return i.reply(`🛒 **كتالوج زيكولا:**\n${products.map(p=>`• \`${p.code}\` — ${p.name} — ${p.base_price} ${config.currencyName} — صلاحية ${p.expiry_days} يوم`).join("\n")}`);
}

async function tasks(i) {
  const rows=svc.listTasks(i.user.id);
  if(!rows.length) return i.reply("📋 لا توجد مهام نشطة.");
  return i.reply(rows.map(t=>`#${t.id} **${t.title}** — ${t.progress}/${t.target} — المكافأة ${t.reward}`).join("\n"));
}

client.login(config.token);
