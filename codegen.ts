import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // Backend GraphQL endpoint
  schema: 'schema.graphql',

  // Where to find GraphQL queries/mutations
  documents: 'src/graphql/**/*.graphql',

  ignoreNoDocuments: true,

  // Generate TypeScript types
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],

      config: {
        // Type safety options
        nonOptionalTypename: true,
        dedupeFragments: true,
        skipTypename: false,

        // Make types more strict
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: true,
          defaultValue: false
        },
        enumsAsTypes: true
      }
    }
  }
};

export default config;
