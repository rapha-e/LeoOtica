import sys
import os
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import json
from sqlalchemy import select, update
from backend.app.core.database import AsyncSessionLocal, engine
from backend.app.models.system_parameter import SystemParameter
from backend.app.models.lens import LensModel, LensInventoryGrade

ZERO_MATRIX = {
  "0": { "incolor": 0, "ar": 0, "filtro_azul_ar": 0, "photo_ar": 0, "photo_filtro_azul_ar": 0, "lens_167_ar": 0, "lens_167_fa": 0 },
  "2": { "incolor": 0, "ar": 0, "filtro_azul_ar": 0, "photo_ar": 0, "photo_filtro_azul_ar": 0, "lens_167_ar": 0, "lens_167_fa": 0 },
  "4": { "incolor": 0, "ar": 0, "filtro_azul_ar": 0, "photo_ar": 0, "photo_filtro_azul_ar": 0, "lens_167_ar": 0, "lens_167_fa": 0 },
  "6": { "incolor": 0, "ar": 0, "filtro_azul_ar": 0, "photo_ar": 0, "photo_filtro_azul_ar": 0, "lens_167_ar": 0, "lens_167_fa": 0 }
}

async def zero_bloco_vs():
    async with AsyncSessionLocal() as db:
        print("[Zero Bloco VS] Zerando parâmetros da matriz Bloco Visão Simples no banco de dados...")
        
        # 1. Atualiza o parâmetro matriz_visao_simples no banco
        stmt_param = select(SystemParameter).where(SystemParameter.key == "matriz_visao_simples")
        param = (await db.execute(stmt_param)).scalar_one_or_none()
        
        if param:
            param.value = json.dumps(ZERO_MATRIX)
        else:
            param = SystemParameter(
                key="matriz_visao_simples",
                value=json.dumps(ZERO_MATRIX),
                group="INVENTORY",
                description="Matriz de estoque zera de Bloco Visão Simples"
            )
            db.add(param)

        # 2. Busca modelos da matriz BLOCO_VS e zera os saldos de estoque em lens_inventory_grade
        stmt_models = select(LensModel.id).where(LensModel.matrix_type == "BLOCO_VS")
        res_models = await db.execute(stmt_models)
        model_ids = res_models.scalars().all()

        if model_ids:
            stmt_update = (
                update(LensInventoryGrade)
                .where(LensInventoryGrade.lens_model_id.in_(model_ids))
                .values(quantity_available=0, reserved_quantity=0)
            )
            await db.execute(stmt_update)

        await db.commit()
        print("[Zero Bloco VS] Sucesso! Todos os registros da grade Bloco Visão Simples foram zerados.")

if __name__ == "__main__":
    asyncio.run(zero_bloco_vs())
