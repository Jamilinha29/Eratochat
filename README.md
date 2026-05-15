# EratoChat

Plataforma de recomendação inteligente para **filmes, séries e livros** com interface web e backend em Flask integrado ao Google Gemini.

## Apresentação e Contexto

Com o volume crescente de opções em streaming e leitura, usuários enfrentam sobrecarga de escolha e baixa personalização. O EratoChat foi criado para reduzir esse problema, transformando pedidos em linguagem natural (ex.: "quero algo parecido com Stranger Things") em recomendações organizadas, explicadas e relevantes.

### O que o projeto entrega

- Interpretação de pedidos textuais com IA generativa.
- Recomendações estruturadas por tipo de obra.
- Controle de quantidade solicitada pelo usuário.
- Resposta em formato Markdown com sinopse e justificativa.
- Coleta de métricas reais de API (tempo e erro) no Supabase.
- Módulo de classificação supervisionada para análise de tipo de pedido (`filme`, `serie`, `livro`, `misto`).

## Arquitetura e Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, Vite, `marked`, DOMPurify |
| Backend | Python, Flask, Flask-CORS, `google-generativeai`, `python-dotenv` |
| IA | Google Gemini (`gemini-3-flash`) |
| Métricas | Supabase (REST + tabela `api_request_metrics`) |
| ML complementar | scikit-learn, joblib, python-docx |
| Deploy | Vercel (`vercel.json`) |

## Estrutura do Projeto

```text
EratoChat/
├── backend/
│   └── app.py
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
├── ml/
│   ├── artefatos/
│   │   ├── metricas_modelos.txt
│   │   └── modelo_tipo_obra.joblib
│   ├── RELATORIO_N2.docx
│   └── treino_classificadores.py
├── teste/
│   ├── teste_api_backend.py
│   ├── teste_modelos.py
│   ├── load_test.js
│   ├── verificar_insert_supabase.py
│   └── disparar_requisicoes_e_verificar_supabase.py
├── .env.example
├── .env
├── .gitignore
├── README.md
├── requirements.txt
└── vercel.json
```

## Guia de Início Rápido

### 1) Pré-requisitos

- Python 3.10+ (3.12 recomendado)
- Node.js 18+
- Chave Gemini
- (Opcional) Projeto Supabase para métricas

### 2) Instalação

```bash
git clone https://github.com/Emilio467/CineChat.git
cd CineChat
```

Ambiente Python:

```bash
python -m venv .venv
```

Ativação:

- Windows (PowerShell): `.\.venv\Scripts\Activate.ps1`
- Windows (CMD): `.venv\Scripts\activate.bat`
- Linux/macOS: `source .venv/bin/activate`

Dependências:

```bash
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3) Configuração (`.env`)

Se voce **ja tem** `.env`, mantenha o seu arquivo atual.

Se voce **nao tem** `.env`, use o template:

- Windows (CMD): `copy .env.example .env`
- Linux/macOS: `cp .env.example .env`

Depois, edite os valores obrigatorios no `.env`:

```env
GEMINI_API_KEY=COLE_SUA_CHAVE_AQUI
GEMINI_MODEL=gemini-3-flash
MAX_MESSAGE_CHARS=1200
RATE_LIMIT_MAX_REQUESTS=25
RATE_LIMIT_WINDOW_SECONDS=60
APP_AUTH_TOKEN=
CORS_ORIGINS=http://127.0.0.1:5001,http://localhost:5001,http://127.0.0.1:5173,http://localhost:5173
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_METRICS_TABLE=api_request_metrics
FLASK_DEBUG=1
```

Observacao: o backend mostra instrucoes de setup apenas quando detecta que `.env` nao existe.

### 4) Executar

```bash
python backend/app.py
```

- API: `POST http://127.0.0.1:5001/api/chat`
- App: `http://127.0.0.1:5001/`

## Documentação de Uso

### Exemplo de requisição da API

```bash
curl -X POST "http://127.0.0.1:5001/api/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Me recomende 5 livros de fantasia\",\"stream\":false}"
```

Exemplo de resposta:

