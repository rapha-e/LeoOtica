# LeoÓticas - Módulo de Estoque e Grade de Lentes (MVP)

Este é o MVP (Mínimo Produto Viável) do sistema de controle de inventário tridimensional (Grade Óptica) para a fábrica LeoÓticas. O sistema é composto por uma API FastAPI assíncrona conectada a um banco de dados PostgreSQL e um frontend PWA responsivo em React projetado para operação em smartphones através da rede Wi-Fi local.

---

## 🛠️ Arquitetura do Projeto

- **Back-end:** Python 3.11+ utilizando FastAPI e SQLAlchemy (Async).
- **Banco de Dados:** PostgreSQL 15 rodando via Docker.
- **Front-end:** React + Vite + Vanilla CSS (estilo escuro moderno, glassmorphism e responsividade móvel).
- **Integração de Câmera:** Leitor de código de barras em HTML5 (`html5-qrcode`) direto no navegador móvel.

---

## 🚀 Como Iniciar o Projeto Localmente

### Passo 1: Iniciar o Banco de Dados (Docker)
Certifique-se de que o Docker e o Docker Compose estão instalados e rodando na sua máquina. Na raiz do projeto, execute:
```bash
docker-compose up -d
```
Isso iniciará um container PostgreSQL 15 com suporte à extensão pgvector exposto na porta padrão `5432`.

### Passo 2: Configurar e Rodar o Backend (API)
1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Crie e ative um ambiente virtual Python:
   ```bash
   python -m venv venv
   # No Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # No Windows (CMD):
   .\venv\Scripts\activate.bat
   ```
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Execute o script de semeadura (Seeding) para criar as tabelas e popular o banco com dados de teste de lentes, dioptrias e histórico de movimentações fictício:
   ```bash
   # Certifique-se de executar de dentro da pasta backend/
   python seed.py
   ```
5. Inicie o servidor FastAPI:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *Nota: O `--host 0.0.0.0` é crucial para que outros dispositivos na rede Wi-Fi local consigam acessar a API.*

Você pode acessar a documentação interativa da API (Swagger) em seu navegador no link: [http://localhost:8000/docs](http://localhost:8000/docs).

### Passo 3: Configurar e Rodar o Frontend (React/Vite)
1. Abra um novo terminal e navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências JavaScript:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev -- --host
   ```
   *Nota: A flag `--host` permite que o Vite exponha a aplicação na sua rede local.*

O terminal do Vite exibirá os endereços de acesso, por exemplo:
- **Local:** `http://localhost:5173/`
- **Network (Rede Local):** `http://192.168.1.50:5173/`

---

## 📱 Acesso via Celular (Rede Wi-Fi Local)

Para utilizar o leitor de código de barras usando a câmera do smartphone:
1. Conecte o computador servidor e o smartphone na **mesma rede Wi-Fi**.
2. No celular, abra o navegador e digite o endereço de **Network** indicado pelo terminal do Vite (ex: `http://192.168.1.50:5173`).
3. O aplicativo identificará dinamicamente o IP do servidor e fará as chamadas da API sem nenhuma configuração manual.
4. **Importante:** Navegadores exigem conexão segura (HTTPS) para habilitar a câmera. Para testar localmente em HTTP no celular:
   - No Chrome (Android): Acesse `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
   - Adicione o endereço do servidor (ex: `http://192.168.1.50:5173` e `http://192.168.1.50:8000`) na lista, marque como *Enabled* e reinicie o Chrome do celular.

---

## 💡 Fluxos Principais no Aplicativo

1. **Scanner Mobile (Bipagem):**
   - Bipe um código de barras de caixa de lentes. Se o código constar no estoque, ele soma (+1) à quantidade física de forma atômica e registra o evento `AUDIT` no histórico de auditoria.
   - Se for inédito, ele abre um **Modal de Fallback**, permitindo que o operador cadastre o grau esférico, cilíndrico, localização física (gaveta) e selecione ou crie um modelo de lente correspondente.
2. **Grade Óptica:**
   - Visualização tridimensional dinâmica das quantidades e gavetas físicas (Eixo Y: Grau Esférico, Eixo X: Grau Cilíndrico).
   - Destaque em cores: Vermelho (Ruptura/Zerado), Amarelo (Estoque Crítico <= 2), Verde (Estoque Seguro).
   - Clique em qualquer célula para exibir detalhes como a gaveta exata, código de barras e marca.
3. **Importar NF-e (XML):**
   - Faça o upload do arquivo XML da NF-e fornecida pelo fabricante.
   - O sistema lê o código de barras comercial (`<cEAN>`) de cada lente e atualiza a quantidade em lote de forma automática.
   - Caso existam produtos na nota fiscal cujos códigos de barras sejam inéditos no banco de dados, o sistema lista os itens pendentes e oferece um botão **Cadastrar** rápido que pré-preenche o código e a quantidade para reconciliação assistida.
4. **Motor Preditivo:**
   - Calcula a taxa de consumo diário das lentes com base nas saídas dos últimos 30 dias.
   - Utiliza as variáveis de Lead Time do Fornecedor e Estoque de Segurança para prever rupturas.
   - Gera e exporta uma planilha formatada em Excel com sugestões semanais exatas de compra para reposição.
