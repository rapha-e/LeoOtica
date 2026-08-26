# Relatório Geral de Funcionalidades do Sistema LeoÓticas

**Versão do Sistema:** 2.0 Enterprise  
**Arquitetura:** Python FastAPI (Backend Async) + React JS Vite (Frontend UI) + SQLAlchemy Async + SQLite/PostgreSQL  
**Data do Relatório:** 24/08/2026  

---

## 1. Visão Geral da Plataforma

O **LeoÓticas** é um sistema completo e integrado de **ERP, WMS (Warehouse Management System), MES (Manufacturing Execution System) e Gestão Financeira Corporativa** especializado para **laboratórios óticos e fábricas de lentes de óculos**.

A plataforma automatiza todo o ciclo produtivo e comercial: desde o recebimento de receitas óticas (via IA/OCR ou Bipador USB), passando pela alocação atômica de insumos, direcionamento automático de esteira (Expressa vs CNC Surfaçagem), gestão de insumos via **Custo Médio Ponderado (CMP)**, até a baixa comercial, faturamento e **DRE Consolidado em tempo real**.

---

## 2. Módulo de Estoque e Insumos (WMS & CMP)

### 2.1. Matrizes de Estoque e Dioptrias
- **Matrizes Suportadas:**
  - `LP_GRADE`: Visão Simples Pronta Entrega.
  - `GRADE_167`: Visão Simples Alto Índice 1.67.
  - `MF_ACB`: Multifocal Acabado.
  - `MF_BLOCO`: Multifocal Bloco (Semi-Acabado com Adição).
  - `BLOCO_VS`: Bloco Visão Simples (Surfaçagem CNC).
- **Controle por Olho:** Separação de dioptrias por Olho Direito (OD), Olho Esquerdo (OE) ou Ambos (OU).
- **Localização Física:** Mapeamento de etiquetas de gaveta/prateleira (`location_tag`).

### 2.2. Valorização por Custo Médio Ponderado (CMP)
- **Custo Médio Ponderado (`average_cost_price`):** Recalculado automaticamente a cada entrada de estoque (`IN`, `AUDIT`) pela fórmula:
  $$\text{CMP}_{\text{novo}} = \frac{(\text{Estoque}_{\text{atual}} \times \text{CMP}_{\text{atual}}) + (\text{Qtd}_{\text{entrada}} \times \text{Preço}_{\text{entrada}})}{\text{Estoque}_{\text{atual}} + \text{Qtd}_{\text{entrada}}}$$
- **Último Custo de Compra (`last_purchase_price`):** Registro do preço unitário pago na última nota fiscal de compra.
- **Entrada Manual e Fallback:** Modal de cadastro fallback com suporte a definição manual de preços de custo, venda e código de barras.

### 2.3. Leitura e Bipador USB
- **Busca por Código de Barras (`/inventory/by-barcode/{barcode}`):** Consulta instantânea de modelo, dioptria, localização e saldos sem alteração física.
- **Reserva Atômica (`quantity_reserved` / `reserved_quantity`):** Reserva atômica no momento da alocação de OS para saldo disponível (`saldo_livre = disponivel - reservado > 0`).

---

## 3. Módulo de Produção e Chão de Fábrica (MES)

### 3.1. Registro e Recepção de OS
- **Tipos de OS:**
  - `PADRAO`: Produção de óculos completo (Lente + Armação + Tratamentos).
  - `REPARO_SERVICO`: Serviços técnicos e reparos (Coloração, Montagem, Ajuste).
- **Leitura Inteligente de Receitas (IA OCR):** Processamento automático de fotos/PDFs de receitas médicas para extração de Esférico, Cilíndrico, Eixo, Adição, DNP e Altura.
- **Transposição Automática:** Conversão clínica de cilíndrico positivo (`+`) para cilindro negativo (`-`).

### 3.2. Roteamento Inteligente e Esteira Produtiva
- **Roteamento Automático:**
  - `EXPRESSA_FACETAMENTO`: Lentes de estoque prontas baixadas diretamente para montagem/corte.
  - `SURFACAGEM_CNC`: Blocos semi-acabados encaminhados para surfaçagem digital CNC.
- **Fases da Esteira:** `RECEBIDA` ➔ `SEPARACAO` ➔ `SURFACAGEM` ➔ `TRATAMENTO` ➔ `FACETAMENTO` ➔ `CONTROLE_QUALIDADE` ➔ `EXPEDICAO`.
- **Painéis de TV (Digital Signage):** Interfaces públicas para monitores no chão de fábrica acompanhando a fila de produção e tempos de ciclo em tempo real.

