import os
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Carrega variáveis do .env (busca na raiz)
from dotenv import find_dotenv
load_dotenv(find_dotenv())

api_key = os.getenv("GEMINI_API_KEY")
print("API KEY FOUND:", bool(api_key))

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
CORS(app)

# Configura a chave da API do Gemini
genai.configure(api_key=api_key)

SYSTEM_PROMPT = """Você é um mecanismo de recomendação ultra-especializado em entretenimento. Seu objetivo único é receber nomes de filmes, séries ou livros e retornar sugestões similares com base em temática, tom, estilo ou narrativa.

### REGRAS DE EXECUÇÃO:
1. FOCO TOTAL: Se o usuário enviar algo que não seja um título de obra ou pedido de recomendação, responda educadamente que você só pode ajudar com filmes, séries e livros.
2. FORMATO DE SAÍDA (Markdown): Suas respostas DEVEM ser estruturadas com Markdown para que o frontend as exiba corretamente. Use negrito para títulos e listas para detalhes.
3. ORGANIZAÇÃO: Separe claramente as sugestões por categoria (Filmes, Séries ou Livros).
4. CURADORIA: Para cada indicação, inclua:
   - Título e Ano/Autor.
   - Uma breve sinopse (máximo 2 frases).
   - "Por que você vai gostar": Uma explicação rápida da conexão com o que o usuário gosta.

### TOM DE VOZ:
Seja prestativo, inteligente e direto ao ponto. Use emojis de forma moderada para manter o visual atraente no chat."""

# Inicializa o modelo
model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction=SYSTEM_PROMPT
)

# Inicializa um dicionário simples de históricos por sessão (em produção seria um banco de dados)
chats = {}

def get_chat_session(session_id="default"):
    if session_id not in chats:
        chats[session_id] = model.start_chat(history=[])
    return chats[session_id]

@app.route('/api/chat', methods=['POST'])
def chat_agente():
    dados = request.get_json()
    msg_usuario = dados.get('message', '')
    session_id = dados.get('session_id', 'default')

    if not msg_usuario:
        return jsonify({"error": "Mensagem não fornecida"}), 400

    chat = get_chat_session(session_id)

    try:
        response = chat.send_message(msg_usuario)
        return jsonify({"response": response.text})
    except Exception as e:
        return jsonify({"response": f"O projetor parou! (Erro: {str(e)})"}), 500

# Rotas para servir o frontend localmente (Vercel ignora isso se bem configurado)
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def static_files(path):
    return app.send_static_file(path)

# Tratamento especial para o vercel (o vercel procura por 'app')
if __name__ == '__main__':
    app.run(debug=True, port=5001)
