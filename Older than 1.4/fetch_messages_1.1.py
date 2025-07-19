from telethon import TelegramClient
import asyncio
import json

api_id = 27263017
api_hash = 'e63d76252d56d8cdeb8425e6bf52c8a6'
channel_username = 'masjid_quotes'  # no @

def extract_entities(message):
    if not message.entities:
        return []
    return [{
        'offset': ent.offset,
        'length': ent.length,
        'type': ent.__class__.__name__.replace('MessageEntity', '').lower()
    } for ent in message.entities]

async def main():
    client = TelegramClient('session_name', api_id, api_hash)
    await client.start()

    messages = []
    print(f"Fetching messages from @{channel_username} ...")

    async for message in client.iter_messages(channel_username, limit=None):
        if message.text and message.text.strip():
            lines = message.text.strip().split('\n')
            if len(lines) > 1:
                title = lines[-1].strip()
                text = '\n'.join(lines[:-1])
            else:
                title = "Telegram Quote"
                text = lines[0]

            messages.append({
                'id': message.id,
                'title': title,
                'text': text,
                'entities': extract_entities(message)
            })

    await client.disconnect()

    with open('channel_messages.json', 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved {len(messages)} messages to channel_messages.json")

asyncio.run(main())
