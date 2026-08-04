import os
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai

from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle
from backend.app.models.movement import StockMovement
from backend.app.models.lens import LensModel, LensInventoryGrade


# 1. FUNÇÕES ANALÍTICAS DE BANCO DE DADOS (SEGURAS E ASSÍNCRONAS)

async def get_top_billing_stores(db: AsyncSession, limit: int = 5) -> List[Dict[str, Any]]:
    """Consulta no banco quais óticas mais faturaram (ciclos fechados nos últimos 30 dias)."""
    limite_30_dias = datetime.utcnow() - timedelta(days=30)
    query = (
        select(
            OpticalStore.corporate_name.label("store_name"),
            func.sum(BillingCycle.total_amount).label("total_billed")
        )
        .join(BillingCycle, BillingCycle.optical_store_id == OpticalStore.id)
        .where(BillingCycle.start_date >= limite_30_dias)
        .group_by(OpticalStore.corporate_name)
        .order_by(func.sum(BillingCycle.total_amount).desc())
        .limit(limit)
    )
    res = await db.execute(query)
    rows = res.all()
    return [{"store_name": r.store_name, "total_billed": float(r.total_billed)} for r in rows]


async def get_top_consumed_lenses(db: AsyncSession, limit: int = 5) -> List[Dict[str, Any]]:
    """Consulta os modelos de lentes mais consumidos (saídas físicas nos últimos 30 dias)."""
    limite_30_dias = datetime.utcnow() - timedelta(days=30)
    query = (
        select(
            LensModel.brand.label("brand"),
            LensModel.material.label("material"),
            LensModel.refractive_index.label("refractive_index"),
            LensModel.treatment.label("treatment"),
            LensInventoryGrade.spherical.label("spherical"),
            LensInventoryGrade.cylindrical.label("cylindrical"),
            func.sum(StockMovement.quantity).label("total_quantity")
        )
        .join(LensInventoryGrade, StockMovement.lens_inventory_id == LensInventoryGrade.id)
        .join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id)
        .where(StockMovement.movement_type == "OUT")
        .where(StockMovement.movement_date >= limite_30_dias)
        .group_by(
            LensModel.brand,
            LensModel.material,
            LensModel.refractive_index,
            LensModel.treatment,
            LensInventoryGrade.spherical,
            LensInventoryGrade.cylindrical
        )
        .order_by(func.sum(StockMovement.quantity).desc())
        .limit(limit)
    )
    res = await db.execute(query)
    rows = res.all()
    return [
        {
            "brand": r.brand,
            "material": r.material,
            "refractive_index": float(r.refractive_index),
            "treatment": r.treatment,
            "spherical": float(r.spherical),
            "cylindrical": float(r.cylindrical),
            "total_quantity": int(r.total_quantity)
        }
        for r in rows
    ]


async def get_overdue_service_orders(db: AsyncSession, limit: int = 20) -> List[Dict[str, Any]]:
    """Consulta OSs ativas que estão na esteira há mais de 3 dias."""
    limite_atraso = datetime.utcnow() - timedelta(days=3)
    query = (
        select(
            ServiceOrder.os_number.label("os_number"),
            ServiceOrder.client_name.label("client_name"),
            ServiceOrder.status.label("status"),
            ServiceOrder.created_at.label("created_at"),
            OpticalStore.trade_name.label("store_name")
        )
        .join(OpticalStore, ServiceOrder.optical_store_id == OpticalStore.id)
        .where(ServiceOrder.status != OSStatus.EXPEDICAO)
        .where(ServiceOrder.status != OSStatus.CANCELADA)
        .where(ServiceOrder.created_at < limite_atraso)
        .order_by(ServiceOrder.created_at.asc())
        .limit(limit)
    )
    res = await db.execute(query)
    rows = res.all()
    return [
        {
            "os_number": r.os_number,
            "client_name": r.client_name,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "created_at": r.created_at.isoformat(),
            "store_name": r.store_name
        }
        for r in rows
    ]


