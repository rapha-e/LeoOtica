from uuid import UUID, uuid4
from datetime import datetime, timezone
from decimal import Decimal
from typing import Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status

from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory, ServiceOrderItem
from backend.app.models.lens import LensModel, ProductionRoute, MatrixType
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsReceivable
from backend.app.services.pricing import calculate_lp_auto_price
from backend.app.services.allocation import allocate_and_deduct_inventory
from backend.app.schemas.os_factory import OSCreateFactorySchema

class OSFactoryService:

    @staticmethod
    def _calculate_decentration_and_min_diameter(
        frame_a: float, 
        frame_bridge: float, 
        dnp: float, 
        ed: float
    ) -> Tuple[float, float]:
        """
        Calcula a descentração horizontal e o diâmetro mínimo do bloco/lente exigido para corte.
        """
        decentration = ((frame_a + frame_bridge) / 2.0) - dnp
        min_diameter = ed + (2.0 * abs(decentration)) + 2.0  # 2.0mm de margem técnica
        return decentration, min_diameter

    @staticmethod
    def _transpose_dioptria(spherical: float, cylindrical: float, axis: int) -> Tuple[float, float, int]:
        """
        Garante a transposição para a forma canônica de cilíndrico negativo.
        """
        if cylindrical > 0:
            new_sph = spherical + cylindrical
            new_cyl = -cylindrical
            new_axis = axis + 90 if axis <= 90 else axis - 90
            return new_sph, new_cyl, new_axis
        return spherical, cylindrical, axis

    @classmethod
    async def register_factory_os(
        cls, 
        db: AsyncSession, 
        schema: OSCreateFactorySchema, 
        current_user_id: UUID
    ) -> ServiceOrder:
        # 1. Validação da Ótica e Trava Financeira de Inadimplência
        store_res = await db.execute(select(OpticalStore).where(OpticalStore.id == schema.optical_store_id))
        optical_store = store_res.scalars().first()
        if not optical_store:
            raise HTTPException(status_code=404, detail="Ótica parceira não encontrada.")

        # Verifica títulos vencidos em Contas a Receber
        overdue_stmt = select(AccountsReceivable).where(
            AccountsReceivable.optical_store_id == schema.optical_store_id,
            AccountsReceivable.status.in_(["PENDENTE", "ATRASADO", "RECEBIDO_PARCIAL"]),
            AccountsReceivable.due_date < datetime.now(timezone.utc)
        )
        overdue_res = await db.execute(overdue_stmt)
        has_overdue_titles = overdue_res.scalars().first() is not None

        # 2. Carrega Modelo do Cadastrador Unificado (se fornecido)
        lens_model = None
        production_route_val = "SERVICO_REPARO"
        if schema.lens_model_id:
            model_res = await db.execute(select(LensModel).where(LensModel.id == schema.lens_model_id))
            lens_model = model_res.scalars().first()
            if not lens_model and schema.os_type == "PADRAO":
                raise HTTPException(status_code=404, detail="Modelo de lente não cadastrado.")
            if lens_model:
                production_route_val = str(lens_model.production_route)

        # 3. Transposição e Validação Geométrica para Olho Direito e Esquerdo (se informados)
        od_sph, od_cyl, od_axis = (0.0, 0.0, 0)
        oe_sph, oe_cyl, oe_axis = (0.0, 0.0, 0)
        od_min_dia, oe_min_dia = (0.0, 0.0)

        # 3. Transposição e Validação Geométrica para Olho Direito e Esquerdo (se informados)
        od_sph, od_cyl, od_axis = (0.0, 0.0, 0)
        oe_sph, oe_cyl, oe_axis = (0.0, 0.0, 0)
        od_min_dia, oe_min_dia = (0.0, 0.0)

        if schema.od_prescription and schema.frame_geometry:
            od_sph, od_cyl, od_axis = cls._transpose_dioptria(
                schema.od_prescription.spherical, schema.od_prescription.cylindrical, schema.od_prescription.axis
            )
            _, od_min_dia = cls._calculate_decentration_and_min_diameter(
                schema.frame_geometry.frame_a, schema.frame_geometry.frame_bridge,
                schema.od_prescription.dnp, schema.frame_geometry.frame_ed
            )

        if schema.oe_prescription and schema.frame_geometry:
            oe_sph, oe_cyl, oe_axis = cls._transpose_dioptria(
                schema.oe_prescription.spherical, schema.oe_prescription.cylindrical, schema.oe_prescription.axis
            )
            _, oe_min_dia = cls._calculate_decentration_and_min_diameter(
                schema.frame_geometry.frame_a, schema.frame_geometry.frame_bridge,
                schema.oe_prescription.dnp, schema.frame_geometry.frame_ed
            )

        # 4. Cálculo de Preço Comercial (Lentes + Serviços Adicionais vs. Override Manual)
        additional_services_sum = sum(float(s.price) for s in (schema.additional_services or []))

        if schema.manual_price_override is not None:
            final_price = schema.manual_price_override + additional_services_sum
            custom_price_applied = True
        elif lens_model:
            if lens_model.matrix_type == MatrixType.LP_GRADE:
                od_price = await calculate_lp_auto_price(db, lens_model.id, od_sph, od_cyl) if schema.od_prescription else 0.0
                oe_price = await calculate_lp_auto_price(db, lens_model.id, oe_sph, oe_cyl) if schema.oe_prescription else 0.0
                lens_price = od_price + oe_price
            else:
                unit_price = float(lens_model.sale_price or 0.0)
                eye_count = 0
                if schema.od_prescription:
                    eye_count += 1
                if schema.oe_prescription:
                    eye_count += 1
                if eye_count == 0:
                    eye_count = 2
                lens_price = unit_price * eye_count
            final_price = lens_price + additional_services_sum
            custom_price_applied = False
        else:
            final_price = additional_services_sum if additional_services_sum > 0 else 50.0
            custom_price_applied = False

        # 5. Definição do Status Inicial e Rota de Produção
        # Consulta a política global de inadimplência nos parâmetros do sistema (consistente com o fluxo manual)
        from backend.app.crud.crud_system_parameters import get_parameter
        store_policy = await get_parameter(db, "financial_delinquency_policy", "POLICY_ALERT")
        
        if has_overdue_titles and store_policy == "POLICY_BLOCK":
            initial_status = OSStatus.BLOQUEADA_FINANCEIRO.value if hasattr(OSStatus.BLOQUEADA_FINANCEIRO, 'value') else OSStatus.BLOQUEADA_FINANCEIRO
            next_station = "FINANCEIRO_RETENCAO"
        elif has_overdue_titles and store_policy == "POLICY_AUTHORIZE":
            initial_status = OSStatus.AGUARDANDO_LIBERACAO.value if hasattr(OSStatus.AGUARDANDO_LIBERACAO, 'value') else OSStatus.AGUARDANDO_LIBERACAO
            next_station = "FINANCEIRO_RETENCAO"
        elif schema.os_type == "REPARO_SERVICO" or not lens_model:
            initial_status = OSStatus.SEPARACAO.value if hasattr(OSStatus.SEPARACAO, 'value') else OSStatus.SEPARACAO
            next_station = "BANCADA_REPAROS"
        else:
            if lens_model.production_route == ProductionRoute.EXPRESSA_FACETAMENTO:
                initial_status = OSStatus.SEPARACAO.value if hasattr(OSStatus.SEPARACAO, 'value') else OSStatus.SEPARACAO
                next_station = "FACETAMENTO_MONTAGEM"
            else:
                initial_status = OSStatus.SURFACAGEM.value if hasattr(OSStatus.SURFACAGEM, 'value') else OSStatus.SURFACAGEM
                next_station = "SURFACAGEM_CNC"

        # 6. Instanciação da Ordem de Serviço
        os_number = f"OS-{datetime.now(timezone.utc).year}-{uuid4().hex[:6].upper()}"
        
        rx_data_prepared = {}
        if schema.od_prescription:
            rx_data_prepared["OD"] = {
                "esferico": od_sph, "cilindrico": od_cyl, "eixo": od_axis,
                "adicao": schema.od_prescription.addition,
                "curva_base": schema.od_prescription.base_curve,
                "dnp": schema.od_prescription.dnp,
                "altura": schema.od_prescription.height,
                "min_diameter": od_min_dia
            }
        if schema.oe_prescription:
            rx_data_prepared["OE"] = {
                "esferico": oe_sph, "cilindrico": oe_cyl, "eixo": oe_axis,
                "adicao": schema.oe_prescription.addition,
                "curva_base": schema.oe_prescription.base_curve,
                "dnp": schema.oe_prescription.dnp,
                "altura": schema.oe_prescription.height,
                "min_diameter": oe_min_dia
            }

        new_os = ServiceOrder(
            id=uuid4(),
            os_number=os_number,
            optical_store_id=schema.optical_store_id,
            client_order_number=schema.client_order_number,
            tray_number=schema.tray_number,
            priority=schema.priority.value if hasattr(schema.priority, 'value') else str(schema.priority),
            os_type=schema.os_type,
            status=initial_status,
            lens_model_id=lens_model.id if lens_model else None,
            od_spherical=Decimal(str(od_sph)),
            od_cylindrical=Decimal(str(od_cyl)),
            od_axis=od_axis,
            od_addition=Decimal(str(schema.od_prescription.addition if schema.od_prescription else 0.0)),
            od_dnp=Decimal(str(schema.od_prescription.dnp if schema.od_prescription else 0.0)),
            od_height=Decimal(str(schema.od_prescription.height if schema.od_prescription else 0.0)),
            oe_spherical=Decimal(str(oe_sph)),
            oe_cylindrical=Decimal(str(oe_cyl)),
            oe_axis=oe_axis,
            oe_addition=Decimal(str(schema.oe_prescription.addition if schema.oe_prescription else 0.0)),
            oe_dnp=Decimal(str(schema.oe_prescription.dnp if schema.oe_prescription else 0.0)),
            oe_height=Decimal(str(schema.oe_prescription.height if schema.oe_prescription else 0.0)),
            frame_a=Decimal(str(schema.frame_geometry.frame_a if schema.frame_geometry else 0.0)),
            frame_bridge=Decimal(str(schema.frame_geometry.frame_bridge if schema.frame_geometry else 0.0)),
            frame_ed=Decimal(str(schema.frame_geometry.frame_ed if schema.frame_geometry else 0.0)),
            total_amount=Decimal(str(final_price)),
            custom_price_applied=custom_price_applied,
            price_override_reason=schema.price_override_reason,
            special_instructions=schema.special_instructions,
            created_at=datetime.now(timezone.utc)
        )

        db.add(new_os)
        await db.flush()

        # 7. Execução da Alocação de Estoque apenas se for OS Padrão com Modelo de Lente e sem bloqueio financeiro
        if lens_model and "Inadimplência" not in str(initial_status) and "Bloqueada" not in str(initial_status):
            try:
                await allocate_and_deduct_inventory(
                    db=db,
                    os_id=new_os.id,
                    lens_model_id=lens_model.id,
                    rx_data=rx_data_prepared
                )
            except Exception as alloc_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(alloc_err)
                )

        # 8. Gravação dos Serviços Técnicos Adicionais em ServiceOrderItem
        if schema.additional_services:
            for s in schema.additional_services:
                item = ServiceOrderItem(
                    id=uuid4(),
                    service_order_id=new_os.id,
                    entity_type="service",
                    entity_id=s.service_id,
                    quantity=1,
                    unit_price=Decimal(str(s.price)),
                    total_price=Decimal(str(s.price)),
                    custom_price_applied=False,
                    created_at=datetime.now(timezone.utc)
                )
                db.add(item)

        # 9. Registro de Rastreabilidade no Histórico
        history_entry = OSWorkflowHistory(
            id=uuid4(),
            service_order_id=new_os.id,
            previous_status=None,
            new_status=str(initial_status),
            sector=next_station,
            operator_id=current_user_id,
            operator_notes=f"OS criada via registro fabril. Rota: {production_route_val}",
            changed_at=datetime.now(timezone.utc)
        )
        db.add(history_entry)

        await db.commit()
        await db.refresh(new_os)
        return new_os
