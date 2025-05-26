const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const dotenv = require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const database = new sqlite3.Database('tokens.db');
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

database.run(`
  CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  name TEXT NOT NULL,
  elapsed_time INTEGER NOT NULL
  )
`);

function storeToken({userId, token, name, elapsedSeconds, date}) {
  const store = database.prepare(`
    INSERT INTO tokens (user_id, token, name, elapsed_time, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  store.run(userId, token, name, elapsedSeconds, date, (err) => {
    if (err) {
      console.error("Failed to store token:", err.message);
    } else {
      console.log(`Token stored for user ${name} (${userId})`);
    }
  });

  store.finalize();
}

function getCommand({givenId, message}) {
  database.all(`SELECT name, token, timestamp, elapsed_time FROM tokens WHERE user_id = ?`, [givenId], (err, rows) => {
    if (err) {
      console.error(err);
      return message.reply("Error checking tokens");
    }

    if (!rows || rows.length === 0) {
      return message.reply("User has no tokens");
    }
    let reply = ``;

    rows.forEach((row, i) => {
      if (i == 0) {
        reply += `User ${row.name} has ${rows.length} token(s):\n\n`;
      }
      reply += `**${i + 1}.** \`Token: ${row.token}\`\nDate: ${row.timestamp} after ${row.elapsed_time} seconds\n\n`;
    });

    if (reply.length >= 2000) {
      reply = reply.slice(0, 1995) + "\n... (truncated)";
    }
    message.reply(reply);
  })
}

function verifyCommand({givenId, givenToken, message}) {
  database.get(`SELECT * FROM tokens WHERE user_id = ? and token = ?`, [givenId, givenToken], (err, row) => {
    if (err) {
      console.error(err);
      return message.reply("Could not verify user token");
    }

    if (row) {
      message.reply(`Token \`${row.token}\` is a valid token for user: ${row.name}`);
    } else {
      message.reply(`Token \`${givenToken}\` is not a valid token for user: ${givenId}`);
    }
  })
}

function fetchCommand({message}) {
  database.all(`SELECT DISTINCT user_id, name FROM tokens ORDER BY name COLLATE NOCASE`, (err, rows) => {
    if (err) {
      console.error(err);
      return message.reply("Failed to fetch users.");
    }

    if (!rows || rows.length === 0) {
      return message.reply("No users found in the token system.");
    }

    let reply = `Users with at least one token:\n\n`;

    rows.forEach((row, i) => {
      reply += `**${i + 1}.** ${row.name} (${row.user_id})\n`;
    });

    if (reply.length >= 2000) {
      reply = reply.slice(0, 1995) + "\n... (truncated)";
    }
    message.reply(reply);
  });
}

app.get('/', (req, res) => {
  res.send('Bot + Webhook server is online and ready!');
});

// Roblox Webhook Handler
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
    storeToken({
      userId: user,
      token: code,
      name: name,
      elapsedSeconds: elapse,
      date: time
    })
    res.sendStatus(200);
}) 

app.listen(PORT, () => {
  console.log(`Webhook server running on http://localhost:${PORT}`);
});

// Start bot
bot.once('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.on('messageCreate', (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === "!get") {
    const givenId = args[1];
    if (!givenId || typeof givenId !== "string" || givenId.trim() === "") {
       return message.reply("Please provide a valid user");
    }
    getCommand({
      givenId: givenId,
      message: message
    });
  }

  if (command === "!verify") {
    const givenId = args[1];
    const givenToken = args[2];

    if (!givenId || typeof givenId !== "string" || givenId.trim() === "") {
       return message.reply("Please provide a valid user");
    }

    if (!givenToken || typeof givenToken !== "string" || givenToken.trim() === "") {
       return message.reply("Please provide a valid token");
    }
    verifyCommand({
      givenId: givenId,
      givenToken: givenToken,
      message: message
    });
  }

  if (command === "!fetch") {
    fetchCommand({
      message: message
    })
  }
})

bot.login(TOKEN);