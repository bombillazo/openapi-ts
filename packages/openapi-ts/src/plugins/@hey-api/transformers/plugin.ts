import ts from 'typescript';

import type {
  EnsureUniqueIdentifierData,
  GeneratedFile,
} from '../../../generate/file';
import { parseRef } from '../../../generate/file';
import type { Identifier, Namespace } from '../../../generate/file/types';
import {
  createOperationKey,
  operationResponsesMap,
} from '../../../ir/operation';
import type { IR } from '../../../ir/types';
import { tsc } from '../../../tsc';
import { stringCase } from '../../../utils/stringCase';
import { typesId } from '../typescript/ref';
import { bigIntExpressions, dateExpressions } from './expressions';
import type { HeyApiTransformersPlugin } from './types';

interface OperationIRRef {
  /**
   * Operation ID
   */
  id: string;
}

export const operationTransformerIrRef = ({
  id,
  type,
}: OperationIRRef & {
  type: 'data' | 'error' | 'response';
}): string => {
  let affix = '';
  switch (type) {
    case 'data':
      affix = 'DataResponseTransformer';
      break;
    case 'error':
      affix = 'ErrorResponseTransformer';
      break;
    case 'response':
      affix = 'ResponseTransformer';
      break;
  }
  const irRef = '#/ir/';
  return `${irRef}${stringCase({
    // TODO: parser - do not pascalcase for functions, only for types
    case: 'camelCase',
    value: id,
  })}${affix}`;
};

const schemaIrRef = ({
  $ref,
  type,
}: {
  $ref: string;
  type: 'response';
}): string => {
  let affix = '';
  switch (type) {
    case 'response':
      affix = 'SchemaResponseTransformer';
      break;
  }
  const parts = $ref.split('/');
  return `${parts.slice(0, parts.length - 1).join('/')}/${stringCase({
    case: 'camelCase',
    value: parts[parts.length - 1]!,
  })}${affix}`;
};

export const schemaResponseTransformerRef = ({
  $ref,
}: {
  $ref: string;
}): string => schemaIrRef({ $ref, type: 'response' });

export const transformersId = 'transformers';
const dataVariableName = 'data';

const ensureStatements = (
  nodes: Array<ts.Expression | ts.Statement>,
): Array<ts.Statement> =>
  nodes.map((node) =>
    ts.isStatement(node)
      ? node
      : tsc.expressionToStatement({ expression: node }),
  );

const isNodeReturnStatement = ({
  node,
}: {
  node: ts.Expression | ts.Statement;
}) => node.kind === ts.SyntaxKind.ReturnStatement;

const schemaResponseTransformerNodes = ({
  plugin,
  schema,
}: {
  plugin: HeyApiTransformersPlugin['Instance'];
  schema: IR.SchemaObject;
}): Array<ts.Expression | ts.Statement> => {
  const identifierData = tsc.identifier({ text: dataVariableName });
  const nodes = processSchemaType({
    dataExpression: identifierData,
    plugin,
    schema,
  });
  // append return statement if one does not already exist
  if (
    nodes.length &&
    !isNodeReturnStatement({ node: nodes[nodes.length - 1]! })
  ) {
    nodes.push(tsc.returnStatement({ expression: identifierData }));
  }
  return nodes;
};

/**
 * Prevents a specific identifier from being created. This is useful for
 * transformers where we know a certain transformer won't be needed, and
 * we want to avoid attempting to create since we know it won't happen.
 */
const blockIdentifier = ({
  $ref,
  file,
  namespace,
}: Pick<EnsureUniqueIdentifierData, '$ref'> & {
  file: GeneratedFile;
  namespace: Namespace;
}): Identifier => {
  const { name, ref } = parseRef($ref);
  const refValue =
    file.identifiers[name.toLocaleLowerCase()]?.[namespace]?.[ref];
  if (!refValue) {
    throw new Error(
      `Identifier for $ref ${$ref} in namespace ${namespace} not found`,
    );
  }

  refValue.name = false;

  return {
    created: false,
    name: refValue.name,
  };
};

