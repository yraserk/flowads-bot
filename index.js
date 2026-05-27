require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const DM_DELAY_MS = Number(process.env.DM_DELAY_MS || 1000);
const MAX_DMS_PER_RUN = Number(process.env.MAX_DMS_PER_RUN || 500);

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

function isValidHttpUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("dmeveryonelaunch")
    .setDescription("Send a FlowAds launch embed to a specific role.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to DM")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("confirm")
        .setDescription("Type LAUNCH to confirm")
        .setRequired(true)
    )
].map((command) => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Slash commands registered.");
  } catch (error) {
    console.error("discord ain't working:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "dmeveryonelaunch") return;

      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "you don't have permissions for this command",
          ephemeral: true
        });
      }

      const confirm = interaction.options.getString("confirm");

      if (confirm !== "LAUNCH") {
        return interaction.reply({
          content: "Cancelled. To confirm, type `LAUNCH`.",
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
          content: "Yeah lets not use the @everyone role. Use a specific role.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`launch_dm_modal:${role.id}`)
        .setTitle("FlowAds Launch DM");

      const titleInput = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Embed title")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256)
        .setValue("FlowAds is now live");

      const descriptionInput = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Embed description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setValue("Stop manual ad posting. Automate your ads with FlowAds easily and efficiently.\n\nEverything you need to grow your brand on Discord\n✅ Fully Automated Advertising\n✅ Smart Ad Scheduling\n✅ Ad Rotations & Ad Pools\n✅ Server Discovery Section\n✅ Templates\n✅ Multi-IP Rotation System\n✅ Advanced Analytics & Dashboard\n✅ Team Management\n✅ Account Email Provisioning\n✅ Stealth Mode & Security\n✅ Bank-Grade Security Token Encryption\n✅ Free Plan Available\n✅ And More!\n\nWe’re in beta phase, so bugs are expected, but we haven’t found any ourselves so far.\nIf you find any bugs, please report them to us, and we will compensate you for any caused delay.\n\nAlso, if you need help with anything, open a ticket. We will be more than happy to help you and guide you through the entire process!\n\nIf you have the Partner role, you can now have 7 days of FlowAds+ for free! Just open a ticket to claim it. You have until the 23rd of June to do so.\n\n📡 We’ll appreciate any feedback or suggestions\n📈 Visit https://flowads.dev/ to get started.");

      const urlInput = new TextInputBuilder()
        .setCustomId("url")
        .setLabel("Title URL, optional")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("https://flowads.dev/");

      const imageInput = new TextInputBuilder()
        .setCustomId("image")
        .setLabel("Image URL, optional")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("https://example.com/image.png");

      const colorInput = new TextInputBuilder()
        .setCustomId("color")
        .setLabel("Embed color, optional")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue("#ec3a36");

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(colorInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith("launch_dm_modal:")) return;

      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "you don't have permissions for this command",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const roleId = interaction.customId.split(":")[1];
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.editReply("Role not found anymore.");
      }

      const title = interaction.fields.getTextInputValue("title");
      let description = interaction.fields.getTextInputValue("description");
      const url = interaction.fields.getTextInputValue("url").trim();
      const image = interaction.fields.getTextInputValue("image").trim();
      const color = normalizeColor(interaction.fields.getTextInputValue("color"));

      description = description.replace(/\\n/g, "\n");

      description = description.replace(/<@&(\d+)>/g, function (match, id) {
        const foundRole = interaction.guild.roles.cache.get(id);
        return foundRole ? `@${foundRole.name}` : "that role";
      });

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

      if (isValidHttpUrl(url)) embed.setURL(url);
      if (isValidHttpUrl(image)) embed.setImage(image);

      let sent = 0;
      let failed = 0;

      for (const member of membersToDM) {
        try {
          await member.send({ embeds: [embed] });
          sent++;
        } catch {
          failed++;
        }

        await wait(DM_DELAY_MS);
      }

      let reply = `Launch DM finished for ${role}.\nSent: ${sent}\nFailed: ${failed}\nMembers with role: ${targetMembers.length}`;

      if (targetMembers.length > MAX_DMS_PER_RUN) {
        reply += `\n\nOnly the first ${MAX_DMS_PER_RUN} members were messaged.`;
      }

      return interaction.editReply(reply);
    }
  } catch (error) {
    console.error(error);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("Something went wrong ig");
    }

    return interaction.reply({
      content: "Something went wrong ig",
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
