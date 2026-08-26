import asyncio
import sys
import os
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.models.financial_catalog import Product, PriceHistory

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with async_session() as db:
        prods = (await db.execute(select(Product))).scalars().all()
        seen = {}
        to_delete = []
        
        for p in prods:
            if p.is_lens or p.brand:
                # Normalizar chave
                brand_norm = (p.brand or p.name or '').strip().lower()
                # Se contiver 'novalab cmp' ou 'bip ', remove hashes aleatórios de teste se houver
                treat_norm = (p.treatment or '').strip().lower()
                idx_norm = float(p.refractive_index) if p.refractive_index else 1.56
                mat_norm = (p.material or '').strip().lower()
                
                if 'novalab' in brand_norm:
                    key = ('novalab', treat_norm, idx_norm, mat_norm)
                else:
                    key = (brand_norm, treat_norm, idx_norm, mat_norm)
                    
                if key in seen:
                    to_delete.append(p.id)
                else:
                    seen[key] = p
                    
        for pid in to_delete:
            await db.execute(delete(PriceHistory).where(PriceHistory.entity_id == pid))
            await db.execute(delete(Product).where(Product.id == pid))
            
        await db.commit()
        
        remaining = (await db.execute(select(Product))).scalars().all()
        print(f"Produtos excluídos: {len(to_delete)}. Restantes: {len(remaining)}")

if __name__ == "__main__":
    asyncio.run(main())
