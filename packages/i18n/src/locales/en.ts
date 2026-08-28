/**
 * The English catalogue, and the shape every other language is checked against.
 *
 * `uk` is typed as `Messages`, so a key added here and forgotten there is a
 * compile error rather than a string that silently renders in the wrong
 * language. What the types cannot see — a Ukrainian value left as its English
 * source — is what catalogue.test.ts is for.
 *
 * Plural keys use i18next's suffixes and are resolved by `Intl.PluralRules`.
 * English needs `_one` and `_other`; Ukrainian needs `_one`, `_few` and
 * `_many`, so a count that reads correctly in one language is not evidence it
 * reads correctly in the other.
 */
export const en = {
  common: {
    appName: 'Expenzo',
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    done: 'Done',
    loading: 'Loading…',
    everyone: 'Everyone',
    everything: 'Everything',
    uncategorised: 'Uncategorised',
    member: 'Member',
    language: 'Language',
    today: 'Today',
    yesterday: 'Yesterday',
  },

  auth: {
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signInTitle: 'Sign in to Expenzo',
    createAccount: 'Create account',
    creatingAccount: 'Creating account…',
    createAccountTitle: 'Create your Expenzo account',
    createAccountExplainer:
      'You get a household of your own, and can invite people to it afterwards.',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    firstName: 'First name',
    lastName: 'Last name',
    baseCurrency: 'Currency',
    baseCurrencyExplainer:
      'What your household counts in. It cannot be changed once anything is recorded.',
    password: 'Password',
    confirmPassword: 'Confirm password',
    magicLinkExplainer: 'We will email you a link. No password needed.',
    showMagicLink: 'Email me a sign-in link instead',
    sendMagicLink: 'Send magic link',
    sendingMagicLink: 'Sending…',
    magicLinkSent: 'Check your email for a sign-in link.',
    alreadyHaveAccount: 'Already have an account? ',
    noAccountYet: 'No account yet? ',
    createOne: 'Create one',
    continueWithGoogle: 'Continue with Google',
    continueWithApple: 'Continue with Apple',
    signOut: 'Sign out',
    errors: {
      checkDetails: 'Check the details and try again.',
      signInFailed: 'Could not sign you in. Try again.',
      sendLinkFailed: 'Could not send the link. Try again.',
      providerUnreachable: 'Could not reach that provider.',
      providerNoUrl: 'That provider did not return a sign-in URL.',
      invalidEmail: 'Enter a valid email address.',
      missingCode: 'That sign-in link is missing its code.',
      linkFailed: 'That link did not work',
      linkFailedExplainer: 'Sign-in links work once and expire. Ask for a new one.',
    },
  },

  nav: {
    limits: 'Limits',
    primary: 'Main',
    profile: 'You',
    settings: 'Settings',
    subscriptions: 'Subscriptions',
    notFound: 'Not found',
    newExpense: 'New expense',
    manageCategories: 'Manage categories',
    backToDashboard: 'Back to the dashboard',
    backToExpenses: 'Back to your expenses',
    goToExpenses: 'Go to your expenses',
    goToExpenseList: 'Go to the expense list',
  },

  pageTitle: {
    dashboard: 'Dashboard · Expenzo',
    categories: 'Categories · Expenzo',
    household: 'Household · Expenzo',
    limits: 'Limits · Expenzo',
    signIn: 'Sign in · Expenzo',
    register: 'Create an account · Expenzo',
    invite: 'Join a household · Expenzo',
    subscriptions: 'Subscriptions · Expenzo',
    profile: 'Your profile · Expenzo',
    description: 'Track expenses on web and mobile.',
  },

  invite: {
    failed: 'That invitation did not work',
    explainer:
      'Invitation links work once and expire after 14 days. Ask whoever invited you to send a new one.',
  },

  dashboard: {
    leftThisPeriod: 'Left this period',
    income: 'Income',
    spent: 'Spent',
    wholePeriodNote: 'Everything in the period, not just what is listed',
    period: 'Period',
    author: 'Author',
    byCategory: 'By category',
    nothingSpent: 'Nothing spent in this period.',
    rangeSeparator: 'to',
  },

  period: {
    'this-month': 'This month',
    'last-month': 'Last month',
    'this-week': 'This week',
  },

  expenses: {
    title: 'Expenses',
    add: 'Add',
    addDialogTitle: 'Add an expense',
    count_one: '{{count}} expense',
    count_other: '{{count}} expenses',
    nothingRecorded: 'Nothing recorded in this period.',
    loadMore: 'Load more',
    fallbackName: 'Expense',
    deleteLabel: 'Delete {{name}}',
    direction: 'Direction',
    spending: 'Spending',
    incomeDirection: 'Income',
    date: 'Date',
    datePlaceholder: 'YYYY-MM-DD',
    merchant: 'Merchant',
    merchantPlaceholder: 'Blue Bottle',
    note: 'Note',
    addExpense: 'Add expense',
    adding: 'Adding…',
    errors: {
      invalid: 'Check the expense and try again.',
      addFailed: 'Could not add the expense.',
    },
  },

  cadence: {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semiannual: 'Every six months',
    yearly: 'Yearly',
  },

  subscriptions: {
    title: 'Subscriptions',
    add: 'Add subscription',
    adding: 'Adding…',
    heading: 'Add a subscription',
    service: 'Service',
    serviceUnlisted: 'Not listed',
    name: 'Name',
    namePlaceholder: 'Netflix',
    amount: 'Amount',
    billingCycle: 'Billing cycle',
    startedOn: 'Started on',
    nextCharge: 'Next {{date}}',
    perYear: '{{amount}} a year',
    none: 'Nothing recorded yet. Add what the household pays for monthly.',
    cancelled: 'Cancelled',
    cancelLabel: 'Cancel {{name}}',
    reactivateLabel: 'Reactivate {{name}}',
    deleteLabel: 'Delete {{name}}',
    errors: {
      invalid: 'Check the subscription and try again.',
      addFailed: 'Could not add the subscription.',
    },
  },

  categories: {
    title: 'Categories',
    name: 'Name',
    namePlaceholder: 'Coffee',
    colour: 'Colour',
    add: 'Add category',
    adding: 'Adding…',
    archiveLabel: 'Archive {{name}}',
    yours: 'Your categories',
    builtIn: 'Built in',
    colours: {
      blue: 'Blue',
      orange: 'Orange',
      teal: 'Teal',
      purple: 'Purple',
      pink: 'Pink',
      green: 'Green',
      red: 'Red',
      slate: 'Slate',
    },
    errors: {
      invalid: 'That category is not valid.',
      addFailed: 'Could not add the category.',
    },
  },

  limits: {
    title: 'Spending limits',
    amount: 'Amount',
    monthly: 'Monthly limit',
    setHeading: 'Set a limit',
    current: 'Current limits',
    none: 'No limits set. Spending is shown without one until you add it.',
    householdWide: 'Everything (household-wide)',
    removeLabel: 'Remove limit',
    set: 'Set limit',
    saving: 'Saving…',
    fallbackCategory: 'Category',
    errors: {
      invalid: 'That is not a limit.',
      setFailed: 'Could not set the limit.',
    },
  },

  household: {
    title: 'Household',
    invite: 'Invite',
    inviting: 'Inviting…',
    emailPlaceholder: 'them@example.com',
    members: 'Members',
    inviteSomeone: 'Invite someone',
    joined: 'You have joined the household',
    joinedExplainer: 'Shared expenses and subscriptions are now visible to you.',
    linkExplainer:
      'Send this link to the person you are inviting. It works once and expires in 14 days.',
    errors: {
      inviteFailed: 'Could not create the invitation.',
      noToken: 'The server did not return an invitation token.',
    },
  },

  profile: {
    title: 'Your profile',
    explainer: 'Your name is what the rest of your household sees on every expense.',
    firstName: 'First name',
    lastName: 'Last name',
    displayCurrency: 'Show my totals in',
    displayCurrencyExplainer:
      'Everything stays recorded in your household currency. This changes only what you are shown, converted at today’s rate.',
    photo: 'Photo',
    choosePhoto: 'Choose a photo',
    replacePhoto: 'Replace photo',
    removePhoto: 'Remove photo',
    uploadingPhoto: 'Uploading…',
    photoExplainer: 'Only people in your household can see it.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Could not save your profile. Try again.',
  },

  /**
   * Keys emitted by the zod schemas in packages/domain. The schemas stay free
   * of React and of locale — they return a key and the interpolation values it
   * needs, and whichever screen is showing the error translates it.
   */
  validation: {
    email: {
      required: 'Enter your email address',
      invalid: 'Enter a valid email address',
    },
    name: {
      required: 'Enter a name',
      tooLong: 'That name is too long',
    },
    avatar: {
      notAnImage: 'Choose a JPEG, PNG or WebP image',
      tooLarge: 'That image is too large — keep it under 2 MB',
    },
    password: {
      // Deliberately not {{count}}: that name is reserved by i18next for
      // pluralisation, and would send these looking for _one/_other forms that
      // do not exist. Neither string is counted — both quote a fixed limit.
      tooShort: 'Use at least {{min}} characters',
      tooLong: 'That password is too long — keep it under {{max}} bytes',
      mismatch: 'Those passwords do not match',
    },
    amount: {
      integer: 'Amount must be a whole number of minor units',
      positive: 'Amount must be greater than zero',
    },
    currency: {
      invalid: 'Currency must be a three-letter uppercase ISO code',
    },
    filter: {
      categoryConflict: 'Ask for one category or for those with none, not both',
    },
    date: {
      format: 'Date must be formatted YYYY-MM-DD',
      unreal: 'Not a real calendar date',
      rangeReversed: 'Range end must not precede its start',
    },
    uuid: {
      invalid: 'Must be a UUID',
    },
    category: {
      nameRequired: 'Give the category a name',
      nameTooLong: 'That name is too long',
      nameNeedsCharacter: 'That name needs at least one letter or digit',
      colourInvalid: 'Colour must be a six-digit hex value like #337dff',
      sortOrderInteger: 'Sort order must be a whole number',
    },
    limit: {
      positive: 'A limit has to be greater than zero',
    },
    subscription: {
      nameRequired: 'Give the subscription a name',
      nameTooLong: 'That name is too long',
      anchorDay: 'The billing day must be between 1 and 31',
      intervalCount: 'The interval must be at least one',
    },
  },
};

/**
 * The shape every other catalogue is held to.
 *
 * Deliberately no `as const` above: it would make each value its own literal
 * type, and `Messages` would then demand the Ukrainian catalogue contain the
 * English string — which is the exact opposite of the point. The structure is
 * what has to match; the words must not.
 */
export type Messages = typeof en;