async def get_rework_losses(db: AsyncSession) -> Dict[str, Any]:
    """Calcula o prejuízo financeiro acumulado por OSs com retrabalho."""
    res = await db.execute(
        select(
            func.count(ServiceOrder.id).label("count"),
            func.coalesce(func.sum(ServiceOrder.total_amount), 0).label("loss")
        )
        .where(ServiceOrder.is_rework == True, ServiceOrder.is_deleted == False)
    )
    row = res.one()
    return {"count": int(row.count), "loss_brl": float(row.loss)}


async def get_unbilled_service_orders(db: AsyncSession) -> List[Dict[str, Any]]:
    """Retorna a listagem de OSs prontas que ainda não foram faturadas."""
    from backend.app.crud.billing import get_pending_billing_groups
    groups = await get_pending_billing_groups(db)
    return [{"store_name": g["optical_store_name"], "pending_count": g["pending_os_count"], "total_amount": float(g.get("estimated_total_amount", 0.0))} for g in groups]


async def get_morning_briefing(db: AsyncSession) -> Dict[str, Any]:
    """Gera o resumo situacional pró-ativo 'Bom Dia Executivo' para início de expediente."""
    now = datetime.utcnow()
    start_today = datetime(now.year, now.month, now.day)
    three_days_ago = now - timedelta(days=3)

    # 1. OSs Atrasadas
    overdue_res = await db.execute(
        select(func.count(ServiceOrder.id))
        .where(ServiceOrder.status != OSStatus.EXPEDICAO, ServiceOrder.status != OSStatus.CANCELADA, ServiceOrder.created_at < three_days_ago)
    )
    overdue_count = overdue_res.scalar() or 0

    # 2. Lentes em Ruptura (saldo zero ou <=2)
    rupture_res = await db.execute(select(func.count(LensInventoryGrade.id)).where(LensInventoryGrade.quantity_available <= 2))
    rupture_count = rupture_res.scalar() or 0

    # 3. Clientes Inadimplentes (Ciclos fechados vencidos)
    overdue_clients_res = await db.execute(
        select(func.count(func.distinct(BillingCycle.optical_store_id)))
        .where(BillingCycle.status == "FECHADO", BillingCycle.due_date < now)
    )
    overdue_clients_count = overdue_clients_res.scalar() or 0

    # 4. OSs criadas hoje
    today_res = await db.execute(select(func.count(ServiceOrder.id)).where(ServiceOrder.created_at >= start_today))
    today_count = today_res.scalar() or 0

    summary_md = (
        f"🌅 **Bom Dia, Gestor Executivo!**\n\n"
        f"Aqui está o raio-x operacional da fábrica nesta manhã ({now.strftime('%d/%m/%Y')}):\n\n"
        f"- ⚠️ **{overdue_count} OSs Atrasadas** na esteira há mais de 3 dias.\n"
        f"- 💧 **{rupture_count} Dioptrias em Ruptura** (estoque crítico &lt;= 2 un).\n"
        f"- ❌ **{overdue_clients_count} Óticas Inadimplentes** com faturas em atraso.\n"
        f"- 🚀 **{today_count} Novas OSs** deram entrada hoje.\n\n"
        f"💡 *Recomendação:* Priorize a verificação das OSs em surfaçagem e o contato comercial com os clientes em atraso."
    )

    return {
        "overdue_os_count": overdue_count,
        "rupture_lenses_count": rupture_count,
        "overdue_clients_count": overdue_clients_count,
        "today_orders_count": today_count,
        "summary_markdown": summary_md
    }


# 2. MOTOR DE FALLBACK LOCAL DETERMINÍSTICO (RESILIÊNCIA OFFLINE)

