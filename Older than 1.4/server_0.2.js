require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

let cachedMessages = [];
let lastUpdateId = 0;

// Convert Telegram message text + entities to HTML
function formatTextWithEntities(text, entities = []) {
  if (!entities || entities.length === 0) return escapeHtml(text);

  // Sort entities descending by offset
  entities.sort((a, b) => b.offset - a.offset);

  let formattedText = text;

  for (const entity of entities) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    const substring = escapeHtml(formattedText.slice(start, end));

    let replacement = substring;

    switch (entity.type) {
      case 'bold':
        replacement = `<b>${substring}</b>`;
        break;
      case 'italic':
        replacement = `<i>${substring}</i>`;
        break;
      case 'underline':
        replacement = `<u>${substring}</u>`;
        break;
      case 'strikethrough':
        replacement = `<s>${substring}</s>`;
        break;
      case 'code':
        replacement = `<code>${substring}</code>`;
        break;
      case 'pre':
        replacement = `<pre>${substring}</pre>`;
        break;
      case 'text_link':
        replacement = `<a href="${entity.url}" target="_blank" rel="noopener noreferrer">${substring}</a>`;
        break;
      // You can add more entity types here if needed
    }

    formattedText = formattedText.slice(0, start) + replacement + formattedText.slice(end);
  }

  return formattedText;
}

// Escape HTML special characters to avoid XSS
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
          const text = update.channel_post.text || update.channel_post.caption || '';
          const entities = update.channel_post.entities || update.channel_post.caption_entities || [];
          const html = formatTextWithEntities(text, entities);

          // Keep only last 50 messages, remove duplicates by message_id
          if (!cachedMessages.find(msg => msg.message_id === update.channel_post.message_id)) {
            cachedMessages.push({
              message_id: update.channel_post.message_id,
              html,
            });
            if (cachedMessages.length > 50) cachedMessages.shift();
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch updates:', e);
  }
}

// Poll every 15 seconds
setInterval(fetchUpdates, 15000);
fetchUpdates();

// Serve static frontend files (index.html, etc.)
app.use(express.static(path.join(__dirname)));

// API endpoint returning quotes with formatted HTML
app.get('/quotes', (req, res) => {
  const quotes = cachedMessages
    .filter(msg => msg.html && msg.html.trim().length > 0)
    .slice(-50)
    .map(msg => ({ id: msg.message_id, html: msg.html }));

  res.json(quotes);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
