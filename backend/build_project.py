import os
import sys
import subprocess
import shutil

def run_command(command, cwd=None):
    print(f"\n>> Executando: {command}")
    print(f">> Diretorio: {cwd or os.getcwd()}")
    res = subprocess.run(command, shell=True, cwd=cwd)
    if res.returncode != 0:
        print(f">> Erro (codigo de retorno: {res.returncode}) ao executar: {command}")
        sys.exit(res.returncode)

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_dir)
    frontend_dir = os.path.join(project_root, "frontend")
    
    print("=======================================================")
    print("   Iniciando Compilacao do Projeto Nova Lab V 2.0 (.exe)  ")
    print("=======================================================")
    
    print("\n--- Etapa 1: Compilando o Frontend React ---")
    if not os.path.exists(frontend_dir):
        print(f"Erro catastrófico: Pasta do frontend não encontrada em {frontend_dir}")
        sys.exit(1)
        
    # Garante a instalação de pacotes e build de produção do frontend
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    run_command(f"{npm_cmd} run build", cwd=frontend_dir)
    
    print("\n--- Etapa 2: Configurando dependencias do Backend ---")
    # Tenta usar o python.exe do ambiente virtual local (.venv312 ou .venv)
    venv_python = os.path.join(backend_dir, ".venv312", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
    if os.path.exists(venv_python):
        print(f"Ambiente virtual encontrado em: {venv_python}")
    else:
        print("Ambiente virtual nao encontrado localmente. Usando o python global.")
        venv_python = sys.executable
        
    # Garante que PyInstaller esteja instalado
    run_command(f'"{venv_python}" -m pip install pyinstaller', cwd=backend_dir)
    
    print("\n--- Etapa 3: Executando o PyInstaller ---")
    # Limpa compilações anteriores para evitar cache corrompido
    for folder in ["build", "dist"]:
        path = os.path.join(backend_dir, folder)
        if os.path.exists(path):
            print(f"Limpando pasta anterior: {path}")
            shutil.rmtree(path, ignore_errors=True)
            
    # Executa o PyInstaller para gerar "Nova Lab V 2.0.exe"
    pyinstaller_cmd = (
        f'"{venv_python}" -m PyInstaller '
        f'--onefile '
        f'--name "Nova Lab V 2.0" '
        f'--paths ".." '
        f'--add-data "../frontend/dist;dist" '
        f'--collect-all uvicorn '
        f'--collect-all fastapi '
        f'--collect-all reportlab '
        f'--hidden-import aiosqlite '
        f'--hidden-import bcrypt '
        f'--hidden-import email_validator '
        f'run.py'
    )
    
    run_command(pyinstaller_cmd, cwd=backend_dir)
    
    # Copia o banco de dados para a pasta dist
    db_source = os.path.join(backend_dir, "leootica.db")
    db_dest = os.path.join(backend_dir, "dist", "leootica.db")
    if os.path.exists(db_source):
        print(f"Copiando banco de dados para: {db_dest}")
        shutil.copy2(db_source, db_dest)
            
    executable_path = os.path.join(backend_dir, "dist", "Nova Lab V 2.0.exe")
    if os.path.exists(executable_path):
        print("\n=======================================================")
        print("   Compilação Concluída com Sucesso!")
        print(f"Executável gerado em: {executable_path}")
        print("=======================================================")

    else:
        print("\n=======================================================")
        print("   Erro: O executavel nao foi encontrado na pasta dist.")
        print("=======================================================")
        sys.exit(1)

if __name__ == "__main__":
    main()
