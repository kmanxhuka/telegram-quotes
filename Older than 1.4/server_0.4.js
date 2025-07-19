require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

let cachedMessages = [];
let lastUpdateId = 0;

// Escape HTML to prevent XSS
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Robust formatter: Handles nested/overlapping Telegram entities + line breaks
function formatTextWithEntities(text, entities = []) {
  if (!entities || entities.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const openTags = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    strikethrough: 's',
    code: 'code',
    pre: 'pre',
    text_link: 'a',
  };

  const events = [];

  entities.forEach((entity, idx) => {
    if (!entity) return;
    if (typeof entity.offset !== 'number' || typeof entity.length !== 'number') return;

    events.push({ pos: entity.offset, type: 'start', entity, idx });
    events.push({ pos: entity.offset + entity.length, type: 'end', entity, idx });
  });

  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type === b.type) return 0;
    return a.type === 'end' ? -1 : 1;
  });

  let result = '';
  let currIndex = 0;
  const stack = [];

  for (const event of events) {
    if (!event.entity) continue;

    if (event.pos > currIndex) {
      result += escapeHtml(text.slice(currIndex, event.pos));
      currIndex = event.pos;
    }

    if (event.type === 'start') {
      const e = event.entity;
      if (e.type === 'text_link' && e.url) {
        result += `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">`;
      } else {
        const tag = openTags[e.type] || 'span';
        result += `<${tag}>`;
      }
      stack.push(event);
    } else {
      let popped;
      do {
        popped = stack.pop();
        if (!popped || !popped.entity) break;
        const e = popped.entity;
        if (e.type === 'text_link') {
          result += '</a>';
        } else {
          const tag = openTags[e.type] || 'span';
          result += `</${tag}>`;
        }
      } while (popped.idx !== event.idx && stack.length > 0);
    }
  }

  if (currIndex < text.length) {
    result += escapeHtml(text.slice(currIndex));
  }

  while (stack.length) {
    const popped = stack.pop();
    if (!popped || !popped.entity) continue;
    const e = popped.entity;
    if (e.type === 'text_link') {
      result += '</a>';
    } else {
      const tag = openTags[e.type] || 'span';
      result += `</${tag}>`;
    }
  }

  // Convert \n to <br> so new lines display properly
  return result.replace(/\n/g, '<br>');
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

// Fetch every 15s
setInterval(fetchUpdates, 15000);
fetchUpdates();

// Serve static files (index.html, CSS, etc.)
app.use(express.static(path.join(__dirname)));

// API endpoint for quotes
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