const processSchemaType = ({
  dataExpression,
  plugin,
  schema,
}: {
  dataExpression?: ts.Expression | string;
  plugin: HeyApiTransformersPlugin['Instance'];
  schema: IR.SchemaObject;
}): Array<ts.Expression | ts.Statement> => {
  const file = plugin.context.file({ id: transformersId })!;

  if (schema.$ref) {
    let identifier = file.identifier({
      $ref: schemaResponseTransformerRef({ $ref: schema.$ref }),
      create: true,
      namespace: 'value',
    });

    if (identifier.created && identifier.name) {
      // create each schema response transformer only once
      const refSchema = plugin.context.resolveIrRef<IR.SchemaObject>(
        schema.$ref,
      );
      const nodes = schemaResponseTransformerNodes({
        plugin,
        schema: refSchema,
      });
      if (nodes.length) {
        const node = tsc.constVariable({
          expression: tsc.arrowFunction({
            async: false,
            multiLine: true,
            parameters: [
              {
                name: dataVariableName,
                // TODO: parser - add types, generate types without transforms
                type: tsc.keywordTypeNode({ keyword: 'any' }),
              },
            ],
            statements: ensureStatements(nodes),
          }),
          name: identifier.name,
        });
        file.add(node);
      } else {
        // the created schema response transformer was empty, do not generate
        // it and prevent any future attempts
        identifier = blockIdentifier({
          $ref: schemaResponseTransformerRef({ $ref: schema.$ref }),
          file,
          namespace: 'value',
        });
      }
    }

    if (identifier.name) {
      const callExpression = tsc.callExpression({
        functionName: identifier.name,
        parameters: [dataExpression],
      });

      if (dataExpression) {
        // In a map callback, the item needs to be returned, not just the transformation result
        if (typeof dataExpression === 'string' && dataExpression === 'item') {
          return [
            tsc.returnStatement({
              expression: callExpression,
            }),
          ];
        }

        return [
          typeof dataExpression === 'string'
            ? callExpression
            : tsc.assignment({
                left: dataExpression,
                right: callExpression,
              }),
        ];
      }
    }

    return [];
  }

  if (schema.type === 'array') {
    if (!dataExpression || typeof dataExpression === 'string') {
      return [];
    }

    // TODO: parser - handle tuples and complex arrays
    const nodes = !schema.items
      ? []
      : processSchemaType({
          dataExpression: 'item',
          plugin,
          schema: schema.items?.[0]
            ? schema.items[0]
            : {
                ...schema,
                type: undefined,
              },
        });

    if (!nodes.length) {
      return [];
    }

    // Ensure the map callback has a return statement for the item
    const mapCallbackStatements = ensureStatements(nodes);
    const hasReturnStatement = mapCallbackStatements.some((stmt) =>
      isNodeReturnStatement({ node: stmt }),
    );

    if (!hasReturnStatement) {
      mapCallbackStatements.push(
        tsc.returnStatement({
          expression: tsc.identifier({ text: 'item' }),
        }),
      );
    }

    return [
      tsc.assignment({
        left: dataExpression,
        right: tsc.callExpression({
          functionName: tsc.propertyAccessExpression({
            expression: dataExpression,
            name: 'map',
          }),
          parameters: [
            tsc.arrowFunction({
              multiLine: true,
              parameters: [
                {
                  name: 'item',
                  type: 'any',
                },
              ],
              statements: mapCallbackStatements,
            }),
          ],
        }),
      }),
    ];
  }

  if (schema.type === 'object') {
    let nodes: Array<ts.Expression | ts.Statement> = [];
    const required = schema.required ?? [];

    for (const name in schema.properties) {
      const property = schema.properties[name]!;
      const propertyAccessExpression = tsc.propertyAccessExpression({
        expression: dataExpression || dataVariableName,
        name,
      });
      const propertyNodes = processSchemaType({
        dataExpression: propertyAccessExpression,
        plugin,
        schema: property,
      });
      if (!propertyNodes.length) {
        continue;
      }
      const noNullableTypesInSchema = !property.items?.find(
        (x) => x.type === 'null',
      );
      const requiredField = required.includes(name);
      // Cannot fully rely on required fields
      // Such value has to be present, but it doesn't guarantee that this value is not nullish
      if (requiredField && noNullableTypesInSchema) {
        nodes = nodes.concat(propertyNodes);
      } else {
        nodes.push(
          // todo: Probably, it would make more sense to go with if(x !== undefined && x !== null) instead of if(x)
          // this place influences all underlying transformers, while it's not exactly transformer itself
          // Keep in mind that !!0 === false, so it already makes output for Bigint undesirable
          tsc.ifStatement({
            expression: propertyAccessExpression,
            thenStatement: tsc.block({
              statements: ensureStatements(propertyNodes),
            }),
          }),
        );
      }
    }

    return nodes;
  }

  if (schema.items) {
    if (schema.items.length === 1) {
      return processSchemaType({
        dataExpression: 'item',
        plugin,
        schema: schema.items[0]!,
      });
    }

    let arrayNodes: Array<ts.Expression | ts.Statement> = [];
    // process 2 items if one of them is null
    if (
      schema.logicalOperator === 'and' ||
      (schema.items.length === 2 &&
        schema.items.find(
          (item) => item.type === 'null' || item.type === 'void',
        ))
    ) {
      for (const item of schema.items) {
        const nodes = processSchemaType({
          dataExpression: dataExpression || 'item',
          plugin,
          schema: item,
        });
        if (nodes.length) {
          if (dataExpression) {
            arrayNodes = arrayNodes.concat(nodes);
          } else {
            const identifierItem = tsc.identifier({ text: 'item' });
            // processed means the item was transformed
            arrayNodes.push(
              tsc.ifStatement({
                expression: identifierItem,
                thenStatement: tsc.block({
                  statements: ensureStatements(nodes),
                }),
              }),
              tsc.returnStatement({ expression: identifierItem }),
            );
          }
        }
      }
      return arrayNodes;
    }

    // assume enums do not contain transformable values
    if (schema.type !== 'enum') {
      if (
        !(schema.items ?? []).every((item) =>
          (
            ['boolean', 'integer', 'null', 'number', 'string'] as ReadonlyArray<
              typeof item.type
            >
          ).includes(item.type),
        )
      ) {
        console.warn(
          `❗️ Transformers warning: schema ${JSON.stringify(schema)} is too complex and won't be currently processed. This will likely produce an incomplete transformer which is not what you want. Please open an issue if you'd like this improved https://github.com/hey-api/openapi-ts/issues`,
        );
      }
    }
  }

  for (const transformer of plugin.config.transformers ?? []) {
    const t = transformer({
      config: plugin.config,
      dataExpression,
      file,
      schema,
    });
    if (t) {
      return t;
    }
  }

  return [];
};

