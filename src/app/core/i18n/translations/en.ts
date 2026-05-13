/** Nested message map; leaves are translatable strings (not English-specific literals). */
export type TranslationTree = {
  readonly [key: string]: string | TranslationTree;
};

export const en = {
  shell: {
    brand: 'Incident Hub',
    nav: {
      platformTenants: 'Platform tenants',
      tenantUsers: 'Tenant users',
      dashboard: 'Dashboard',
      tickets: 'Tickets',
      newRequest: 'New request',
    },
    topbarTitle: 'AI-assisted Incident & Service Request',
    toggleTheme: 'Toggle theme',
    logout: 'Logout',
    localeAria: 'Language',
    localeEn: 'EN',
    localeSv: 'SV',
  },
  common: {
    ok: 'OK',
    loadingShort: 'Loading…',
  },
  tenantUsers: {
    title: 'Tenant users',
    introPart1:
      'New users sign in with your organization’s primary email domain. Enter only the part before',
    introPart2: '— the domain is fixed.',
    addUser: 'Add user',
    domainMissing:
      'Primary email domain is not available. You cannot add users until it is configured.',
    fields: {
      name: 'Name',
      emailLocalPart: 'Email (local part)',
      emailLocalPartError:
        'Letters, digits, dots, hyphens, underscores; no leading/trailing dots.',
      role: 'Role',
      password: 'Password',
    },
    roles: {
      MANAGER: 'Manager',
      AGENT: 'Agent',
      REQUESTER: 'Requester',
    },
    create: 'Create',
    usersList: 'Users',
    loading: 'Loading…',
    deactivate: 'Deactivate',
    inactiveLabel: 'Inactive',
    domainLoading: '(loading…)',
    snack: {
      loadFailed: 'Failed to load users',
      userCreated: 'User created',
      createFailed: 'Create failed (duplicate email or invalid local part)',
      updateFailed: 'Update failed',
    },
  },
} as const satisfies TranslationTree;
