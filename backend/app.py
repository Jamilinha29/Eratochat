import json
import os
import re
import time
from collections import defaultdict, deque

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from dotenv import find_dotenv, load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

load_dotenv(find_dotenv())

api_key = os.getenv("GEMINI_API_KEY", "").strip()
gemini_model_name = (os.getenv("GEMINI_MODEL") or "gemini-3-flash").strip()
app_auth_token = os.getenv("APP_AUTH_TOKEN", "").strip()
max_message_chars = int(os.getenv("MAX_MESSAGE_CHARS", "1200"))
rate_limit_max_requests = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "25"))
rate_limit_window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

if os.getenv("FLASK_DEBUG") == "1":
    print("GEMINI_API_KEY configurada:", bool(api_key))
    print("GEMINI_MODEL:", gemini_model_name)

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")

# CORS: em produção, configure CORS_ORIGINS com URL HTTPS do seu domínio.
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
   - Se pedir apenas filmes: entregue somente filmes nas N indicações.
   - Se pedir apenas séries: entregue somente séries nas N indicações.
   - Se pedir apenas livros: entregue somente livros nas N indicações.
   - Se o pedido misturar tipos, distribua os N itens entre os tipos pedidos.
3. QUANTIDADE: Se o usuário pedir explicitamente um número de recomendações, use exatamente esse número. Se não pedir número, use 20 obras distintas. Sempre numere de 1 até N.
4. FORMATO (Markdown, compacto):
   - Um cabeçalho por tipo (`## Filmes`, `## Séries`, `## Livros`) apenas quando aplicável.
   - Cada item deve ficar em 3 blocos fixos, nesta ordem:
     1) `**N. Título (Ano ou Autor)**`
     2) Sinopse/descrição da obra (2 a 3 linhas, com 3 a 4 frases curtas)
     3) *Por que vai gostar:* (1 frase)
5. Seja direto: no máximo 2 frases de abertura antes da lista.

