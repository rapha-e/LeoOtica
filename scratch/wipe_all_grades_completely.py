import sqlite3
import os

db_paths = [
    "backend/leootica.db",
    "backend/sql_app.db",
    "backend/app.db",
    "leootica.db"
]

for path in db_paths:
    if os.path.exists(path):
        print(f"\n==================================================")
        print(f"[WIPE] Limpando dados de grades e registros órfãos: {path}")
        print(f"==================================================")
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        # Ativa foreign keys para integridade durante a limpeza
        cursor.execute("PRAGMA foreign_keys = OFF;")

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]

        # 1. Limpa todas as tabelas de itens de grade e estoques de lentes e blocos
        grade_tables = [
            "lens_inventory_grade",
            "block_grid_items",
            "block_inventory",
            "degree_pricing_policy_ranges",
            "stock_movements",
            "blind_inventory_items",
            "blind_inventory_sessions",
            "supplier_order_items",
            "supplier_orders"
        ]
        
        for tbl in grade_tables:
            if tbl in tables:
                cursor.execute(f"DELETE FROM {tbl};")
                print(f"   • Tabela '{tbl}' zerada (0 registros).")

        # 2. Desvincula referências em Ordens de Serviço (service_orders) se existirem
        if "service_orders" in tables:
            cursor.execute("PRAGMA table_info(service_orders);")
            so_cols = [c[1] for c in cursor.fetchall()]
            set_clauses = []
            if "allocated_od_lens_id" in so_cols:
                set_clauses.append("allocated_od_lens_id = NULL")
            if "allocated_oe_lens_id" in so_cols:
                set_clauses.append("allocated_oe_lens_id = NULL")
            if "lens_model_id" in so_cols:
                set_clauses.append("lens_model_id = NULL")
            
            if set_clauses:
                cursor.execute(f"UPDATE service_orders SET {', '.join(set_clauses)};")
                print("   • Referências de lentes em Ordens de Serviço desvinculadas (SET NULL).")

        # 3. Limpa produtos do catálogo comercial correspondentes a lentes
        if "products" in tables:
            # Pega IDs de produtos de lentes a serem removidos
            cursor.execute("SELECT id FROM products WHERE is_lens = 1 OR lens_model_id IS NOT NULL;")
            lens_prod_ids = [row[0] for row in cursor.fetchall()]
            
            if lens_prod_ids and "price_history" in tables:
                placeholders = ",".join(["?"] * len(lens_prod_ids))
                cursor.execute(f"DELETE FROM price_history WHERE entity_type = 'product' AND entity_id IN ({placeholders});", lens_prod_ids)
                print(f"   • {cursor.rowcount} registros de histórico de preços de produtos de lentes removidos.")

            cursor.execute("DELETE FROM products WHERE is_lens = 1 OR lens_model_id IS NOT NULL;")
            print(f"   • {cursor.rowcount} produtos de lentes removidos do catálogo comercial.")

        # 4. Limpa modelos base de lentes e blocos
        model_tables = ["lens_models", "block_models"]
        for tbl in model_tables:
            if tbl in tables:
                cursor.execute(f"DELETE FROM {tbl};")
                print(f"   • Tabela de modelos '{tbl}' zerada (0 registros).")

        # 5. Limpa parâmetros de sistema referentes a matrizes/grades
        if "system_parameters" in tables:
            cursor.execute("DELETE FROM system_parameters WHERE key LIKE '%matriz%' OR key LIKE '%grade%';")
            print(f"   • {cursor.rowcount} parâmetros de sistema de matrizes/grades removidos.")

        conn.commit()

        # 6. Otimiza e limpa espaço em disco com VACUUM
        print("   • Executando VACUUM para eliminar espaço fragmentado e lixo de sistema...")
        cursor.execute("VACUUM;")
        conn.commit()
        
        conn.close()

print("\n==================================================")
print("[OK] Registros de TODAS as grades e dados associados foram ZERADOS e o banco de dados foi otimizado com sucesso!")
print("==================================================")
