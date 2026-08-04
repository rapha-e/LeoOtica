import uuid
from typing import List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.user import User, Role
from backend.app.schemas.user import UserCreate, UserUpdate
from backend.app.core.security import get_password_hash

async def get_user(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """
    Busca um usuário pelo seu ID único, trazendo a role e permissões acopladas.
    """
    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.role).selectinload(Role.permissions))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """
    Busca um usuário por e-mail, útil para validar duplicidade.
    """
    query = (
        select(User)
        .where(User.email == email)
        .options(selectinload(User.role).selectinload(Role.permissions))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def get_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None
) -> List[User]:
    """
    Lista todos os usuários com paginação, filtro textual por nome ou e-mail.
    """
    sql_query = select(User).options(selectinload(User.role).selectinload(Role.permissions))
    
    if query:
        search_term = f"%{query}%"
        sql_query = sql_query.where(
            or_(
                User.name.ilike(search_term),
                User.email.ilike(search_term)
            )
        )
        
    sql_query = sql_query.order_by(User.name.asc()).offset(skip).limit(limit)
    result = await db.execute(sql_query)
    return list(result.scalars().all())

async def get_roles(db: AsyncSession) -> List[Role]:
    """
    Lista todas as roles disponíveis no sistema.
    """
    query = select(Role).options(selectinload(Role.permissions))
    result = await db.execute(query)
    return list(result.scalars().all())

async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    """
    Cria um novo usuário na base de dados com a senha criptografada.
    """
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_password,
        role_id=user_in.role_id,
        is_active=user_in.is_active if user_in.is_active is not None else True,
        must_change_password=user_in.must_change_password if user_in.must_change_password is not None else False
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Recarrega a role do usuário após criar
    query = (
        select(User)
        .where(User.id == db_user.id)
        .options(selectinload(User.role).selectinload(Role.permissions))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def update_user(db: AsyncSession, db_user: User, user_in: UserUpdate) -> User:
    """
    Atualiza os dados de um usuário existente, re-criptografando a senha se fornecida.
    """
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Se enviou nova senha, gera o hash e remove o campo plain password do payload
    if "password" in update_data and update_data["password"]:
        db_user.hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        
    for field, val in update_data.items():
        setattr(db_user, field, val)
        
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Recarrega a role
    query = (
        select(User)
        .where(User.id == db_user.id)
        .options(selectinload(User.role).selectinload(Role.permissions))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def delete_user(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """
    Exclui um usuário fisicamente do banco de dados.
    """
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    db_user = result.scalars().first()
    if not db_user:
        return False
        
    await db.delete(db_user)
    await db.commit()
    return True
