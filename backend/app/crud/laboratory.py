from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.laboratory import Laboratory
from backend.app.schemas.laboratory import LaboratoryUpdate

async def get_laboratory(db: AsyncSession) -> Optional[Laboratory]:
    """
    Retorna o perfil do laboratório cadastrado no sistema.
    Como o sistema possui apenas um laboratório, retorna o primeiro registro.
    """
    query = select(Laboratory)
    result = await db.execute(query)
    return result.scalars().first()

async def update_laboratory(db: AsyncSession, obj_in: LaboratoryUpdate) -> Laboratory:
    """
    Atualiza as informações do laboratório ou cria um novo perfil se não existir.
    """
    db_obj = await get_laboratory(db)
    if not db_obj:
        db_obj = Laboratory(
            name=obj_in.name,
            address=obj_in.address,
            cep=obj_in.cep,
            telephone=obj_in.telephone,
            cnpj=obj_in.cnpj
        )
        db.add(db_obj)
    else:
        db_obj.name = obj_in.name
        db_obj.address = obj_in.address
        db_obj.cep = obj_in.cep
        db_obj.telephone = obj_in.telephone
        db_obj.cnpj = obj_in.cnpj
        db.add(db_obj)
        
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
