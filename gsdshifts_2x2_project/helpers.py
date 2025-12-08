# helpers.py - database helpers (SQLite)
import sqlite3
import os
from flask import g

def get_db(db_path=None):
    if getattr(g, '_database', None) is None:
        path = db_path or os.path.join(os.path.dirname(__file__), 'tabela.bd')
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        g._database = conn
    return g._database

def close_db(e=None):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()
        g._database = None

def init_db(db_path=None):
    path = db_path or os.path.join(os.path.dirname(__file__), 'tabela.bd')
    need_create = not os.path.exists(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if need_create:
        cur.execute('''
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                customTime TEXT,
                start TEXT,
                weeklyOff TEXT
            );
        ''')
        cur.execute('''
            CREATE TABLE holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                name TEXT NOT NULL
            );
        ''')
        # sample data
        import json
        cur.execute('INSERT INTO employees (name,type,customTime,start,weeklyOff) VALUES (?,?,?,?,?)',
                    ('Maria','1-2x2','06:00–17:00','2025-08-01', json.dumps([])))
        cur.execute('INSERT INTO employees (name,type,customTime,start,weeklyOff) VALUES (?,?,?,?,?)',
                    ('João','2-fixo','16:00–00:58','2025-08-01', json.dumps([0,6])))
        cur.execute('INSERT INTO employees (name,type,customTime,start,weeklyOff) VALUES (?,?,?,?,?)',
                    ('Ana','3-2x2','20:20–06:00','2025-08-05', json.dumps([])))
        cur.execute('INSERT INTO holidays (date,name) VALUES (?,?)',
                    ('2025-01-01','Ano Novo'))
        cur.execute('INSERT INTO holidays (date,name) VALUES (?,?)',
                    ('2025-04-21','Exemplo: Tiradentes'))
        conn.commit()
    conn.close()
