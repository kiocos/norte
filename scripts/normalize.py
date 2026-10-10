"""CBO + Brazilian salary aggregates. No salaries are imputed.

Areas, RIASEC and remote potential are explicit, reproducible editorial rules,
not psychometric scores or observed remote-work rates.
"""
import collections, csv, hashlib, io, json, pathlib, re, unicodedata
from preparation import preparation

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT/'data'/'raw'
OUT = ROOT/'data'/'processed'

def clean(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s)).strip()
def fold(s): return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c))
def rows(name):
 b=(RAW/name).read_bytes()
 try: text=b.decode('utf-8-sig')
 except UnicodeDecodeError: text=b.decode('cp1252')
 reader=csv.DictReader(io.StringIO(text),delimiter=';' if name.startswith('cbo') else ',')
 result=[]
 for row in reader:
  # Official activity text contains unquoted semicolons in its final column.
  if None in row:
   row[reader.fieldnames[-1]] += ';' + ';'.join(row.pop(None))
  result.append({k:clean(v or '') for k,v in row.items()})
 return result

# Order and palette intentionally match the geographic clusters in the UI.
AREAS = [
 ('tecnologia','Tecnologia','#5279df','code','Sistemas, dados e novas possibilidades.'),
 ('saude','Saúde & bem-estar','#df7490','heart','Cuidar de pessoas, em cada fase da vida.'),
 ('criatividade','Arte, design & comunicação','#a17bd4','palette','Ideias que ganham forma, voz e movimento.'),
 ('educacao','Educação','#d99a46','graduation','Compartilhar conhecimento e abrir caminhos.'),
 ('negocios','Negócios & gestão','#8e86c1','briefcase','Organizar recursos, pessoas e decisões.'),
 ('engenharia','Engenharia & construção','#619dab','ruler','Projetar e construir o mundo ao redor.'),
 ('ciencia','Ciência & pesquisa','#7982bd','flask','Investigar perguntas e descobrir respostas.'),
 ('juridico','Direito & setor público','#ae849d','scale','Direitos, políticas e vida em sociedade.'),
 ('natureza','Natureza & agro','#b3a268','leaf','Trabalhar com a terra e seus ecossistemas.'),
 ('servicos','Serviços & hospitalidade','#c99771','coffee','Experiências, cuidado e vida cotidiana.'),
 ('industria','Indústria & produção','#7f9ea9','factory','Transformar materiais em produtos.'),
 ('logistica','Logística & transportes','#ae9972','truck','Conectar pessoas, lugares e mercadorias.'),
 ('seguranca','Segurança & defesa','#8591a8','shield','Proteger pessoas e comunidades.'),
 ('comercio','Comércio & vendas','#c58b88','store','Conectar necessidades a boas soluções.'),
]

