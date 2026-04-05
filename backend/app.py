import json

import os

import google.generativeai as genai

from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context

from flask_cors import CORS

from dotenv import find_dotenv, load_dotenv



load_dotenv(find_dotenv())





api_key = os.getenv("GEMINI_API_KEY", "").strip()

# Nome do modelo na API (gemini-1.5-* foi descontinuado; padrão alinhado ao SDK atual)

gemini_model_name = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()



if os.getenv("FLASK_DEBUG") == "1":

    print("GEMINI_API_KEY configurada:", bool(api_key))

    print("GEMINI_MODEL:", gemini_model_name)



app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")



# CORS: em produção defina CORS_ORIGINS=https://seu-app.vercel.app

_default_origins = [

    "http://127.0.0.1:5001",

    "http://localhost:5001",

    "http://127.0.0.1:5173",

    "http://localhost:5173",

]

_cors_raw = os.getenv("CORS_ORIGINS", "").strip()

cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()] if _cors_raw else _default_origins

CORS(app, origins=cors_origins, supports_credentials=False)



model = None

if api_key:

    genai.configure(api_key=api_key)

    SYSTEM_PROMPT = """Você é um mecanismo de recomendação ultra-especializado em entretenimento. Recebe títulos ou pedidos e devolve sugestões similares (temática, tom, estilo ou narrativa).

### REGRAS OBRIGATÓRIAS:

1. FOCO: Se o pedido não for sobre filmes, séries ou livros, diga educadamente que só ajuda nesses temas.

2. TIPO DE OBRA (obrigatório): Identifique o que o usuário pediu:
   - Se pedir **apenas filmes** (cinema, longas, “filmes de…”, sem mencionar séries ou livros como foco) → entregue **somente filmes** nas 20 indicações. **Não** inclua séries nem livros.
   - Se pedir **apenas séries** (TV, streaming, temporadas…) → **somente séries** (20 itens). **Não** inclua filmes nem livros.
   - Se pedir **apenas livros** (leitura, autores, romances literários…) → **somente livros** (20 itens). **Não** inclua filmes nem séries.
   - Se o pedido for **genérico** (“recomenda algo”, “o que assistir e ler”) ou **misturar** tipos explicitamente → aí sim pode usar mais de um tipo; distribua os **20 itens** entre o que foi pedido (ou equilibre entre filmes, séries e livros se nada for especificado).

3. QUANTIDADE: **Sempre exatamente 20 obras distintas**, numeradas de **1** a **20**. Quando o foco for um único tipo (filmes OU séries OU livros), os **20** são **todos** desse tipo.

4. FORMATO (Markdown, compacto):
   - Um único cabeçalho `## Filmes` **ou** `## Séries` **ou** `## Livros` quando o pedido for só desse tipo. Se houver mais de um tipo no pedido, use um cabeçalho por seção.
   - Cada item: `**N. Título (Ano ou Autor)**`, sinopse em 1 frase curta, depois *Por que vai gostar:* uma frase curta.

5. Seja direto: no máximo 2 frases de abertura antes da lista.

### TOM:

Prestativo e objetivo; emojis com moderação."""



    # Respostas longas (20 itens): margem confortável para não truncar no meio

    _gen_cfg = genai.GenerationConfig(

        max_output_tokens=16384,

        temperature=0.85,

    )

    model = genai.GenerativeModel(

        model_name=gemini_model_name,

        system_instruction=SYSTEM_PROMPT,

        generation_config=_gen_cfg,

    )





def _iter_stream_text_deltas(stream_response):

    """

    O SDK pode enviar chunks com texto cumulativo (cada chunk.text = texto inteiro até ali)

    ou incremental (só o trecho novo). Emitimos apenas o delta para o SSE.

    Depois do loop, se nada foi emitido, usa stream_response.text (texto final resolvido).

    """

    accumulated = ""

    emitted = False

    for chunk in stream_response:

        try:

            cur = chunk.text or ""

        except (ValueError, AttributeError):

            cur = ""

        if not cur:

            continue

        if accumulated and cur.startswith(accumulated):

            delta = cur[len(accumulated) :]

            accumulated = cur

        elif not accumulated:

            delta = cur

            accumulated = cur

        else:

            delta = cur

            accumulated = accumulated + cur

        if delta:

            emitted = True

            yield delta



    if not emitted:

        try:

            full = stream_response.text or ""

        except (ValueError, AttributeError):

            full = ""

        if full:

            yield full





def _expose_internal_error(exc):

    """Em produção não vaza detalhes internos; em teste/debug sim."""

    if app.config.get("TESTING"):

        return str(exc)

    if os.getenv("FLASK_DEBUG") == "1":

        return str(exc)

    return "Erro interno ao falar com o serviço de IA."





@app.after_request

def security_headers(response):

    response.headers["X-Content-Type-Options"] = "nosniff"

    response.headers["X-Frame-Options"] = "SAMEORIGIN"

    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response





@app.route("/api/chat", methods=["POST"])

def chat_agente():

    dados = request.get_json(silent=True) or {}

    msg_usuario = dados.get("message", "")

    use_stream = bool(dados.get("stream"))



    if not msg_usuario:

        return jsonify({"error": "Mensagem não fornecida"}), 400



    if model is None:

        return jsonify({"error": "Serviço de IA não configurado. Defina GEMINI_API_KEY no ambiente."}), 503



    if use_stream:



        def sse_chunks():

            try:

                stream_resp = model.generate_content(msg_usuario, stream=True)

                for delta in _iter_stream_text_deltas(stream_resp):

                    if delta:

                        yield f"data: {json.dumps({'text': delta}, ensure_ascii=False)}\n\n"

                yield f"data: {json.dumps({'done': True})}\n\n"

            except Exception as e:

                yield f"data: {json.dumps({'error': _expose_internal_error(e)})}\n\n"



        return Response(

            stream_with_context(sse_chunks()),

            mimetype="text/event-stream",

            headers={

                "Cache-Control": "no-cache",

                "X-Accel-Buffering": "no",

            },

        )



    try:

        response = model.generate_content(msg_usuario, stream=False)

        return jsonify({"response": response.text})

    except Exception as e:

        detail = _expose_internal_error(e)

        return jsonify({"response": f"O projetor parou! (Erro: {detail})"}), 500





@app.route("/")

def index():

    return app.send_static_file("index.html")





@app.route("/<path:path>")

def static_files(path):

    return app.send_static_file(path)





if __name__ == "__main__":

    debug = os.getenv("FLASK_DEBUG") == "1"

    app.run(debug=debug, port=5001)
