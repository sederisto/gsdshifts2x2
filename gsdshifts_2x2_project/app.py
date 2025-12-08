# app.py - Flask backend for GsdShifts-2x2 (CC50 final project)
from flask import Flask, send_from_directory, jsonify, request, g, make_response, send_file
from flask_session import Session
import sqlite3, os, csv, io
from helpers import get_db, close_db, init_db

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_key')
Session(app)

DATABASE = os.path.join(os.path.dirname(__file__), 'tabela.bd')

@app.teardown_appcontext
def teardown_db(exception):
    close_db()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Static files served automatically by Flask from /static

# --- API: Employees ---
@app.route('/api/employees', methods=['GET','POST'])
def employees_route():
    db = get_db()
    if request.method == 'GET':
        cur = db.execute('SELECT id, name, type, customTime, start, weeklyOff FROM employees ORDER BY name')
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                'id': r['id'],
                'name': r['name'],
                'type': r['type'],
                'customTime': r['customTime'],
                'start': r['start'],
                'weeklyOff': json_list_to_py(r['weeklyOff'])
            })
        return jsonify(result)
    else:
        data = request.get_json()
        weeklyOff = py_to_json_list(data.get('weeklyOff', []))
        cur = db.execute('INSERT INTO employees (name,type,customTime,start,weeklyOff) VALUES (?,?,?,?,?)',
                         (data.get('name'), data.get('type'), data.get('customTime'), data.get('start'), weeklyOff))
        db.commit()
        return jsonify({'id': cur.lastrowid}), 201

@app.route('/api/employees/<int:eid>', methods=['PUT','DELETE'])
def employee_modify(eid):
    db = get_db()
    if request.method == 'DELETE':
        db.execute('DELETE FROM employees WHERE id=?', (eid,))
        db.commit()
        return '', 204
    else:
        data = request.get_json()
        weeklyOff = py_to_json_list(data.get('weeklyOff', []))
        db.execute('UPDATE employees SET name=?, type=?, customTime=?, start=?, weeklyOff=? WHERE id=?',
                   (data.get('name'), data.get('type'), data.get('customTime'), data.get('start'), weeklyOff, eid))
        db.commit()
        return '', 204

# --- API: Holidays ---
@app.route('/api/holidays', methods=['GET','POST'])
def holidays_route():
    db = get_db()
    if request.method == 'GET':
        cur = db.execute('SELECT id, date, name FROM holidays ORDER BY date')
        rows = cur.fetchall()
        return jsonify([{'id':r['id'],'date':r['date'],'name':r['name']} for r in rows])
    else:
        data = request.get_json()
        cur = db.execute('INSERT INTO holidays (date,name) VALUES (?,?)', (data.get('date'), data.get('name')))
        db.commit()
        return jsonify({'id': cur.lastrowid}), 201

@app.route('/api/holidays/<int:hid>', methods=['DELETE'])
def holiday_delete(hid):
    db = get_db()
    db.execute('DELETE FROM holidays WHERE id=?', (hid,))
    db.commit()
    return '', 204

# --- Export CSV ---
@app.route('/api/export/csv')
def export_csv():
    year = int(request.args.get('year', 0))
    month = int(request.args.get('month', 0)) - 1
    if year<=0 or month<0:
        return 'Parâmetros inválidos', 400
    # build CSV in memory
    db = get_db()
    cur = db.execute('SELECT id, name, type, customTime, start, weeklyOff FROM employees ORDER BY name')
    emps = cur.fetchall()
    # compute schedule
    from datetime import datetime, date, timedelta
    def days_in_month(y,m): return (date(y, m+1, 1) - timedelta(days=1)).day if m<12 else 31
    days = daysInMonth = __import__('calendar').monthrange(year, month+1)[1]
    out = io.StringIO()
    writer = csv.writer(out)
    headers = ['Funcionário'] + [str(d) for d in range(1, days+1)]
    writer.writerow(headers)
    # load holidays
    cur = db.execute('SELECT date, name FROM holidays')
    hols = {r['date']: r['name'] for r in cur.fetchall()}
    import json as _json
    for e in emps:
        row = [e['name']]
        emp = {
            'id': e['id'],
            'name': e['name'],
            'type': e['type'],
            'customTime': e['customTime'],
            'start': e['start'],
            'weeklyOff': _json.loads(e['weeklyOff'] or '[]')
        }
        for d in range(1, days+1):
            dt = date(year, month+1, d)
            is_hol = hols.get(dt.isoformat())
            working = True
            if emp['type'].endswith('2x2'):
                start = parse_iso(emp['start']) if emp['start'] else date(year, month+1, 1)
                diff = (dt - start).days
                idx = ((diff % 4) + 4) % 4
                working = idx in (0,1)
            else:
                if dt.weekday() in emp['weeklyOff']:
                    working = False
            if is_hol:
                row.append(f'Feriado: {is_hol}')
            else:
                row.append(f'Trab. (T{emp["type"].split("-")[0]})' if working else 'Folga')
        writer.writerow(row)
    output = make_response(out.getvalue())
    output.headers["Content-Type"] = "text/csv; charset=utf-8"
    output.headers["Content-Disposition"] = f"attachment; filename=escala_{year}_{month+1}.csv"
    return output

# --- Utilities ---
def parse_iso(s):
    from datetime import datetime, date
    if not s: return date.today()
    try:
        return datetime.strptime(s, '%Y-%m-%d').date()
    except:
        return date.today()

def py_to_json_list(p):
    import json
    return json.dumps(p)

def json_list_to_py(s):
    import json
    try:
        return json.loads(s or '[]')
    except:
        return []

if __name__ == '__main__':
    # ensure DB exists and initialized
    init_db(DATABASE)
    app.run(debug=True, host='0.0.0.0', port=5000)
