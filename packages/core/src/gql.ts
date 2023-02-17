/* eslint-disable prefer-rest-params */
import { DocumentNode, DefinitionNode, Kind } from 'graphql';
import { AnyVariables, TypedDocumentNode } from './types';
import { keyDocument, stringifyDocument } from './utils';

const applyDefinitions = (
  fragmentNames: Map<string, string>,
  target: DefinitionNode[],
  source: Array<DefinitionNode> | ReadonlyArray<DefinitionNode>
) => {
  for (const definition of source) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      const name = definition.name.value;
      const value = stringifyDocument(definition);
      // Fragments will be deduplicated according to this Map
      if (!fragmentNames.has(name)) {
        fragmentNames.set(name, value);
        target.push(definition);
      } else if (
        process.env.NODE_ENV !== 'production' &&
        fragmentNames.get(name) !== value
      ) {
        // Fragments with the same names is expected to have the same contents
        console.warn(
          '[WARNING: Duplicate Fragment] A fragment with name `' +
            name +
            '` already exists in this document.\n' +
            'While fragment names may not be unique across your source, each name must be unique per document.'
        );
      }
    } else {
      target.push(definition);
    }
  }
};

/** A GraphQL parse function, which may be called as a tagged template literal, returning a parsed {@link DocumentNode}.
 *
 * @remarks
 * The `gql` tag or function is used to parse a GraphQL query document into a {@link DocumentNode}.
 *
 * When used as a tagged template, `gql` will automatically merge fragment definitions into the resulting
 * document and deduplicate them.
 *
 * It enforces that all fragments have a unique name. When fragments with different definitions share a name,
 * it will log a warning in development.
 *
 * Hint: It’s recommended to use this `gql` function over other GraphQL parse functions, since it puts the parsed
 * results directly into `@urql/core`’s internal caches and prevents further unnecessary work.
 *
 * @example
 * ```ts
 * const AuthorFragment = gql`
 *   fragment AuthorDisplayComponent on Author {
 *     id
 *     name
 *   }
 * `;
 *
 * const BookFragment = gql`
 *   fragment ListBookComponent on Book {
 *     id
 *     title
 *     author {
 *       ...AuthorDisplayComponent
 *     }
 *   }
 *
 *   ${AuthorFragment}
 * `;
 *
 * const BookQuery = gql`
 *   query Book($id: ID!) {
 *     book(id: $id) {
 *       ...BookFragment
 *     }
 *   }
 *
 *   ${BookFragment}
 * `;
 * ```
 */
function gql<Data = any, Variables extends AnyVariables = AnyVariables>(
  strings: TemplateStringsArray,
  ...interpolations: Array<TypedDocumentNode | DocumentNode | string>
): TypedDocumentNode<Data, Variables>;

function gql<Data = any, Variables extends AnyVariables = AnyVariables>(
  string: string
): TypedDocumentNode<Data, Variables>;

function gql(/* arguments */) {
  const fragmentNames = new Map<string, string>();
  const definitions: DefinitionNode[] = [];
  const interpolations: DefinitionNode[] = [];

  // Apply the entire tagged template body's definitions
  let body: string = Array.isArray(arguments[0])
    ? arguments[0][0]
    : arguments[0] || '';
  for (let i = 1; i < arguments.length; i++) {
    const value = arguments[i];
    if (value && value.definitions) {
      interpolations.push(...value.definitions);
    } else {
      body += value;
    }

    body += arguments[0][i];
  }

  // Apply the tag's body definitions
  applyDefinitions(fragmentNames, definitions, keyDocument(body).definitions);
  // Copy over each interpolated document's definitions
  applyDefinitions(fragmentNames, definitions, interpolations);

  return keyDocument({
    kind: Kind.DOCUMENT,
    definitions,
  });
}

export { gql };
