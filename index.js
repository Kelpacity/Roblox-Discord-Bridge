const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false }
});

// Create tokens table if it doesn’t exist
(async () => {
  const createTable = `
    CREATE TABLE IF NOT EXISTS tokens (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      name TEXT NOT NULL,
      elapsed_time INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );
  `;
  try {
    await pool.query(createTable);
    console.log('Ensured tokens table exists');
  } catch (err) {
    console.error('Error creating tokens table:', err);
  }
})();

app.use(express.json());

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// helper: store a token record
async function storeToken({ userId, token, name, elapsedSeconds, date }) {
  const sql = `
    INSERT INTO tokens (user_id, token, name, elapsed_time, timestamp)
    VALUES ($1, $2, $3, $4, $5)
  `;
  try {
    await pool.query(sql, [String(userId), token, name, elapsedSeconds, date]);
    console.log(`Stored token for ${name} (${userId})`);
  } catch (err) {
    console.error('Failed to store token:', err.message);
  }
}

// helper: reply with all tokens for a user
async function getCommand(givenId, message) {
  const sql = `
    SELECT name, token, timestamp, elapsed_time
      FROM tokens
     WHERE user_id = $1
  ORDER BY timestamp DESC
  `;
  try {
    const { rows } = await pool.query(sql, [String(givenId)]);
    if (rows.length === 0) {
      return message.reply('User has no tokens');
    }
    let reply = `User ${rows[0].name} has ${rows.length} token(s):\n\n`;
    for (let i = 0; i < rows.length; i++) {
      const { token, timestamp, elapsed_time } = rows[i];
      reply += `${i + 1}. \`${token}\`  ${timestamp}  (${elapsed_time}s)\n`;
    }
    if (reply.length > 2000) reply = reply.slice(0, 1995) + '\n... (truncated)';
    message.reply(reply);
  } catch (err) {
    console.error(err);
    message.reply('Error checking tokens');
  }
}

// helper: verify a specific token for a user
async function verifyCommand(givenId, givenToken, message) {
  const sql = `
    SELECT name, token
      FROM tokens
     WHERE user_id = $1
       AND token = $2
  `;
  try {
    const { rows } = await pool.query(sql, [String(givenId), givenToken]);
    if (rows.length > 0) {
      message.reply(`Token \`${rows[0].token}\` is valid for user ${rows[0].name}`);
    } else {
      message.reply(`Token \`${givenToken}\` is not valid for user ${givenId}`);
    }
  } catch (err) {
    console.error(err);
    message.reply('Could not verify user token');
  }
}

// helper: list all users who have at least one token
async function fetchCommand(message) {
  const sql = `
    SELECT user_id, name
    FROM tokens
    GROUP BY user_id, name
    ORDER BY LOWER(name)
  `;
  try {
    const { rows } = await pool.query(sql);
    if (!rows.length) {
      await message.reply('No users found in the token system');
      return;
    }

    let reply = 'Users with at least one token:\n\n';
    rows.forEach((row, i) => {
      reply += `${i + 1}. ${row.name} (${row.user_id})\n`;
    });

    if (reply.length > 2000) reply = reply.slice(0, 1995) + '\n... (truncated)';
    await message.reply(reply);
  } catch (err) {
    console.error('fetchCommand failed:', err);
    await message.reply('Failed to fetch users');
  }
}

app.get('/', (req, res) => {
  res.send('Bot + Webhook server is online and ready!');
});

app.post('/roblox', async (req, res) => {
  const { Code: code, UserID: user, Name: name, Time: time, Elapsed: elapse } = req.body;
  if (!code)   return res.status(400).send("Missing 'Code'");
  if (!user)   return res.status(400).send("Missing 'UserID'");
  if (!name)   return res.status(400).send("Missing 'Name'");
  if (!time)   return res.status(400).send("Missing 'Time'");
  if (!elapse) return res.status(400).send("Missing 'Elapsed'");

  const channel = bot.channels.cache.get(CHANNEL_ID);
  if (channel) {
    channel.send(`${name} (${user}) received code \`${code}\` at ${time} after ${elapse}s`);
  }

  await storeToken({
    userId: user,
    token: code,
    name,
    elapsedSeconds: parseInt(elapse, 10),
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

bot.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!get') {
    const givenId = args[1] || message.author.id;
    if (!givenId.trim()) {
      return message.reply('Please provide a valid user');
    }
    await getCommand(givenId, message);
  }

  if (command === '!verify') {
    const givenId = args[1] || message.author.id;
    const givenToken = args[2];
    if (!givenToken) {
      return message.reply('Please provide a valid token');
    }
    await verifyCommand(givenId, givenToken, message);
  }

  if (command === '!fetch') {
    await fetchCommand(message);
  }
});

bot.login(TOKEN);