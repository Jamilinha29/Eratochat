# EratoChat

Assistente de conversação focado em **recomendações de filmes, séries e livros**, usando a API do Google Gemini. O nome **EratoChat** identifica o produto; o nome do agente de IA é configurável nas opções da interface.

## Objetivo

O EratoChat permite que o usuário descreva o que gosta de assistir ou ler e receba sugestões organizadas em Markdown (categorias, sinopses curtas e “por que você vai gostar”). O backend aplica um *system prompt* fixo para manter o foco em entretenimento e o frontend oferece temas, histórico de conversas no navegador e interface em React.

## Stack principal

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Vite 5, `marked` + DOMPurify (Markdown seguro) |
| Backend | Python 3, Flask, Flask-CORS, `google-generativeai`, `python-dotenv` |
| IA | Google Gemini 1.5 Flash |
| Testes | pytest (API), script opcional k6 (carga) |
| Deploy | Vercel (`vercel.json` + build estático do frontend) |

## Pré-requisitos

- **Python** 3.9 ou superior (recomendado 3.10+)
- **Node.js** 18+ (para instalar dependências e build do frontend)
- Conta Google com **chave de API** do [Google AI Studio](https://aistudio.google.com/) (Gemini)

## Estrutura do repositório

```
.
├── backend/           # Flask – API /chat e servir dist em desenvolvimento
├── frontend/          # React (Vite) – código-fonte e pasta dist após build
├── teste/             # teste_modelos.py, teste_api_backend.py, load_test.js (k6)
├── requirements.txt   # Dependências Python (raiz – CI e instalação)
├── vercel.json        # Configuração de deploy
├── .env.example       # Modelo de variáveis (sem segredos) — copie para `.env`
├── .env               # Criar localmente (não versionar) – ver abaixo
└── README.md
```

## Configuração da chave (`.env`)

Copie o modelo e preencha a chave (nunca commite o `.env`):

```bash
cp .env.example .env
```

Edite `.env` na raiz:

```env
GEMINI_API_KEY=sua_chave_aqui
```

O `.gitignore` ignora `.env`, arquivos `.env.*` (exceto `.env.example`), chaves `.pem`, caches e `frontend/dist/`.

## Segurança

- **Chave Gemini**: só no servidor / variáveis de ambiente (Vercel: *Settings → Environment Variables*). O frontend **não** embute chaves; só chama a sua API.
- **CORS**: por padrão aceita `localhost` / `127.0.0.1` nas portas do app e do Vite. Em produção, defina `CORS_ORIGINS` no `.env` com a URL do seu site (várias URLs separadas por vírgula).
- **Erros**: em produção o backend não expõe detalhes internos da exceção; com `FLASK_DEBUG=1` os detalhes aparecem para depuração local.
- **Cabeçalhos HTTP**: `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy` são aplicados nas respostas.
- **Markdown**: o React sanitiza o HTML com DOMPurify antes de exibir respostas da IA.

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/Emilio467/CineChat.git
cd CineChat
```

### 2. Ambiente Python (recomendado: venv)

**Windows (PowerShell):**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Linux / macOS:**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend – dependências e build

O Flask serve os arquivos estáticos a partir de `frontend/dist`. É necessário gerar o build antes de rodar o servidor único (backend + SPA):

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Testes automatizados (opcional)

Com o venv ativo e na raiz do projeto:

```bash
pip install pytest
pytest teste/teste_api_backend.py
```

Para testar listagem de modelos / conexão com a API (requer `GEMINI_API_KEY`):

```bash
python teste/teste_modelos.py
```

Carga com **k6** (com o backend em `http://127.0.0.1:5001`):

```bash
k6 run teste/load_test.js
```

## Executar localmente

Na raiz do projeto, com o build do frontend já feito e o `.env` configurado:

```bash
python backend/app.py
```

- API: `POST http://127.0.0.1:5001/api/chat` (JSON: `message`, `session_id`)
- Interface: abra no navegador `http://127.0.0.1:5001/`

**Desenvolvimento só do frontend** (hot reload; a API continua no Flask na porta 5001):

```bash
cd frontend
npm run dev
```

O app detecta `localhost` e envia requisições para `http://127.0.0.1:5001/api/chat`.

## Variáveis e portas

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | Sim | Chave da API Gemini |

| Serviço | Porta padrão |
|---------|----------------|
| Flask (`backend/app.py`) | `5001` |

## CI/CD

O workflow em `.github/workflows/main.yml` instala dependências com `requirements.txt`, valida sintaxe de arquivos Python e executa `pytest` em `teste/teste_api_backend.py` em pushes e pull requests para `main` / `master`.

## Deploy (Vercel)

O projeto inclui `vercel.json` para build do frontend e função Python. Configure o segredo **`GEMINI_API_KEY`** nas variáveis de ambiente do projeto na Vercel após conectar o repositório.


