#!/usr/bin/env python3
"""Extract historical CBO family training fields without running Java or SQL.

The public CBO offline installer embeds an HSQLDB text database. This script
reads only its family records and preserves their factual training descriptions
for local analysis; downstream UI should show short factual summaries.

Run: python scripts/fetch_training.py
Rebuild the same snapshot: python scripts/fetch_training.py --offline
Compare ten families with the 2010 books:
  python -m pip install pypdf==6.20.0
  python scripts/fetch_training.py --offline --verify-books

The 2014 date is the database file's save date, not an individual update date
or evidence that its descriptions are current professional requirements.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import unicodedata
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SOURCE_URL = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/cboconsultas-instalador.jar"
SOURCE_PATH = RAW / "cbo-training-source.jar"
OUTPUT_PATH = RAW / "cbo-training.json"
BOOK_URLS = {
    1: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/livro-1-portal-cbo.pdf",
    2: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/cbo2002_liv2.pdf",
}
SAMPLE_CODES = ("2124", "2235", "2515", "2331", "3171", "3222", "4110", "5132", "7152", "6131")
SQL_TOKEN = re.compile(r"\s*(?:'((?:''|[^'])*)'|(NULL|TRUE|FALSE|-?\d+))\s*(,|$)", re.S)


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "MapaCarreiras/1.0 (public-data-import)"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def block_file(payload: bytes, name: str) -> bytes:
    """Read Java serialization block-data bytes, not serialized objects/code."""
    marker = f"$INSTALL_PATH/bd/{name}".encode()
    position = payload.find(marker)
    if position < 0:
        raise ValueError(f"Official installer no longer contains {name}")
    position += len(marker)
    chunks = []
    while position < len(payload):
        tag = payload[position]
        if tag == 0x7A:  # TC_BLOCKDATALONG
            length = struct.unpack(">I", payload[position + 1:position + 5])[0]
            position += 5
        elif tag == 0x77:  # TC_BLOCKDATA
            length = payload[position + 1]
            position += 2
        else:
            break
        if length > 1024 * 1024 or position + length > len(payload):
            raise ValueError("Invalid block-data boundary")
        chunks.append(payload[position:position + length])
        position += length
    if not chunks:
        raise ValueError(f"No block data found for {name}")
    return b"".join(chunks)


def sql_values(source: str) -> list:
    values = []
    position = 0
    while position < len(source):
        match = SQL_TOKEN.match(source, position)
        if not match:
            raise ValueError(f"Unsupported SQL literal at byte {position}; no SQL was executed")
        text, scalar, delimiter = match.groups()
        if text is not None:
            text = text.replace("''", "'")
            text = re.sub(r"\\u([a-fA-F0-9]{4})", lambda m: chr(int(m[1], 16)), text)
            values.append(text)
        elif scalar == "NULL":
            values.append(None)
        elif scalar in ("TRUE", "FALSE"):
            values.append(scalar == "TRUE")
        else:
            values.append(int(scalar))
        position = match.end()
        if not delimiter and position != len(source):
            raise ValueError("Unexpected SQL suffix")
    return values


def extract(jar_bytes: bytes) -> tuple[list[dict], dict]:
    with zipfile.ZipFile(io.BytesIO(jar_bytes)) as archive:
        payload = archive.read("packs/pack-Principal")
    properties = block_file(payload, "CBO.properties").decode("utf-8")
    snapshot_comment = next(line[1:] for line in properties.splitlines() if re.match(r"^#\w{3} \w{3} \d", line))
    snapshot_date = datetime.strptime(snapshot_comment, "%a %b %d %H:%M:%S GMT%z %Y").date().isoformat()
    script = block_file(payload, "CBO.script").decode("utf-8")
    if not script.startswith('SET DATABASE COLLATION "Portuguese"'):
        raise ValueError("Unexpected database format")
    prefix = "INSERT INTO FAMILIAS_OCUPACIONAIS VALUES("
    families = []
    for line in script.splitlines():
        if not line.startswith(prefix):
            continue
        if not line.endswith(")"):
            raise ValueError("Incomplete family INSERT")
        values = sql_values(line[len(prefix):-1])
        if len(values) != 21:
            raise ValueError("Family schema changed; inspect before reimporting")
        code, text = values[1], values[7]
        if not isinstance(code, str) or not re.fullmatch(r"\d{4}", code):
            raise ValueError(f"Invalid family code: {code}")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"Missing training description: {code}")
        families.append({
            "code": code,
            "title": values[15],
            "text": text,
            "source_url": SOURCE_URL,
            "source_kind": "cbo_offline_database",
            "source_field": "FAMILIAS_OCUPACIONAIS.TE_FORMACAO_EXPER",
            "source_snapshot_date": snapshot_date,
            "source_snapshot_year": int(snapshot_date[:4]),
            "individual_updated_at": values[4],
            "source_status": values[9],
            "edition_year": None,
            "page": None,
        })
    if len({family["code"] for family in families}) != len(families) or len(families) < 500:
        raise ValueError("Duplicate or incomplete family extraction")
    families.sort(key=lambda family: family["code"])
    return families, {
        "database_properties_timestamp": snapshot_comment,
        "source_snapshot_date": snapshot_date,
        "source_snapshot_year": int(snapshot_date[:4]),
        "family_count": len(families),
        "family_status_counts": dict(Counter(family["source_status"] for family in families)),
        "individual_update_dates_present": sum(family["individual_updated_at"] is not None for family in families),
        "family_records_sha256": hashlib.sha256("\n".join(line for line in script.splitlines() if line.startswith(prefix)).encode()).hexdigest(),
    }


def normalize_for_comparison(value: str) -> str:
    # Dehyphenate PDF line wraps, ignore typography/case and the long s glyph.
    value = re.sub(r"-\s*\n\s*", "", value)
    value = "".join(char for char in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]", "", value)


def verify_books(families: list[dict], offline: bool) -> dict:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise SystemExit("Book comparison requires: python -m pip install pypdf") from exc
    import difflib
    wanted = set(SAMPLE_CODES)
    results = []
    books = []
    by_code = {family["code"]: family for family in families}
    heading = re.compile(r"forma[çc][ãa]o\s+e\s+experi[êe]ncia", re.I)
    stop_heading = re.compile(r"condi[çc][õo]es\s+gerais|c[óo]digo\s+internacional|recursos\s+de\s+trabalho|\bnotas\b", re.I)
    for number, url in BOOK_URLS.items():
        path = RAW / f"cbo-training-livro-{number}.pdf"
        if path.exists():
            pdf_bytes = path.read_bytes()
        elif not offline:
            pdf_bytes = download(url)
            path.write_bytes(pdf_bytes)
        else:
            raise FileNotFoundError(f"No offline book snapshot: {path}; run once without --offline")
        reader = PdfReader(io.BytesIO(pdf_bytes))
        books.append({"book": number, "source_url": url, "edition_year": 2010, "pages": len(reader.pages), "sha256": hashlib.sha256(pdf_bytes).hexdigest()})
        current_code = None
        current_text = []
        start_page = None

        def finish() -> None:
            nonlocal current_code, current_text, start_page
            if current_code not in wanted or not current_text:
                return
            joined = "\n".join(current_text)
            section = heading.search(joined)
            if not section:
                return
            remainder = joined[section.end():]
            end = stop_heading.search(remainder)
            if not end:
                return
            training = remainder[:end.start()].strip()
            # Remove standalone printed folio numbers, which otherwise appear
            # when a paragraph continues across two pages.
            training = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", training).strip()
            normalized_book = normalize_for_comparison(training)
            normalized_db = normalize_for_comparison(by_code[current_code]["text"])
            ratio = difflib.SequenceMatcher(None, normalized_book, normalized_db, autojunk=False).ratio()
            results.append({
                "code": current_code,
                "title": by_code[current_code]["title"],
                "book": number,
                "source_url": url,
                "page": start_page,
                "edition_year": 2010,
                "normalized_similarity": round(ratio, 4),
                "identical_after_typographic_normalization": normalized_book == normalized_db,
                "book_training_characters": len(training),
                "database_training_characters": len(by_code[current_code]["text"]),
                "comparison_note": "Similarity is a diagnostic, not an assertion of unchanged legal requirements.",
            })
            wanted.remove(current_code)

        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            match = re.search(r"C[ÓO]DIGO\s+(\d{4})", text[:250], re.I)
            if match and match[1] != current_code:
                finish()
                current_code = match[1]
                current_text = []
                start_page = index + 1
            if current_code in wanted:
                current_text.append(text)
            if index % 100 == 0:
                print(f"Book {number}: page {index + 1}/{len(reader.pages)}; {len(results)}/10 samples found", flush=True)
            if not any((code[0] < "6") == (number == 1) for code in wanted):
                break
        finish()
    return {"requested_codes": list(SAMPLE_CODES), "matched_samples": len(results), "missing_codes": sorted(wanted), "samples": sorted(results, key=lambda row: row["code"]), "books": books}


def coverage(families: list[dict]) -> dict:
    codes = {family["code"] for family in families}
    result = {}
    family_path = RAW / "cbo-familia.csv"
    occupation_path = RAW / "cbo-ocupacao.csv"
    if family_path.exists():
        current = {row["CODIGO"] for row in csv.DictReader(io.StringIO(family_path.read_text(encoding="latin-1")), delimiter=";")}
        result.update({"catalog_family_count": len(current), "catalog_families_matched": len(current & codes), "catalog_families_missing": sorted(current - codes), "historical_families_not_in_catalog": sorted(codes - current)})
    if occupation_path.exists():
        current = [row["CODIGO"] for row in csv.DictReader(io.StringIO(occupation_path.read_text(encoding="latin-1")), delimiter=";")]
        result.update({"catalog_occupation_count": len(current), "catalog_occupations_with_family_reference": sum(code[:4] in codes for code in current), "occupation_join_note": "A family reference is shared context; individual occupations in that family may have different entry routes or may have been added after the historical snapshot."})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--verify-books", action="store_true")
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else None
    if args.offline:
        jar_bytes = SOURCE_PATH.read_bytes()
        retrieved_at = datetime.fromtimestamp(SOURCE_PATH.stat().st_mtime, timezone.utc).isoformat()
        if previous and previous["metadata"]["source_sha256"] == hashlib.sha256(jar_bytes).hexdigest():
            retrieved_at = previous["metadata"]["retrieved_at"]
    else:
        jar_bytes = download(SOURCE_URL)
        retrieved_at = datetime.now(timezone.utc).isoformat()
    families, details = extract(jar_bytes)
    metadata = {
        "source_name": "Ministério do Trabalho e Emprego — banco público CBO Consultas OFFLine",
        "source_url": SOURCE_URL,
        "source_sha256": hashlib.sha256(jar_bytes).hexdigest(),
        "source_bytes": len(jar_bytes),
        "raw_file": "data/raw/cbo-training-source.jar",
        "retrieved_at": retrieved_at,
        **details,
        "coverage": coverage(families),
        "extraction": "Read ZIP entry packs/pack-Principal; decode only Java block-data file contents; parse SQL literals from FAMILIAS_OCUPACIONAIS INSERT records. No installer, Java bytecode, or SQL is executed.",
        "display_policy": "Descriptions are retained for local source analysis. Display concise factual summaries with source and historical snapshot date, not extensive paragraphs.",
        "limitations": [
            "Referência histórica, não escolaridade mínima legal atual nem descrição de todas as exigências de empregadores.",
            "20/11/2014 é a data de gravação no arquivo CBO.properties; não comprova atualização das descrições naquele ano. DT_ATUALIZACAO está vazio nas famílias extraídas.",
            "A descrição é da família CBO de quatro dígitos. Requisitos podem variar entre as ocupações da mesma família; não inferir um diploma para todas elas.",
            "Os livros usados para conferência são da terceira edição de 2010 e podem divergir do banco offline.",
            "A consulta/download Excel do QBQ foi localizada em https://qbq.trabalho.gov.br/loginDados, que exige cadastro/login; não foi obtida base QBQ autenticada.",
            "A classificação CBO não regulamenta profissões. Não foram verificadas leis ou regras atuais de conselhos profissionais.",
            "As descrições podem citar nomenclaturas educacionais e normas antigas. Ausência de informação não significa acesso livre.",
        ],
    }
    if args.verify_books:
        metadata["book_verification"] = verify_books(families, args.offline)
    elif previous and previous["metadata"]["source_sha256"] == metadata["source_sha256"] and "book_verification" in previous["metadata"]:
        metadata["book_verification"] = previous["metadata"]["book_verification"]
    if not args.offline:
        SOURCE_PATH.write_bytes(jar_bytes)
    OUTPUT_PATH.write_text(json.dumps({"metadata": metadata, "families": families}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"families": len(families), "source_snapshot_date": details["source_snapshot_date"], "coverage": metadata["coverage"], "output": str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
