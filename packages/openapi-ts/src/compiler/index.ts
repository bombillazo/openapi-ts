import { type PathLike, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { ensureDirSync } from '../generate/utils';
import * as classes from './classes';
import * as convert from './convert';
import * as module from './module';
import * as _return from './return';
import * as transform from './transform';
import * as typedef from './typedef';
import * as types from './types';
import * as utils from './utils';

export type { Property } from './typedef';
export type { FunctionParameter } from './types';
export type { Comments } from './utils';
export type { ClassElement, Node, TypeNode } from 'typescript';

const splitNameAndExtension = (fileName: string) => {
  const match = fileName.match(/\.[0-9a-z]+$/i);
  const extension = match ? match[0].slice(1) : '';
  const name = fileName.slice(
    0,
    fileName.length - (extension ? extension.length + 1 : 0),
  );
  return { extension, name };
};

export class TypeScriptFile {
  private _headers: Array<string> = [];
  private _imports = new Map<
    string,
    Map<string, utils.ImportExportItemObject>
  >();
  private _items: Array<ts.Node | string> = [];
  private _name: string;
  private _path: PathLike;

  public constructor({
    dir,
    name,
    header = true,
  }: {
    dir: string;
    header?: boolean;
    name: string;
  }) {
    this._name = this._setName(name);
    this._path = path.resolve(dir, this.getName());

    if (header) {
      this._headers = [
        ...this._headers,
        `/**
 * THIS FILE IS AUTO-GENERATED!
 * DO NOT MODIFY OR SAVE THIS FILE MANUALLY.
 * @script - openapi-ts
 */`,
      ];
    }
  }

  public add(...nodes: Array<ts.Node | string>) {
    this._items = [...this._items, ...nodes];
  }

  /**
   * Adds an import to the provided module. Handles duplication, returns added import.
   */
  public import({
    module,
    ...importedItem
  }: utils.ImportExportItemObject & {
    module: string;
  }): utils.ImportExportItemObject {
    let moduleMap = this._imports.get(module);

    if (!moduleMap) {
      moduleMap = new Map<string, utils.ImportExportItemObject>();
      this._imports.set(module, moduleMap);
    }

    const match = moduleMap.get(importedItem.name);
    if (match) {
      return match;
    }

    moduleMap.set(importedItem.name, importedItem);
    return importedItem;
  }

  public getName(withExtension = true) {
    if (withExtension) {
      return this._name;
    }

    const { name } = splitNameAndExtension(this._name);
    return name;
  }

  public isEmpty() {
    return !this._items.length;
  }

  public remove(options?: Parameters<typeof rmSync>[1]) {
    rmSync(this._path, options);
  }

  /**
   * Removes last node form the stack. Works as undo.
   */
  public removeNode() {
    this._items = this._items.slice(0, this._items.length - 1);
  }

  private _setName(fileName: string) {
    if (fileName.includes('index')) {
      return fileName;
    }

    const { extension, name } = splitNameAndExtension(fileName);
    return [name, 'gen', extension].filter(Boolean).join('.');
  }

  public toString(seperator: string = '\n') {
    let output: string[] = [];
    if (this._headers.length) {
      output = [...output, this._headers.join('\n')];
    }
    let importsStringArray: string[] = [];
    for (const [_module, moduleMap] of this._imports.entries()) {
      const imports = Array.from(moduleMap.values());
      const node = compiler.namedImportDeclarations({
        imports,
        module: _module,
      });
      importsStringArray = [
        ...importsStringArray,
        utils.tsNodeToString({ node }),
      ];
    }
    if (importsStringArray.length) {
      output = [...output, importsStringArray.join('\n')];
    }
    output = [
      ...output,
      ...this._items.map((node) =>
        typeof node === 'string'
          ? node
          : utils.tsNodeToString({ node, unescape: true }),
      ),
    ];
    return output.join(seperator);
  }

  public write(seperator = '\n') {
    if (this.isEmpty()) {
      this.remove({ force: true });
      return;
    }

    let dir = this._path;
    if (typeof this._path === 'string') {
      const parts = this._path.split(path.sep);
      dir = parts.slice(0, parts.length - 1).join(path.sep);
    }
    ensureDirSync(dir);
    writeFileSync(this._path, this.toString(seperator));
  }
}

export const compiler = {
  arrayLiteralExpression: types.createArrayLiteralExpression,
  arrowFunction: types.createArrowFunction,
  awaitExpression: types.createAwaitExpression,
  binaryExpression: transform.createBinaryExpression,
  callExpression: module.createCallExpression,
  classDeclaration: classes.createClassDeclaration,
  conditionalExpression: types.createConditionalExpression,
  constVariable: module.createConstVariable,
  constructorDeclaration: classes.createConstructorDeclaration,
  createPropertyDeclaration: classes.createPropertyDeclaration,
  elementAccessExpression: transform.createElementAccessExpression,
  enumDeclaration: types.createEnumDeclaration,
  exportAllDeclaration: module.createExportAllDeclaration,
  exportDefaultDeclaration: module.createDefaultExportDeclaration,
  exportNamedDeclaration: module.createNamedExportDeclarations,
  expressionToStatement: convert.expressionToStatement,
  identifier: utils.createIdentifier,
  ifStatement: transform.createIfStatement,
  indexedAccessTypeNode: types.createIndexedAccessTypeNode,
  isTsNode: utils.isTsNode,
  keywordTypeNode: types.createKeywordTypeNode,
  methodDeclaration: classes.createMethodDeclaration,
  namedImportDeclarations: module.createNamedImportDeclarations,
  namespaceDeclaration: types.createNamespaceDeclaration,
  newExpression: classes.newExpression,
  nodeToString: utils.tsNodeToString,
  objectExpression: types.createObjectType,
  ots: utils.ots,
  propertyAccessExpression: types.createPropertyAccessExpression,
  propertyAccessExpressions: transform.createPropertyAccessExpressions,
  returnFunctionCall: _return.createReturnFunctionCall,
  returnVariable: _return.createReturnVariable,
  safeAccessExpression: transform.createSafeAccessExpression,
  stringLiteral: types.createStringLiteral,
  stringToTsNodes: utils.stringToTsNodes,
  transformArrayMap: transform.createArrayMapTransform,
  transformArrayMutation: transform.createArrayTransformMutation,
  transformDateMutation: transform.createDateTransformMutation,
  transformFunctionMutation: transform.createFunctionTransformMutation,
  transformNewDate: transform.createDateTransformerExpression,
  typeAliasDeclaration: types.createTypeAliasDeclaration,
  typeArrayNode: typedef.createTypeArrayNode,
  typeInterfaceNode: typedef.createTypeInterfaceNode,
  typeIntersectNode: typedef.createTypeIntersectNode,
  typeNode: types.createTypeNode,
  typeOfExpression: types.createTypeOfExpression,
  typeRecordNode: typedef.createTypeRecordNode,
  typeReferenceNode: types.createTypeReferenceNode,
  typeTupleNode: typedef.createTypeTupleNode,
  typeUnionNode: typedef.createTypeUnionNode,
};
