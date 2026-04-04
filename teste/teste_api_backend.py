import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# Adiciona o diretório raiz ao path para importar a pasta backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_api_chat_sem_mensagem(client):
    """Testa se a API retorna erro 400 (Bad Request) quando a mensagem não é enviada."""
    resposta = client.post('/api/chat', json={})
    assert resposta.status_code == 400
    dados = resposta.get_json()
    assert dados["error"] == "Mensagem não fornecida"

@patch('backend.app.get_chat_session')
def test_api_chat_com_mensagem(mock_get_chat_session, client):
    """Testa o envio de uma mensagem com o modelo Gemini (Mockado para evitar cobrança/lentidão)."""
    
    # Criar um chat mockado que simula a resposta do modelo do Google
    mock_chat = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Claro! Com base nisso recomendo: O Auto da Compadecida (2000)."
    mock_chat.send_message.return_value = mock_response
    mock_get_chat_session.return_value = mock_chat
    
    # Simulando a requisição do frontend
    resposta = client.post('/api/chat', json={
        "message": "Indique um filme nacional", 
        "session_id": "test_session_1"
    })
    
    assert resposta.status_code == 200
    dados = resposta.get_json()
    assert "response" in dados
    assert "Auto da Compadecida" in dados["response"]

@patch('backend.app.get_chat_session')
def test_api_chat_erro_interno(mock_get_chat_session, client):
    """Testa como a API reage (status 500) caso a IA ou a rede deem erro."""
    
    # Forçar um erro (Ex: Erro de API Key ou falha de rede do Google)
    mock_chat = MagicMock()
    mock_chat.send_message.side_effect = Exception("Google API Offline Simulation")
    mock_get_chat_session.return_value = mock_chat
    
    resposta = client.post('/api/chat', json={"message": "Olá"})
    
    assert resposta.status_code == 500
    dados = resposta.get_json()
    assert "Google API Offline Simulation" in dados["response"]
