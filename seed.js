const db = require("./db");
const { CHALLENGES } = require("./commands");
for (const name of CHALLENGES) {
  db.prepare("INSERT OR IGNORE INTO challenges(name) VALUES(?)").run(name);
}
console.log("Seed complete.");
