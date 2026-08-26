import os
import sys
import sqlite3

db_path = "backend/leootica.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, name, email FROM users;")
users = cursor.fetchall()

print("--- Usuários cadastrados no banco ---")
for u in users:
    print(f"ID: {u[0]} | Nome: {u[1]} | Email/Login: {u[2]}")

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("\n--- Verificação do número de linhas por tabela ---")
for tbl in tables:
    tname = tbl[0]
    cursor.execute(f"SELECT COUNT(*) FROM {tname};")
    count = cursor.fetchone()[0]
    if count > 0:
        print(f"   • {tname}: {count} registro(s)")

conn.close()
