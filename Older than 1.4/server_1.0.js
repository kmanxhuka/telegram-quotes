const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load all messages from JSON at startup
let allMessages = [];
try {
  allMessages = JSON.parse(fs.readFileSync(path.join(__dirname, 'channel_messages.json'), 'utf8'));
  console.log(`✅ Loaded ${allMessages.length} messages from channel_messages.json`);
} catch (err) {
  console.error('❌ Error loading messages file:', err);
}

app.use(express.static(path.join(__dirname)));

app.get('/quotes', (req, res) => {
  if (allMessages.length === 0) {
    return res.json([{ id: 0, title: 'No Quotes Found', html: 'Please fetch messages first.' }]);
  }

  // Pick a random message
  const randomMessage = allMessages[Math.floor(Math.random() * allMessages.length)];

  // Replace newlines with <br> for HTML formatting
  const formattedHtml = randomMessage.text.replace(/\n/g, '<br>');

  res.json([{
    id: randomMessage.id,
    title: randomMessage.title,
    html: formattedHtml
  }]);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
