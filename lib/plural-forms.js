'use strict';

// Evaluates the `Plural-Forms` header of a catalog (`nplurals=N; plural=EXPR;`) without eval,
// new Function or vm. EXPR is the C subset GNU gettext accepts: the variable n, decimal integer
// literals, parentheses, unary !, binary * / % + - < <= > >= == != && || and the ?: conditional.
// Anything else, or anything too long or too deeply nested, is rejected and the caller falls back
// to the Germanic rule (n != 1), which is what GNU gettext does for a missing or broken header.

// The longest rule in common use (Arabic, Slovenian, Irish) is well under 200 characters
const MAX_HEADER_LENGTH = 512;
const MAX_NESTING_DEPTH = 32;
const MAX_NPLURALS = 32;
const MAX_LITERAL_DIGITS = 9;

const OPERATORS = ['==', '!=', '<=', '>=', '&&', '||', '<', '>', '!', '*', '/', '%', '+', '-', '?', ':', '(', ')'];

const BINARY_LEVELS = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

const toInt = value => (value ? 1 : 0);

const BINARY_OPERATIONS = {
    '||': (left, right) => n => toInt(left(n) || right(n)),
    '&&': (left, right) => n => toInt(left(n) && right(n)),
    '==': (left, right) => n => toInt(left(n) === right(n)),
    '!=': (left, right) => n => toInt(left(n) !== right(n)),
    '<': (left, right) => n => toInt(left(n) < right(n)),
    '<=': (left, right) => n => toInt(left(n) <= right(n)),
    '>': (left, right) => n => toInt(left(n) > right(n)),
    '>=': (left, right) => n => toInt(left(n) >= right(n)),
    '+': (left, right) => n => left(n) + right(n),
    '-': (left, right) => n => left(n) - right(n),
    '*': (left, right) => n => left(n) * right(n),
    // C integer division and remainder; dividing by zero has no defined result, NaN maps to index 0
    '/': (left, right) => n => {
        const divisor = right(n);
        return divisor === 0 ? NaN : Math.trunc(left(n) / divisor);
    },
    '%': (left, right) => n => {
        const divisor = right(n);
        return divisor === 0 ? NaN : left(n) % divisor;
    }
};

function tokenize(expression) {
    const tokens = [];
    let pos = 0;

    while (pos < expression.length) {
        const char = expression[pos];

        if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
            pos++;
            continue;
        }

        if (char === 'n') {
            tokens.push({ type: 'n' });
            pos++;
            continue;
        }

        if (char >= '0' && char <= '9') {
            let end = pos;
            while (end < expression.length && expression[end] >= '0' && expression[end] <= '9') {
                end++;
            }
            if (end - pos > MAX_LITERAL_DIGITS) {
                throw new Error('Integer literal too long');
            }
            tokens.push({ type: 'number', value: Number(expression.slice(pos, end)) });
            pos = end;
            continue;
        }

        const operator = OPERATORS.find(op => expression.startsWith(op, pos));
        if (!operator) {
            throw new Error(`Unexpected character at ${pos}`);
        }
        tokens.push({ type: 'op', value: operator });
        pos += operator.length;
    }

    return tokens;
}

// Recursive-descent parser that compiles straight into closures, one per AST node
class ExpressionParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peekOp() {
        const token = this.tokens[this.pos];
        return token && token.type === 'op' ? token.value : null;
    }

    expectOp(value) {
        if (this.peekOp() !== value) {
            throw new Error(`Expected "${value}"`);
        }
        this.pos++;
    }

    // depth counts nested conditionals, parentheses and ! operators, so recursion stays bounded
    static checkDepth(depth) {
        if (depth > MAX_NESTING_DEPTH) {
            throw new Error('Expression nested too deeply');
        }
    }

    // conditional := binary(0) [ "?" conditional ":" conditional ]
    parseConditional(depth) {
        ExpressionParser.checkDepth(depth);
        const condition = this.parseBinary(0, depth);
        if (this.peekOp() !== '?') {
            return condition;
        }
        this.pos++;
        const whenTrue = this.parseConditional(depth + 1);
        this.expectOp(':');
        const whenFalse = this.parseConditional(depth + 1);
        return n => (condition(n) ? whenTrue(n) : whenFalse(n));
    }

    // Left-associative binary operators, one precedence level per BINARY_LEVELS entry
    parseBinary(level, depth) {
        if (level >= BINARY_LEVELS.length) {
            return this.parseUnary(depth);
        }
        let left = this.parseBinary(level + 1, depth);
        let op = this.peekOp();
        while (op && BINARY_LEVELS[level].includes(op)) {
            this.pos++;
            left = BINARY_OPERATIONS[op](left, this.parseBinary(level + 1, depth));
            op = this.peekOp();
        }
        return left;
    }

    // unary := "!" unary | primary
    parseUnary(depth) {
        if (this.peekOp() !== '!') {
            return this.parsePrimary(depth);
        }
        this.pos++;
        ExpressionParser.checkDepth(depth + 1);
        const operand = this.parseUnary(depth + 1);
        return n => toInt(!operand(n));
    }

    // primary := "n" | integer | "(" conditional ")"
    parsePrimary(depth) {
        const token = this.tokens[this.pos++];
        if (!token) {
            throw new Error('Unexpected end of expression');
        }
        if (token.type === 'n') {
            return n => n;
        }
        if (token.type === 'number') {
            const value = token.value;
            return () => value;
        }
        if (token.value === '(') {
            const inner = this.parseConditional(depth + 1);
            this.expectOp(')');
            return inner;
        }
        throw new Error(`Unexpected "${token.value}"`);
    }
}

/**
 * Compiles a plural expression into a function of n. Throws on anything outside the grammar.
 *
 * @param  {String}   expression  The plural= part of a Plural-Forms header
 * @return {Function} n => numeric plural index (not yet clamped)
 */
function compileExpression(expression) {
    const parser = new ExpressionParser(tokenize(expression));
    const compiled = parser.parseConditional(0);
    if (parser.pos !== parser.tokens.length) {
        throw new Error('Unexpected trailing input');
    }
    return compiled;
}

/**
 * Parses a Plural-Forms header value into a plural rule.
 *
 * @param  {String} header  e.g. "nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 ? 1 : 2);"
 * @return {Object|null} { nplurals, pluralsFunc } or null if the header is missing or malformed
 */
function parsePluralForms(header) {
    if (typeof header !== 'string' || header.length > MAX_HEADER_LENGTH) {
        return null;
    }

    let nplurals;
    let expression;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) {
            if (part.trim()) {
                return null;
            }
            continue;
        }
        const key = part.slice(0, separator).trim().toLowerCase();
        const value = part.slice(separator + 1).trim();
        if (key === 'nplurals') {
            nplurals = /^\d{1,2}$/.test(value) ? Number(value) : NaN;
        } else if (key === 'plural') {
            expression = value;
        }
    }

    if (!(nplurals >= 1 && nplurals <= MAX_NPLURALS) || !expression) {
        return null;
    }

    let evaluate;
    try {
        evaluate = compileExpression(expression);
    } catch {
        return null;
    }

    return {
        nplurals,
        pluralsFunc: n => {
            const index = Math.trunc(evaluate(n));
            if (!Number.isFinite(index) || index < 0) {
                return 0;
            }
            return Math.min(index, nplurals - 1);
        }
    };
}

// GNU gettext's default when a catalog has no usable Plural-Forms header
const DEFAULT_PLURAL_FORMS = {
    nplurals: 2,
    pluralsFunc: n => toInt(n !== 1)
};

module.exports = { parsePluralForms, DEFAULT_PLURAL_FORMS };
