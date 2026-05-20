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
| IA | Google Gemini (`gemini-3-flash-preview`) |
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

### Referencia rapida — CMD vs PowerShell

| Acao | CMD | PowerShell |
|------|-----|------------|
| Entrar em pasta | `cd /d C:\pasta` | `Set-Location C:\pasta` |
| Ativar venv | `.venv\Scripts\activate.bat` | `.\.venv\Scripts\Activate.ps1` |
| Copiar arquivo | `copy origem destino` | `Copy-Item origem destino` |
| npm | `npm install` | `npm.cmd install` |
| Continuar linha | `^` no fim da linha | `` ` `` no fim da linha |
| Python alternativo | caminho completo `.exe` | `& "$env:LOCALAPPDATA\...\python.exe"` |

### 1) Pré-requisitos

- Python 3.10+ (3.12 recomendado)
- Node.js 18+
- Chave Gemini
- (Opcional) Projeto Supabase para métricas

### 2) Instalação

> Use **apenas** o bloco do terminal que voce abriu. Nao misture sintaxe de CMD com PowerShell.

**CMD (Prompt de Comando)**

```cmd
git clone https://github.com/Emilio467/CineChat.git
cd CineChat
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
cd frontend
npm install
npm run build
cd ..
copy .env.example .env
```

**PowerShell**

```powershell
git clone https://github.com/Emilio467/CineChat.git
Set-Location CineChat
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Set-Location frontend
npm.cmd install
npm.cmd run build
Set-Location ..
Copy-Item .env.example .env
```

Se `python` nao for reconhecido no **PowerShell**:

```powershell
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -m venv .venv
.\.venv\Scripts\Activate.ps1
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -m pip install -r requirements.txt
```

**Linux/macOS:**

```bash
git clone https://github.com/Emilio467/CineChat.git
cd CineChat
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
cp .env.example .env
```

### 3) Configuração (`.env`)

Se voce **ja tem** `.env`, mantenha o seu arquivo atual.

Se voce **nao tem** `.env`, copie o template (ja incluido nos comandos de instalacao acima).

Depois, edite os valores obrigatorios no `.env`:

```env
GEMINI_API_KEY=COLE_SUA_CHAVE_AQUI
GEMINI_MODEL=gemini-3-flash-preview
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

Se usar `APP_AUTH_TOKEN`, crie `frontend\.env.local` com o mesmo valor:

```env
VITE_APP_AUTH_TOKEN=seu_token_aqui
```

CMD (a partir da raiz do projeto):

```cmd
copy frontend\.env.example frontend\.env.local
```

PowerShell (a partir da raiz do projeto):

```powershell
Copy-Item frontend\.env.example frontend\.env.local
```

### 4) Executar

O chat precisa do **backend na porta 5001**. O Vite (porta 5173) e opcional para desenvolvimento com hot-reload.

> **CMD:** barras `\`, `npm`, `activate.bat`.  
> **PowerShell:** `npm.cmd`, `.\`, `Activate.ps1`, `Set-Location`, `Copy-Item`.

#### Opcao A — Dois terminais (desenvolvimento)

**Terminal 1 — Backend (obrigatorio)**

CMD:

```cmd
cd /d C:\caminho\para\Eratochat
.venv\Scripts\activate.bat
python backend\app.py
```

PowerShell:

```powershell
Set-Location C:\caminho\para\Eratochat
.\.venv\Scripts\Activate.ps1
python backend\app.py
```

Se `python` nao for reconhecido no **PowerShell**:

```powershell
Set-Location C:\caminho\para\Eratochat
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" backend\app.py
```

**Terminal 2 — Frontend (opcional)**

CMD:

```cmd
cd /d C:\caminho\para\Eratochat\frontend
npm run dev
```

PowerShell:

```powershell
Set-Location C:\caminho\para\Eratochat\frontend
npm.cmd run dev
```

Acesse `http://localhost:5173` com o backend ja em `http://127.0.0.1:5001`.

#### Opcao B — Um terminal (producao local)

CMD:

```cmd
cd /d C:\caminho\para\Eratochat
.venv\Scripts\activate.bat
cd frontend
npm run build
cd ..
python backend\app.py
```

PowerShell:

```powershell
Set-Location C:\caminho\para\Eratochat
.\.venv\Scripts\Activate.ps1
Set-Location frontend
npm.cmd run build
Set-Location ..
python backend\app.py
```

