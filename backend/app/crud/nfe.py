import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.nfe import NfeSaida
from backend.app.services.nfe_emitter import generate_access_key, generate_nfe_xml
from backend.app.services.focus_nfe_service import FocusNfeService


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
    Gera e emite a NF-e para um ciclo de faturamento.
    Se a Focus NFe estiver configurada (FOCUS_NFE_TOKEN), despacha para a API e SEFAZ.
    Caso contrário, executa a emissão em Modo Simulação Local retrocompatível.
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

    # 4. Dados do laboratório
    from backend.app.crud import laboratory as crud_laboratory
    lab = await crud_laboratory.get_laboratory(db)

    focus_service = FocusNfeService()

    # 5. Fluxo Integrado Focus NFe vs. Modo Simulação
    if focus_service.is_configured:
        ref = f"CICLO-{str(cycle_id)}"
        payload = focus_service.build_nfe_payload(cycle, nfe_number, laboratory=lab)

        try:
            resp = await focus_service.emit_nfe(ref, payload)
        except Exception as e:
            raise ValueError(f"Falha na comunicação com a Focus NFe: {str(e)}")

        status_focus = resp.get("status", "processando_autorizacao")
        chave_acesso = resp.get("chave_nfe") or generate_access_key(
            uf=35,
            cnpj="".join(filter(str.isdigit, lab.cnpj if lab else "58032958000144")).zfill(14),
            model=55,
            serie=1,
            nfe_number=nfe_number
        )
        protocolo = resp.get("protocolo")
        danfe_url = resp.get("caminho_danfe")
        xml_url = resp.get("caminho_xml_nota_fiscal")
        mensagem_sefaz = resp.get("mensagem_sefaz") or "Enviada para processamento na SEFAZ"

        if status_focus == "autorizado":
            status_db = "AUTORIZADA"
        elif status_focus == "erro_autorizacao":
            status_db = "REJEITADA"
            mensagem_sefaz = resp.get("mensagem_sefaz") or str(resp.get("erros", "Rejeição na SEFAZ"))
        else:
            status_db = "PROCESSANDO"

        # Tenta baixar o XML oficial se já retornado, senão cria placeholder/simulado
        xml_content = None
        if xml_url:
            try:
                xml_bytes = await focus_service.download_file(xml_url)
                xml_content = xml_bytes.decode("utf-8", errors="ignore")
            except Exception:
                xml_content = None

        if not xml_content:
            xml_content = generate_nfe_xml(cycle, nfe_number, chave_acesso, laboratory=lab)

        db_nfe = NfeSaida(
            billing_cycle_id=cycle_id,
            nfe_number=nfe_number,
            serie=1,
            chave_acesso=chave_acesso,
            xml_content=xml_content,
            status=status_db,
            focus_ref=ref,
            protocolo=protocolo,
            danfe_url=danfe_url,
            xml_url=xml_url,
            mensagem_sefaz=mensagem_sefaz,
            emitted_at=datetime.now(timezone.utc)
        )
    else:
        # Modo Simulação Local
        uf_sp = 35
        serie = 1
        cnpj_laboratorio = "".join(filter(str.isdigit, lab.cnpj if lab else "58032958000144")).zfill(14)
        chave_acesso = generate_access_key(
            uf=uf_sp,
            cnpj=cnpj_laboratorio,
            model=55,
            serie=serie,
            nfe_number=nfe_number
        )
        xml_content = generate_nfe_xml(cycle, nfe_number, chave_acesso, laboratory=lab)

        db_nfe = NfeSaida(
            billing_cycle_id=cycle_id,
            nfe_number=nfe_number,
            serie=serie,
            chave_acesso=chave_acesso,
            xml_content=xml_content,
            status="EMITIDA",
            mensagem_sefaz="Nota emitida no modo simulação local (homologação interna)",
            emitted_at=datetime.now(timezone.utc)
        )

    db.add(db_nfe)
    await db.commit()
    await db.refresh(db_nfe)

    return db_nfe


async def sync_nfe_saida(db: AsyncSession, cycle_id: uuid.UUID) -> NfeSaida:
    """
    Sincroniza o status da NF-e com a Focus NFe / SEFAZ e atualiza os links do DANFE e XML.
    """
    db_nfe = await get_nfe_by_cycle_id(db, cycle_id)
    if not db_nfe:
        raise ValueError("Nota fiscal não encontrada para sincronização.")

    focus_service = FocusNfeService()
    if not db_nfe.focus_ref or not focus_service.is_configured:
        return db_nfe

    try:
        data = await focus_service.get_nfe(db_nfe.focus_ref)
    except Exception as e:
        raise ValueError(f"Falha ao consultar Focus NFe: {str(e)}")

    status_focus = data.get("status")
    if not status_focus:
        return db_nfe

    if status_focus == "autorizado":
        db_nfe.status = "AUTORIZADA"
        db_nfe.chave_acesso = data.get("chave_nfe") or db_nfe.chave_acesso
        db_nfe.protocolo = data.get("protocolo") or db_nfe.protocolo
        db_nfe.danfe_url = data.get("caminho_danfe")
        db_nfe.xml_url = data.get("caminho_xml_nota_fiscal")
        db_nfe.mensagem_sefaz = data.get("mensagem_sefaz") or "Autorizado o uso da NF-e"

        # Se tiver o XML oficial na Focus NFe, baixa para o banco
        if db_nfe.xml_url:
            try:
                xml_bytes = await focus_service.download_file(db_nfe.xml_url)
                db_nfe.xml_content = xml_bytes.decode("utf-8", errors="ignore")
            except Exception:
                pass
    elif status_focus == "processando_autorizacao":
        db_nfe.status = "PROCESSANDO"
        db_nfe.mensagem_sefaz = data.get("mensagem_sefaz") or "Aguardando processamento na SEFAZ"
    elif status_focus == "erro_autorizacao":
        db_nfe.status = "REJEITADA"
        db_nfe.mensagem_sefaz = data.get("mensagem_sefaz") or str(data.get("erros", "Rejeição SEFAZ"))
    elif status_focus == "cancelado":
        db_nfe.status = "CANCELADA"
        db_nfe.mensagem_sefaz = data.get("mensagem_sefaz") or "Nota fiscal cancelada na SEFAZ"

    await db.commit()
    await db.refresh(db_nfe)
    return db_nfe


async def cancel_nfe_saida(db: AsyncSession, cycle_id: uuid.UUID, justification: Optional[str] = None) -> NfeSaida:
    """
    Realiza o cancelamento da NF-e vinculada a um faturamento.
    Se emitido pela Focus NFe, envia o cancelamento à SEFAZ.
    """
    db_nfe = await get_nfe_by_cycle_id(db, cycle_id)

    if not db_nfe:
        raise ValueError("Nota fiscal não encontrada para cancelamento.")

    if db_nfe.status == "CANCELADA":
        raise ValueError("Nota fiscal já se encontra cancelada.")

    focus_service = FocusNfeService()
    if db_nfe.focus_ref and focus_service.is_configured:
        just = justification or "Cancelamento solicitado devido a ajuste operacional no ciclo de faturamento."
        try:
            await focus_service.cancel_nfe(db_nfe.focus_ref, just)
            db_nfe.mensagem_sefaz = "Cancelamento registrado e homologado na SEFAZ."
        except Exception as e:
            raise ValueError(f"Erro ao cancelar nota na SEFAZ via Focus NFe: {str(e)}")

    db_nfe.status = "CANCELADA"
    await db.commit()
    await db.refresh(db_nfe)

    return db_nfe
