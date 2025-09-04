import type { JsonSchemaDraft2020_12 } from '../openApi/3.1.x/types/json-schema-draft-2020-12';
import type {
  SecuritySchemeObject,
  ServerObject,
} from '../openApi/3.1.x/types/spec';
import type { StringCase } from '../types/case';
import type { IRContext } from './context';
import type { IRMediaType } from './mediaType';

interface IRBodyObject {
  mediaType: string;
  /**
   * Does body control pagination? We handle only simple values
   * for now, up to 1 nested field.
   */
  pagination?: boolean | string;
  required?: boolean;
  schema: IRSchemaObject;
  type?: IRMediaType;
}

interface IRComponentsObject {
  parameters?: Record<string, IRParameterObject>;
  requestBodies?: Record<string, IRRequestBodyObject>;
  schemas?: Record<string, IRSchemaObject>;
}

interface IRContextFile {
  /**
   * Define casing for identifiers in this file.
   */
  case?: StringCase;
  /**
   * Should the exports from this file be re-exported in the index barrel file?
   */
  exportFromIndex?: boolean;
  /**
   * Unique file identifier.
   */
  id: string;
  /**
   * Relative file path to the output path.
   *
   * @example
   * 'bar/foo.ts'
   */
  path: string;
}

interface IRHooks {
  /**
   * Hooks specifically for overriding operations behavior.
   *
   * Use these to classify operations, decide which outputs to generate,
   * or apply custom behavior to individual operations.
   */
  operations?: {
    /**
     * Classify the given operation into one or more kinds.
     *
     * Each kind determines how we treat the operation (e.g., generating queries or mutations).
     *
     * **Default behavior:**
     * - GET → 'query'
     * - DELETE, PATCH, POST, PUT → 'mutation'
     *
     * **Resolution order:**
     * 1. If `isQuery` or `isMutation` returns `true` or `false`, that overrides `getKind`.
     * 2. If `isQuery` or `isMutation` returns `undefined`, the result of `getKind` is used.
     *
     * @param operation - The operation object to classify.
     * @returns An array containing one or more of 'query' or 'mutation'.
     */
    getKind?: (
      operation: IROperationObject,
    ) => ReadonlyArray<'mutation' | 'query'>;
    /**
     * Check if the given operation should be treated as a mutation.
     *
     * This affects which outputs are generated for the operation.
     *
     * **Default behavior:** DELETE, PATCH, POST, and PUT operations are treated as mutations.
     *
     * **Resolution order:** If this returns `true` or `false`, it overrides `getKind`.
     * If it returns `undefined`, `getKind` is used instead.
     *
     * @param operation - The operation object to check.
     * @returns true if the operation is a mutation, false otherwise, or undefined to fallback to `getKind`.
     */
    isMutation?: (operation: IROperationObject) => boolean | undefined;
    /**
     * Check if the given operation should be treated as a query.
     *
     * This affects which outputs are generated for the operation.
     *
     * **Default behavior:** GET operations are treated as queries.
     *
     * **Resolution order:** If this returns `true` or `false`, it overrides `getKind`.
     * If it returns `undefined`, `getKind` is used instead.
     *
     * @param operation - The operation object to check.
     * @returns true if the operation is a query, false otherwise, or undefined to fallback to `getKind`.
     */
    isQuery?: (operation: IROperationObject) => boolean | undefined;
  };
}

interface IROperationObject {
  body?: IRBodyObject;
  deprecated?: boolean;
  description?: string;
  id: string;
  method: keyof IRPathItemObject;
  operationId?: string;
  parameters?: IRParametersObject;
  path: keyof IRPathsObject;
  responses?: IRResponsesObject;
  security?: ReadonlyArray<IRSecurityObject>;
  servers?: ReadonlyArray<IRServerObject>;
  summary?: string;
  tags?: ReadonlyArray<string>;
}

interface IRParametersObject {
  cookie?: Record<string, IRParameterObject>;
  header?: Record<string, IRParameterObject>;
  path?: Record<string, IRParameterObject>;
  query?: Record<string, IRParameterObject>;
}

interface IRParameterObject
  extends Pick<JsonSchemaDraft2020_12, 'deprecated' | 'description'> {
  /**
   * Determines whether the parameter value SHOULD allow reserved characters, as defined by RFC3986 `:/?#[]@!$&'()*+,;=` to be included without percent-encoding. The default value is `false`. This property SHALL be ignored if the request body media type is not `application/x-www-form-urlencoded` or `multipart/form-data`. If a value is explicitly defined, then the value of `contentType` (implicit or explicit) SHALL be ignored.
   */
  allowReserved?: boolean;
  /**
   * When this is true, property values of type `array` or `object` generate separate parameters for each value of the array, or key-value-pair of the map. For other types of properties this property has no effect. When `style` is `form`, the default value is `true`. For all other styles, the default value is `false`. This property SHALL be ignored if the request body media type is not `application/x-www-form-urlencoded` or `multipart/form-data`. If a value is explicitly defined, then the value of `contentType` (implicit or explicit) SHALL be ignored.
   */
  explode: boolean;
  /**
   * Endpoint parameters must specify their location.
   */
  location: 'cookie' | 'header' | 'path' | 'query';
  name: string;
  /**
   * Does this parameter control pagination? We handle only simple values
   * for now, up to 1 nested field.
   */
  pagination?: boolean | string;
  required?: boolean;
  schema: IRSchemaObject;
  /**
   * Describes how the parameter value will be serialized depending on the type of the parameter value. Default values (based on value of `in`): for `query` - `form`; for `path` - `simple`; for `header` - `simple`; for `cookie` - `form`.
   */
  style:
    | 'deepObject'
    | 'form'
    | 'label'
    | 'matrix'
    | 'pipeDelimited'
    | 'simple'
    | 'spaceDelimited';
}

