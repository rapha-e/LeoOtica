import os
import shutil
from datetime import datetime
from typing import List, Dict

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", "backups")
if not os.path.exists(os.path.dirname(BACKUP_DIR)):
    BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backups")

def get_db_path():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    candidates = [
        os.path.join(base_dir, "backend", "leootica.db"),
        os.path.join(base_dir, "leootica.db"),
        os.path.join(base_dir, "backend", "novalab.db"),
        os.path.join(base_dir, "novalab.db"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]


def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)

def create_backup() -> Dict:
    """
    Cria uma cópia física em disco do arquivo SQLite com timestamp.
    Retorna metadados do backup gerado.
    """
    ensure_backup_dir()
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Arquivo de banco de dados não encontrado em {db_path}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_novalab_{timestamp}.db"
    destination_path = os.path.join(BACKUP_DIR, filename)

    shutil.copy2(db_path, destination_path)
    file_size_bytes = os.path.getsize(destination_path)


    # Limpa backups antigos se excederem 15 cópias de retenção
    clean_old_backups(max_keep=15)

    return {
        "filename": filename,
        "filepath": destination_path,
        "size_bytes": file_size_bytes,
        "size_mb": round(file_size_bytes / (1024 * 1024), 2),
        "created_at": datetime.now().isoformat(),
        "status": "SUCESSO"
    }

def list_backups() -> List[Dict]:
    """
    Retorna a lista de todos os backups salvos em disco ordenados do mais recente para o mais antigo.
    """
    ensure_backup_dir()
    backups = []

    for filename in os.listdir(BACKUP_DIR):
        if filename.startswith("backup_novalab_") and filename.endswith(".db"):
            filepath = os.path.join(BACKUP_DIR, filename)
            stat = os.stat(filepath)
            backups.append({
                "filename": filename,
                "filepath": filepath,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })

    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups

def restore_backup(filename: str) -> Dict:
    """
    Restaura o banco de dados a partir de um arquivo de backup específico.
    """
    ensure_backup_dir()
    target_backup_path = os.path.join(BACKUP_DIR, filename)

    if not os.path.exists(target_backup_path):
        raise FileNotFoundError(f"Backup {filename} não encontrado.")

    db_path = get_db_path()
    temp_safety_path = f"{db_path}.before_restore"
    if os.path.exists(db_path):
        shutil.copy2(db_path, temp_safety_path)

    shutil.copy2(target_backup_path, db_path)


    return {
        "message": f"Banco de dados restaurado com sucesso a partir de {filename}.",
        "restored_file": filename,
        "restored_at": datetime.now().isoformat()
    }

def clean_old_backups(max_keep: int = 15):
    """
    Remove arquivos de backup antigos excedentes mantendo apenas os max_keep mais recentes.
    """
    backups = list_backups()
    if len(backups) > max_keep:
        to_delete = backups[max_keep:]
        for item in to_delete:
            try:
                os.remove(item["filepath"])
            except Exception:
                pass
