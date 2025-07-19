import json
import asyncio
from telethon import TelegramClient
import re

api_id = 27263017
api_hash = 'e63d76252d56d8cdeb8425e6bf52c8a6'
channel_username = 'masjid_quotes'

# Markdown to HTML conversion
def markdown_to_html(text):
    # Escape HTML
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Bold **text**
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Italic __text__ or _text_
    text = re.sub(r'__(.*?)__', r'<i>\1</i>', text)
    text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
    # Inline code
    text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
    # Newlines
    text = text.replace('\n', '<br>')
    return text

async def main():
    client = TelegramClient('session_name', api_id, api_hash)
    await client.start()
    print(f"Connected as {await client.get_me()}")

    messages = []
    async for message in client.iter_messages(channel_username, limit=100):
        if message.message:
            lines = message.message.strip().split('\n')

            # Last line becomes title
            raw_title = lines[-1].strip() if len(lines) > 1 else "Quote"
            # Remove hashtags and extra symbols from title
            title = re.sub(r'[#]+', '', raw_title).strip()

            # Body is everything except last line
            body = '\n'.join(lines[:-1]) if len(lines) > 1 else lines[0]

            # Convert Markdown to HTML
            html = markdown_to_html(body)

            messages.append({
                'id': message.id,
                'title': title,
                'html': html
            })

    with open('channel_messages.json', 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(messages)} messages to channel_messages.json")

asyncio.run(main())
