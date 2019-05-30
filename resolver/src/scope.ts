import * as ast from "./ast";
import {Message} from "./message";
import {Value, StringValue} from "./value";
import {Result, Success, Failure} from "./result";

export class Scope {
    private readonly messages: Map<string, Message>;
    private readonly variables: Map<string, Value>;
    public errors: Array<string>;

    constructor(messages: Map<string, Message>, variables: Map<string, Value>) {
        this.messages = messages;
        this.variables = variables;
        this.errors = [];
    }

    resolve(node: ast.SyntaxNode): Result<Value> {
        switch (node.type) {
            case ast.NodeType.VariableReference:
                return this.resolveVariableReference(node as ast.VariableReference);
            case ast.NodeType.MessageReference:
                return this.resolveMessageReference(node as ast.MessageReference);
            case ast.NodeType.SelectExpression:
                return this.resolveSelectExpression(node as ast.SelectExpression);
            case ast.NodeType.TextElement:
                return this.resolveTextElement(node as ast.TextElement);
            case ast.NodeType.Placeable:
                return this.resolvePlaceable(node as ast.Placeable);
            case ast.NodeType.Pattern:
                return this.resolvePattern(node as ast.Pattern);
            default:
                throw new TypeError("Unresolvable node type.");
        }
    }

    resolveVariableReference(node: ast.VariableReference): Result<Value> {
        let value = this.variables.get(node.id.name);
        if (value !== undefined) {
            return new Success(value);
        } else {
            this.errors.push(`Unknown variable: $${node.id.name}.`);
            return new Failure(new StringValue(`$${node.id.name}`));
        }
    }

    resolveMessageReference(node: ast.MessageReference): Result<Value> {
        let message = this.messages.get(node.id.name);
        if (message !== undefined) {
            return message.resolveValue(this);
        } else {
            this.errors.push(`Unknown message: ${node.id.name}.`);
            return new Failure(new StringValue(`${node.id.name}`));
        }
    }

    resolveDefaultVariant(node: ast.SelectExpression): Result<Value> {
        for (let variant of node.variants) {
            if (variant.default) {
                return this.resolve(variant.value);
            }
        }
        throw new RangeError("Missing default variant.");
    }

    resolveSelectExpression(node: ast.SelectExpression): Result<Value> {
        return this.resolve(node.selector)
            .then(selector => {
                for (let variant of node.variants) {
                    if (variant.key.name === selector.value) {
                        return this.resolve(variant.value);
                    }
                }
                return this.resolveDefaultVariant(node);
            })
            .else(_ => this.resolveDefaultVariant(node));
    }

    resolveTextElement(node: ast.TextElement): Result<Value> {
        return new Success(new StringValue(node.value));
    }

    resolvePlaceable(node: ast.Placeable): Result<Value> {
        return this.resolve(node.expression);
    }

    resolvePattern(node: ast.Pattern): Result<Value> {
        return new Success(
            new StringValue(
                node.elements
                    .map(element =>
                        this.resolve(element)
                            .fold(value => value, value => new StringValue(`{${value.value}}`))
                            .format(this)
                    )
                    .join("")
            )
        );
    }
}
