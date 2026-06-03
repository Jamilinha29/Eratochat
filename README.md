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
| Deploy | Vercel (`vercel.json`) e Render |

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

- Python 3.10+
- Node.js 18+
- Chave do Gemini (Google AI Studio)

---

### 2) Instalação Única (Funciona em CMD, PowerShell e Bash)

Abra um terminal na pasta raiz do projeto e execute a sequência abaixo passo a passo. Os comandos foram unificados para serem compatíveis com qualquer sistema operacional e terminal sem necessidade de ajustes:

```bash
# 1. Criar o ambiente virtual Python
python -m venv .venv

# 2. Ativar o ambiente virtual e instalar dependências
# (Execute a linha que corresponde ao seu terminal)
# No Windows PowerShell:      .\.venv\Scripts\Activate.ps1
# No Windows CMD:             .venv\Scripts\activate.bat
# No Linux / macOS Bash:      source .venv/bin/activate

# 3. Instalar pacotes do Python
pip install -r requirements.txt

# 4. Instalar pacotes do Frontend e gerar build inicial
cd frontend
npm install
npm run build
cd ..

# 5. Criar o arquivo de configuração de chaves
cp .env.example .env
```
*(Se você estiver no Windows CMD, pode usar `copy` em vez de `cp` no passo 5, embora ambos os sistemas aceitem a maioria dos comandos hoje).*

---

### 3) Configuração (`.env`)

Insira sua chave do Gemini e as chaves do Supabase (se for utilizar) no arquivo `.env` gerado na raiz:

```env
GEMINI_API_KEY=SUA_CHAVE_REAL_AQUI
GEMINI_MODEL=gemini-3-flash-preview
MAX_MESSAGE_CHARS=1200
RATE_LIMIT_MAX_REQUESTS=25
RATE_LIMIT_WINDOW_SECONDS=60
APP_AUTH_TOKEN=EratoChat@2026
CORS_ORIGINS=http://127.0.0.1:5001,http://localhost:5001,http://127.0.0.1:5173,http://localhost:5173
SUPABASE_URL=SUA_URL_SUPABASE_AQUI
SUPABASE_KEY=SUA_CHAVE_ANON_SUPABASE_AQUI
SUPABASE_METRICS_TABLE=api_request_metrics
FLASK_DEBUG=1
```

---

### 4) Como Executar o Projeto no Dia a Dia

Sempre que abrir o projeto para rodá-lo localmente, execute estes comandos nos seus terminais:

#### Terminal 1 — Backend (Flask API)
```bash
# Se o .venv não estiver ativo, ative-o antes de iniciar:
# PowerShell: .\.venv\Scripts\Activate.ps1   |   CMD: .venv\Scripts\activate.bat
python backend/app.py
```
*O servidor iniciará no endereço público `http://localhost:5001` ou `http://127.0.0.1:5001`.*

#### Terminal 2 — Frontend (React Interface)
```bash
cd frontend
npm run dev
```
*Acesse a interface no link gerado pelo Vite (geralmente `http://localhost:5173`).*

---

### 5) Módulo de Classificação de ML (Treino e Relatórios)

Para treinar os classificadores de Machine Learning e gerar o relatório acadêmico automático em formato `.docx`, ative o `.venv` e execute:

```bash
python ml/treino_classificadores.py
```

Os arquivos de performance do modelo e o relatório em Word serão gerados e atualizados nas pastas `ml/artefatos/` e copiados diretamente para a sua pasta de `Downloads`.

---

### 6) Executando Testes Unitários

Para garantir a qualidade e saúde da API do Eratochat, execute as ferramentas de teste integradas:

```bash
# Instalar a suite de teste
pip install pytest

# Rodar os testes automatizados
pytest teste/teste_api_backend.py
```

---

## Supabase (Métricas e avatar de perfil)

Com `SUPABASE_URL` e `SUPABASE_KEY`, o backend usa o Supabase para:
- Métricas de uso da IA (tabela `api_request_metrics`);
- Foto de perfil do usuário (Storage + tabela `user_avatars`).

### Configuração Inicial
Execute o script `supabase/avatars_setup.sql` no SQL Editor do Supabase para criar as tabelas, bucket de fotos de perfil e as políticas de segurança Row Level Security (RLS).

---

## Informações de Contato

### Autores

- Emílio Gaspar — Desenvolvimento Backend
- Jamili Gabriela — QA e Desenvolvimento
- Dante Tucker — Análise de Dados
- Wesley Albuquerque — Desenvolvimento Frontend
- João Lira Baracho — Análise de Dados

### Canais de ajuda

- Abra uma issue no repositório para bugs e dúvidas técnicas.
- Para suporte de execução local, inclua o erro exibido no terminal e o sistema operacional usado.
