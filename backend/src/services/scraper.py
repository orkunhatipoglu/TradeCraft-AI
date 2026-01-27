import sys
import json
import os
import asyncio
import re
from praw import Reddit
from telethon import TelegramClient
from dotenv import load_dotenv

# --- Configuration & Setup ---
# .env dosyasını üst dizinden yükle
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

reddit_client_id = os.getenv('REDDIT_CLIENT_ID')
reddit_client_secret = os.getenv('REDDIT_CLIENT_SECRET')
reddit_user_agent = os.getenv('REDDIT_USER_AGENT')
# Virgülle ayrılmış subreddit listesi
reddit_subreddits = os.getenv('REDDIT_SUBREDDITS', 'CryptoCurrency,SatoshiStreetBets').split(',')

telegram_api_id = os.getenv('TELEGRAM_API_ID')
telegram_api_hash = os.getenv('TELEGRAM_API_HASH')
# Virgülle ayrılmış kanal listesi (örn: @Bitcoin,@CryptoSignals)
telegram_channels = os.getenv('TELEGRAM_CHANNELS', '').split(',')

def scrape_reddit(symbols):
    """Reddit'ten son gönderileri çeker ve ham metin listesi döner."""
    if not reddit_client_id or not reddit_client_secret:
        return []
    
    try:
        reddit = Reddit(
            client_id=reddit_client_id,
            client_secret=reddit_client_secret,
            user_agent=reddit_user_agent
        )
        
        texts = []
        # Birden fazla subreddit'i birleştir (örn: CryptoCurrency+Bitcoin)
        sub_string = "+".join([s.strip().replace('r/', '') for s in reddit_subreddits])
        subreddit = reddit.subreddit(sub_string)
        
        # 'Hot' yerine 'New' çekmek daha güncel veri verir
        for post in subreddit.new(limit=50): 
            combined_text = f"{post.title} {post.selftext}"
            # Regex ile sembol kontrolü: word boundary kullanarak tam eşleşme
            if any(re.search(r'\b' + re.escape(s) + r'\b', combined_text, re.IGNORECASE) for s in symbols):
                texts.append(combined_text)
                
        return texts
    except Exception as e:
        # Hata basma, sadece boş dön (TS tarafı JSON parse hatası almasın diye)
        return []

async def scrape_telegram(symbols):
    """Telegram kanallarından son mesajları çeker."""
    if not telegram_api_id or not telegram_api_hash:
        return []
    
    try:
        client = TelegramClient('tradecraft_session', int(telegram_api_id), telegram_api_hash)
        await client.start()
        
        texts = []
        for channel in telegram_channels:
            if not channel: continue
            try:
                # Son 30 mesajı kontrol et
                async for message in client.iter_messages(channel.strip(), limit=30):
                    if message.text and any(re.search(r'\b' + re.escape(s) + r'\b', message.text, re.IGNORECASE) for s in symbols):
                        texts.append(message.text)
            except Exception:
                continue
            # Flood koruması için kanal arası bekleme
            await asyncio.sleep(0.5)
                
        await client.disconnect()
        return texts
    except Exception:
        return []

async def main():
    # Sembolleri argüman olarak al
    symbols = sys.argv[1:] if len(sys.argv) > 1 else ['BTC', 'Bitcoin']
    
    # Paralel çalıştır
    loop = asyncio.get_running_loop()
    
    # Reddit (Senkron) ve Telegram (Asenkron) görevlerini birleştir
    reddit_future = loop.run_in_executor(None, scrape_reddit, symbols)
    telegram_future = scrape_telegram(symbols)
    
    results = await asyncio.gather(reddit_future, telegram_future)
    
    # İki listeyi birleştir: [Reddit Textleri] + [Telegram Textleri]
    all_raw_texts = results[0] + results[1]
    
    # SADECE JSON ÇIKTISI VER (Print yok, log yok)
    print(json.dumps(all_raw_texts))

if __name__ == '__main__':
    asyncio.run(main())