import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.nfe import NfeSaida
from backend.app.services.nfe_emitter import generate_access_key, generate_nfe_xml

async def get_nfe_by_cycle_id(db: AsyncSession, cycle_id: uuid.UUID) -> Optional[NfeSaida]:
    """
    Busca o registro de nota fiscal vinculado ao ciclo de faturamento.
    """
    result = await db.execute(
        select(NfeSaida).where(NfeSaida.billing_cycle_id == cycle_id)
    )
    return result.scalars().first()

async def create_nfe_saida(db: AsyncSession, cycle_id: uuid.UUID) -> NfeSaida:
    """
    Gera e emite a NF-e simulada para um ciclo de faturamento.
    Garante numeração sequencial automática e chave de acesso única.
    """
    # 1. Busca o ciclo com relacionamento com a ótica e itens carregados
    cycle_result = await db.execute(
        select(BillingCycle)
        .where(BillingCycle.id == cycle_id)
        .options(
            selectinload(BillingCycle.optical_store),
            selectinload(BillingCycle.items).selectinload(BillingItem.service_order)
        )
    )
    cycle = cycle_result.scalars().first()
    
    if not cycle:
        raise ValueError("Ciclo de faturamento não encontrado.")
        
    # 2. Verifica se a nota já foi emitida
    existing_nfe = await get_nfe_by_cycle_id(db, cycle_id)
    if existing_nfe:
        raise ValueError("Nota Fiscal já emitida para este ciclo de faturamento.")
        
    # 3. Calcula o próximo número de nota fiscal (sequencial)
    max_num_result = await db.execute(
        select(func.max(NfeSaida.nfe_number))
    )
    max_num = max_num_result.scalar()
    nfe_number = (max_num or 0) + 1
    
    # 4. Dados fiscais
    uf_sp = 35  # São Paulo
    serie = 1
    
    # CNPJ do emitente padrão ou do laboratório
    from backend.app.crud import laboratory as crud_laboratory
    lab = await crud_laboratory.get_laboratory(db)
    cnpj_laboratorio = "".join(filter(str.isdigit, lab.cnpj if lab else "58032958000144")).zfill(14)
    
    # 5. Gera chave de acesso
    chave_acesso = generate_access_key(
        uf=uf_sp,
        cnpj=cnpj_laboratorio,
        model=55,
        serie=serie,
        nfe_number=nfe_number
    )
    
    # 6. Gera conteúdo do XML
    xml_content = generate_nfe_xml(cycle, nfe_number, chave_acesso, laboratory=lab)
    
    # 7. Cria e persiste no banco de dados
    db_nfe = NfeSaida(
        billing_cycle_id=cycle_id,
        nfe_number=nfe_number,
        serie=serie,
        chave_acesso=chave_acesso,
        xml_content=xml_content,
        status="EMITIDA",
        emitted_at=datetime.utcnow()
    )
    
    db.add(db_nfe)
    await db.commit()
    await db.refresh(db_nfe)
    
    return db_nfe

async def cancel_nfe_saida(db: AsyncSession, cycle_id: uuid.UUID) -> NfeSaida:
    """
    Realiza o cancelamento simulado da NF-e vinculada a um faturamento.
    """
    db_nfe = await get_nfe_by_cycle_id(db, cycle_id)
    
    if not db_nfe:
        raise ValueError("Nota fiscal não encontrada para cancelamento.")
        
    if db_nfe.status == "CANCELADA":
        raise ValueError("Nota fiscal já se encontra cancelada.")
        
    db_nfe.status = "CANCELADA"
    await db.commit()
    await db.refresh(db_nfe)
    
    return db_nfe