def area_for(code,title):
 t=fold(title); f=code[:4]
 if code[0]=='0' or re.search(r'bombeiro|polici|vigilante|seguranca pessoal|detetive|agente penitenci|guarda-civil',t): return 'seguranca'
 if f=='2211':return 'ciencia'
 if f=='2221':return 'natureza'
 if code[:3] in ['715','716','717']:return 'engenharia'
 if 'telemarketing' in t:return 'comercio'
 if code[:2]=='23' or re.search(r'professor|pedagogo|psicopedagogo|instrutor de aprendizagem|coordenador pedagogico',t): return 'educacao'
 if code[:2]=='22' or code[:3] in ['322','324','325'] or re.search(r'medic[oa]|enferm|fisioterap|terapeuta|psicolog|dentista|nutricion|fonoaudio|farmaceut|optomet|educador fisico',t): return 'saude'
 if code[:3] in ['212','317'] or f in ['1236','1425','2031','2112'] or re.search(r'desenvolv.*sistemas|programador de sistemas|programador de internet|administrador de (redes|banco)|seguranca da informacao|engenheiro de software|cientista de dados|analista de sistemas',t): return 'tecnologia'
 if code[:2]=='26' or code[:3] in ['371','372','373','374','375','376','377'] or re.search(r'designer|desenhista industrial|publicitari|marketing|fotograf|artista|artesao|compositor|dancarino|musico|jornalista|ilustrador|decorador|\bator\b|\batriz\b',t): return 'criatividade'
 if code[:2] in ['24','11'] or f=='3514': return 'juridico'
 if code[:2]=='21' or code[:3] in ['312','313','314','318'] or re.search(r'engenheir|arquiteto|urbanista|mestre de obras|pedreiro|carpinteiro|eletricista|encanador|topografo|tecnico.*(construcao|edificac)',t):
  if code[:3] in ['211','213']: return 'ciencia'
  return 'engenharia'
 if code[:2]=='20' or code[:3] in ['301','311']: return 'ciencia'
 if code[0]=='6' or code[:3] in ['321'] or re.search(r'agronom|florestal|ambiental|aquicult|agricol|pecuari|pescador|jardineiro',t): return 'natureza'
 if code[:3] in ['342','341','782','783'] or re.search(r'motorista|piloto de|maquinista|cobrador de transport|logistica|almoxarife|estoquista',t): return 'logistica'
 if code[:2]=='52' or code[:3]=='354' or re.search(r'vendedor|corretor|representante comercial|operador de telemarketing',t): return 'comercio'
 if code[0] in ['7','8','9']: return 'industria'
 if code[0]=='5': return 'servicos'
 return 'negocios'

BASE_PROFILES = {
 'tecnologia':[2,5,2,1,2,3], 'saude':[3,4,1,5,1,2], 'criatividade':[2,2,5,2,3,1],
 'educacao':[1,3,3,5,2,2], 'negocios':[1,2,1,3,5,5], 'engenharia':[5,4,2,1,2,3],
 'ciencia':[3,5,2,2,1,3], 'juridico':[1,4,1,3,4,4], 'natureza':[5,3,1,2,2,2],
 'servicos':[4,1,2,4,2,2], 'industria':[5,2,1,1,1,3], 'logistica':[5,2,1,2,2,4],
 'seguranca':[5,2,1,3,3,3], 'comercio':[2,1,2,4,5,3]
}
KEYWORDS={
 'R':r'operar|montar|reparar|consertar|instalar|construir|cultivar',
 'I':r'pesquisar|investigar|diagnosticar|analisar dados|realizar pesquisa',
 'A':r'criar|compor|interpretar personage|desenhar|conceber|ensaiar',
 'S':r'ensinar|cuidar|acolher|orientar pacientes|educar|assistir pessoas',
 'E':r'negociar|vender|liderar|gerenciar|dirigir|captar cliente',
 'C':r'arquivar|registrar|conferir|controlar estoque|classificar documento|contabilizar'
}

def remote_for(code,title,area):
 t=fold(title)
 if code[:3] in ['212','317'] or code[:4] in ['1425','2112'] or re.search(r'programador de internet|desenvolvedor|tradutor|revisor de texto|redator|designer grafico|desenhista industrial grafico',t):
  return 'alto','Atividades centradas em software, dados ou conteúdo digital permitem execução a distância. Avaliação editorial; não mede vagas remotas.'
 if area in ['negocios','juridico'] or re.search(r'psicolog|jornalista|publicitari|marketing|arquiteto|professor|analista|contador|consultor',t):
  return 'parcial','Parte das tarefas pode ser feita a distância; atendimento, ensino ou operação podem exigir presença. Avaliação editorial.'
 if area in ['industria','natureza','logistica','seguranca','servicos'] or area=='saude' or re.search(r'pedreiro|eletricista|encanador',t):
  return 'presencial','As tarefas descritas envolvem ambientes, materiais ou atendimento físico. Avaliação editorial; podem existir exceções.'
 return 'nao_avaliado','Ainda não há avaliação suficiente para classificar o potencial de trabalho remoto desta ocupação.'

