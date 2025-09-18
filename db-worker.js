// db-worker.js

import sqlite3InitModule from 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.46.0-build1/sqlite3.mjs';

let db, sqlite3;

const send = (msg) => postMessage(msg);

self.onmessage = async (e) => {
  const {id, type, payload} = e.data || {};
  try{
    if(type === 'open'){
      // Load SQLite WASM and open OPFS DB
      const base = 'https://unpkg.com/@sqlite.org/sqlite-wasm@3.46.0-build1/';
      sqlite3 = await sqlite3InitModule({ locateFile: f => base + f });
      db = new sqlite3.oo1.OpfsDb('/study-notes/db.sqlite','c'); // 'c' => create if missing
      db.exec('pragma foreign_keys = on;');
      send({id, ok:true});
    }
    else if(type === 'migrate'){
      db.exec(`
        create table if not exists subjects(
          id integer primary key,
          name text unique not null,
          created_at integer default (strftime('%s','now'))
        );
        create table if not exists topics(
          id integer primary key,
          subject_id integer not null references subjects(id) on delete cascade,
          name text not null,
          created_at integer default (strftime('%s','now'))
        );
        create table if not exists chunks(
          id integer primary key,
          topic_id integer not null references topics(id) on delete cascade,
          name text not null,
          created_at integer default (strftime('%s','now'))
        );
        create table if not exists notes(
          id integer primary key,
          scope text not null check(scope in ('topic','chunk')),
          scope_id integer not null,
          kind text not null check(kind in ('image','pdf')),
          title text,
          path text,      -- for images in OPFS
          url text,       -- for PDF links
          created_at integer default (strftime('%s','now'))
        );
        create index if not exists idx_notes_scope on notes(scope, scope_id);
      `);
      send({id, ok:true});
    }
    else if(type === 'exec'){
      if(payload?.bind){
        const stmt = db.prepare(payload.sql);
        try{ stmt.bind(payload.bind); stmt.step(); } finally { stmt.free(); }
      }else{
        db.exec(payload.sql);
      }
      send({id, ok:true});
    }
    else if(type === 'select'){
      const rows = [];
      if(payload?.bind){
        const stmt = db.prepare(payload.sql);
        try{
          stmt.bind(payload.bind);
          while(stmt.step()){
            rows.push(stmt.get({rowMode:'object'}));
          }
        }finally{ stmt.free(); }
      }else{
        db.exec({sql: payload.sql, rowMode:'object', callback: r=>rows.push(r)});
      }
      send({id, ok:true, rows});
    }
  }catch(err){
    send({id, ok:false, error: String(err)});
  }
};
