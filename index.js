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
    const code = req.body.Code;
    const user = req.body.UserID;
    const name = req.body.Name;
    const time = req.body.Time;
    const elapse = req.body.Elapsed;

    if (!code) return res.status(400).send("Missing 'code' in body.");
    if (!user) return res.status(400).send("Missing 'user' in body.");
    if (!time) return res.status(400).send("Missing 'time' in body.");
    if (!elapse) return res.status(400).send("Missing 'elapse' in body.");
    if (!name) return res.status(400).send("Missing 'name' in body.");

    const channel = bot.channels.cache.get(CHANNEL_ID);
    if (channel) {
      channel.send(`${name} {${user}} just got a new code: ${code} at ${time} after ${elapse} seconds`);
    }
    res.sendStatus(200);
}) 

app.listen(PORT, () => {
  console.log(`Webhook server running on http://localhost:${PORT}`);
});

// 🤖 Start bot
bot.once('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.login(TOKEN);