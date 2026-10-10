"""Conservative summaries of historical, family-level CBO training descriptions.

These categories describe mentions in source text, never current legal requirements.
Multiple educational routes remain variable, not the lowest apparent barrier.
"""
import re
import unicodedata

def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(c))

def preparation(record):
    if not record:
        return dict(preparation='nao_informada', preparationSummary=None,
                    preparationSource=None, preparationSnapshot=None)
    text = fold(record['text'])
    # Exclude the generic apprenticeship-law boilerplate, which says nothing
    # about a particular occupation's training route.
    text = re.split(r'a\(s\) ocupa', text)[0]
    levels = []
    if re.search(r'fundamental|primeiro grau|1[º°o]? grau|[1-8]a? serie', text):
        levels.append('fundamental')
    if re.search(r'ensino medio|nivel medio|segundo grau|2[º°o]? grau', text):
        levels.append('medio')
    technical = bool(re.search(r'(curso[s]?|formacao|ensino|habilitacao) tecnic[oa]|tecnico[s]? de nivel medio|nivel tecnico', text))
    if technical:
        levels = [level for level in levels if level != 'medio'] + ['tecnica']
    if re.search(r'superior|graduacao|bacharel|licenciatura|universitari', text):
        levels.append('superior')
    free = bool(re.search(r'acesso .*livre|sem (exigencia|requisito|requerimento).*escolaridade|nao (se )?exige.*escolaridade', text))
    qualification = bool(re.search(r'curso[s]? (livre|basic|de qualificacao|profissionalizante)|qualificacao profissional', text))
    names = {'fundamental':'ensino fundamental', 'medio':'ensino médio', 'tecnica':'formação técnica', 'superior':'ensino superior'}
    category = 'variavel' if len(levels) > 1 or free else levels[0] if levels else 'qualificacao' if qualification else 'nao_informada'
    if levels:
        summary = 'A descrição histórica desta família menciona ' + ', '.join(names[x] for x in levels) + '.'
        if len(levels) > 1:
            summary += ' Existem trajetórias diferentes dentro da mesma família; confira a ocupação específica.'
    elif qualification:
        summary = 'A descrição histórica menciona cursos de qualificação ou formação profissional, sem um nível escolar único identificado.'
    else:
        summary = 'A descrição histórica não permitiu classificar uma formação de referência única.'
    if free:
        summary += ' O documento descreve acesso variável ou livre; isso não confirma os requisitos atuais.'
    elif qualification and levels:
        summary += ' Também há menção a cursos de qualificação.'
    if re.search(r'experiencia|estagio|exercicio profissional', text):
        summary += ' O documento também aborda experiência ou prática profissional.'
    return dict(preparation=category, preparationSummary=summary,
                preparationSource=record['source_url'], preparationSnapshot=record['source_snapshot_date'])
