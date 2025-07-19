const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'channel_messages.json');

let allMessages = [];
function loadMessages() {
  try {
    allMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    console.log(`✅ Loaded ${allMessages.length} raw messages`);
  } catch (err) {
    console.error('❌ Error loading messages:', err);
  }
}
loadMessages();

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[m]);
}

// ✅ Format using Telegram entities or Markdown fallback
function formatTextWithEntities(text, entities) {
  if (!entities || entities.length === 0) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')  // Bold
      .replace(/__(.*?)__/g, '<i>$1</i>')      // Italic
      .replace(/_(.*?)_/g, '<i>$1</i>')        // Italic
      .replace(/`(.*?)`/g, '<code>$1</code>')  // Code
      .replace(/\n/g, '<br>');                 // Newlines
  }

  // Process entities into HTML
  entities = entities.slice().sort((a, b) => a.offset - b.offset);
  let result = '';
  let pointer = 0;
  const tagStack = [];
  const events = [];

  for (const ent of entities) {
    events.push({ pos: ent.offset, type: 'start', entity: ent });
    events.push({ pos: ent.offset + ent.length, type: 'end', entity: ent });
  }

  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type === 'start' && b.type === 'end') return -1;
    if (a.type === 'end' && b.type === 'start') return 1;
    return 0;
  });

  for (const ev of events) {
    if (pointer < ev.pos) {
      result += escapeHtml(text.slice(pointer, ev.pos));
      pointer = ev.pos;
    }
    if (ev.type === 'start') {
      const e = ev.entity;
      switch (e._) {
        case 'MessageEntityBold': result += '<b>'; tagStack.push('b'); break;
        case 'MessageEntityItalic': result += '<i>'; tagStack.push('i'); break;
        case 'MessageEntityUnderline': result += '<u>'; tagStack.push('u'); break;
        case 'MessageEntityStrike': result += '<s>'; tagStack.push('s'); break;
        case 'MessageEntityCode': result += '<code>'; tagStack.push('code'); break;
        case 'MessageEntityPre': result += '<pre>'; tagStack.push('pre'); break;
        case 'MessageEntityTextUrl':
          result += `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">`;
          tagStack.push('a'); break;
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

app.use(express.static(path.join(__dirname)));

// ✅ Return random formatted quote
app.get('/quotes', (req, res) => {
  if (allMessages.length === 0) {
    return res.json([{ id: 0, title: 'No Quotes', html: 'Please fetch messages.' }]);
  }

  const randomQuote = allMessages[Math.floor(Math.random() * allMessages.length)];

  // Extract last line as title
  const lines = randomQuote.text.split('\n');
  const rawTitle = lines.length > 1 ? lines[lines.length - 1].trim() : 'Quote';
  const title = rawTitle;

  const html = formatTextWithEntities(randomQuote.text, randomQuote.entities);

  res.json([{ id: randomQuote.id, title, html }]);
});

// ✅ Fetch new messages from Python every hour
function fetchMessages() {
  console.log('⏳ Fetching latest messages...');
  exec('python fetch_messages.py', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return;
    }
    if (stderr) console.error(`⚠️ Stderr: ${stderr}`);
    console.log(stdout);
    loadMessages();
    console.log('✅ Messages updated.');
  });
}

setInterval(fetchMessages, 60 * 60 * 1000);
fetchMessages();

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
