import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CHAVE_API = "AIzaSyD9VKRkGBQKmQKFL2Myg-pSPIZJpPhyTWA"


PROMPT_SISTEMA = (
    "Você é o CineChat, um assistente especializado em cinema e séries. "
    "Personalidade: Entusiasta, amigável e com vasto conhecimento técnico e de curiosidades. "
    "Regras: 1. Responda sempre como um expert. 2. Use emojis de cinema (🎬, 🍿). "
    "3. Se o usuário falar de um filme, sugira algo parecido ou conte uma curiosidade."
)


historico_conversa = []

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/chat', methods=['POST'])
def chat_agente():
    global historico_conversa
    dados = request.get_json()
    msg_usuario = dados.get('message', '')


    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={CHAVE_API}"
    

    historico_conversa.append({"role": "user", "parts": [{"text": msg_usuario}]})
    

    payload = {
        "system_instruction": {"parts": [{"text": PROMPT_SISTEMA}]},
        "contents": historico_conversa
    }

    try:
        response = requests.post(url, json=payload)
        response_data = response.json()

        if response.status_code == 200:
            texto_ia = response_data['candidates'][0]['content']['parts'][0]['text']
            

            historico_conversa.append({"role": "model", "parts": [{"text": texto_ia}]})
            

            if len(historico_conversa) > 15:
                historico_conversa.pop(0)
                
            return jsonify({"response": texto_ia})
        else:
            erro = response_data.get('error', {}).get('message', 'Erro desconhecido')
            return jsonify({"response": f"Erro na projeção: {erro}"})

    except Exception as e:
        return jsonify({"response": "O projetor parou! (Erro de conexão)"})

if __name__ == '__main__':
    app.run(debug=True, port=5001)