const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const database = new Database('tokens.db');
const app = express();
const PORT = process.env.PORT || 3000;

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

// create table if it doesn’t exist
database.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    name TEXT NOT NULL,
    elapsed_time INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

function storeToken({ userId, token, name, elapsedSeconds, date }) {
  const stmt = database.prepare(`
    INSERT INTO tokens (user_id, token, name, elapsed_time, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  try {
    stmt.run(userId, token, name, elapsedSeconds, date);
    console.log(`Stored token for ${name} (${userId})`);
  } catch (err) {
    console.error('Failed to store token:', err.message);
  }
}

function getCommand({ givenId, message }) {
  const stmt = database.prepare(`
    SELECT name, token, timestamp, elapsed_time
      FROM tokens
     WHERE user_id = ?
     ORDER BY timestamp DESC
  `);
  let rows;
  try {
    rows = stmt.all(givenId);
  } catch (err) {
    console.error(err);
    return message.reply('Error checking tokens');
  }
  if (!rows.length) {
    return message.reply('User has no tokens');
  }
  let reply = `User ${rows[0].name} has ${rows.length} token(s):\n\n`;
  rows.forEach((row, i) => {
    reply += `${i + 1}. \`${row.token}\`  ${row.timestamp}  (${row.elapsed_time}s)\n`;
  });
  if (reply.length > 2000) {
    reply = reply.slice(0, 1995) + '\n... (truncated)';
  }
  message.reply(reply);
}

function verifyCommand({ givenId, givenToken, message }) {
  const stmt = database.prepare(`
    SELECT name, token
      FROM tokens
     WHERE user_id = ? AND token = ?
  `);
  let row;
  try {
    row = stmt.get(givenId, givenToken);
  } catch (err) {
    console.error(err);
    return message.reply('Could not verify user token');
  }
  if (row) {
    message.reply(`Token \`${row.token}\` is valid for user ${row.name}`);
  } else {
    message.reply(`Token \`${givenToken}\` is not valid for user ${givenId}`);
  }
}

function fetchCommand({ message }) {
  const stmt = database.prepare(`
    SELECT DISTINCT user_id, name
      FROM tokens
     ORDER BY name COLLATE NOCASE
  `);
  let rows;
  try {
    rows = stmt.all();
  } catch (err) {
    console.error(err);
    return message.reply('Failed to fetch users');
  }
  if (!rows.length) {
    return message.reply('No users found in the token system');
  }
  let reply = 'Users with at least one token:\n\n';
  rows.forEach((row, i) => {
    reply += `${i + 1}. ${row.name} (${row.user_id})\n`;
  });
  if (reply.length > 2000) {
    reply = reply.slice(0, 1995) + '\n... (truncated)';
  }
  message.reply(reply);
}

app.get('/', (req, res) => {
  res.send('Bot + Webhook server is online and ready!');
});

app.post('/roblox', (req, res) => {
  const code    = req.body.Code;
  const user    = req.body.UserID;
  const name    = req.body.Name;
  const time    = req.body.Time;
  const elapse  = req.body.Elapsed;

  if (!code)   return res.status(400).send("Missing 'Code'");
  if (!user)   return res.status(400).send("Missing 'UserID'");
  if (!name)   return res.status(400).send("Missing 'Name'");
  if (!time)   return res.status(400).send("Missing 'Time'");
  if (!elapse) return res.status(400).send("Missing 'Elapsed'");

  const channel = bot.channels.cache.get(CHANNEL_ID);
  if (channel) {
    channel.send(`${name} (${user}) received code \`${code}\` at ${time} after ${elapse}s`);
  }

  storeToken({
    userId: user,
    token: code,
    name: name,
    elapsedSeconds: elapse,
    date: time
  });

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});

bot.once('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.on('messageCreate', (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!get') {
    const givenId = args[1] || message.author.id;
    if (!givenId.trim()) {
      return message.reply('Please provide a valid user');
    }
    getCommand({ givenId, message });
  }

  if (command === '!verify') {
    const givenId = args[1] || message.author.id;
    const givenToken = args[2];
    if (!givenToken) {
      return message.reply('Please provide a valid token');
    }
    verifyCommand({ givenId, givenToken, message });
  }

  if (command === '!fetch') {
    fetchCommand({ message });
  }
});

bot.login(TOKEN);
