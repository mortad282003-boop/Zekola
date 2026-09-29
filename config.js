require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID || null,
  policeRoleId: process.env.POLICE_ROLE_ID || null,
  databasePath: process.env.DATABASE_PATH || "./data/zykola.db",

  currencyName: "وحدة ذكاء",

  expiryDays: {
    food: 7,
    default: 14
  },

  cooldowns: {
    miningMs: 4 * 60 * 60 * 1000,
    policeSecurityMs: 60 * 60 * 1000
  },

  startingBalance: 100,
  startingHunger: 100,
  startingWater: 100,
  startingElectricity: 100,

  housing: {
    room: { name: "غرفة متواضعة", rent: 25, capacity: 20 },
    apartment: { name: "شقة صغيرة", rent: 60, capacity: 40 },
    luxury: { name: "شقة فاخرة", rent: 120, capacity: 70 },
    house: { name: "منزل", rent: 220, capacity: 120 }
  }
};
