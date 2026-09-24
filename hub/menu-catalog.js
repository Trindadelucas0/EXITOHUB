'use strict';

const AVADESK_URL = 'https://suporte.avadesk.com.br/';
const DEFAULT_SIEG_URL = 'https://www.sieg.com.br';
const DEFAULT_CALENDAR_URL = 'https://calendar.google.com/calendar';

function safeHttpUrl(value, fallback) {
  const raw = String(value || '').trim() || fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch (_) {
    /* ignore */
  }
  return fallback;
}

function siegUrl() {
  return safeHttpUrl(process.env.HUB_SIEG_URL, DEFAULT_SIEG_URL);
}

function calendarUrl() {
  return safeHttpUrl(process.env.HUB_GOOGLE_CALENDAR_URL, DEFAULT_CALENDAR_URL);
}

function buildCatalog() {
  return [
    {
      id: 'geral',
      label: 'Geral',
      items: [
        {
          id: 'carteira',
          label: 'Controle da Carteira de Clientes',
          href: '/hub/modulo/carteira',
          require: 'admin',
          status: 'soon',
          icon: 'briefcase',
          currentKey: 'modulo-carteira',
          description: 'Cadastro e visão da carteira de clientes do escritório.',
        },
        {
          id: 'certificados',
          label: 'Certificados Digitais',
          href: siegUrl(),
          require: 'admin',
          status: 'external',
          icon: 'shield',
          external: true,
          currentKey: 'certificados',
          description: 'Acesso ao portal SIEG para certificados digitais.',
        },
        {
          id: 'login-cliente',
          label: 'Login do Cliente',
          href: '/hub/modulo/login-cliente',
          require: 'admin',
          status: 'soon',
          icon: 'log-in',
          currentKey: 'modulo-login-cliente',
          description: 'Acesso e gestão de login dos clientes.',
        },
      ],
    },
    {
      id: 'fiscal',
      label: 'Fiscal',
      items: [
        {
          id: 'auditor-fiscal',
          label: 'Auditor Fiscal',
          href: '/ncm/',
          require: 'ncm',
          status: 'live',
          icon: 'search',
          currentKey: 'ncm',
          description: 'Auditor de NCM e regras fiscais.',
        },
        {
          id: 'debitos',
          label: 'Controle de Débitos/ parcelamentos',
          href: '/hub/modulo/debitos',
          require: 'admin',
          status: 'soon',
          icon: 'receipt',
          currentKey: 'modulo-debitos',
          description: 'Acompanhamento de débitos e parcelamentos fiscais.',
        },
        {
          id: 'declaracoes',
          label: 'Auditor de Declarações Acessórias',
          href: '/hub/modulo/declaracoes',
          require: 'admin',
          status: 'soon',
          icon: 'file-text',
          currentKey: 'modulo-declaracoes',
          description: 'Conferência das declarações acessórias.',
        },
        {
          id: 'controle-dauto',
          label: 'Controle DAUTO',
          href: '/folha/fiscal',
          require: 'folha',
          status: 'live',
          icon: 'bar-chart',
          currentKey: 'folha-fiscal',
          description: 'Resumo de impostos do Grupo DAUTO.',
        },
      ],
    },
    {
      id: 'contabil',
      label: 'Contábil',
      items: [
        {
          id: 'conciliacao',
          label: 'Conciliação',
          href: '/conci/',
          require: 'conci',
          status: 'live',
          icon: 'git-compare',
          currentKey: 'conci',
          description: 'Conciliação bancária.',
        },
      ],
    },
    {
      id: 'folha',
      label: 'Folha de pagamento',
      items: [
        {
          id: 'cct',
          label: 'CCT – Convenções Coletivas',
          href: '/hub/modulo/cct',
          require: 'admin',
          status: 'soon',
          icon: 'scale',
          currentKey: 'modulo-cct',
          description: 'Consulta e controle de convenções coletivas.',
        },
        {
          id: 'folha-mensal',
          label: 'Controle folha mensal',
          href: '/folha/dashboard',
          require: 'folha',
          status: 'live',
          icon: 'wallet',
          currentKey: 'folha-dashboard',
          description: 'INSS, IRRF, FGTS e lançamentos por competência.',
        },
        {
          id: 'dauto-tintas',
          label: 'DAUTO Tintas',
          href: '/folha/modulos',
          require: 'folha',
          status: 'live',
          icon: 'droplet',
          currentKey: 'folha-modulos',
          description: 'Módulos de folha e fiscal da DAUTO Tintas.',
        },
        {
          id: 'calculadora-recibo',
          label: 'Calculadora de recibo',
          href: '/hub/modulo/calculadora-recibo',
          require: 'admin',
          status: 'soon',
          icon: 'calculator',
          currentKey: 'modulo-calculadora-recibo',
          description: 'Cálculo de recibos de pagamento.',
        },
      ],
    },
    {
      id: 'administrativo',
      label: 'Administrativo',
      items: [
        {
          id: 'integracao',
          label: 'Integração',
          href: '/portal/onboarding',
          require: 'auth',
          status: 'live',
          icon: 'plug',
          currentKey: 'portal-onboarding',
          description: 'Trilha de integração do funcionário.',
        },
        {
          id: 'videos',
          label: 'Vídeos de Integração',
          href: '/portal/videos',
          require: 'auth',
          status: 'live',
          icon: 'play',
          currentKey: 'portal-videos',
          description: 'Conheça a empresa.',
        },
        {
          id: 'pops',
          label: 'POPs',
          href: '/portal/pops',
          require: 'auth',
          status: 'live',
          icon: 'clipboard',
          currentKey: 'portal-pops',
          description: 'Procedimentos operacionais padrão.',
        },
        {
          id: 'informativos',
          label: 'Informativos',
          href: '/portal/informativos',
          require: 'auth',
          status: 'live',
          icon: 'megaphone',
          currentKey: 'portal-informativos',
          description: 'Comunicados e informativos internos.',
        },
        {
          id: 'catalogos',
          label: 'Catálogos',
          href: '/portal/catalogos',
          require: 'auth',
          status: 'live',
          icon: 'file-text',
          currentKey: 'portal-catalogos',
          description: 'Materiais da empresa.',
        },
        {
          id: 'documentos',
          label: 'Documentos Corporativos',
          href: '/portal/documentos',
          require: 'auth',
          status: 'live',
          icon: 'file-text',
          currentKey: 'portal-documentos',
          description: 'Formulários e arquivos oficiais.',
        },
        {
          id: 'organograma',
          label: 'Diagrama da Empresa',
          href: '/portal/diagrama',
          require: 'auth',
          status: 'live',
          icon: 'network',
          currentKey: 'portal-diagrama',
          description: 'Estrutura organizacional do escritório.',
        },
        {
          id: 'portal-admin',
          label: 'Portal Corporativo',
          href: '/admin/portal',
          require: 'admin',
          status: 'live',
          icon: 'settings',
          section: 'config',
          currentKey: 'admin-portal',
          description: 'Administrar conteúdos do portal.',
        },
        {
          id: 'usuarios',
          label: 'Gerenciar usuários',
          href: '/admin/usuarios',
          require: 'admin',
          status: 'live',
          icon: 'settings',
          section: 'config',
          currentKey: 'admin',
          description: 'Cadastro de logins e módulos do HUB.',
        },
        {
          id: 'acompanhamento',
          label: 'Acompanhamento Onboarding',
          href: '/admin/portal/onboarding/acompanhamento',
          require: 'admin',
          status: 'live',
          icon: 'clipboard',
          section: 'config',
          currentKey: 'admin-onboarding-users',
          description: 'Progresso da trilha de integração dos colaboradores.',
        },
      ],
    },
    {
      id: 'projetos',
      label: 'Projetos',
      items: [
        {
          id: 'avadesk',
          label: 'Projetos (Avadesk)',
          href: '/projetos',
          require: 'admin',
          status: 'live',
          icon: 'headset',
          currentKey: 'projetos',
          description: 'Chamados, bugs e projetos em andamento no Avadesk.',
        },
      ],
    },
    {
      id: 'agenda',
      label: 'Agenda',
      items: [
        {
          id: 'google-agenda',
          label: 'Agenda',
          href: '/portal/agenda',
          require: 'auth',
          status: 'live',
          icon: 'calendar',
          currentKey: 'portal-agenda',
          description: 'Reuniões, treinamentos e eventos internos.',
        },
        {
          id: 'google-agenda-ext',
          label: 'Google Agenda',
          href: calendarUrl(),
          require: 'admin',
          status: 'external',
          icon: 'calendar',
          external: true,
          currentKey: 'agenda',
          description: 'Calendário do escritório no Google Agenda.',
        },
      ],
    },
  ];
}