def number(row,key):
 try:
  n=float(row.get(key,''))
  return n if n>0 else None
 except (ValueError,TypeError):return None

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 occupations=rows('cbo-ocupacao.csv')
 families={r['CODIGO']:r['TITULO'] for r in rows('cbo-familia.csv')}
 training=json.loads((RAW/'cbo-training.json').read_text())
 training_records={r['code']:r for r in training['families']}
 family_records=[{'code':code,'title':title,**preparation(training_records.get(code))} for code,title in families.items()]
 preparation_categories={r['code']:r['preparation'] for r in family_records}
 aliases=collections.defaultdict(list)
 for r in rows('cbo-sinonimo.csv'):
  if r['TITULO'] not in aliases[r['CODIGO']]: aliases[r['CODIGO']].append(r['TITULO'])
 activities=collections.defaultdict(list)
 for r in rows('cbo-perfilocupacional.csv'):
  # Z is personal competencies, not an occupation's day-to-day activities.
  if r['SGL_GRANDE_AREA']!='Z' and r['NOME_ATIVIDADE'] not in activities[r['COD_OCUPACAO']]:
   activities[r['COD_OCUPACAO']].append(r['NOME_ATIVIDADE'])
 rais={r['cbo']:r for r in rows('rais-2025.csv')}
 caged={r['cbo']:r for r in rows('caged-12m.csv')}
 result=[]; suppressed=0
 for r in occupations:
  code=r['CODIGO'].zfill(6); title=r['TITULO']; area=area_for(code,title)
  assert re.fullmatch(r'\d{6}',code)
  riasec=dict(zip('RIASEC',BASE_PROFILES[area]))
  text=fold(' '.join(activities[code]))
  for key,regex in KEYWORDS.items():
   if len(re.findall(regex,text))>=3:riasec[key]=min(5,riasec[key]+1)
  remote,reason=remote_for(code,title,area)
  salary=rais.get(code,{}); hire=caged.get(code,{})
  sample=int(float(salary.get('vinculos_remun') or '0'))
  valid=sample>=30 and number(salary,'p50') is not None
  if not valid:suppressed+=1
  result.append({
   'code':code,'title':title,'area':area,'family':code[:4],
   'kind':'cbo','sourceUrl':'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/downloads',
   'workModes':['emprego'],'description':None,
   'aliases':aliases[code],'activities':activities[code],
   'riasec':riasec,'remote':remote,'remoteReason':reason,
   'salary':number(salary,'p50') if valid else None,
   'salaryLow':number(salary,'p25') if valid else None,
   'salaryHigh':number(salary,'p75') if valid else None,
   'salaryMean':number(salary,'media') if valid else None,
   'sample':sample,'employment':int(float(salary.get('vinculos') or '0')),
   'admissionSalary':number(hire,'sal_adm_mediana') if int(float(hire.get('n_sal') or '0'))>=30 else None,
   'admissions':int(float(hire.get('adm') or '0')),
   'dismissals':int(float(hire.get('desl') or '0')),
   'balance':int(float(hire.get('saldo') or '0')),
   'salaryStatus':'available' if valid else ('small_sample' if sample>0 else 'unavailable'),
  })
 # Keep three catalog types separate. A MEI activity is not an additional CBO
 # occupation, and an entrepreneurial pathway is not a legal qualification.
 mei=json.loads((RAW/'mei-activities.json').read_text())
 for a in mei['activities']:
  title=a['title'].lower().capitalize()
  area=area_for('mei',title)
  sector=a['cnae_code'][:2]
  if sector in ['45','46','47']:area='comercio'
  if a['cnae_code'].startswith('951'):area='tecnologia'
  if a['cnae_code'].startswith('639'):area='criatividade'
  if area=='negocios':
   if sector in ['45','46','47']:area='comercio'
   elif sector in ['49','50','51','52','53']:area='logistica'
   elif sector in ['01','02','03']:area='natureza'
   elif sector in ['41','42','43']:area='engenharia'
   elif sector in ['58','59','60','73','90']:area='criatividade'
   elif sector in ['85']:area='educacao'
   elif sector in ['86','87','88']:area='saude'
   elif sector in ['62','63']:area='tecnologia'
   elif 10<=int(sector)<=33:area='industria'
   else:area='servicos'
  if re.search(r'cabeleireir|esteticista|manicur|pedicur|massagista',fold(title)):area='saude'
  remote,reason=remote_for('mei',title,area)
  result.append({
   'code':'mei-'+hashlib.sha256((a['title']+'|'+a['cnae_code']+'|'+a['table']).encode()).hexdigest()[:12],
   'title':title,'area':area,'family':None,'kind':'mei','aliases':[a['title'],a['cnae'],a['cnae_code'],a['cnae_description']],
   'sourceUrl':a['source_url']+'#page='+str(a['source_page']),'workModes':['autonomo','negocio'],
   'description':f"Atividade da tabela {a['table']} do Anexo XI do MEI. CNAE {a['cnae']}. A descrição específica e as demais condições de enquadramento devem ser verificadas na fonte oficial.",
   'activities':['Atividade econômica vinculada: '+a['cnae_description'].lower()+'.'],
   'riasec':dict(zip('RIASEC',BASE_PROFILES[area])),'remote':remote,'remoteReason':reason,
   'salary':None,'salaryLow':None,'salaryHigh':None,'salaryMean':None,'sample':0,'employment':0,
   'admissionSalary':None,'admissions':0,'dismissals':0,'balance':0,'salaryStatus':'unavailable'
  })
 editorial=json.loads((ROOT/'data'/'editorial-paths.json').read_text())
 for p in editorial['paths']:
  profile=dict(zip('RIASEC',BASE_PROFILES[p['area']]))
  profile['E']=5
  result.append({
   'code':'path-'+p['id'],'title':p['title'],'area':p['area'],'family':None,'kind':'caminho',
   'aliases':p['aliases'],'sourceUrl':editorial['sources'][p['source']],'workModes':['autonomo','negocio'],
   'description':p['description'],'activities':p['activities'],'riasec':profile,'remote':p['remote'],
   'remoteReason':'Avaliação editorial do modo de execução deste negócio ou serviço. Não é uma estatística de vagas remotas; o formato depende da operação.',
   'salary':None,'salaryLow':None,'salaryHigh':None,'salaryMean':None,'sample':0,'employment':0,
   'admissionSalary':None,'admissions':0,'dismissals':0,'balance':0,'salaryStatus':'unavailable'
  })
 assert len({o['code'] for o in result})==len(result)
 for o in result:
  o['preparation']=preparation_categories.get(o['family'],'nao_informada')
  if o['salary']: assert 0<o['salaryLow']<=o['salary']<=o['salaryHigh'],o['code']
 areas=[dict(id=a,title=b,color=c,icon=d,description=e) for a,b,c,d,e in AREAS]
 data={'occupations':result,'families':family_records, 'areas':areas}
 (OUT/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 report={'total_options':len(result),'occupations':len(occupations),'mei_activities':len(mei['activities']),'editorial_paths':len(editorial['paths']),'families':len(families),'aliases':sum(len(o['aliases']) for o in result if o['kind']=='cbo'),'with_salary':sum(o['salary'] is not None for o in result),'cbo_without_salary':suppressed,'with_activities':sum(bool(o['activities']) for o in result),'areas':dict(collections.Counter(o['area'] for o in result)),'rais_unmatched_codes':sorted(set(rais)-{o['code'] for o in result}),'classification_version':'editorial-cbo-v1','minimum_salary_sample':30}
 report['preparation']={'source_snapshot':training['metadata']['source_snapshot_date'],'matched_families':sum(bool(r['preparationSource']) for r in family_records),'categories':dict(collections.Counter(o['preparation'] for o in result))}
 (OUT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
