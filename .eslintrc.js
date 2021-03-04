module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'prettier',
  ],

  env: {
    node: true,
  },

  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'script',
  },

  overrides: [
    // TypeScript-specific rulesets
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser', // Specifies the ESLint parser
      parserOptions: {
        ecmaVersion: 2021, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
        ecmaFeatures: {
          jsx: true, // Allows for the parsing of JSX
        },
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', './src/**/tsconfig.json'],
      },
    },

    // renderer/browser-specific rules
    {
      files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
      extends: [
        'eslint:recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'plugin:@typescript-eslint/recommended', // A plugin that contains a bunch of ESLint rules that are TypeScript specific
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
      ],
      env: {
        browser: true,
      },
    },

    // main/Node/server-specific rules
    {
      files: ['src/main/**/*.ts', 'src/main/**/*.tsx'],
      extends: [
        'eslint:recommended',
        'plugin:node/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'plugin:@typescript-eslint/recommended', // A plugin that contains a bunch of ESLint rules that are TypeScript specific.
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
      ],
      env: {
        node: true,
      },
      rules: {
        'node/no-unpublished-import': [
          'error',
          {
            allowModules: ['electron'],
          },
        ],
        'node/no-unsupported-features/es-syntax': [
          'error',
          {
            ignores: ['modules'],
          },
        ],
      },
      settings: {
        node: {
          resolvePaths: [__dirname, '/src/main', '/src/renderer'],
          tryExtensions: ['.js', '.jsx', '.json', '.node', '.ts', '.d.ts'],
          allowModules: ['electron', 'fs-extra'],
        },
        'import/resolver': {
          node: {
            extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.node'],
            moduleDirectory: ['node_modules', 'src/renderer', 'src/main'],
          },
        },
      },
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
          'src/main/tsconfig.json',
          'src/renderer/tsconfig.json',
        ],
      },
    },
  },

  globals: {
    __static: 'readonly',
    __dirname: 'readonly',
  },
}
