# gsdshifts-2x2 — Projeto Final (CC50)

## Estrutura do projeto
```
gsdshifts_2x2_project/
├─ index.html
├─ static/
│  ├─ style.css
│  └─ script.js
├─ app.py
├─ application.py
├─ helpers.py
├─ tabela.bd
├─ requirements.txt
└─ README.md
```

## Como rodar (local)
1. Crie um ambiente virtual Python (recomendado).
```bash
python -m venv venv
source venv/bin/activate  # linux / mac
venv\Scripts\activate     # windows
```

2. Instale dependências:
```bash
pip install -r requirements.txt
```

3. Inicialize (o banco será criado automaticamente se não existir) e rode:
```bash
python app.py
```

4. Acesse `http://localhost:5000` no navegador.

## entregue
- Frontend profissional, separado em `index.html`, `static/style.css` e `static/script.js`.
- Backend Flask com API REST mínima para `employees` e `holidays`.
- Exporte CSV via endpoint `/api/export/csv`.
- Banco SQLite `tabela.bd` com dados de exemplo.
- Arquivos `app.py`, `application.py` (WSGI) e `helpers.py`.(obs: WSGI (Web Server Gateway Interface) é uma especificação padrão para a comunicação entre servidores web (como Apache, Nginx) e aplicações/frameworks web Python (como Django, Flask), atuando como um mediador para padronizar a troca de requisições HTTP e respostas, permitindo que diferentes componentes funcionem juntos sem precisar de código específico para cada um)
- `requirements.txt` com pacotes solicitados.

## Exportar PDF
O botão **"📄 Exportar PDF"** captura automaticamente a tabela mensal visível em tela e gera um PDF em formato A4 horizontal.
O recurso utiliza:
- `html2canvas` para capturar o DOM como imagem
- `jsPDF` para montar o PDF final

O PDF gerado é salvo automaticamente com o nome:
## Observações e próximos passos recomendados
- Remover `debug=True` em produção e configurar SECRET_KEY seguro.
- Integrar autenticação (Flask-Login or token-based) se for necessário.
- Configurar deploy (gunicorn + nginx) usando `application:application` como entrypoint.
- Possível integração com Firebase / SharePoint / Power Automate via endpoints (se necessário).

