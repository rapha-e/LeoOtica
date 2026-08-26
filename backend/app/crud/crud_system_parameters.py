import uuid
from datetime import datetime, timezone
from decimal import Decimal
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
    },

    # --- TABELAS DE PREÇO POR TIPO DE LENTE (LP) ---
    # 1. LP Incolor 1.50
    "lp_incolor_150_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP Incolor 1.50"},
    "lp_incolor_150_price_base": {"value": "60.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP Incolor 1.50"},
    "lp_incolor_150_price_over": {"value": "80.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP Incolor 1.50"},

    # 2. LP AR 1.56
    "lp_ar_156_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP AR 1.56"},
    "lp_ar_156_price_base": {"value": "75.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP AR 1.56"},
    "lp_ar_156_price_over": {"value": "95.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP AR 1.56"},

    # 3. LP Filtro Azul AR 1.56
    "lp_filtro_azul_ar_156_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP Filtro Azul AR 1.56"},
    "lp_filtro_azul_ar_156_price_base": {"value": "95.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP Filtro Azul AR 1.56"},
    "lp_filtro_azul_ar_156_price_over": {"value": "125.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP Filtro Azul AR 1.56"},

    # 4. LP POLY AR 1.59
    "lp_poly_ar_159_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP POLY AR 1.59"},
    "lp_poly_ar_159_price_base": {"value": "110.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP POLY AR 1.59"},
    "lp_poly_ar_159_price_over": {"value": "140.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP POLY AR 1.59"},

    # 5. LP POLY Filtro Azul AR 1.59
    "lp_poly_filtro_azul_ar_159_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP POLY Filtro Azul AR 1.59"},
    "lp_poly_filtro_azul_ar_159_price_base": {"value": "130.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP POLY Filtro Azul AR 1.59"},
    "lp_poly_filtro_azul_ar_159_price_over": {"value": "165.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP POLY Filtro Azul AR 1.59"},

    # 6. LP PHOTO AR 1.56
    "lp_photo_ar_156_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP PHOTO AR 1.56"},
    "lp_photo_ar_156_price_base": {"value": "145.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP PHOTO AR 1.56"},
    "lp_photo_ar_156_price_over": {"value": "185.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP PHOTO AR 1.56"},

    # 7. LP PHOTO Filtro Azul AR 1.56
    "lp_photo_filtro_azul_ar_156_cyl_threshold": {"value": "2.00", "group": "LENS_PRICING", "description": "Limite Cilíndrico LP PHOTO Filtro Azul AR 1.56"},
    "lp_photo_filtro_azul_ar_156_price_base": {"value": "170.00", "group": "LENS_PRICING", "description": "Preço Base (Sph 0-4 | Cyl 0-2) LP PHOTO Filtro Azul AR 1.56"},
    "lp_photo_filtro_azul_ar_156_price_over": {"value": "215.00", "group": "LENS_PRICING", "description": "Preço Ajustado (Cyl > 2.00D) LP PHOTO Filtro Azul AR 1.56"}
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

from decimal import Decimal
from datetime import datetime, timezone

LP_KEY_MAPPING = {
    "lp_incolor_150": ["LP Incolor 1.50"],
    "lp_ar_156": ["LP AR 1.56"],
    "lp_filtro_azul_ar_156": ["LP Filtro Azul AR 1.56"],
    "lp_poly_ar_159": ["LP POLY AR 1.59"],
    "lp_poly_filtro_azul_ar_159": ["LP POLY FILTRO AZUL AR 1.59", "LP POLY Filtro Azul AR 1.59"],
    "lp_photo_ar_156": ["LP PHOTO AR 1.56"],
    "lp_photo_filtro_azul_ar_156": ["LP PHOTO FILTRO AZUL AR 1.56", "LP PHOTO Filtro Azul AR 1.56"],
}