```json
{
  "response": "## Livros\n\n**1. ...**\n..."
}
```

### Regras de negócio implementadas

- Foco em filmes, séries e livros.
- Se o usuário define quantidade, a API respeita.
- Se não define, padrão de 20 recomendações.
- Limite de tamanho de mensagem (`MAX_MESSAGE_CHARS`).
- Rate limit por IP.

### Segurança implementada

- Chave Gemini somente no backend.
- CORS configurável por ambiente.
- Token opcional (`APP_AUTH_TOKEN`).
- Cabeçalhos de segurança HTTP.
- Sanitização de HTML no frontend via DOMPurify.

## Classificação Supervisionada e Relatório

O projeto inclui um módulo de ML para classificar o tipo de solicitação textual do usuário.

### O que foi implementado

- Separação treino/teste com `train_test_split`.
- Treino de 3 classificadores:
  - Logistic Regression
  - Linear SVC
  - Multinomial Naive Bayes
- Matriz de confusão do melhor modelo.
- Relatório em Word com atualização automática:
  - `ml/RELATORIO_N2.docx`
  - cópia em `Downloads/RELATORIO_N2.docx` ao executar o script.

### Como executar

```bash
python ml/treino_classificadores.py
```

Arquivos gerados:

- `ml/artefatos/modelo_tipo_obra.joblib`
- `ml/artefatos/metricas_modelos.txt`
- `ml/RELATORIO_N2.docx`

## Supabase (Métricas Reais da API)

Com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, cada chamada ao `/api/chat` é registrada com status e tempo de resposta.

### Criação da tabela

```sql
create table if not exists public.api_request_metrics (
  id bigint generated always as identity primary key,
  endpoint text not null default '/api/chat',
  status_code integer not null,
  response_time_ms integer not null,
  message_length integer not null default 0,
  is_stream boolean not null default false,
  error_code text,
  error_message text,
  client_ip text,
  created_at timestamp with time zone not null default now()
);
```

### Permissões mínimas (anon)

```sql
alter table public.api_request_metrics enable row level security;

drop policy if exists "allow anon insert metrics" on public.api_request_metrics;
drop policy if exists "allow anon select metrics" on public.api_request_metrics;

create policy "allow anon insert metrics"
on public.api_request_metrics
for insert
to anon
with check (true);

create policy "allow anon select metrics"
on public.api_request_metrics
for select
to anon
using (true);

grant insert, select on public.api_request_metrics to anon;
grant usage, select on sequence public.api_request_metrics_id_seq to anon;
```

## Testes

```bash
pytest teste/teste_api_backend.py
```

Utilitários de verificação:

- `python teste/verificar_insert_supabase.py`
- `python teste/disparar_requisicoes_e_verificar_supabase.py`

## Deploy

O projeto já está preparado para Vercel com:

- função Python em `backend/app.py`
- build estático do frontend
- roteamento via `vercel.json`

Configure as variáveis no painel da Vercel (principalmente `GEMINI_API_KEY` e variáveis de Supabase, se usadas em produção).

## Guia de Contribuição

1. Faça um fork do projeto.
2. Crie uma branch de feature/correção.
3. Implemente com commits pequenos e objetivos.
4. Rode testes (`pytest`) antes de abrir PR.
5. Descreva no PR:
   - motivação da mudança,
   - impacto esperado,
   - como validar.

### Boas práticas para contribuir

- Não versionar segredos (`.env`, chaves, tokens).
- Manter compatibilidade com fluxo local e Vercel.
- Documentar qualquer nova variável de ambiente no `README.md`.

## Informações de Contato

### Autores

- Emílio Gaspar — Desenvolvimento Backend
- Jamili Gabriela — QA e Desenvolvimento
- Dante Tucker — Análise de Dados
- Wesley Albuquerque — Desenvolvimento Frontend
- João Lira Baracho — Análise de Dados

### Canais de ajuda

- Abra uma issue no repositório para bugs e dúvidas técnicas.
- Para suporte de execução local, inclua:
  - sistema operacional,
  - comando executado,
  - erro completo exibido no terminal.

