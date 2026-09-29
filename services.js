const db = require("./db");
const config = require("./config");

const now = () => Date.now();

function ensureUser(userId, name) {
  let user = db.prepare("SELECT * FROM users WHERE user_id=?").get(userId);
  if (!user) {
    const t = now();
    db.prepare(`
      INSERT INTO users
      (user_id,name,balance,hunger,water,electricity,housing,inventory_capacity,created_at,last_hunger_tick,last_service_tick)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      userId, name, config.startingBalance, config.startingHunger,
      config.startingWater, config.startingElectricity, "room", 20, t, t, t
    );
    user = db.prepare("SELECT * FROM users WHERE user_id=?").get(userId);
  }
  return user;
}

function getUser(userId) {
  return db.prepare("SELECT * FROM users WHERE user_id=?").get(userId);
}

function changeBalance(userId, amount) {
  const user = getUser(userId);
  if (!user) throw new Error("المستخدم غير مسجل.");
  if (user.balance + amount < 0) throw new Error("الرصيد غير كافٍ.");
  db.prepare("UPDATE users SET balance=balance+? WHERE user_id=?").run(amount, userId);
}

function setJob(userId, job) {
  db.prepare("UPDATE users SET job=?, job_xp=0 WHERE user_id=?").run(job, userId);
}

function addXp(userId, xp) {
  db.prepare("UPDATE users SET job_xp=job_xp+? WHERE user_id=?").run(xp, userId);
}

function getProduct(code) {
  return db.prepare("SELECT * FROM products WHERE code=?").get(code);
}

function activeInventory(ownerId, productCode) {
  const t = now();
  return db.prepare(`
    SELECT COALESCE(SUM(quantity),0) qty
    FROM inventory
    WHERE owner_id=? AND product_code=? AND expires_at>?
  `).get(ownerId, productCode, t).qty;
}

function addInventory(ownerId, productCode, quantity, sourceJob) {
  if (quantity <= 0) throw new Error("الكمية غير صحيحة.");
  const product = getProduct(productCode);
  if (!product) throw new Error("المنتج غير مسجل.");

  const user = getUser(ownerId);
  const used = db.prepare(`
    SELECT COALESCE(SUM(quantity),0) qty FROM inventory
    WHERE owner_id=? AND expires_at>?
  `).get(ownerId, now()).qty;

  if (used + quantity > user.inventory_capacity) {
    throw new Error(`سعة الحقيبة غير كافية. المتاح: ${Math.max(0, user.inventory_capacity-used)}`);
  }

  const t = now();
  const expires = t + product.expiry_days * 24 * 60 * 60 * 1000;
  db.prepare(`
    INSERT INTO inventory(owner_id,product_code,quantity,produced_at,expires_at,source_job)
    VALUES(?,?,?,?,?,?)
  `).run(ownerId, productCode, quantity, t, expires, sourceJob || null);
}

function removeInventory(ownerId, productCode, quantity) {
  if (activeInventory(ownerId, productCode) < quantity) {
    throw new Error("الكمية المتاحة غير كافية.");
  }
  let remaining = quantity;
  const rows = db.prepare(`
    SELECT * FROM inventory
    WHERE owner_id=? AND product_code=? AND expires_at>?
    ORDER BY expires_at ASC, id ASC
  `).all(ownerId, productCode, now());

  const del = db.prepare("DELETE FROM inventory WHERE id=?");
  const upd = db.prepare("UPDATE inventory SET quantity=? WHERE id=?");

  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity, remaining);
    if (take === row.quantity) del.run(row.id);
    else upd.run(row.quantity - take, row.id);
    remaining -= take;
  }
}

function getInventory(ownerId) {
  return db.prepare(`
    SELECT i.product_code, p.name, p.category,
           SUM(i.quantity) quantity,
           MIN(i.expires_at) expires_at
    FROM inventory i JOIN products p ON p.code=i.product_code
    WHERE i.owner_id=? AND i.expires_at>?
    GROUP BY i.product_code
    ORDER BY p.category, p.name
  `).all(ownerId, now());
}

function setCooldown(userId, action, readyAt) {
  db.prepare(`
    INSERT INTO cooldowns(user_id,action,ready_at) VALUES(?,?,?)
    ON CONFLICT(user_id,action) DO UPDATE SET ready_at=excluded.ready_at
  `).run(userId, action, readyAt);
}

function cooldownRemaining(userId, action) {
  const row = db.prepare("SELECT ready_at FROM cooldowns WHERE user_id=? AND action=?")
    .get(userId, action);
  if (!row) return 0;
  return Math.max(0, row.ready_at - now());
}

function cleanupExpired() {
  db.prepare("DELETE FROM inventory WHERE expires_at<=?").run(now());
  db.prepare("UPDATE pending_sales SET status='expired' WHERE status='pending' AND expires_at<=?").run(now());
}

function produce(userId, code, quantity, job) {
  const product = getProduct(code);
  if (!product) throw new Error("المنتج غير مسجل.");
  if (product.producer_job !== job) throw new Error("هذه المهنة لا تنتج هذا المنتج.");
  addInventory(userId, code, quantity, job);
  addXp(userId, 5 * quantity);
}

function craft(userId, outputCode, quantity, job) {
  const product = getProduct(outputCode);
  if (!product) throw new Error("المنتج غير موجود.");
  if (product.producer_job !== job) throw new Error("هذه المهنة لا تصنع هذا المنتج.");

  const recipe = db.prepare(`
    SELECT r.*, p.name FROM recipes r JOIN products p ON p.code=r.input_code
    WHERE r.output_code=?
  `).all(outputCode);

  if (!recipe.length) throw new Error("لا توجد وصفة لهذا المنتج.");

  for (const r of recipe) {
    const needed = r.input_qty * quantity;
    if (activeInventory(userId, r.input_code) < needed) {
      throw new Error(`تحتاج ${needed} من ${r.name}.`);
    }
  }

  for (const r of recipe) {
    removeInventory(userId, r.input_code, r.input_qty * quantity);
  }
  addInventory(userId, outputCode, quantity, job);
  addXp(userId, 10 * quantity);
}

function createTask(userId, job, title, target, reward) {
  db.prepare(`
    INSERT INTO tasks(user_id,job,title,target,reward,created_at)
    VALUES(?,?,?,?,?,?)
  `).run(userId, job, title, target, reward, now());
}

function listTasks(userId) {
  return db.prepare(`
    SELECT * FROM tasks
    WHERE user_id=? AND status='active'
    ORDER BY id DESC
  `).all(userId);
}

function completeTask(taskId, userId) {
  const task = db.prepare("SELECT * FROM tasks WHERE id=? AND user_id=? AND status='active'")
    .get(taskId, userId);
  if (!task) throw new Error("المهمة غير موجودة.");
  if (task.progress < task.target) throw new Error("المهمة لم تكتمل بعد.");
  db.prepare("UPDATE tasks SET status='completed' WHERE id=?").run(taskId);
  changeBalance(userId, task.reward);
  addXp(userId, 10);
  return task;
}

module.exports = {
  ensureUser, getUser, changeBalance, setJob, addXp,
  getProduct, activeInventory, addInventory, removeInventory, getInventory,
  setCooldown, cooldownRemaining, cleanupExpired, produce, craft,
  createTask, listTasks, completeTask, db
};
