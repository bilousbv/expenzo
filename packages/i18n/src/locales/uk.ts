import type { Messages } from './en';

/**
 * The Ukrainian catalogue — the app's default language.
 *
 * Typed against `Messages`, so a key added to English and forgotten here fails
 * `check-types` rather than rendering in the wrong language at runtime.
 *
 * The intersection adds the plural forms Ukrainian needs and English does not.
 * Ukrainian selects `_one` for 1, 21, 31…, `_few` for 2-4, 22-24…, and `_many`
 * for 5-20 and the rest: одна витрата, дві витрати, п'ять витрат. Leaving
 * `_few` and `_many` out does not fail loudly — i18next falls back to the
 * singular and produces «5 витрата», which is the sort of thing that makes an
 * interface read as machine-made.
 */
export const uk: Messages & {
  expenses: { count_few: string; count_many: string };
} = {
  common: {
    appName: 'Expenzo',
    close: 'Закрити',
    cancel: 'Скасувати',
    delete: 'Видалити',
    done: 'Готово',
    loading: 'Завантаження…',
    everyone: 'Усі',
    everything: 'Усе',
    uncategorised: 'Без категорії',
    member: 'Учасник',
    language: 'Мова',
    today: 'Сьогодні',
    yesterday: 'Вчора',
  },

  auth: {
    signIn: 'Увійти',
    signingIn: 'Вхід…',
    signInTitle: 'Вхід до Expenzo',
    createAccount: 'Створити акаунт',
    creatingAccount: 'Створення акаунта…',
    createAccountTitle: 'Створення акаунта Expenzo',
    createAccountExplainer:
      'Ви отримаєте власне домогосподарство і зможете запросити до нього людей.',
    email: 'Електронна пошта',
    emailPlaceholder: 'ви@приклад.com',
    firstName: 'Ім’я',
    lastName: 'Прізвище',
    baseCurrency: 'Валюта',
    baseCurrencyExplainer:
      'Валюта, в якій рахує ваше домогосподарство. Її не можна змінити, щойно щось записано.',
    password: 'Пароль',
    confirmPassword: 'Підтвердьте пароль',
    magicLinkExplainer: 'Ми надішлемо посилання на пошту. Пароль не потрібен.',
    showMagicLink: 'Надіслати посилання для входу',
    sendMagicLink: 'Надіслати посилання',
    sendingMagicLink: 'Надсилання…',
    magicLinkSent: 'Перевірте пошту — там посилання для входу.',
    alreadyHaveAccount: 'Вже маєте акаунт? ',
    noAccountYet: 'Ще немає акаунта? ',
    createOne: 'Створити',
    continueWithGoogle: 'Продовжити з Google',
    continueWithApple: 'Продовжити з Apple',
    signOut: 'Вийти',
    errors: {
      checkDetails: 'Перевірте дані та спробуйте ще раз.',
      signInFailed: 'Не вдалося увійти. Спробуйте ще раз.',
      sendLinkFailed: 'Не вдалося надіслати посилання. Спробуйте ще раз.',
      providerUnreachable: 'Не вдалося звʼязатися з цим провайдером.',
      providerNoUrl: 'Провайдер не повернув посилання для входу.',
      invalidEmail: 'Введіть коректну адресу електронної пошти.',
      missingCode: 'У цьому посиланні для входу немає коду.',
      linkFailed: 'Це посилання не спрацювало',
      linkFailedExplainer:
        'Посилання для входу діє один раз і має термін дії. Попросіть надіслати нове.',
    },
  },

  nav: {
    limits: 'Ліміти',
    profile: 'Ви',
    settings: 'Налаштування',
    subscriptions: 'Підписки',
    notFound: 'Не знайдено',
    newExpense: 'Нова витрата',
    manageCategories: 'Керувати категоріями',
    backToExpenses: 'Назад до витрат',
    goToExpenses: 'Перейти до витрат',
    goToExpenseList: 'Перейти до списку витрат',
  },

  pageTitle: {
    dashboard: 'Огляд · Expenzo',
    categories: 'Категорії · Expenzo',
    household: 'Домогосподарство · Expenzo',
    limits: 'Ліміти · Expenzo',
    signIn: 'Вхід · Expenzo',
    register: 'Створення акаунта · Expenzo',
    invite: 'Приєднання до домогосподарства · Expenzo',
    subscriptions: 'Підписки · Expenzo',
    profile: 'Ваш профіль · Expenzo',
    description: 'Облік витрат у браузері та на телефоні.',
  },

  invite: {
    failed: 'Це запрошення не спрацювало',
    explainer:
      'Посилання-запрошення діє один раз і втрачає чинність через 14 днів. Попросіть того, хто вас запросив, надіслати нове.',
  },

  dashboard: {
    leftThisPeriod: 'Залишилось за період',
    income: 'Дохід',
    spent: 'Витрачено',
    wholePeriodNote: 'Весь період, а не лише те, що показано у списку',
    period: 'Період',
    author: 'Автор',
    byCategory: 'За категоріями',
    nothingSpent: 'За цей період витрат немає.',
    rangeSeparator: 'до',
  },

  period: {
    'this-month': 'Цей місяць',
    'last-month': 'Минулий місяць',
    'this-week': 'Цей тиждень',
  },

  expenses: {
    title: 'Витрати',
    add: 'Додати',
    addDialogTitle: 'Додати витрату',
    count_one: '{{count}} витрата',
    count_few: '{{count}} витрати',
    count_many: '{{count}} витрат',
    count_other: '{{count}} витрати',
    nothingRecorded: 'За цей період нічого не записано.',
    loadMore: 'Показати ще',
    fallbackName: 'Витрата',
    deleteLabel: 'Видалити {{name}}',
    direction: 'Тип',
    spending: 'Витрата',
    incomeDirection: 'Дохід',
    date: 'Дата',
    datePlaceholder: 'РРРР-ММ-ДД',
    merchant: 'Продавець',
    merchantPlaceholder: 'Аромат кави',
    note: 'Нотатка',
    addExpense: 'Додати витрату',
    adding: 'Додавання…',
    errors: {
      invalid: 'Перевірте витрату та спробуйте ще раз.',
      addFailed: 'Не вдалося додати витрату.',
    },
  },

  cadence: {
    weekly: 'Щотижня',
    monthly: 'Щомісяця',
    quarterly: 'Щокварталу',
    semiannual: 'Раз на пів року',
    yearly: 'Щороку',
  },

  subscriptions: {
    title: 'Підписки',
    add: 'Додати підписку',
    adding: 'Додавання…',
    heading: 'Додати підписку',
    service: 'Сервіс',
    serviceUnlisted: 'Немає у списку',
    name: 'Назва',
    namePlaceholder: 'Netflix',
    amount: 'Сума',
    billingCycle: 'Періодичність',
    startedOn: 'Початок',
    nextCharge: 'Наступний платіж {{date}}',
    perYear: '{{amount}} на рік',
    none: 'Ще нічого немає. Додайте те, за що домогосподарство платить щомісяця.',
    cancelled: 'Скасовано',
    cancelLabel: 'Скасувати {{name}}',
    reactivateLabel: 'Відновити {{name}}',
    deleteLabel: 'Видалити {{name}}',
    errors: {
      invalid: 'Перевірте підписку та спробуйте ще раз.',
      addFailed: 'Не вдалося додати підписку.',
    },
  },

  categories: {
    title: 'Категорії',
    name: 'Назва',
    namePlaceholder: 'Кава',
    colour: 'Колір',
    add: 'Додати категорію',
    adding: 'Додавання…',
    archiveLabel: 'Архівувати {{name}}',
    yours: 'Ваші категорії',
    builtIn: 'Вбудовані',
    colours: {
      blue: 'Синій',
      orange: 'Помаранчевий',
      teal: 'Бірюзовий',
      purple: 'Фіолетовий',
      pink: 'Рожевий',
      green: 'Зелений',
      red: 'Червоний',
      slate: 'Сірий',
    },
    errors: {
      invalid: 'Ця категорія некоректна.',
      addFailed: 'Не вдалося додати категорію.',
    },
  },

  limits: {
    title: 'Ліміти витрат',
    amount: 'Сума',
    monthly: 'Місячний ліміт',
    setHeading: 'Встановити ліміт',
    current: 'Поточні ліміти',
    none: 'Лімітів немає. Витрати показуються без ліміту, доки ви його не додасте.',
    householdWide: 'Усе (на домогосподарство)',
    removeLabel: 'Прибрати ліміт',
    set: 'Встановити ліміт',
    saving: 'Збереження…',
    fallbackCategory: 'Категорія',
    errors: {
      invalid: 'Це не ліміт.',
      setFailed: 'Не вдалося встановити ліміт.',
    },
  },

  household: {
    title: 'Домогосподарство',
    invite: 'Запросити',
    inviting: 'Надсилання запрошення…',
    emailPlaceholder: 'колега@приклад.com',
    members: 'Учасники',
    inviteSomeone: 'Запросити людину',
    joined: 'Ви приєдналися до домогосподарства',
    joinedExplainer: 'Спільні витрати та підписки тепер видимі вам.',
    linkExplainer:
      'Надішліть це посилання тому, кого запрошуєте. Воно спрацює один раз і діятиме 14 днів.',
    errors: {
      inviteFailed: 'Не вдалося створити запрошення.',
      noToken: 'Сервер не повернув токен запрошення.',
    },
  },

  profile: {
    title: 'Ваш профіль',
    explainer: 'Ваше ім’я бачитимуть інші учасники домогосподарства біля кожної витрати.',
    firstName: 'Ім’я',
    lastName: 'Прізвище',
    displayCurrency: 'Показувати мої підсумки в',
    displayCurrencyExplainer:
      'Усе й далі записується у валюті домогосподарства. Це змінює лише те, що бачите ви, — за сьогоднішнім курсом.',
    photo: 'Фото',
    choosePhoto: 'Обрати фото',
    replacePhoto: 'Замінити фото',
    removePhoto: 'Видалити фото',
    uploadingPhoto: 'Завантаження…',
    photoExplainer: 'Його бачать лише учасники вашого домогосподарства.',
    save: 'Зберегти',
    saving: 'Збереження…',
    saved: 'Збережено',
    saveFailed: 'Не вдалося зберегти профіль. Спробуйте ще раз.',
  },

  validation: {
    email: {
      required: 'Введіть адресу електронної пошти',
      invalid: 'Введіть коректну адресу електронної пошти',
    },
    name: {
      required: 'Введіть ім’я',
      tooLong: 'Це ім’я задовге',
    },
    avatar: {
      notAnImage: 'Оберіть зображення JPEG, PNG або WebP',
      tooLarge: 'Це зображення завелике — не більше 2 МБ',
    },
    password: {
      tooShort: 'Використайте щонайменше {{min}} символів',
      tooLong: 'Цей пароль задовгий — не більше {{max}} байтів',
      mismatch: 'Паролі не збігаються',
    },
    amount: {
      integer: 'Сума має бути цілим числом у найменших одиницях',
      positive: 'Сума має бути більшою за нуль',
    },
    currency: {
      invalid: 'Валюта має бути трилітерним кодом ISO у верхньому регістрі',
    },
    date: {
      format: 'Дата має бути у форматі РРРР-ММ-ДД',
      unreal: 'Такої дати не існує',
      rangeReversed: 'Кінець періоду не може передувати його початку',
    },
    uuid: {
      invalid: 'Має бути UUID',
    },
    category: {
      nameRequired: 'Дайте категорії назву',
      nameTooLong: 'Ця назва задовга',
      nameNeedsCharacter: 'Назва має містити хоча б одну літеру або цифру',
      colourInvalid: 'Колір має бути шестизначним шістнадцятковим значенням, як #337dff',
      sortOrderInteger: 'Порядок сортування має бути цілим числом',
    },
    limit: {
      positive: 'Ліміт має бути більшим за нуль',
    },
    subscription: {
      nameRequired: 'Дайте підписці назву',
      nameTooLong: 'Ця назва задовга',
      anchorDay: 'День списання має бути від 1 до 31',
      intervalCount: 'Інтервал має бути щонайменше один',
    },
  },
};
