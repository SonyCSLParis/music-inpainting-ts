module.exports = {
  root: true,

  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],

  env: {
    node: true,
    es2021: true,
  },

  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['node_modules/**', '**/dist/**'],

  rules: {
    'no-warning-comments': [
      'warn',
      {
        terms: ['todo', 'fixme', 'xxx', 'hack'],
      },
    ],

    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: true,
        packageDir: __dirname,
      },
    ],
  },

  globals: {
    __static: 'readonly',
    __dirname: 'readonly',
  },

  overrides: [
    // TypeScript-specific rulesets
    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: [
        'plugin:import/typescript',
        'plugin:@typescript-eslint/recommended', // A plugin that contains a bunch of ESLint rules that are TypeScript specific
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
    },

    // renderer/browser-specific rules
    {
      files: ['packages/renderer/**/*.ts', 'packages/renderer/**/*.tsx'],
      env: {
        browser: true,
        node: false,
      },
    },

    // main/Node/server-specific rules
    {
      files: ['packages/main/**/*.ts', 'packages/main/**/*.tsx'],
      extends: ['plugin:node/recommended'],
      env: {
        node: true,
      },

      settings: {
        node: {
          resolvePaths: [__dirname, './packages/main', './packages/renderer'],
          tryExtensions: ['.js', '.jsx', '.json', '.node', '.ts', '.d.ts'],
          allowModules: ['electron', 'fs-extra'],
        },
        'import/resolver': {
          node: {
            extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.node'],
            moduleDirectory: [
              'node_modules',
              'packages/renderer',
              'packages/main',
            ],
          },
        },
      },
    },

    {
      files: '**/*.ts',
      rules: {
        // conflicts with import-plugin and does not support multiple package.json files
        'node/no-extraneous-import': 0,
      },
      extends: ['prettier'],
    },
  ],

  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: [
          'tsconfig.json',
          'packages/main/tsconfig.json',
          'packages/renderer/tsconfig.json',
        ],
      },
    },
  },
}
