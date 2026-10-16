import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError("GROQ_API_KEY is missing from backend/.env")

client = Groq(api_key=api_key)
response = client.chat.completions.create(
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    messages=[{"role": "user", "content": "What is photosynthesis?"}],
)

print((response.choices[0].message.content or "").encode("ascii", "replace").decode())
