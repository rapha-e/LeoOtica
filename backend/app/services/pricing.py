import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.lens import LensModel, DegreePricingPolicyRange

async def calculate_lp_auto_price(
    db: AsyncSession, 
    lens_model_id: uuid.UUID, 
    spherical: float, 
    cylindrical: float
) -> float:
    """
    Calcula o preço automático de venda para Lentes Prontas (LP_GRADE) por faixa de grau.
    Realiza a transposição de Cilíndrico Positivo para Negativo caso necessário.
    """
    sph = Decimal(str(spherical))
    cyl = Decimal(str(cylindrical))

    # Transposição de Cilíndrico Positivo para Negativo
    if cyl > 0:
        sph = sph + cyl
        cyl = -cyl

    # Busca política por faixa matemática de dioptria
    stmt = select(DegreePricingPolicyRange).where(
        DegreePricingPolicyRange.lens_model_id == lens_model_id,
        DegreePricingPolicyRange.min_spherical <= sph,
        DegreePricingPolicyRange.max_spherical >= sph,
        DegreePricingPolicyRange.min_cylindrical <= cyl,
        DegreePricingPolicyRange.max_cylindrical >= cyl
    )
    result = await db.execute(stmt)
    policy = result.scalars().first()

    if policy:
        return float(policy.price)

    # Fallback: utiliza a regra padrão ou o preço base do modelo
    stmt_model = select(LensModel).where(LensModel.id == lens_model_id)
    model_res = await db.execute(stmt_model)
    lens_model = model_res.scalars().first()

    if lens_model:
        return float(lens_model.get_sale_price_for_diopter(sph, cyl))
    
    return 0.0
