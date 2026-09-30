import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Nova Lab.db')
print(f"Migrando banco em: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

columns_to_add = [
    ('alert_enabled', 'BOOLEAN DEFAULT 1 NOT NULL'),
    ('alert_dismissed', 'BOOLEAN DEFAULT 0 NOT NULL'),
    ('alert_days_before', 'INTEGER DEFAULT 3 NOT NULL'),
    ('dismissed_at', 'DATETIME NULL')
]

cursor.execute('PRAGMA table_info(accounts_payable)')
existing_cols = [c[1] for c in cursor.fetchall()]

for col_name, col_type in columns_to_add:
    if col_name not in existing_cols:
        cursor.execute(f'ALTER TABLE accounts_payable ADD COLUMN {col_name} {col_type}')
        print(f'Coluna adicionada: {col_name}')
    else:
        print(f'Coluna ja existe: {col_name}')

conn.commit()
conn.close()
print("Migracao concluida com sucesso!")
