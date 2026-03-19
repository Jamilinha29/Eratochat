import requests

CHAVE_API = "AIzaSyD9VKRkGBQKmQKFL2Myg-pSPIZJpPhyTWA"
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={CHAVE_API}"

try:
    response = requests.get(url)
    data = response.json()
    
    if response.status_code == 200:
        print("--- MODELOS DISPONÍVEIS NA SUA CHAVE ---")
        for m in data.get('models', []):
            print(f"- {m['name']}")
    else:
        print(f"ERRO: {data}")
except Exception as e:
    print(f"Falha na conexão: {e}")