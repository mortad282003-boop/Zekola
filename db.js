const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const dbPath = path.resolve(config.databasePath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 100,
  job TEXT,
  job_xp INTEGER NOT NULL DEFAULT 0,
  hunger INTEGER NOT NULL DEFAULT 100,
  water INTEGER NOT NULL DEFAULT 100,
  electricity INTEGER NOT NULL DEFAULT 100,
  housing TEXT NOT NULL DEFAULT 'room',
  inventory_capacity INTEGER NOT NULL DEFAULT 20,
  created_at INTEGER NOT NULL,
  last_hunger_tick INTEGER NOT NULL,
  last_service_tick INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  producer_job TEXT,
  expiry_days INTEGER NOT NULL DEFAULT 14,
  stackable INTEGER NOT NULL DEFAULT 1,
  base_price INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  output_code TEXT NOT NULL,
  input_code TEXT NOT NULL,
  input_qty INTEGER NOT NULL,
  FOREIGN KEY(output_code) REFERENCES products(code),
  FOREIGN KEY(input_code) REFERENCES products(code)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  produced_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  source_job TEXT,
  FOREIGN KEY(product_code) REFERENCES products(code)
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  store_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_catalog (
  store_id INTEGER NOT NULL,
  product_code TEXT NOT NULL,
  PRIMARY KEY(store_id, product_code),
  FOREIGN KEY(store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY(product_code) REFERENCES products(code)
);

CREATE TABLE IF NOT EXISTS store_inventory (
  store_id INTEGER NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(store_id, product_code),
  FOREIGN KEY(store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY(product_code) REFERENCES products(code)
);

CREATE TABLE IF NOT EXISTS pending_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id TEXT,
  buyer_id TEXT,
  product_code TEXT,
  quantity INTEGER,
  total_price INTEGER,
  created_at INTEGER NOT NULL,
  sale_id INTEGER
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  channel_id TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS police_checks (
  police_id TEXT NOT NULL,
  challenge_id INTEGER NOT NULL,
  checked_at INTEGER NOT NULL,
  safe INTEGER NOT NULL,
  PRIMARY KEY(police_id, challenge_id),
  FOREIGN KEY(challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS cooldowns (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  ready_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, action)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  job TEXT NOT NULL,
  title TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  reward INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

const seedProducts = [
  ["wheat","قمح","food_raw","farmer",7,1,10,"محصول زراعي"],
  ["corn","ذرة","food_raw","farmer",7,1,10,"محصول زراعي"],
  ["vegetables","خضروات","food_raw","farmer",7,1,15,"خضروات طازجة"],
  ["milk","حليب","food","farmer",7,1,20,"حليب طازج"],
  ["eggs","بيض","food","farmer",7,1,18,"بيض"],
  ["meat","لحم","food","farmer",7,1,35,"لحم طازج"],
  ["iron_ore","خام الحديد","raw","miner",14,1,30,"خام"],
  ["copper_ore","خام النحاس","raw","miner",14,1,25,"خام"],
  ["coal","فحم","raw","miner",14,1,15,"مادة خام"],
  ["wood","خشب","raw","farmer",14,1,20,"خشب"],
  ["leather","جلد","raw","farmer",14,1,25,"جلد"],
  ["cloth","قماش","material","tailor",14,1,40,"قماش"],
  ["horse_cart","عربة جر حصان","tool","blacksmith",14,0,250,"عربة مصنعة"],
  ["shield","درع","tool","blacksmith",14,0,180,"درع"],
  ["sword","سيف","tool","blacksmith",14,0,220,"سيف"],
  ["meal_meat","وجبة لحم","food","restaurant",7,1,90,"وجبة مطبوخة"],
  ["meal_vegetable","وجبة خضار","food","restaurant",7,1,55,"وجبة مطبوخة"],
  ["shirt","قميص","clothing","clothing_merchant",14,0,100,"ملابس"],
  ["pants","بنطال","clothing","clothing_merchant",14,0,130,"ملابس"],
  ["coat","معطف","clothing","clothing_merchant",14,0,180,"ملابس"]
];

const insertProduct = db.prepare(`
INSERT OR IGNORE INTO products
(code,name,category,producer_job,expiry_days,stackable,base_price,description)
VALUES (?,?,?,?,?,?,?,?)
`);
for (const p of seedProducts) insertProduct.run(...p);

const recipes = [
  ["horse_cart","iron_ore",12],["horse_cart","wood",15],["horse_cart","leather",4],
  ["shield","iron_ore",8],["shield","wood",4],["shield","leather",2],
  ["sword","iron_ore",10],["sword","coal",4],
  ["meal_meat","meat",1],["meal_meat","vegetables",1],
  ["meal_vegetable","vegetables",2],["meal_vegetable","corn",1],
  ["shirt","cloth",2],["pants","cloth",3],["coat","cloth",5]
];
const insertRecipe = db.prepare(`
INSERT OR IGNORE INTO recipes(output_code,input_code,input_qty) VALUES (?,?,?)
`);
for (const r of recipes) insertRecipe.run(...r);

module.exports = db;