interface IRPathsObject {
  [path: `/${string}`]: IRPathItemObject;
}

interface IRPathItemObject {
  delete?: IROperationObject;
  get?: IROperationObject;
  head?: IROperationObject;
  options?: IROperationObject;
  patch?: IROperationObject;
  post?: IROperationObject;
  put?: IROperationObject;
  trace?: IROperationObject;
}

interface IRRequestBodyObject
  extends Pick<JsonSchemaDraft2020_12, 'description'> {
  required?: boolean;
  schema: IRSchemaObject;
}

interface IRResponsesObject {
  /**
   * Any {@link https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#http-status-codes HTTP status code} can be used as the property name, but only one property per code, to describe the expected response for that HTTP status code. This field MUST be enclosed in quotation marks (for example, "200") for compatibility between JSON and YAML. To define a range of response codes, this field MAY contain the uppercase wildcard character `X`. For example, `2XX` represents all response codes between `[200-299]`. Only the following range definitions are allowed: `1XX`, `2XX`, `3XX`, `4XX`, and `5XX`. If a response is defined using an explicit code, the explicit code definition takes precedence over the range definition for that code.
   */
  [statusCode: string]: IRResponseObject | undefined;
  /**
   * The documentation of responses other than the ones declared for specific HTTP response codes. Use this field to cover undeclared responses.
   */
  default?: IRResponseObject;
}

interface IRResponseObject {
  // TODO: parser - handle headers, links, and possibly other media types?
  mediaType?: string;
  schema: IRSchemaObject;
}

interface IRSchemaObject
  extends Pick<
    JsonSchemaDraft2020_12,
    | '$ref'
    | 'const'
    | 'default'
    | 'deprecated'
    | 'description'
    | 'exclusiveMaximum'
    | 'exclusiveMinimum'
    | 'maximum'
    | 'maxItems'
    | 'maxLength'
    | 'minimum'
    | 'minItems'
    | 'minLength'
    | 'pattern'
    | 'required'
    | 'title'
    | 'example'
  > {
  /**
   * If the schema is intended to be used as an object property, it can be
   * marked as read-only or write-only. This value controls whether the schema
   * receives the "readonly" TypeScript keyword.
   */
  accessScope?: 'read' | 'write';
  /**
   * Similar to `accessScope`, but tells us whether the schema as a whole
   * contains any read-only or write-only fields. This value controls whether
   * we split the schema into individual schemas for payloads and responses.
   */
  accessScopes?: ReadonlyArray<'both' | 'read' | 'write'>;
  /**
   * If type is `object`, `additionalProperties` can be used to either define
   * a schema for properties not included in `properties` or disallow such
   * properties altogether.
   */
  additionalProperties?: IRSchemaObject | false;
  /**
   * Any string value is accepted as `format`.
   */
  format?: JsonSchemaDraft2020_12['format'] | 'binary' | 'integer';
  /**
   * If schema resolves into multiple items instead of a simple `type`, they
   * will be included in `items` array.
   */
  items?: ReadonlyArray<IRSchemaObject>;
  /**
   * When resolving a list of items, we need to know the relationship between
   * them. `logicalOperator` specifies this logical relationship.
   * @default 'or'
   */
  logicalOperator?: 'and' | 'or';
  /**
   * When type is `object`, `patternProperties` can be used to define a schema
   * for properties that match a specific regex pattern.
   */
  patternProperties?: Record<string, IRSchemaObject>;
  /**
   * When type is `object`, `properties` will contain a map of its properties.
   */
  properties?: Record<string, IRSchemaObject>;

  /**
   * The names of `properties` can be validated against a schema, irrespective
   * of their values. This can be useful if you don't want to enforce specific
   * properties, but you want to make sure that the names of those properties
   * follow a specific convention.
   */
  propertyNames?: IRSchemaObject;
  /**
   * Each schema eventually resolves into `type`.
   */
  type?:
    | 'array'
    | 'boolean'
    | 'enum'
    | 'integer'
    | 'never'
    | 'null'
    | 'number'
    | 'object'
    | 'string'
    | 'tuple'
    | 'undefined'
    | 'unknown'
    | 'void';
}

type IRSecurityObject = SecuritySchemeObject;

type IRServerObject = ServerObject;

type IRWebhookObject = IRPathItemObject;

interface IRModel {
  components?: IRComponentsObject;
  paths?: IRPathsObject;
  servers?: ReadonlyArray<IRServerObject>;
  webhooks?: Record<string, IRWebhookObject>;
}

export namespace IR {
  export type BodyObject = IRBodyObject;
  export type ComponentsObject = IRComponentsObject;
  export type Context<Spec extends Record<string, any> = any> = IRContext<Spec>;
  export type ContextFile = IRContextFile;
  export type Hooks = IRHooks;
  export type Model = IRModel;
  export type OperationObject = IROperationObject;
  export type ParameterObject = IRParameterObject;
  export type ParametersObject = IRParametersObject;
  export type PathItemObject = IRPathItemObject;
  export type PathsObject = IRPathsObject;
  export type ReferenceObject = ReferenceObject;
  export type RequestBodyObject = IRRequestBodyObject;
  export type ResponseObject = IRResponseObject;
  export type ResponsesObject = IRResponsesObject;
  export type SchemaObject = IRSchemaObject;
  export type SecurityObject = IRSecurityObject;
  export type ServerObject = IRServerObject;
  export type WebhookObject = IRWebhookObject;
}
