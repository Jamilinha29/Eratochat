import http from 'k6/http';
import { check, sleep } from 'k6';

/*
  Como rodar este teste:
  1. Instale o K6 (https://k6.io/docs/get-started/installation/)
  2. Garanta que o seu servidor Python (app.py) esteja rodando em localhost:5001
  3. No terminal, execute: k6 run teste/load_test.js
*/

export const options = {
  // Simulando um tráfego de 5 usuários simultâneos por 15 segundos.
  // Mantemos o número de VUs baixo para não esgotar a cota gratuita (Rate Limit) da API do Google Gemini.
  vus: 5,
  duration: '15s',
  
  // Limiares de aceitação para considerar que o sistema passou no teste de carga
  thresholds: {
    // 95% das requisições devem ser mais rápidas do que 6 segundos (O Gemini pode ser um pouco lento)
    http_req_duration: ['p(95)<6000'],
    // Taxa de falhas deve ser inferior a 1%
    http_req_failed: ['rate<0.01'], 
  },
};

export default function () {
  // Endereço local ou de produção
  const url = 'http://127.0.0.1:5001/api/chat';
  
  // Payload simulando o frontend em modo streaming
  const payload = JSON.stringify({
    message: 'Olá, me recomende uma série de ficção curtinha!',
    stream: true
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Dispara a requisição POST
  const res = http.post(url, payload, params);

  // Verifica o resultado
  check(res, {
    'status é 200 (Sucesso)': (r) => r.status === 200,
    'resposta é SSE': (r) => (r.headers['Content-Type'] || '').includes('text/event-stream'),
    'resposta contém eventos': (r) => r.body && r.body.includes('data: '),
  });

  // Pausa entre os envios para simular um usuário humano lendo a resposta
  sleep(2);
}
