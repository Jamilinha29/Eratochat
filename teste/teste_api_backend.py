import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# Adiciona o diretório raiz ao path para importar a pasta backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Permite importar o app sem chave real no CI (as chamadas ao Gemini são mockadas)
os.environ.setdefault("GEMINI_API_KEY", "pytest-placeholder-not-used")

from backend.app import app, _ip_hits, _extract_requested_count

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture(autouse=True)
def clear_rate_limit_bucket(monkeypatch):
    _ip_hits.clear()
    # Evita 401 quando o .env local define APP_AUTH_TOKEN (testes não enviam header).
    monkeypatch.setattr("backend.app.app_auth_token", "")

def test_api_chat_sem_mensagem(client):
    """Testa se a API retorna erro 400 (Bad Request) quando a mensagem não é enviada."""
    resposta = client.post('/api/chat', json={})
    assert resposta.status_code == 400
    dados = resposta.get_json()
    assert dados["error"] == "Mensagem não fornecida"

@patch("backend.app.model")
def test_api_chat_com_mensagem(mock_model, client):
    """Testa o envio de uma mensagem com o modelo Gemini (mockado para evitar cobrança/lentidão)."""

    mock_response = MagicMock()
    mock_response.text = "Claro! Com base nisso recomendo: O Auto da Compadecida (2000)."
    mock_model.generate_content.return_value = mock_response

    resposta = client.post(
        "/api/chat",
        json={"message": "Indique um filme nacional"},
    )

    assert resposta.status_code == 200
    dados = resposta.get_json()
    assert "response" in dados
    assert "Auto da Compadecida" in dados["response"]


@patch("backend.app.model")
def test_api_chat_erro_interno(mock_model, client):
    """Testa como a API reage (status 500) caso a IA ou a rede deem erro."""

    mock_model.generate_content.side_effect = Exception("Google API Offline Simulation")

    resposta = client.post("/api/chat", json={"message": "Olá"})

    assert resposta.status_code == 500
    dados = resposta.get_json()
    assert "Google API Offline Simulation" in dados["response"]


@patch("backend.app.model")
def test_api_chat_stream_sse(mock_model, client):
    class Chunk:
        def __init__(self, text):
            self.text = text

    class StreamResponse:
        def __iter__(self):
            return iter([Chunk("Olá"), Chunk(", mundo!")])

        text = "Olá, mundo!"

    mock_model.generate_content.return_value = StreamResponse()

    resposta = client.post("/api/chat", json={"message": "oi", "stream": True})

    assert resposta.status_code == 200
    assert resposta.mimetype == "text/event-stream"
    body = resposta.get_data(as_text=True)
    assert '"text"' in body
    assert '"done": true' in body


@patch("backend.app.max_message_chars", 5)
def test_api_chat_mensagem_muito_longa(client):
    resposta = client.post("/api/chat", json={"message": "123456"})
    assert resposta.status_code == 413
    dados = resposta.get_json()
    assert "Limite" in dados["error"]


@patch("backend.app.model")
def test_api_chat_rate_limit(mock_model, client, monkeypatch):
    monkeypatch.setattr("backend.app.rate_limit_window_seconds", 60)
    monkeypatch.setattr("backend.app.rate_limit_max_requests", 1)

    mock_response = MagicMock()
    mock_response.text = "ok"
    mock_model.generate_content.return_value = mock_response

    primeira = client.post("/api/chat", json={"message": "teste"})
    segunda = client.post("/api/chat", json={"message": "teste novamente"})

    assert primeira.status_code == 200
    assert segunda.status_code == 429
    assert "retry_after_seconds" in segunda.get_json()


@patch("backend.app.model")
def test_api_chat_respeita_quantidade_explicita(mock_model, client):
    twenty_items = "\n".join([f"{i}. Item {i}" for i in range(1, 21)])
    mock_response = MagicMock()
    mock_response.text = twenty_items
    mock_model.generate_content.return_value = mock_response

    resposta = client.post("/api/chat", json={"message": "Quero 5 recomendações de séries de suspense"})

    assert resposta.status_code == 200
    dados = resposta.get_json()
    texto = dados["response"]
    assert "1. Item 1" in texto
    assert "5. Item 5" in texto
    assert "6. Item 6" not in texto


def test_extract_requested_count_cobre_baloes_e_barra():
    assert _extract_requested_count("10 séries de suspense") == 10
    assert _extract_requested_count("Quero 8 recomendações de livros") == 8
    assert _extract_requested_count("Recomende 4 livros de comédia") == 4
    assert _extract_requested_count("Me de 6 sugestões de livros") == 6
    assert _extract_requested_count("Me recomende 7 séries de suspense") == 7
    assert _extract_requested_count("me dê 25 filmes de ação") == 20