### TOM:
Prestativo e objetivo; use linguagem clara com um toque técnico (termos como narrativa, direção, ritmo, fotografia, desenvolvimento de personagens quando fizer sentido), sem exagerar no jargão. Emojis com moderação."""

    _gen_cfg = genai.GenerationConfig(max_output_tokens=16384, temperature=0.85)
    model = genai.GenerativeModel(
        model_name=gemini_model_name,
        system_instruction=SYSTEM_PROMPT,
        generation_config=_gen_cfg,
    )

_ip_hits = defaultdict(deque)


def _extract_requested_count(user_text):
    """
    Detecta quando o usuário pede uma quantidade específica de recomendações.
    Se não detectar, retorna 20 (padrão).
    """
    text = (user_text or "").lower()
    patterns = [
        # Ex.: "10 recomendações", "5 opções", "7 itens"
        r"\b(\d{1,2})\s*(?:recomenda(?:cao|ção|coes|ções)|op(?:cao|ção|coes|ções)|itens?|sugestoes|sugestões)\b",
        # Ex.: "10 séries de suspense", "8 livros fantasia", "20 filmes sci-fi"
        r"\b(\d{1,2})\s*(?:filmes?|s[eé]ries?|livros?)\b",
        # Ex.: "me dê 8", "me de 8", "quero 12", "traga 6", "recomende 4"
        r"\b(?:me\s+d[eê]|quero|traga|liste|mostre|gere|recomende|recomendar)\s+(\d{1,2})\b",
        # Ex.: "me recomende 7", "me recomenda 7", "me recomendar 7"
        r"\bme\s+recomend(?:e|a|ar)\s+(\d{1,2})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if not m:
            continue
        n = int(m.group(1))
        # Mantém entre 1 e 20 para preservar desempenho e legibilidade.
        return max(1, min(n, 20))
    return 20


def _build_prompt_for_request(user_text):
    requested_count = _extract_requested_count(user_text)
    default_rule = (
        "O usuário NÃO informou número explícito; portanto use 20 recomendações."
        if requested_count == 20
        else f"O usuário pediu explicitamente {requested_count} recomendações; não gere mais nem menos."
    )
    return (
        f"INSTRUÇÃO DE QUANTIDADE PARA ESTA RESPOSTA: gere exatamente {requested_count} recomendações, nem mais nem menos, "
        f"numeradas de 1 a {requested_count}. "
        "Se o pedido ultrapassar o limite, respeite no máximo 20 itens. "
        "Não inclua explicações extras fora da lista. "
        f"{default_rule} "
        "Siga isso como prioridade máxima.\n\n"
        f"Pedido do usuário: {user_text}"
    )


def _quota_error_message():
    return (
        "Limite de uso da IA atingido (cota). Aguarde alguns instantes e tente novamente, "
        "ou ajuste o plano/cota da chave Gemini."
    )


def _enforce_recommendation_count(raw_text, requested_count):
    """
    Garante que a resposta tenha no máximo N itens numerados.
    Mantém introdução/cabeçalhos antes do item 1.
    """
    text = (raw_text or "").strip()
    if not text or requested_count <= 0:
        return text

    starts = [m.start() for m in re.finditer(r"(?m)^\s*\d{1,2}\.\s+", text)]
    if not starts:
        return text
    if len(starts) <= requested_count:
        return text

    prefix = text[: starts[0]].rstrip()
    chunks = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(text)
        chunks.append(text[start:end])

    kept = "".join(chunks[:requested_count]).rstrip()
    if prefix:
        return f"{prefix}\n\n{kept}".strip()
    return kept.strip()


def _chunk_for_sse(text, chunk_size=420):
    for i in range(0, len(text), chunk_size):
        yield text[i : i + chunk_size]


def _expose_internal_error(exc):
    """Em produção não vaza detalhes internos; em teste/debug sim."""
    if app.config.get("TESTING"):
        return str(exc)
    if os.getenv("FLASK_DEBUG") == "1":
        return str(exc)
    return "Erro interno ao falar com o serviço de IA."


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _check_rate_limit(ip):
    if rate_limit_max_requests <= 0:
        return False, 0

    now = time.time()
    bucket = _ip_hits[ip]
    while bucket and (now - bucket[0]) > rate_limit_window_seconds:
        bucket.popleft()

    if len(bucket) >= rate_limit_max_requests:
        retry_after = max(1, int(rate_limit_window_seconds - (now - bucket[0])))
        return True, retry_after

    bucket.append(now)
    return False, 0


def _is_authorized():
    if not app_auth_token:
        return True
    raw_auth = request.headers.get("Authorization", "").strip()
    bearer = raw_auth[7:].strip() if raw_auth.lower().startswith("bearer ") else ""
    header_token = request.headers.get("X-App-Token", "").strip()
    return bearer == app_auth_token or header_token == app_auth_token


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self' http://127.0.0.1:5001 http://localhost:5001 https:; "
        "frame-ancestors 'self'"
    )
    return response


@app.route("/api/chat", methods=["POST"])
def chat_agente():
    if not _is_authorized():
        return jsonify({"error": "Não autorizado"}), 401

    rate_limited, retry_after = _check_rate_limit(_client_ip())
    if rate_limited:
        return (
            jsonify(
                {
                    "error": "Muitas requisições. Aguarde alguns segundos e tente novamente.",
                    "retry_after_seconds": retry_after,
                }
            ),
            429,
        )

    dados = request.get_json(silent=True) or {}
    msg_usuario = str(dados.get("message", "")).strip()
    requested_count = _extract_requested_count(msg_usuario)
    use_stream = bool(dados.get("stream"))

    if not msg_usuario:
        return jsonify({"error": "Mensagem não fornecida"}), 400
    if len(msg_usuario) > max_message_chars:
        return jsonify({"error": f"Mensagem muito longa. Limite: {max_message_chars} caracteres."}), 413
    if model is None:
        return jsonify({"error": "Serviço de IA não configurado. Defina GEMINI_API_KEY no ambiente."}), 503

    if use_stream:

        def sse_chunks():
            try:
                response = model.generate_content(
                    _build_prompt_for_request(msg_usuario),
                    stream=False,
                )
                final_text = _enforce_recommendation_count(response.text or "", requested_count)
                for delta in _chunk_for_sse(final_text):
                    yield f"data: {json.dumps({'text': delta}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except google_exceptions.ResourceExhausted:
                yield f"data: {json.dumps({'error': _quota_error_message()})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': _expose_internal_error(e)})}\n\n"

        return Response(
            stream_with_context(sse_chunks()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        response = model.generate_content(_build_prompt_for_request(msg_usuario), stream=False)
        final_text = _enforce_recommendation_count(response.text or "", requested_count)
        return jsonify({"response": final_text})
    except google_exceptions.ResourceExhausted:
        return jsonify({"error": _quota_error_message()}), 429
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
