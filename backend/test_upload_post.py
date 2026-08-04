import urllib.request
import urllib.error
import mimetypes

def test_upload():
    url = "http://localhost:8000/api/v1/os/upload-receita"
    filename = "receita_sucesso.jpg"
    file_content = b"fake image bytes"
    
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    # Construção do corpo multipart/form-data
    body = []
    body.append(f"--{boundary}".encode('utf-8'))
    body.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode('utf-8'))
    body.append('Content-Type: image/jpeg'.encode('utf-8'))
    body.append(b'')
    body.append(file_content)
    body.append(f"--{boundary}--".encode('utf-8'))
    body.append(b'')
    
    req_body = b"\r\n".join(body)
    
    req = urllib.request.Request(url, data=req_body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    
    print("Enviando POST /api/v1/os/upload-receita...")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status do Upload: {response.status}")
            print(f"Resposta:\n{response.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(f"Detalhes do erro:\n{e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
