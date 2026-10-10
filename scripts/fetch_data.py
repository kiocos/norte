"""Download versioned public sources; preserve bytes and SHA-256 provenance."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'raw'
BASE = 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/'
URLS = {f'cbo-{name}.csv': BASE + f'cbo2002-{name}.csv' for name in ['ocupacao','sinonimo','familia','perfilocupacional','subgrupo','subgrupo-principal']}
URLS.update({
 'rais-2025.csv': 'https://futurodascarreiras.com/profissao/dados/rais/rais_cbo6_2025.csv',
 'caged-12m.csv': 'https://futurodascarreiras.com/profissao/dados/caged/caged_cbo6_12m.csv',
})

def fetch(item):
 name, url = item
 req=urllib.request.Request(url, headers={'User-Agent':'NorteCareerResearch/1.0 (public aggregate data)'})
 with urllib.request.urlopen(req, timeout=90) as r:
  body=r.read()
  content_type=r.headers.get('Content-Type','')
 if b'<html' in body[:300].lower(): raise ValueError(f'HTML instead of CSV: {url}')
 (RAW/name).write_bytes(body)
 return {'file':name,'url':url,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'content_type':content_type,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}

if __name__ == '__main__':
 RAW.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  sources=list(pool.map(fetch,URLS.items()))
 (ROOT/'data'/'manifest.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 for source in sources: print(source['file'],source['bytes'],source['sha256'][:12])
