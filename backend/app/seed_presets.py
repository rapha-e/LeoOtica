import asyncio
from decimal import Decimal
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, DegreePricingPolicyRange
from backend.app.core.presets import PRESET_PRODUCTS

async def seed_preset_products():
    async with AsyncSessionLocal() as db:
        print("[Seed Presets] Iniciando população de produtos e presets no banco de dados...")
        created_count = 0

        for matrix_type, products in PRESET_PRODUCTS.items():
            for prod in products:
                # Verifica se o modelo já existe pelo nome ou combinação marca/tratamento
                stmt = select(LensModel).where(
                    LensModel.brand == prod["name"],
                    LensModel.matrix_type == matrix_type
                )
                res = await db.execute(stmt)
                existing = res.scalars().first()

                if not existing:
                    new_model = LensModel(
                        code=f"PRST-{prod['name'].replace(' ', '-').upper()}",
                        name=prod["name"],
                        brand=prod["name"],
                        material=prod["material"],
                        refractive_index=Decimal(str(prod["index"])),
                        treatment=prod["treatment"],
                        diameter=70,
                        matrix_type=matrix_type,
                        production_route=prod["route"],
                        cost_price=Decimal("25.00"),
                        sale_price=Decimal("75.00"),
                        degree_threshold=Decimal("2.00"),
                        sale_price_over_threshold=Decimal("95.00")
                    )
                    db.add(new_model)
                    await db.flush()

                    # Cria políticas padrão por faixa de grau para LP_GRADE
                    if matrix_type == "LP_GRADE":
                        policy_standard = DegreePricingPolicyRange(
                            lens_model_id=new_model.id,
                            min_spherical=Decimal("-4.00"),
                            max_spherical=Decimal("4.00"),
                            min_cylindrical=Decimal("-2.00"),
                            max_cylindrical=Decimal("0.00"),
                            price=Decimal("75.00")
                        )
                        policy_high = DegreePricingPolicyRange(
                            lens_model_id=new_model.id,
                            min_spherical=Decimal("-12.00"),
                            max_spherical=Decimal("12.00"),
                            min_cylindrical=Decimal("-4.00"),
                            max_cylindrical=Decimal("0.00"),
                            price=Decimal("95.00")
                        )
                        db.add(policy_standard)
                        db.add(policy_high)

                    created_count += 1

        await db.commit()
        print(f"[Seed Presets] Sucesso! {created_count} modelos de presets criados/verificados.")

if __name__ == "__main__":
    asyncio.run(seed_preset_products())
