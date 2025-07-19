require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

let cachedMessages = [];
let lastUpdateId = 0;

// Fetch updates from Telegram API
async function fetchUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=100`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        if (update.channel_post && update.channel_post.chat.username === CHANNEL_USERNAME) {
          cachedMessages.push({
            message_id: update.channel_post.message_id,
            text: update.channel_post.text || '',
          });
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch updates:', e);
  }
}

// Schedule update fetching every 15 seconds
setInterval(fetchUpdates, 15000);
fetchUpdates();

// Serve the frontend (index.html) from the current directory
app.use(express.static(path.join(__dirname)));

// API endpoint for quotes
app.get('/quotes', (req, res) => {
  const quotes = cachedMessages
    .filter(msg => msg.text && msg.text.trim().length > 0)
    .slice(-50)
    .map(msg => ({ id: msg.message_id, text: msg.text }));

  res.json(quotes);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
