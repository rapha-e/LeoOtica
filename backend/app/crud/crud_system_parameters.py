import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.system_parameter import SystemParameter

DEFAULT_PARAMETERS = {
    # Financeiro / Inadimplência
    "financial_delinquency_policy": {
        "value": "POLICY_ALERT", # 'POLICY_ALERT', 'POLICY_AUTHORIZE', 'POLICY_BLOCK'
        "group": "FINANCIAL",
        "description": "Política para clientes inadimplentes (POLICY_ALERT, POLICY_AUTHORIZE, POLICY_BLOCK)"
    },
    
    # Estoque & Reposição
    "inventory_critical_qty": {
        "value": "0",
        "group": "INVENTORY",
        "description": "Quantidade considerada como estoque crítico"
    },
    "inventory_low_qty": {
        "value": "5",
        "group": "INVENTORY",
        "description": "Quantidade considerada como estoque baixo"
    },
    "inventory_ideal_qty": {
        "value": "15",
        "group": "INVENTORY",
        "description": "Quantidade ideal de itens no estoque"
    },
    "inventory_desired_coverage_days": {
        "value": "30",
        "group": "INVENTORY",
        "description": "Cobertura de estoque desejada (em dias)"
    },
    "inventory_lead_time_days": {
        "value": "10",
        "group": "INVENTORY",
        "description": "Tempo médio de entrega do fornecedor / Lead Time (em dias)"
    },
    "inventory_safety_stock_days": {
        "value": "7",
        "group": "INVENTORY",
        "description": "Estoque de segurança adicional (em dias)"
    }
}

async def seed_default_parameters(db: AsyncSession):
    """Garante que os parâmetros padrões existam no banco de dados."""
    for key, data in DEFAULT_PARAMETERS.items():
        stmt = select(SystemParameter).where(SystemParameter.key == key)
        param = (await db.execute(stmt)).scalar_one_or_none()
        if not param:
            new_param = SystemParameter(
                key=key,
                value=data["value"],
                group=data["group"],
                description=data["description"]
            )
            db.add(new_param)
    await db.commit()

async def get_parameter(db: AsyncSession, key: str, default: Optional[str] = None) -> str:
    stmt = select(SystemParameter).where(SystemParameter.key == key)
    param = (await db.execute(stmt)).scalar_one_or_none()
    if param:
        return param.value
    if key in DEFAULT_PARAMETERS:
        return DEFAULT_PARAMETERS[key]["value"]
    return default or ""

async def get_all_parameters(db: AsyncSession) -> Dict[str, str]:
    await seed_default_parameters(db)
    stmt = select(SystemParameter)
    result = await db.execute(stmt)
    params = result.scalars().all()
    return {p.key: p.value for p in params}

async def set_parameter(db: AsyncSession, key: str, value: str, group: str = "GENERAL", description: Optional[str] = None) -> SystemParameter:
    stmt = select(SystemParameter).where(SystemParameter.key == key)
    param = (await db.execute(stmt)).scalar_one_or_none()
    if param:
        param.value = str(value)
        if description:
            param.description = description
    else:
        param = SystemParameter(
            key=key,
            value=str(value),
            group=group,
            description=description
        )
        db.add(param)
    await db.commit()
    await db.refresh(param)
    return param

async def set_multiple_parameters(db: AsyncSession, params_dict: Dict[str, str]) -> Dict[str, str]:
    for key, value in params_dict.items():
        group = DEFAULT_PARAMETERS.get(key, {}).get("group", "GENERAL")
        desc = DEFAULT_PARAMETERS.get(key, {}).get("description", None)
        await set_parameter(db, key, str(value), group=group, description=desc)
    return await get_all_parameters(db)
