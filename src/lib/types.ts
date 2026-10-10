export type Interest = "R" | "I" | "A" | "S" | "E" | "C";
export type Remote = "alto" | "parcial" | "presencial" | "nao_avaliado";
export type Kind = "cbo" | "mei" | "caminho";
export type Preparation =
  | "fundamental"
  | "medio"
  | "tecnica"
  | "superior"
  | "qualificacao"
  | "variavel"
  | "nao_informada";
export interface Area {
  id: string;
  title: string;
  color: string;
  icon: string;
  description: string;
}
export interface Occupation {
  code: string;
  title: string;
  area: string;
  family: string | null;
  aliases: string[];
  riasec: Record<Interest, number>;
  remote: Remote;
  salary: number | null;
  salaryLow: number | null;
  salaryHigh: number | null;
  sample: number;
  employment: number;
  kind: Kind;
  sourceUrl: string;
  workModes: string[];
  preparation: Preparation;
}
export interface Detail extends Occupation {
  activities: string[];
  remoteReason: string;
  familyTitle: string | null;
  salaryMean: number | null;
  salaryStatus: string;
  admissionSalary: number | null;
  admissions: number;
  dismissals: number;
  balance: number;
  description?: string;
  preparationSummary: string | null;
  preparationSource: string | null;
  preparationSnapshot: string | null;
}
export interface Catalog {
  areas: Area[];
  occupations: Occupation[];
  updatedAt: string;
}
export interface Filters {
  query: string;
  areas: string[];
  interests: Interest[];
  remote: string;
  salaryMin: number;
  salaryMax: number;
  includeUnknown: boolean;
  kinds: string[];
  preparation: string[];
  savedOnly: boolean;
}
export const INITIAL_FILTERS: Filters = {
  query: "",
  areas: [],
  interests: [],
  remote: "",
  salaryMin: 0,
  salaryMax: 30000,
  includeUnknown: true,
  kinds: [],
  preparation: [],
  savedOnly: false,
};
export const INTERESTS: {
  id: Interest;
  label: string;
  verb: string;
  description: string;
}[] = [
  {
    id: "R",
    label: "Prático",
    verb: "Construir & fazer",
    description: "Trabalhar com ferramentas, natureza e coisas concretas.",
  },
  {
    id: "I",
    label: "Investigativo",
    verb: "Investigar & resolver",
    description: "Pesquisar, analisar e entender como as coisas funcionam.",
  },
  {
    id: "A",
    label: "Artístico",
    verb: "Criar & expressar",
    description: "Imaginar, desenhar, escrever e experimentar ideias.",
  },
  {
    id: "S",
    label: "Social",
    verb: "Cuidar & ensinar",
    description: "Ajudar pessoas, compartilhar conhecimento e acolher.",
  },
  {
    id: "E",
    label: "Empreendedor",
    verb: "Liderar & empreender",
    description: "Negociar, mobilizar pessoas e desenvolver negócios.",
  },
  {
    id: "C",
    label: "Organizador",
    verb: "Organizar & planejar",
    description: "Estruturar processos, lidar com detalhes e organizar dados.",
  },
];
export const REMOTE_LABELS: Record<Remote, string> = {
  alto: "Alto potencial remoto",
  parcial: "Parte das atividades",
  presencial: "Principalmente presencial",
  nao_avaliado: "Ainda não avaliado",
};
export const KIND_LABELS: Record<Kind, string> = {
  cbo: "Ocupação CBO",
  mei: "Atividade MEI",
  caminho: "Caminho empreendedor",
};
export const PREPARATION_LABELS: Record<Preparation, string> = {
  fundamental: "Ensino fundamental",
  medio: "Ensino médio",
  tecnica: "Formação técnica",
  superior: "Ensino superior",
  qualificacao: "Curso de qualificação",
  variavel: "Formação variável",
  nao_informada: "Sem referência classificada",
};
export const money = (value: number | null) =>
  value == null
    ? "Sem dados"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);
