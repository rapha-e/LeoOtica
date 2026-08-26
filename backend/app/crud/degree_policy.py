import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.degree_policy import DegreePricingPolicy
from backend.app.models.lens import LensModel
from backend.app.models.financial_catalog import Product, PriceHistory
from backend.app.schemas.degree_policy import DegreePricingPolicyCreate, DegreePricingPolicyUpdate

async def get_active_policy(db: AsyncSession) -> Optional[DegreePricingPolicy]:
    stmt = select(DegreePricingPolicy).where(DegreePricingPolicy.is_active == True).order_by(DegreePricingPolicy.updated_at.desc())
    return (await db.execute(stmt)).scalars().first()

async def create_or_update_policy(
    db: AsyncSession,
    policy_in: DegreePricingPolicyCreate,
    user_id: Optional[uuid.UUID] = None,
    cascade_update: bool = False
) -> Tuple[DegreePricingPolicy, int]:
    policy = await get_active_policy(db)
    if not policy:
        policy = DegreePricingPolicy(
            degree_threshold=policy_in.degree_threshold,
            default_sale_price_le=policy_in.default_sale_price_le,
            default_sale_price_gt=policy_in.default_sale_price_gt,
            is_active=policy_in.is_active,
            updated_by_id=user_id
        )
        db.add(policy)
    else:
        policy.degree_threshold = policy_in.degree_threshold
        policy.default_sale_price_le = policy_in.default_sale_price_le
        policy.default_sale_price_gt = policy_in.default_sale_price_gt
        policy.is_active = policy_in.is_active
        policy.updated_by_id = user_id
        policy.updated_at = datetime.now(timezone.utc)
        db.add(policy)

    await db.flush()

    updated_count = 0
    if cascade_update and policy.is_active:
        from backend.app.crud.crud_system_parameters import get_all_parameters, sync_system_parameters_to_lens_models
        all_sys_params = await get_all_parameters(db)
        await sync_system_parameters_to_lens_models(db, all_sys_params)

        stmt_lens = select(LensModel)
        lenses = (await db.execute(stmt_lens)).scalars().all()
        updated_count = len(lenses)

        for lm in lenses:
            # Atualiza o produto correspondente no catálogo financeiro caso não tenha sido ajustado ainda
            p_stmt = select(Product).where(Product.lens_model_id == lm.id)
            prod = (await db.execute(p_stmt)).scalars().first()
            if prod:
                new_price = float(lm.sale_price)
                if prod.sale_price != new_price:
                    prod.sale_price = new_price
                    prod.current_version = (prod.current_version or 1) + 1
                    db.add(prod)

                    price_hist = PriceHistory(
                        entity_type="product",
                        entity_id=prod.id,
                        price=new_price,
                        cost_price=prod.cost_price,
                        version=prod.current_version,
                        start_date=datetime.now(timezone.utc),
                        change_reason=f"Atualização em lote (Cascade Update) via Regra Global por Grau (Limite: {policy.degree_threshold:.2f}D)"
                    )
                    db.add(price_hist)

    await db.commit()
    await db.refresh(policy)
    return policy, updated_count
