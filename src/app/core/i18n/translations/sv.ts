import type { TranslationTree } from './en';

/** Swedish UI copy — mirrored structure from `en.ts`. */
export const sv = {
  shell: {
    brand: 'Incident Hub',
    nav: {
      platformTenants: 'Plattformskunder',
      tenantUsers: 'Kontots användare',
      dashboard: 'Översikt',
      tickets: 'Ärenden',
      newRequest: 'Nytt ärende',
    },
    topbarTitle: 'AI-stödda incidenter & servicebegäranden',
    toggleTheme: 'Byt tema',
    logout: 'Logga ut',
    localeAria: 'Språk',
    localeEn: 'EN',
    localeSv: 'SV',
  },
  common: {
    ok: 'OK',
    loadingShort: 'Laddar…',
  },
  tenantUsers: {
    title: 'Kontots användare',
    introPart1:
      'Nya användare loggar in med er organisations primära e-postdomän. Ange bara delen före',
    introPart2: '— domänen är fast.',
    addUser: 'Lägg till användare',
    domainMissing:
      'Primär e-postdomän saknas. Du kan inte lägga till användare förrän den är konfigurerad.',
    fields: {
      name: 'Namn',
      emailLocalPart: 'E-post (lokal del)',
      emailLocalPartError:
        'Bokstäver, siffror, punkter, bindestreck och understreck; inga punkter i början eller slut.',
      role: 'Roll',
      password: 'Lösenord',
    },
    roles: {
      MANAGER: 'Chef',
      AGENT: 'Agent',
      REQUESTER: 'Beställare',
    },
    create: 'Skapa',
    usersList: 'Användare',
    loading: 'Laddar…',
    deactivate: 'Inaktivera',
    inactiveLabel: 'Inaktiv',
    domainLoading: '(laddar…)',
    snack: {
      loadFailed: 'Kunde inte ladda användare',
      userCreated: 'Användare skapad',
      createFailed: 'Misslyckades (dubblett e-post eller ogiltig lokal del)',
      updateFailed: 'Uppdatering misslyckades',
    },
  },
} as const satisfies TranslationTree;
