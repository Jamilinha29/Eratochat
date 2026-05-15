import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from backend.app import _ip_hits, app  # noqa: E402


def enviar_requisicoes():
    _ip_hits.clear()
    mensagens = [
        "Me recomende 3 filmes de suspense",
        "Quero 2 series de comedia",
        "Me indique 2 livros de fantasia",
    ]

    print("Enviando 3 requisicoes para /api/chat ...")
    with app.test_client() as client:
        for i, mensagem in enumerate(mensagens, start=1):
            resposta = client.post("/api/chat", json={"message": mensagem, "stream": False})
            corpo = resposta.get_json(silent=True) or {}
            print(f"- req_{i}: status={resposta.status_code}, keys={list(corpo.keys())}")


def verificar_supabase():
    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_KEY") or "").strip()
    tabela = (os.getenv("SUPABASE_METRICS_TABLE") or "api_request_metrics").strip()

    if not url or not key:
        print("Supabase nao configurado no .env; nao foi possivel verificar logs.")
        return

    query = urllib.parse.urlencode(
        {
            "select": "id,endpoint,status_code,response_time_ms,created_at",
            "order": "created_at.desc",
            "limit": 5,
        }
    )
    endpoint = f"{url}/rest/v1/{tabela}?{query}"
    req = urllib.request.Request(
        endpoint,
        method="GET",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
    )

    print("Consultando ultimos registros no Supabase ...")
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"Total retornado: {len(data)}")
            for row in data[:3]:
                print(
                    f"- id={row.get('id')} status={row.get('status_code')} "
                    f"ms={row.get('response_time_ms')} created_at={row.get('created_at')}"
                )
    except urllib.error.HTTPError as exc:
        detalhe = exc.read().decode("utf-8", errors="ignore")
        print(f"Falha ao consultar Supabase (HTTP {exc.code}). Detalhe: {detalhe}")
        print("Se houver RLS sem policy de SELECT, os inserts ainda podem estar funcionando.")
    except Exception as exc:
        print(f"Falha ao consultar Supabase: {exc}")


if __name__ == "__main__":
    enviar_requisicoes()
    verificar_supabase()
