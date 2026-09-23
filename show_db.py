import sqlite3

conn = sqlite3.connect('backend/researchpilot.db')

print("=" * 60)
print("DATABASE: researchpilot.db")
print("=" * 60)

# Tables
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("\nTABLES:")
for t in tables:
    print(f"  - {t[0]}")

# Schema
print("\nSCHEMA (papers table):")
for col in conn.execute("PRAGMA table_info(papers)").fetchall():
    print(f"  {col[1]:20s} {col[2]}")

# Papers
rows = conn.execute("SELECT id, title, owner_email, sentence_count, created_at FROM papers").fetchall()
print(f"\nPAPERS ({len(rows)} total):")
print("-" * 60)
for r in rows:
    print(f"  ID      : {r[0]}")
    print(f"  Title   : {r[1]}")
    print(f"  Owner   : {r[2]}")
    print(f"  Sentences: {r[3]}")
    print(f"  Created : {r[4]}")
    print()

conn.close()
print("=" * 60)
