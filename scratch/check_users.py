import asyncio
import sys
import os

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.user import User
from backend.app.core.security import verify_password
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print("Usuários cadastrados no banco de dados:")
        for u in users:
            is_valid = verify_password("Dio@sup.2203", u.hashed_password)
            print(f"- ID: {u.id} | Email/Login: '{u.email}' | Nome: '{u.name}' | Senha Válida: {is_valid}")

if __name__ == "__main__":
    asyncio.run(check())
