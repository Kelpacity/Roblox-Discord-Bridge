const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3000;

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

app.use(express.json());

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

app.get('/', (req, res) => {
  res.send('Bot + Webhook server is online and ready!');
});

// 🌐 Roblox Webhook Handler
app.post('/roblox', (req, res) => {
  const message = req.body.message || "No message content";
  const channel = bot.channels.cache.get(CHANNEL_ID);
  if (channel) {
    channel.send(`Roblox Update: ${message}`);
  }
  res.sendStatus(200);
});

app.post('/roblox', (req, res) => {
    const code = req.body.code;
    const user = req.body.user;

    if (!code) return res.status(400).send("Missing 'code' in body.");
    if (!user) return res.status(400).send("Missing 'user' in body.");

    const line = code + "\n";
    fs.appendFile('codes.txt', line, (err) => {
        if (err) {
            console.error("Error writing code:", err);
            return res.status(500).send("Failed to store code.");
        }
        console.log("Code stored:", code);
        res.status(200).send("Code received and stored.");
  });
}) 

app.listen(PORT, () => {
  console.log(`Webhook server running on http://localhost:${PORT}`);
});

// 🤖 Start bot
bot.once('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.login(TOKEN);