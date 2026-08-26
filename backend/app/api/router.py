from fastapi import APIRouter, Depends
from backend.app.api.endpoints import (
    lens_models, inventory, movements, nfe, alerts, os as endpoints_os, analytics as endpoints_analytics,
    partner, factory, auth, optical_stores, financial_catalog, customer_price, billing, users, laboratory,
    search as endpoints_search, tv as endpoints_tv, backup, financial_corp, system_parameters, supplier_order, blocks, orders,
    degree_policy
)


from backend.app.api.deps import get_current_active_operator, get_current_active_admin

api_router = APIRouter()

# Política Global de Precificação por Grau
api_router.include_router(degree_policy.router, prefix="/degree-policy", tags=["Política Global de Precificação por Grau"])

# Rotas públicas ou com autenticação específica por chaves
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(partner.router, prefix="/partner", tags=["Portal do Lojista"]) # Autenticado via X-API-Key

# Rotas que possuem controle granular interno
api_router.include_router(lens_models.router, prefix="/lens-models", tags=["Modelos de Lentes"])
api_router.include_router(blocks.router, prefix="/blocks", tags=["Grade de Blocos"], dependencies=[Depends(get_current_active_operator)])

# Rotas restritas para Operadores de fábrica
api_router.include_router(orders.router, prefix="/orders", tags=["Pedidos Comerciais de Venda"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(optical_stores.router, prefix="/optical-stores", tags=["Cadastro de Óticas"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Estoque e Grade"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(movements.router, prefix="/movements", tags=["Movimentações e Auditoria"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(nfe.router, prefix="/nfe", tags=["Importação de Notas"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alertas Preditivos"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(endpoints_os.router, prefix="/os", tags=["Ordens de Serviço (OS)"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(endpoints_analytics.router, prefix="/analytics", tags=["Inteligência de Dados e Gráficos"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(factory.router, prefix="/factory", tags=["Chão de Fábrica (Automático)"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(financial_catalog.router, prefix="/catalog", tags=["Catálogo Financeiro"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(customer_price.router, prefix="/price-tables", tags=["Tabelas de Preços por Ótica"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(billing.router, prefix="/billing", tags=["Fechamento Financeiro"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(laboratory.router, prefix="/laboratory", tags=["Perfil do Laboratório"], dependencies=[Depends(get_current_active_operator)])

# Rotas administrativas restritas a Administradores de fábrica
api_router.include_router(partner.admin_router, prefix="/admin/partners", tags=["Administração de Parceiros"], dependencies=[Depends(get_current_active_admin)])
api_router.include_router(users.router, prefix="/admin/users", tags=["Gerenciamento de Usuários"], dependencies=[Depends(get_current_active_admin)])
api_router.include_router(backup.router, prefix="/admin/backups", tags=["Backup e Restauração"], dependencies=[Depends(get_current_active_admin)])
api_router.include_router(financial_corp.router, prefix="/finance-corp", tags=["Financeiro Corporativo"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(system_parameters.router, prefix="/system-parameters", tags=["Parâmetros do Sistema"], dependencies=[Depends(get_current_active_operator)])
api_router.include_router(supplier_order.router, prefix="/supplier-orders", tags=["Pedidos no Fornecedor"], dependencies=[Depends(get_current_active_operator)])



# Pesquisa global (requer autenticacao de operador)
api_router.include_router(endpoints_search.router, prefix="/search", tags=["Pesquisa Global"])

# Paineis de TV (publicos — sem autenticacao, para exibicao em televisoes da fabrica)
api_router.include_router(endpoints_tv.router, prefix="/tv", tags=["Paineis de TV"])