def format_billing_stores_markdown(stores: List[Dict[str, Any]]) -> str:
    if not stores:
        return "Nenhum fechamento financeiro foi registrado nos últimos 30 dias para as óticas comerciais."
    
    md = "### 🏢 Óticas com Maior Faturamento (Últimos 30 Dias)\n\n"
    md += "Abaixo estão as óticas parceiras com maior faturamento consolidado:\n\n"
    md += "| Posição | Ótica Parceira | Faturamento Total |\n"
    md += "| :---: | :--- | :--- |\n"
    for idx, s in enumerate(stores, 1):
        md += f"| **{idx}º** | {s['store_name']} | R$ {s['total_billed']:.2f} |\n"
    return md


def format_consumed_lenses_markdown(lenses: List[Dict[str, Any]]) -> str:
    if not lenses:
        return "Nenhuma saída de lentes do estoque físico foi registrada nos últimos 30 dias."
    
    md = "### 🔍 Lentes com Maior Consumo (Últimos 30 Dias)\n\n"
    md += "Modelos e dioptrias de lentes mais consumidos nas ordens de serviço finalizadas:\n\n"
    md += "| Posição | Detalhes da Lente | Grau (Esf / Cil) | Quantidade Consumida |\n"
    md += "| :---: | :--- | :--- | :---: |\n"
    for idx, l in enumerate(lenses, 1):
        grau = f"{l['spherical']:+.2f} Esf / {l['cylindrical']:.2f} Cil"
        desc = f"{l['brand']} ({l['material']} - Ind {l['refractive_index']:.2f} - {l['treatment']})"
        md += f"| **{idx}º** | {desc} | **{grau}** | {l['total_quantity']} unids |\n"
    return md


def format_overdue_orders_markdown(orders: List[Dict[str, Any]]) -> str:
    if not orders:
        return "Excelente! Não há nenhuma Ordem de Serviço (OS) atrasada na esteira da fábrica no momento."
    
    md = "### ⚠️ Ordens de Serviço (OS) Atrasadas na Fábrica\n\n"
    md += "Listagem de OSs ativas que estão na esteira de produção há mais de 3 dias:\n\n"
    md += "| Número OS | Paciente | Ótica de Origem | Status Atual | Data de Entrada |\n"
    md += "| :--- | :--- | :--- | :--- | :--- |\n"
    for o in orders:
        data_criacao = datetime.fromisoformat(o['created_at']).strftime("%d/%m/%Y %H:%M")
        md += f"| **{o['os_number']}** | {o['client_name']} | {o['store_name']} | `{o['status']}` | {data_criacao} |\n"
    return md


async def execute_local_fallback(db: AsyncSession, question: str) -> str:
    """Identifica a intenção localmente por palavras-chave e executa a query correspondente."""
    question_lower = question.lower()
    
    if any(k in question_lower for k in ["retrabalho", "perda", "prejuízo", "prejuizo"]):
        data = await get_rework_losses(db)
        return f"### 💸 Impacto de Retrabalho na Produção\n\n- **OSs com Retrabalho:** {data['count']} ordens de serviço\n- **Prejuízo Acumulado Estimado:** R$ {data['loss_brl']:.2f}"

    elif any(k in question_lower for k in ["pendente", "a faturar", "não faturada", "nao faturada"]):
        groups = await get_unbilled_service_orders(db)
        if not groups:
            return "Todas as OSs elegíveis estão faturadas no momento!"
        md = "### 📋 OSs Prontas Pendentes de Faturamento\n\n| Ótica Comercial | OSs Pendentes | Total Acumulado |\n| :--- | :---: | :--- |\n"
        for g in groups:
            md += f"| **{g['store_name']}** | {g['pending_count']} OSs | R$ {g['total_amount']:.2f} |\n"
        return md

    elif any(k in question_lower for k in ["ótica", "otica", "fatur", "fechamento", "venda", "loja"]):
        stores = await get_top_billing_stores(db)
        return format_billing_stores_markdown(stores)
        
    elif any(k in question_lower for k in ["lente", "consumo", "saída", "saida", "estoque", "grade"]):
        lenses = await get_top_consumed_lenses(db)
        return format_consumed_lenses_markdown(lenses)
        
    elif any(k in question_lower for k in ["os", "atras", "andamento", "esteira", "produ", "bancada", "paciente"]):
        orders = await get_overdue_service_orders(db)
        return format_overdue_orders_markdown(orders)
        
    else:
        return (
            "Olá! Sou o **Assistente Operacional** da Nova Lab. Respondo dúvidas operacionais e financeiras em tempo real.\n\n"
            "Tente perguntar:\n"
            "- *Quais óticas mais faturaram este mês?*\n"
            "- *Quais lentes tiveram maior consumo?*\n"
            "- *Quanto perdi com retrabalho?*\n"
            "- *Quais OSs estão pendentes de faturamento?*\n"
            "- *Quais OSs estão atrasadas?*\n"
        )



