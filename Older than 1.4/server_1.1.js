const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load messages
let allMessages = [];
try {
  allMessages = JSON.parse(fs.readFileSync(path.join(__dirname, 'channel_messages.json'), 'utf8'));
  console.log(`✅ Loaded ${allMessages.length} messages from channel_messages.json`);
} catch (err) {
  console.error('❌ Could not load messages:', err);
}

// Escape HTML characters
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[m]);
}

// Convert Telegram text + entities into HTML
function formatTextWithEntities(text, entities) {
  // ✅ Remove leftover Markdown-like symbols
  text = text.replace(/[*_`~]+/g, '');

  if (!entities || entities.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  // Sort entities by position
  entities = entities.slice().sort((a, b) => a.offset - b.offset);

  let result = '';
  let pointer = 0;
  const tagStack = [];

  // Create open/close events for tags
  const events = [];
  for (const ent of entities) {
    events.push({ pos: ent.offset, type: 'start', entity: ent });
    events.push({ pos: ent.offset + ent.length, type: 'end', entity: ent });
  }

  // Sort events (start before end if same pos)
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type === 'start' && b.type === 'end') return -1;
    if (a.type === 'end' && b.type === 'start') return 1;
    return 0;
  });

  // Build formatted string
  for (const ev of events) {
    if (pointer < ev.pos) {
      result += escapeHtml(text.slice(pointer, ev.pos));
      pointer = ev.pos;
    }

    if (ev.type === 'start') {
      const e = ev.entity;
      switch (e.type) {
        case 'bold': result += '<b>'; tagStack.push('b'); break;
        case 'italic': result += '<i>'; tagStack.push('i'); break;
        case 'underline': result += '<u>'; tagStack.push('u'); break;
        case 'strikethrough': result += '<s>'; tagStack.push('s'); break;
        case 'code': result += '<code>'; tagStack.push('code'); break;
        case 'pre': result += '<pre>'; tagStack.push('pre'); break;
        case 'texturl': 
          result += `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">`; 
          tagStack.push('a'); break;
        case 'url': {
          const url = escapeHtml(text.substr(e.offset, e.length));
          result += `<a href="${url}" target="_blank" rel="noopener noreferrer">`; 
          tagStack.push('a'); break;
        }
        case 'mention': {
          const username = text.substr(e.offset + 1, e.length - 1);
          result += `<a href="https://t.me/${escapeHtml(username)}" target="_blank" rel="noopener noreferrer">`;
          tagStack.push('a'); break;
        }
        default: tagStack.push(null); break;
      }
    } else {
      const tag = tagStack.pop();
      if (tag) result += `</${tag}>`;
    }
  }

  if (pointer < text.length) {
    result += escapeHtml(text.slice(pointer));
  }

  return result.replace(/\n/g, '<br>');
}

// Serve static files (index.html)
app.use(express.static(path.join(__dirname)));

// API endpoint for random quote
app.get('/quotes', (req, res) => {
  if (allMessages.length === 0) {
    return res.json([{ id: 0, title: 'No Quotes', html: 'Please fetch messages first.' }]);
  }

  const randomQuote = allMessages[Math.floor(Math.random() * allMessages.length)];
  const html = formatTextWithEntities(randomQuote.text, randomQuote.entities);

  res.json([{ id: randomQuote.id, title: randomQuote.title, html }]);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