function canSeeItem(user, item) {
  if (!user || !item) return false;
  if (item.require === 'auth') return true;
  if (item.require === 'admin') return Boolean(user.isAdmin);
  if (item.require === 'folha') return Boolean(user.canFolha);
  if (item.require === 'conci') return Boolean(user.canConci);
  if (item.require === 'ncm') return Boolean(user.canNcm);
  return false;
}

function publicItem(item) {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    status: item.status,
    icon: item.icon || 'file-text',
    external: Boolean(item.external),
    currentKey: item.currentKey,
    description: item.description || '',
    section: item.section === 'config' ? 'config' : 'main',
  };
}

function getMenuForUser(user) {
  if (!user) return [];
  return buildCatalog()
    .map((dept) => {
      const items = dept.items.filter((item) => canSeeItem(user, item)).map(publicItem);
      return {
        id: dept.id,
        label: dept.label,
        items,
      };
    })
    .filter((dept) => dept.items.length > 0);
}

function findSoonModule(slug) {
  const id = String(slug || '').trim();
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  for (const dept of buildCatalog()) {
    const item = dept.items.find((entry) => entry.id === id && entry.status === 'soon');
    if (item) return item;
  }
  return null;
}

module.exports = {
  AVADESK_URL,
  getMenuForUser,
  findSoonModule,
};
