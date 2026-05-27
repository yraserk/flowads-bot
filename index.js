require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const DM_DELAY_MS = Number(process.env.DM_DELAY_MS || 3000);
const MAX_DMS_PER_RUN = Number(process.env.MAX_DMS_PER_RUN || 80);

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID.");
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeColor(color) {
  if (!color) return "#ec3a36";

  const clean = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  if (/^[0-9A-Fa-f]{6}$/.test(clean)) return `#${clean}`;

  return "#ec3a36";
}

const commands = [
  new SlashCommandBuilder()
    .setName("dmeveryonelaunch")
    .setDescription("You prop only need this like one time ngl")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("the role to dm")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("the embed titles")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("description ig")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("confirm")
        .setDescription("type LAUNCH to confirm")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("put title")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("put image")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("put color hex")
        .setRequired(false)
    )
].map((command) => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("ayyy");
  } catch (error) {
    console.error("discord ain't working (def not my code):", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "dmeveryonelaunch") return;

  try {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "you don't have permissions for this command",
        ephemeral: true
      });
    }

    const confirm = interaction.options.getString("confirm");

    if (confirm !== "LAUNCH") {
      return interaction.reply({
        content: "Cancelled. to confirm type `LAUNCH`.",
        ephemeral: true
      });
    }

    const role = interaction.options.getRole("role");

    if (!role) {
      return interaction.reply({
        content: "this role ain't a thing",
        ephemeral: true
      });
    }

    if (role.id === interaction.guild.id) {
      return interaction.reply({
        content: "Yeah lets not use the @everyone role - just use a members role or smth idk",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const url = interaction.options.getString("url");
    const image = interaction.options.getString("image");
    const color = normalizeColor(interaction.options.getString("color"));

    const allMembers = await interaction.guild.members.fetch();

    const targetMembers = [...allMembers
      .filter((member) => {
        return !member.user.bot && member.roles.cache.has(role.id);
      })
      .values()
    ];

    if (targetMembers.length === 0) {
      return interaction.editReply(`you sure thats the right role bro? - ${role}.`);
    }

    const membersToDM = targetMembers.slice(0, MAX_DMS_PER_RUN);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: "FlowAds" })
      .setTimestamp();

    if (url) embed.setURL(url);
    if (image) embed.setImage(image);

    let sent = 0;
    let failed = 0;

    for (const member of membersToDM) {
      try {
        await member.send({ embeds: [embed] });
        sent++;
      } catch (error) {
        failed++;
      }

      await wait(DM_DELAY_MS);
    }

    let reply = `Launch DM finished for ${role}.\nSent: ${sent}\nFailed: ${failed}\nMembers with role: ${targetMembers.length}`;

    if (targetMembers.length > MAX_DMS_PER_RUN) {
      reply += `\n\nTHATS TOO MANY TARGETS! CHILL BRO`;
    }

    return interaction.editReply(reply);
  } catch (error) {
    console.error(error);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("Something went wrong ig (idk what)");
    }

    return interaction.reply({
      content: "Something went wrong ig (idk what)",
      ephemeral: true
    });
  }
});

client.login(TOKEN);

const app = express();

app.get("/", (req, res) => {
  res.send("its running ig");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Health server running on port ${PORT}`);
});
