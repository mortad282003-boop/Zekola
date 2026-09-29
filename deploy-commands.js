const { REST, Routes } = require("discord.js");
const config = require("./config");
const buildCommands = require("./commands");

if (!config.token || !config.clientId || !config.guildId) {
  console.error("ضع DISCORD_TOKEN و CLIENT_ID و GUILD_ID في .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: buildCommands(config) }
    );
    console.log("تم تسجيل أوامر أرض زيكولا.");
  } catch (e) {
    console.error(e);
  }
})();