// handles only response transformers for now
export const handler: HeyApiTransformersPlugin['Handler'] = ({ plugin }) => {
  const file = plugin.createFile({
    id: transformersId,
    path: plugin.output,
  });

  if (plugin.config.dates) {
    plugin.config.transformers = [
      ...(plugin.config.transformers ?? []),
      dateExpressions,
    ];
  }

  if (plugin.config.bigInt) {
    plugin.config.transformers = [
      ...(plugin.config.transformers ?? []),
      bigIntExpressions,
    ];
  }

  plugin.forEach('operation', ({ operation }) => {
    const { response } = operationResponsesMap(operation);

    if (!response) {
      return;
    }

    if (response.items && response.items.length > 1) {
      if (plugin.context.config.logs.level === 'debug') {
        console.warn(
          `❗️ Transformers warning: route ${createOperationKey(operation)} has ${response.items.length} non-void success responses. This is currently not handled and we will not generate a response transformer. Please open an issue if you'd like this feature https://github.com/hey-api/openapi-ts/issues`,
        );
      }
      return;
    }

    const pluginTypeScript = plugin.getPlugin('@hey-api/typescript')!;
    const fileTypeScript = plugin.context.file({ id: typesId })!;
    const responseName = fileTypeScript.getName(
      pluginTypeScript.api.getId({ operation, type: 'response' }),
    );

    if (!responseName) {
      return;
    }

    let identifierResponseTransformer = file.identifier({
      $ref: operationTransformerIrRef({ id: operation.id, type: 'response' }),
      create: true,
      namespace: 'value',
    });
    if (!identifierResponseTransformer.name) {
      return;
    }

    // TODO: parser - consider handling simple string response which is also a date
    const nodes = schemaResponseTransformerNodes({ plugin, schema: response });
    if (nodes.length) {
      file.import({
        asType: true,
        module: file.relativePathToFile({
          context: plugin.context,
          id: typesId,
        }),
        name: responseName,
      });
      const responseTransformerNode = tsc.constVariable({
        exportConst: true,
        expression: tsc.arrowFunction({
          async: true,
          multiLine: true,
          parameters: [
            {
              name: dataVariableName,
              // TODO: parser - add types, generate types without transforms
              type: tsc.keywordTypeNode({ keyword: 'any' }),
            },
          ],
          returnType: tsc.typeReferenceNode({
            typeArguments: [
              tsc.typeReferenceNode({
                typeName: responseName,
              }),
            ],
            typeName: 'Promise',
          }),
          statements: ensureStatements(nodes),
        }),
        name: identifierResponseTransformer.name,
      });
      file.add(responseTransformerNode);
    } else {
      // the created schema response transformer was empty, do not generate
      // it and prevent any future attempts
      identifierResponseTransformer = blockIdentifier({
        $ref: operationTransformerIrRef({
          id: operation.id,
          type: 'response',
        }),
        file,
        namespace: 'value',
      });
    }
  });
};