Acesse `http://127.0.0.1:5001/` (interface + API no mesmo servidor).

#### URLs

- API: `POST http://127.0.0.1:5001/api/chat`
- App (build unico): `http://127.0.0.1:5001/`
- Dev (Vite): `http://localhost:5173/`

### Solucao de problemas

| Sintoma | Causa | O que fazer |
|--------|--------|-------------|
| `python` nao reconhecido (PowerShell) | Python fora do PATH | Use o bloco com `& "$env:LOCALAPPDATA\..."` da secao 4 |
| `python` nao reconhecido (CMD) | Python fora do PATH | Instale Python marcando "Add to PATH" ou use o caminho completo do executavel |
| Erro de conexao no chat | Backend parado | Suba `backend/app.py` antes do Vite |
| `Nao autorizado` (401) | `APP_AUTH_TOKEN` definido sem token no frontend | Preencha `frontend/.env.local` com `VITE_APP_AUTH_TOKEN` igual ao backend, ou deixe `APP_AUTH_TOKEN` vazio |
| Erro 500 da IA apos autenticar | Modelo invalido (`gemini-3-flash`) | Use `GEMINI_MODEL=gemini-3-flash-preview` e reinicie o backend |
| Chave nova nao vale | `.env` so e lido na inicializacao | Pare o Flask (Ctrl+C) e inicie de novo |
| `npm` falha no PowerShell | Politica de scripts bloqueia `npm.ps1` | Use `npm.cmd` em vez de `npm` |
| `npm.cmd` / `python` nao encontrado | Fora do PATH | Use os comandos completos da secao 4 ou marque "Add to PATH" na instalacao |

## Documentação de Uso

### Exemplo de requisição da API

CMD (`^` continua o comando na linha seguinte):

```cmd
curl -X POST "http://127.0.0.1:5001/api/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Me recomende 5 livros de fantasia\",\"stream\":false}"
```

PowerShell (`` ` `` continua o comando na linha seguinte):

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/chat" -Method POST `
  -ContentType "application/json" `
  -Body '{"message":"Me recomende 5 livros de fantasia","stream":false}'
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

CMD:

```cmd
cd /d C:\caminho\para\Eratochat
.venv\Scripts\activate.bat
python ml\treino_classificadores.py
```

PowerShell:

```powershell
Set-Location C:\caminho\para\Eratochat
.\.venv\Scripts\Activate.ps1
python ml\treino_classificadores.py
```

Se `python` nao for reconhecido no **PowerShell**:

```powershell
Set-Location C:\caminho\para\Eratochat
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" ml\treino_classificadores.py
```

Arquivos gerados:

- `ml/artefatos/modelo_tipo_obra.joblib`
- `ml/artefatos/metricas_modelos.txt`
- `ml/RELATORIO_N2.docx`

## Supabase (Métricas e avatar de perfil)

Com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_KEY`), o backend usa o Supabase para:

- métricas de `/api/chat` (tabela `api_request_metrics`);
- foto de perfil do usuário (Storage + tabela `user_avatars`).

### Avatar de perfil

Execute o script `supabase/avatars_setup.sql` no SQL Editor do Supabase (cria tabela, bucket `avatars` e políticas).

Endpoints:

- `GET /api/avatar?client_id=...` — URL pública da foto
- `POST /api/avatar` — envia `multipart/form-data` com `client_id` e `avatar` (remove a imagem anterior automaticamente)
- `DELETE /api/avatar?client_id=...` — remove foto e registro

O navegador guarda apenas um `client_id` em `localStorage`; a imagem fica no Supabase.

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

CMD:

```cmd
cd /d C:\caminho\para\Eratochat
.venv\Scripts\activate.bat
pip install pytest
pytest teste\teste_api_backend.py
python teste\verificar_insert_supabase.py
python teste\disparar_requisicoes_e_verificar_supabase.py
python teste\teste_modelos.py
```

PowerShell:

```powershell
Set-Location C:\caminho\para\Eratochat
.\.venv\Scripts\Activate.ps1
pip install pytest
pytest teste\teste_api_backend.py
python teste\verificar_insert_supabase.py
python teste\disparar_requisicoes_e_verificar_supabase.py
python teste\teste_modelos.py
```

Se `python` nao for reconhecido no **PowerShell**:

```powershell
Set-Location C:\caminho\para\Eratochat
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -m pip install pytest
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -m pytest teste\teste_api_backend.py
```

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

