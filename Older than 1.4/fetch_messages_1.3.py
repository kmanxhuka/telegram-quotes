import json
import asyncio
from telethon import TelegramClient

api_id = 27263017
api_hash = 'e63d76252d56d8cdeb8425e6bf52c8a6'
channel_username = 'masjid_quotes'

async def main():
    client = TelegramClient('session_name', api_id, api_hash)
    await client.start()
    print(f"Connected as {await client.get_me()}")

    messages = []
    async for message in client.iter_messages(channel_username, limit=100):
        if message.message:
            # Keep raw text and entities (for formatting later in Node)
            messages.append({
                'id': message.id,
                'text': message.message,
                'entities': [e.to_dict() for e in (message.entities or [])]
            })

    with open('channel_messages.json', 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(messages)} raw messages to channel_messages.json")

asyncio.run(main())
