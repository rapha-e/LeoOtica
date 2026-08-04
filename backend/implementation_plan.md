# Plano de Implementação - Unificação de Lentes, Dados do Laboratório Dinâmicos e Correção do Fechamento

Este plano detalha a unificação do cadastro de lentes físicas e catálogo comercial, a persistência e edição dinâmica dos dados cadastrais do laboratório e a reinicialização e correção definitiva do faturamento de Ordens de Serviço (OS).

---

## Propostas de Mudanças

### 1. Unificação de Cadastro de Lentes (Grade de Estoque + Catálogo Financeiro)

#### [NEW] [laboratory.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/models/laboratory.py)
Criar o modelo SQLAlchemy `Laboratory` para persistir os dados cadastrais do laboratório.
- Atributos: `id`, `name`, `cnpj`, `telephone`, `cep`, `address`.

#### [MODIFY] [lens.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/models/lens.py)
- Adicionar o campo `sale_price` (Numeric(10, 2)) no modelo `LensModel`.

#### [MODIFY] [lens.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/schemas/lens.py)
- Adicionar `sale_price` (Decimal) nos schemas `LensModelBase` e `LensModelUpdate`.

#### [MODIFY] [lens.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/crud/lens.py)
- Atualizar a criação de `LensModel` (`create_lens_model`) para salvar `sale_price` e automaticamente criar o correspondente faturável `Product` no catálogo financeiro, mantendo-os vinculados pelo campo `lens_model_id`.
- Atualizar `update_lens_model` para sincronizar as edições de preço de custo e venda no `Product` correspondente.
- Atualizar `delete_lens_model` para remover o `Product` do catálogo.

#### [MODIFY] [os.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/crud/os.py)
- Atualizar `find_matching_product` na alocação de lentes para buscar o produto faturável no catálogo financeiro de forma direta usando `Product.lens_model_id == lens_model.id` antes de recorrer a buscas por aproximação de nome.

#### [MODIFY] [AdminLentes.jsx](file:///c:/Users/rapha/Documents/LeoOtica/frontend/src/components/AdminLentes.jsx)
- Adicionar o campo **Preço de Venda** ao formulário de criação/edição de lentes.
- Exibir a coluna **Preço de Venda** na listagem do painel.

#### [MODIFY] [App.jsx](file:///c:/Users/rapha/Documents/LeoOtica/frontend/src/App.jsx)
- Adicionar o item de menu **Modelos de Lentes** no dropdown **Estoque & Grade** para dar acesso à tela `AdminLentes.jsx`.
- Configurar o roteamento de abas para que `activeTab === 'admin-lentes'` renderize o componente `<AdminLentes />`.

---

### 2. Cadastro Dinâmico do Laboratório (Nova Lab)

#### [NEW] [laboratory.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/schemas/laboratory.py)
Schemas Pydantic para ler e atualizar as informações do laboratório (`LaboratoryRead`, `LaboratoryUpdate`).

#### [NEW] [laboratory.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/crud/laboratory.py)
CRUD com funções `get_laboratory` e `update_laboratory`.

#### [NEW] [laboratory.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/api/endpoints/laboratory.py)
Rotas `GET /api/v1/laboratory` e `PUT /api/v1/laboratory` para manipulação dos dados pelo frontend.

#### [MODIFY] [router.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/api/router.py)
- Registrar o roteador de laboratório no `api_router`.

#### [MODIFY] [main.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/main.py)
- Adicionar colunas `sale_price` em `lens_models` e criar a tabela `laboratory_profile` caso não existam.
- Semear o laboratório padrão no startup:
  - **Nome**: Nova Lab
  - **CEP**: 71572-302
  - **Telefone**: 61 99266-7281
  - **CNPJ**: 58.032.958/0001-44
  - **Endereço**: Área Especial, Lote 1, Brasília - DF

#### [MODIFY] [nfe_emitter.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/services/nfe_emitter.py)
- Alterar as funções `generate_nfe_xml` e `generate_danfe_pdf` para ler os dados do emissor dinamicamente a partir de um objeto `laboratory`.

#### [MODIFY] [pdf_generator.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/services/pdf_generator.py)
- Alterar `generate_billing_pdf` para aceitar um objeto `laboratory` e exibir as informações do cabeçalho/depósito dinamicamente no PDF A4 de fechamento.

#### [MODIFY] [billing.py](file:///c:/Users/rapha/Documents/LeoOtica/backend/app/api/endpoints/billing.py)
- Obter os dados do laboratório do banco nos endpoints de PDF, XML e DANFE e repassá-los para os geradores de relatório correspondentes.

#### [MODIFY] [App.jsx](file:///c:/Users/rapha/Documents/LeoOtica/frontend/src/App.jsx)
- Carregar os dados do laboratório do backend via API.
- Alterar a marca no cabeçalho ("OptiMind") e rodapé para serem dinâmicos de acordo com o nome cadastrado (ex: "Nova Lan").
- Tornar o logo-container do cabeçalho clicável para abrir um modal premium que permite editar todos os dados do laboratório (Nome, CNPJ, Telefone, CEP e Endereço).

---

### 3. Resolução definitiva do erro de Fechamento Financeiro
- Reiniciar o servidor Uvicorn após a aplicação de todas as correções para recarregar os arquivos Python na memória, aplicando definitivamente os tratamentos de fuso horário.

---

## Plano de Verificação

### Testes Automatizados
- Executar o pytest na suíte de testes de faturamento e lentes para confirmar que a inclusão de `sale_price` e do laboratório não quebra o sistema:
  `pytest test_os_billing.py test_billing_workflow.py`

### Verificação Manual
1. Abrir a aplicação e verificar se o cabeçalho agora exibe **Nova Lan**.
2. Clicar em "Nova Lan" no cabeçalho, editar os dados cadastrais (Nome, CEP, Telefone, CNPJ e Endereço) e confirmar se eles persistem.
3. Cadastrar uma nova lente na aba **Estoque & Grade**, inserindo valores de custo e venda. Verificar se ela aparece na grade e se é criada automaticamente no **Catálogo Financeiro**.
4. Ir para **Comercial & Finanças** -> **Financeiro (Fechamento)**, selecionar a ótica pendente e clicar em **Gerar Fechamento**. Confirmar que o fechamento é concluído sem erros.