# 3. INTERAÇÃO PRINCIPAL COM O GEMINI SDK

SYSTEM_INSTRUCTION = """
Você é o Assistente Operacional Inteligente do sistema Nova Lab. Seu objetivo é ajudar operadores e gestores de uma fábrica de lentes oftálmicas a consultar informações comerciais, logísticas e de produção.


Para responder às dúvidas dos usuários, você possui acesso a três ferramentas analíticas representadas pelas seguintes tags especiais. Se o usuário fizer uma pergunta que precise desses dados, responda UNICAMENTE com o comando correspondente e nada mais:

1. Faturamento de óticas parceiras: responda exatamente `[CALL_TOOL: get_top_billing_stores]`
2. Consumo e saídas de lentes do estoque: responda exatamente `[CALL_TOOL: get_top_consumed_lenses]`
3. OSs atrasadas na esteira de produção: responda exatamente `[CALL_TOOL: get_overdue_service_orders]`

Se o usuário enviar dados de retorno (ex: "Resultado dos dados: ..."), formule uma resposta analítica clara, amigável e profissional formatada em Markdown com tabelas e marcadores em Português do Brasil.
"""

async def ask_assistant(db: AsyncSession, question: str) -> str:
    """Função principal do assistente IA com Function Calling / ReAct e Fallback offline."""
    api_key = os.getenv("GEMINI_API_KEY")
    
    # Se não houver chave de API configurada, vai direto para o fallback local
    if not api_key:
        return await execute_local_fallback(db, question)
        
    try:
        # Configura o Gemini SDK
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Primeira chamada para detectar a intenção (se precisa de ferramenta)
        response = model.generate_content(question)
        response_text = response.text.strip()
        
        # Analisa se o modelo solicitou chamada de ferramenta
        if "[CALL_TOOL: get_top_billing_stores]" in response_text:
            stores = await get_top_billing_stores(db)
            data_context = f"Resultado dos dados das óticas que mais faturaram: {stores}"
            final_response = model.generate_content(f"Pergunta original: {question}\n{data_context}")
            return final_response.text
            
        elif "[CALL_TOOL: get_top_consumed_lenses]" in response_text:
            lenses = await get_top_consumed_lenses(db)
            data_context = f"Resultado dos dados das lentes de maior consumo: {lenses}"
            final_response = model.generate_content(f"Pergunta original: {question}\n{data_context}")
            return final_response.text
            
        elif "[CALL_TOOL: get_overdue_service_orders]" in response_text:
            orders = await get_overdue_service_orders(db)
            data_context = f"Resultado dos dados das ordens de serviço atrasadas: {orders}"
            final_response = model.generate_content(f"Pergunta original: {question}\n{data_context}")
            return final_response.text
            
        # Se o modelo respondeu diretamente sem tag de tool
        return response_text
        
    except Exception as e:
        print(f"[AI Assistant] Erro na chamada à API do Gemini ({e}). Acionando Fallback Local.")
        # Em caso de qualquer erro de rede, cota ou limite, aciona o fallback offline seguro
        return await execute_local_fallback(db, question)