def get_preset_key_for_lens(
    brand: Optional[str] = None,
    name: Optional[str] = None,
    refractive_index: Optional[Any] = None,
    treatment: Optional[str] = None,
    material: Optional[str] = None
) -> Optional[str]:
    b_str = (brand or "").strip().upper()
    n_str = (name or "").strip().upper()
    t_str = (treatment or "").strip().upper()
    m_str = (material or "").strip().upper()
    
    idx = None
    if refractive_index is not None:
        try:
            idx = float(refractive_index)
        except (ValueError, TypeError):
            pass

    full_str = f"{b_str} {n_str}"
    if "FILTRO AZUL" in full_str or "BLUE" in full_str or "AZUL" in t_str or "BLUE" in t_str:
        if "PHOTO" in full_str or "FOTO" in full_str or "PHOTO" in t_str or "FOTO" in t_str:
            return "lp_photo_filtro_azul_ar_156"
        elif "POLY" in full_str or "POLI" in full_str or "POLY" in m_str or (idx is not None and abs(idx - 1.59) < 0.02):
            return "lp_poly_filtro_azul_ar_159"
        else:
            return "lp_filtro_azul_ar_156"
    elif "PHOTO" in full_str or "FOTO" in full_str or "PHOTO" in t_str or "FOTO" in t_str:
        return "lp_photo_ar_156"
    elif "POLY" in full_str or "POLI" in full_str or "POLY" in m_str or (idx is not None and abs(idx - 1.59) < 0.02):
        return "lp_poly_ar_159"
    elif "INCOLOR 1.50" in full_str or "1.50 INCOLOR" in full_str or "LP INCOLOR" in full_str or (idx is not None and abs(idx - 1.50) < 0.02 and ("INCOLOR" in t_str or not t_str)):
        return "lp_incolor_150"
    elif "LP AR 1.56" in full_str or ("1.56" in full_str and "AR" in full_str) or (idx is not None and abs(idx - 1.56) < 0.02):
        return "lp_ar_156"

    return None

async def sync_system_parameters_to_lens_models(db: AsyncSession, params_dict: Dict[str, str]):
    from backend.app.models.lens import LensModel
    from backend.app.models.financial_catalog import Product, PriceHistory
    from backend.app.crud.degree_policy import get_active_policy

    policy = await get_active_policy(db)
    def_base = params_dict.get("lp_ar_156_price_base") or (str(policy.default_sale_price_le) if policy else "75.00")
    def_over = params_dict.get("lp_ar_156_price_over") or (str(policy.default_sale_price_gt) if policy else "95.00")
    def_thresh = params_dict.get("lp_ar_156_cyl_threshold") or (str(policy.degree_threshold) if policy else "2.00")

    stmt = select(LensModel)
    res = await db.execute(stmt)
    all_models = res.scalars().all()

    for lm in all_models:
        pk = get_preset_key_for_lens(
            brand=lm.brand,
            name=lm.name,
            refractive_index=lm.refractive_index,
            treatment=lm.treatment,
            material=lm.material
        )

        base_val = params_dict.get(f"{pk}_price_base") if pk else None
        over_val = params_dict.get(f"{pk}_price_over") if pk else None
        thresh_val = params_dict.get(f"{pk}_cyl_threshold") if pk else None

        new_sale_price = Decimal(str(base_val)) if base_val else Decimal(str(def_base))
        new_over_price = Decimal(str(over_val)) if over_val else Decimal(str(def_over))
        new_thresh = Decimal(str(thresh_val)) if thresh_val else Decimal(str(def_thresh))

        lm.sale_price = new_sale_price
        lm.sale_price_over_threshold = new_over_price
        lm.degree_threshold = new_thresh
        db.add(lm)

        # Atualiza produto correspondente no catálogo financeiro
        p_stmt = select(Product).where(Product.lens_model_id == lm.id)
        prod = (await db.execute(p_stmt)).scalars().first()
        if prod:
            n_price = float(new_sale_price)
            if prod.sale_price != n_price:
                prod.sale_price = n_price
                prod.current_version = (prod.current_version or 1) + 1
                db.add(prod)

                price_hist = PriceHistory(
                    entity_type="product",
                    entity_id=prod.id,
                    price=n_price,
                    cost_price=prod.cost_price,
                    version=prod.current_version,
                    start_date=datetime.now(timezone.utc),
                    change_reason=f"Atualização de preço via Parâmetros do Sistema ({lm.brand}: Base R$ {n_price:.2f})"
                )
                db.add(price_hist)

    await db.flush()

async def set_multiple_parameters(db: AsyncSession, params_dict: Dict[str, str]) -> Dict[str, str]:
    for key, value in params_dict.items():
        group = DEFAULT_PARAMETERS.get(key, {}).get("group", "GENERAL")
        desc = DEFAULT_PARAMETERS.get(key, {}).get("description", None)
        await set_parameter(db, key, str(value), group=group, description=desc)

    await sync_system_parameters_to_lens_models(db, params_dict)
    await db.commit()
    return await get_all_parameters(db)

