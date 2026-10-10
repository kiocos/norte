#!/usr/bin/env python3
"""Download and extract Receita Federal's official MEI occupation tables.

Dependency: python -m pip install pdfplumber==0.11.10
Run: python scripts/fetch_mei.py
Rebuild from the retained PDF without network: python scripts/fetch_mei.py --offline

Only whitespace is normalized. CNAE values are strings and are not unique keys:
several independently named occupations can share the same economic activity.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request

try:
    import pdfplumber
except ImportError as exc:
    raise SystemExit(
        "Install the extraction dependency: python -m pip install pdfplumber==0.11.10"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PDF_PATH = RAW_DIR / "mei-anexo-xi.pdf"
OUTPUT_PATH = RAW_DIR / "mei-activities.json"
SOURCE_URL = "https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/anexo_xi.pdf"
CNAE_PATTERN = re.compile(r"\d{4}-\d/\d{2}")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def extract(pdf_bytes: bytes) -> tuple[list[dict], int, int]:
    activities = []
    current_table = None
    continuations = 0
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            for table in page.extract_tables():
                for cells in table:
                    row = [clean(cell) for cell in cells]
                    if not any(row):
                        continue
                    if row[0] in ("TABELA A", "TABELA B"):
                        current_table = row[0][-1]
                        continue
                    if len(row) == 5 and row[1] == "CNAE":
                        continue
                    if len(row) == 5 and CNAE_PATTERN.fullmatch(row[1]):
                        if current_table not in ("A", "B"):
                            raise ValueError(f"Missing table identifier on page {page.page_number}")
                        if not row[0] or not row[2] or row[3] not in ("S", "N") or row[4] not in ("S", "N"):
                            raise ValueError(f"Invalid activity on page {page.page_number}: {row}")
                        activities.append({
                            "title": row[0],
                            "cnae": row[1],
                            "cnae_code": re.sub(r"\D", "", row[1]),
                            "cnae_description": row[2],
                            "iss": row[3],
                            "icms": row[4],
                            "table": current_table,
                            "source_url": SOURCE_URL,
                            "source_page": page.page_number,
                        })
                    elif len(row) == 5 and row[0] and not any(row[1:]):
                        # The PDF splits POCEIRO/CISTERNEIRO/CACIMBEIRO into
                        # two table rows. Preserve that continuation in its title.
                        if not activities or activities[-1]["source_page"] != page.page_number:
                            raise ValueError(f"Orphan title continuation: {row}")
                        previous = activities[-1]["title"]
                        separator = "" if previous.endswith("/") else " "
                        activities[-1]["title"] = previous + separator + row[0]
                        continuations += 1
                    else:
                        raise ValueError(f"Unrecognized table row on page {page.page_number}: {row}")

    keys = {(row["table"], row["title"], row["cnae"]) for row in activities}
    if len(keys) != len(activities):
        raise ValueError("Duplicate occupation records in the official snapshot")
    if len(activities) < 400 or {row["table"] for row in activities} != {"A", "B"}:
        raise ValueError("Incomplete extraction: expected hundreds of occupations and tables A and B")
    return activities, page_count, continuations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use the saved official PDF")
    args = parser.parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if args.offline:
        pdf_bytes = PDF_PATH.read_bytes()
        retrieved_at = datetime.fromtimestamp(PDF_PATH.stat().st_mtime, timezone.utc).isoformat()
        if OUTPUT_PATH.exists():
            previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            if previous["metadata"]["sha256"] == hashlib.sha256(pdf_bytes).hexdigest():
                retrieved_at = previous["metadata"]["retrieved_at"]
    else:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "MapaCarreiras/1.0 (public-data-import)"})
        with urllib.request.urlopen(request, timeout=60) as response:
            pdf_bytes = response.read()
        if not pdf_bytes.startswith(b"%PDF-"):
            raise ValueError("The official URL did not return a PDF")
        retrieved_at = datetime.now(timezone.utc).isoformat()

    activities, page_count, continuations = extract(pdf_bytes)
    counts_by_table = {table: sum(row["table"] == table for row in activities) for table in ("A", "B")}
    output = {
        "metadata": {
            "source_name": "Receita Federal do Brasil / Comitê Gestor do Simples Nacional",
            "source_url": SOURCE_URL,
            "legal_reference": "Anexo XI da Resolução CGSN nº 140, de 22 de maio de 2018 — Tabelas A e B",
            "retrieved_at": retrieved_at,
            "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
            "raw_file": "data/raw/mei-anexo-xi.pdf",
            "raw_bytes": len(pdf_bytes),
            "pdf_pages": page_count,
            "record_count": len(activities),
            "unique_cnae_count": len({row["cnae"] for row in activities}),
            "counts_by_table": counts_by_table,
            "extraction": {
                "library": "pdfplumber",
                "version": pdfplumber.__version__,
                "method": "PDF table cells; preserve original names and codes; normalize whitespace; join title continuation rows",
                "title_continuations_joined": continuations,
                "salary_data": False,
            },
            "limitations": [
                "Snapshot da lista oficial na data de coleta; futuras alterações normativas podem modificar o enquadramento.",
                "Ocupações MEI são atividades econômicas autorizadas e não equivalem a ocupações CBO nem a uma lista de todas as formas de trabalho autônomo.",
                "Um CNAE pode corresponder a várias ocupações: a descrição específica da ocupação deve ser preservada; o código isolado não basta para determinar a permissão.",
                "Tabela B identifica transportadores autônomos de cargas; não deve ser confundida com a Tabela A.",
                "A inclusão na lista não comprova que uma pessoa ou negócio cumpre as demais condições de enquadramento no MEI.",
                "A fonte não fornece rendimentos, lucro, demanda, afinidades ou frequência de trabalho remoto; nenhum desses indicadores foi imputado.",
                "Não foi realizada correspondência automática entre CNAE e CBO nem atribuição de salários de empregados a empreendedores.",
            ],
        },
        "activities": activities,
    }
    if not args.offline:
        PDF_PATH.write_bytes(pdf_bytes)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"records": len(activities), "unique_cnae": output["metadata"]["unique_cnae_count"], "tables": counts_by_table, "output": str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
