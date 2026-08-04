import os
from datetime import datetime, timedelta
from typing import Optional, Any
import jwt
import bcrypt

# Configurações de segurança — SECRET_KEY DEVE ser definida via variável de ambiente.
# Em produção, nunca use o valor padrão. Gere com: python -c "import secrets; print(secrets.token_hex(32))"
_secret_key = os.getenv("SECRET_KEY", "novalab-enterprise-secret-key-2026-secure-static")
SECRET_KEY = _secret_key

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "360"))  # 6 horas padrão

def get_password_hash(password: str) -> str:
    """
    Gera o hash da senha usando bcrypt.
    """
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha em texto plano bate com o hash salvo.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def create_access_token(subject: Any, expires_delta: Optional[timedelta] = None) -> str:
    """
    Gera um token JWT com o subject (geralmente o ID ou email do usuário).
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodifica o token JWT e valida a assinatura.
    Retorna o payload se for válido, ou None caso contrário.
    """
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Verifica se o token expirou
        if decoded_token["exp"] < datetime.utcnow().timestamp():
            return None
        return decoded_token
    except jwt.PyJWTError:
        return None