---

## 4. Módulo Comercial e Precificação

### 4.1. Cadastro de Óticas e Análise de Crédito
- Cadastro completo de Óticas Parceiras com CNPJ, limite de crédito e dados de contato.
- **Bloqueio Preditivo por Inadimplência:** Bloqueio automático de abertura de OS para óticas com faturas vencidas ou limite estourado.

### 4.2. Tabelas de Preços e Precificação por Grau
- **Política Global por Grau (`degree_policy`):** Definição de limites de grau (ex: até $\pm 2.00$ vs acima de $\pm 2.00$) com tabela diferenciada.
- **Tabelas de Preço Customizadas:** Definição de preços diferenciados por ótica ou grupo comercial.

---

## 5. Módulo Financeiro Corporativo e DRE

### 5.1. Ciclos de Fechamento e Contas a Receber
- Agrupamento de Ordens de Serviço por período e emissão automática de **Faturas de Fechamento**.
- Gestão de **Contas a Receber (`AccountsReceivable`)** com baixas parciais/totais e controle de mora/inadimplência.

### 5.2. Contas a Pagar e Importação XML
- Cadastramento de **Contas a Pagar (`AccountsPayable`)** categorizadas (Fornecedores, Insumos, Utilidades).
- **Gestão de Folha de Pagamento (`FOLHA`):** Controle de desembolsos trabalhistas e salários.
- **Importação de NF-e (XML):** Ingestão automática de notas fiscais de compra para atualização de estoque e contas a pagar.

### 5.3. Livro Caixa e Transações Financeiras
- Registro em tabela dedicada **`financial_transactions`** com log imutável de todas as baixas de receita e despesa.

### 5.4. Dashboard DRE Consolidado (Demonstração do Resultado do Exercício)
- Visualização executiva em tempo real com o cálculo:
  $$\text{Faturamento Bruto} - \text{CMV Real (CMP)} = \text{Margem Bruta}$$
  $$\text{Margem Bruta} - \text{Folha de Pagamento} - \text{Outras Despesas} = \text{Lucro Líquido Real}$$
- Métricas em percentual de **Margem Líquida (%)** e **Margem Bruta (%)**.

---

## 6. Inteligência Artificial e Ferramentas Globais

- **Assistente IA / Copilot (`AssistenteIA.jsx`):** Chat integrado para dúvidas operacionais, consultas de dioptrias e estatísticas de vendas.
- **Busca Global Instantânea (`GlobalSearch.jsx`):** Localizador unificado que busca simultaneamente OSs, Lentes, Blocos, Óticas e Faturas.
- **Alertas Preditivos:** Notificação visual pós-login de títulos vencidos, inadimplência e rupturas de estoque.

---

## 7. Segurança e Controle de Acesso (RBAC)

- Autenticação via **JWT (JSON Web Tokens)** com renovação segura.
- Controle granular de acessos por Perfil:
  - **Administrador:** Acesso total a parâmetros do sistema, backups, exclusões, DRE e dashboards executivos.
  - **Operador:** Acesso operacional a lançamento de OS, consulta de estoque e esteira fabril.
- **Parâmetros do Sistema (`ParametrosSistema.jsx`):** Configuração de chaves de API, prazos padrão e políticas operacionais.

---

## 8. Cobertura de Testes Automatizados

O sistema conta com uma suíte de testes de integração e ponta a ponta automatizada em **Pytest** com **100% de aprovação (5/5 testes passados)**:

1. `test_sprint_1_and_2_cmp_calculation`: Validação de modelos, tabelas financeiras e cálculo do CMP.
2. `test_sprint_3_bipador_search_and_atomic_reservation`: Validação de bipador e reserva atômica.
3. `test_sprint_4_contas_a_pagar_receber_and_dre`: Validação de liquidações financeiras e apuração do DRE.
4. `test_complete_e2e_laboratory_lifecycle`: Teste ponta a ponta do ciclo completo do laboratório (Entrada ➔ Bipador ➔ Reserva ➔ Baixa ➔ Faturamento ➔ Contas a Pagar ➔ DRE).
5. `test_complete_enterprise_lifecycle`: Teste E2E da versão 2.0 Enterprise com transposição clínica de cilindro (+ para -), roteamento de esteira expressa e conciliação no Livro Caixa.
