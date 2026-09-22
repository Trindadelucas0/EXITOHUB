'use strict';

const ONBOARDING_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

const LINK_CATEGORIES = [
  'Produtividade',
  'Suporte',
  'Financeiro',
  'RH',
  'Outros',
];

const CONTACT_DEPARTMENTS = [
  'Fiscal',
  'Contábil',
  'Administrativo',
  'TI',
  'RH',
  'Outros',
];

const ITEM_DEPARTMENTS = [
  'Geral',
  'Fiscal',
  'Contábil',
  'Administrativo',
  'TI',
  'RH',
  'Outros',
];

const CONTENT_CATEGORIES = [
  'Empresa',
  'Equipe',
  'Informações',
  'Novidades',
  'Outros',
];

const EMPTY_STATES = {
  contents: 'Em breve, novidades do Êxito.',
  links: 'Nenhum link útil disponível.',
  linksSupport: 'Cadastre atalhos em Portal Corporativo → Links Úteis.',
  contacts: 'Nenhum contato cadastrado.',
  contactsSupport: 'Cadastre contatos em Portal Corporativo → Contatos Úteis.',
  announcements: 'Nenhum novo comunicado no momento.',
  announcementsSupport:
    'Você está com todas as leituras operacionais e comunicados internos em dia.',
  events: 'Nenhum evento próximo agendado.',
  eventsSupport:
    'Não há reuniões gerais, bancas corporativas ou seminários marcados nas próximas horas.',
  agenda: 'Reuniões, treinamentos e eventos internos da semana.',
  agendaSupport: 'A agenda corporativa será integrada em uma próxima etapa.',
  items: 'Nenhum item disponível no momento.',
};

const ITEM_KINDS = {
  video: {
    slug: 'videos',
    label: 'Vídeos de Integração',
    short: 'Vídeos',
    description: 'Conheça a empresa',
    icon: 'play',
    cover: '/hub-assets/portal-cards/videos.svg',
    route: '/portal/videos',
  },
  pop: {
    slug: 'pops',
    label: 'POPs da Empresa',
    short: 'POPs',
    description: 'Procedimentos e instruções',
    icon: 'clipboard',
    cover: '/hub-assets/portal-cards/pops.png',
    route: '/portal/pops',
  },
  diagram: {
    slug: 'diagrama',
    label: 'Diagrama da Empresa',
    short: 'Diagrama',
    description: 'Conheça cargos, setores e equipes',
    icon: 'network',
    cover: '/hub-assets/portal-cards/diagrama.svg',
    route: '/portal/diagrama',
  },
  informative: {
    slug: 'informativos',
    label: 'Informativos',
    short: 'Informativos',
    description: 'Notícias e comunicados',
    icon: 'megaphone',
    cover: '/hub-assets/portal-cards/informativos.svg',
    route: '/portal/informativos',
  },
  catalog: {
    slug: 'catalogos',
    label: 'Catálogos',
    short: 'Catálogos',
    description: 'Materiais da empresa',
    icon: 'file-text',
    cover: '/hub-assets/portal-cards/catalogos.svg',
    route: '/portal/catalogos',
  },
  logo: {
    slug: 'logos',
    label: 'Logos',
    short: 'Logos',
    description: 'Identidade visual oficial',
    icon: 'image',
    cover: '/hub-assets/portal-cards/logos.svg',
    route: '/portal/logos',
  },
  document: {
    slug: 'documentos',
    label: 'Documentos Corporativos',
    short: 'Documentos',
    description: 'Formulários e arquivos oficiais',
    icon: 'file-text',
    cover: '/hub-assets/portal-cards/documentos.svg',
    route: '/portal/documentos',
  },
};

/** Cards de integração na Home (sem Documentos no grid principal de onboarding). */
const HOME_INTEGRATION_KINDS = ['video', 'pop', 'diagram', 'informative', 'catalog', 'logo'];

const TARGET_TYPES = ['none', 'internal', 'external'];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOC_MIMES = new Set(['application/pdf', ...IMAGE_MIMES]);
const VIDEO_MIMES = new Set(['video/mp4', ...DOC_MIMES]);

const LIMITS = {
  imageBytes: 8 * 1024 * 1024,
  pdfBytes: 15 * 1024 * 1024,
  videoBytes: 40 * 1024 * 1024,
};

const DEFAULT_ONBOARDING_STEPS = [
  { position: 1, title: 'Bem-vindo ao Êxito', description: 'Comece sua integração no HUB.', target_kind: 'route', target_route: '/' },
  { position: 2, title: 'Conheça nossa empresa', description: 'Assista aos vídeos de integração.', target_kind: 'route', target_route: '/portal/videos' },
  { position: 3, title: 'Conheça nossa estrutura', description: 'Veja o diagrama da empresa.', target_kind: 'route', target_route: '/portal/diagrama' },
  { position: 4, title: 'Conheça as regras', description: 'Leia os POPs da empresa.', target_kind: 'route', target_route: '/portal/pops' },
  { position: 5, title: 'Conheça os sistemas', description: 'Explore o menu por departamento.', target_kind: 'route', target_route: '/' },
  { position: 6, title: 'Conheça seu departamento', description: 'Fale com os contatos úteis.', target_kind: 'route', target_route: '/' },
  { position: 7, title: 'Documentos importantes', description: 'Consulte informativos e documentos.', target_kind: 'route', target_route: '/portal/documentos' },
  { position: 8, title: 'Finalização', description: 'Confirme que concluiu a integração.', target_kind: 'none', target_route: null },
];

module.exports = {
  ONBOARDING_STATUSES,
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  EMPTY_STATES,
  ITEM_KINDS,
  HOME_INTEGRATION_KINDS,
  TARGET_TYPES,
  IMAGE_MIMES,
  DOC_MIMES,
  VIDEO_MIMES,
  LIMITS,
  DEFAULT_ONBOARDING_STEPS,
};
