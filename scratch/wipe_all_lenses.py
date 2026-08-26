import sqlite3
import os

db_paths = ["backend/leootica.db", "backend/sql_app.db", "backend/app.db", "leootica.db"]

for path in db_paths:
    if os.path.exists(path):
        print(f"[RESET] Limpando banco de dados: {path}")
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        
        target_tables = ["lens_inventory_grade", "lens_models", "block_inventory", "block_models"]
        for tbl in target_tables:
            if tbl in tables:
                cursor.execute(f"DELETE FROM {tbl};")
                print(f"   • Tabela '{tbl}' zerada (0 registros).")
        
        if "system_parameters" in tables:
            cursor.execute("DELETE FROM system_parameters WHERE key LIKE '%matriz%' OR key LIKE '%grade%';")
            print("   • Parametros de sistema de matrizes zerados.")
            
        conn.commit()
        conn.close()

print("[OK] Todos os cadastros de lentes e grades de estoque foram ZERADOS com sucesso!")
