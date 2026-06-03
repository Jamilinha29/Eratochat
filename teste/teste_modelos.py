import os
import google.generativeai as genai
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(), override=True)  # Busca o .env na raiz do projeto de forma inteligente

CHAVE_API = os.getenv("GEMINI_API_KEY", "").strip().strip("'\"")

if not CHAVE_API:
    print("ERRO: Variável GEMINI_API_KEY não encontrada no .env")
    exit()

genai.configure(api_key=CHAVE_API)

try:
    print("--- MODELOS DISPONÍVEIS NA SUA CHAVE ---")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Falha na conexão: {e}")
