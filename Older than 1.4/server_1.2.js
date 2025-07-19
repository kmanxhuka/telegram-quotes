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
    console.log(`✅ Loaded ${allMessages.length} messages`);
  } catch (err) {
    console.error('❌ Error loading messages:', err);
  }
}
loadMessages();

app.use(express.static(path.join(__dirname)));

app.get('/quotes', (req, res) => {
  if (allMessages.length === 0) {
    return res.json([{ id: 0, title: 'No Quotes', html: 'Please fetch messages.' }]);
  }
  const randomQuote = allMessages[Math.floor(Math.random() * allMessages.length)];
  res.json([{ id: randomQuote.id, title: randomQuote.title, html: randomQuote.html }]);
});

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

setInterval(fetchMessages, 60 * 60 * 1000); // Every hour
fetchMessages();

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
