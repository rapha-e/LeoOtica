import asyncio
import sys
import os
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.models.financial_catalog import Product, PriceHistory
from backend.app.models.lens import LensModel, LensInventoryGrade

async def deduplicate():
    print("========================================================================")
    print("DEDUPLICANDO MODELOS E PRODUTOS DE LENTES NO BANCO DE DADOS")
    print("========================================================================")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with async_session() as db:
        # 1. Buscar todos os LensModels
        models = (await db.execute(select(LensModel))).scalars().all()
        print(f"Modelos de Lentes antes da deduplicação: {len(models)}")
        
        model_map = {} # key -> primary LensModel
        duplicates_model_ids = set()
        
        for m in models:
            key = (
                (m.brand or '').strip().lower(),
                (m.material or '').strip().lower(),
                float(m.refractive_index) if m.refractive_index else 1.56,
                (m.treatment or '').strip().lower(),
                (m.matrix_type or 'LP_GRADE').strip().upper()
            )
            if key not in model_map:
                model_map[key] = m
            else:
                # É duplicado
                primary = model_map[key]
                duplicates_model_ids.add(m.id)
                
                # Re-vincular itens de estoque da grade para o modelo primário
                grades = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == m.id))).scalars().all()
                for g in grades:
                    g.lens_model_id = primary.id
                    db.add(g)
                    
                # Excluir o modelo duplicado
                await db.delete(m)
                
        await db.flush()
        print(f"  [OK] Modelos de lentes duplicados removidos: {len(duplicates_model_ids)}")

        # 2. Buscar todos os Produtos do catálogo financeiro
        products = (await db.execute(select(Product))).scalars().all()
        print(f"Produtos no Catálogo Financeiro antes da deduplicação: {len(products)}")
        
        prod_map = {} # key -> primary Product
        removed_products_count = 0
        
        for p in products:
            if not p.is_lens and not p.brand:
                # Não é produto de lente, mantêm
                continue
                
            key = (
                (p.brand or p.name or '').strip().lower(),
                (p.material or '').strip().lower(),
                float(p.refractive_index) if p.refractive_index else 1.56,
                (p.treatment or '').strip().lower()
            )
            
            if key not in prod_map:
                prod_map[key] = p
                # Ajusta SKU do produto se o modelo tiver barcode ou se SKU for genérico demais
                if p.lens_model_id:
                    m_query = select(LensModel).where(LensModel.id == p.lens_model_id)
                    m_res = await db.execute(m_query)
                    lm = m_res.scalar_one_or_none()
                    if lm and lm.code and not p.sku.startswith('INT-') and not p.sku.isdigit():
                        p.sku = lm.code
                        db.add(p)
            else:
                primary = prod_map[key]
                # Remove o produto duplicado e seu histórico de preços
                await db.execute(delete(PriceHistory).where(PriceHistory.entity_id == p.id))
                await db.delete(p)
                removed_products_count += 1

        await db.commit()
        
        final_models = (await db.execute(select(LensModel))).scalars().all()
        final_products = (await db.execute(select(Product))).scalars().all()
        
        print("\n========================================================================")
        print("DEDUPLICAÇÃO CONCLUÍDA COM SUCESSO!")
        print(f"Modelos de Lente Finais: {len(final_models)}")
        print(f"Produtos Finais no Catálogo: {len(final_products)} (Removidos: {removed_products_count})")
        print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(deduplicate())
