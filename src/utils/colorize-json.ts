/*
Copyright (c) 2022 Paul Hennig

INCLUDING CODE FROM Joe Attardi and others: https://github.com/joeattardi/json-colorizer

MIT License

Copyright (c) 2016 Joe Attardi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Chalk } from "chalk";

const chalk = new Chalk({ level: 3 });

import _ from "lodash";
const defaultColors = {
    BRACE: `gray`,
    BRACKET: `gray`,
    COLON: `gray`,
    COMMA: `gray`,
    STRING_KEY: `magenta`,
    STRING_LITERAL: `yellow`,
    NUMBER_LITERAL: `green`,
    BOOLEAN_LITERAL: `cyan`,
    NULL_LITERAL: `white`,
};

const defaultBracketColors = [`#ffd700`, `#da70d6`, `#87cefa`];

export interface ColorizeOptions {
    colors?: {
        BRACE: string;
        BRACKET: string;
        COLON: string;
        COMMA: string;
        STRING_KEY: string;
        STRING_LITERAL: string;
        NUMBER_LITERAL: string;
        BOOLEAN_LITERAL: string;
        NULL_LITERAL: string;
    };
    brackets?: boolean;
    bracketColors?: string[];
    pretty?: boolean;
}

export interface HighlightLabel {
    position: number;
    color?: string;
    background?: string;
}

export interface Token {
    type: TokenType;
    position: number;
    value: string;
}

/* eslint-disable no-unused-vars */
export enum TokenType {
    BRACE = `BRACE`,
    BRACKET = `BRACKET`,
    COLON = `COLON`,
    COMMA = `COMMA`,
    STRING_KEY = `STRING_KEY`,
    STRING_LITERAL = `STRING_LITERAL`,
    NUMBER_LITERAL = `NUMBER_LITERAL`,
    BOOLEAN_LITERAL = `BOOLEAN_LITERAL`,
    NULL_LITERAL = `NULL_LITERAL`,
}

export const colorizeJson = (
    json: string | Record<string, unknown>,
    options: ColorizeOptions = {},
    highlightLabels?: HighlightLabel[]
) => {
    return colorize(getTokens(json, options), options, highlightLabels);
};

const colorize = (
    tokens: Token[],
    options: ColorizeOptions = {},
    highlightLabels?: HighlightLabel[]
) => {
    const colors = options.colors ?? defaultColors;
    const bracketColors = options.bracketColors ?? defaultBracketColors;

    let level = 0;
    return tokens.reduce((acc: string, token: Token, i: number) => {
        const colorKey = colors[token.type];

        const colorFn =
            colorKey && colorKey[0] === `#` ? chalk.hex(colorKey) : _.get(chalk, colorKey);

        let str = colorFn ? colorFn(token.value) : token.value;

        if (
            options.brackets &&
            (token.type === TokenType.BRACE || token.type === TokenType.BRACKET)
        ) {
            if ([`[`, `{`].includes(token.value)) {
                str = chalk.hex(bracketColors[level % 3])(token.value);

                level++;
            } else if ([`]`, `}`].includes(token.value)) {
                level--;
                str = chalk.hex(bracketColors[level % 3])(token.value);
            }
        }

        if (highlightLabels && highlightLabels.length) {
            for (let ii = 0; ii < highlightLabels.length; ii++) {
                const l = highlightLabels[ii];

                const bgColorFn =
                    l.background && l.background[0] === `#`
                        ? chalk.bgHex(l.background)
                        : _.get(chalk, l.background ?? `bgRed`);

                const fgColorFn =
                    l.color && l.color[0] === `#`
                        ? chalk.hex(l.color)
                        : _.get(chalk, l.color ?? `white`);

                if (i < tokens.length - 1) {
                    if (
                        tokens[i].position <= l.position - 1 &&
                        tokens[i + 1].position > l.position - 1
                    ) {
                        str = bgColorFn ? bgColorFn(token.value) : chalk.bgRed(token.value);
                        str = fgColorFn ? fgColorFn(str) : str;
                        break;
                    }
                } else if (tokens[i].position <= l.position + 1) {
                    str = bgColorFn ? bgColorFn(token.value) : chalk.bgRed(token.value);
                    str = fgColorFn ? fgColorFn(str) : str;
                    break;
                }
            }
        }

        return acc + str;
    }, ``);
};

const tokenTypes = [
    { regex: /^\s+/, tokenType: `WHITESPACE` },
    { regex: /^[{}]/, tokenType: `BRACE` },
    { regex: /^[[\]]/, tokenType: `BRACKET` },
    { regex: /^:/, tokenType: `COLON` },
    { regex: /^,/, tokenType: `COMMA` },
    { regex: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i, tokenType: `NUMBER_LITERAL` },
    { regex: /^"(?:\\.|[^"\\])*"(?=\s*:)/, tokenType: `STRING_KEY` },
    { regex: /^"(?:\\.|[^"\\])*"/, tokenType: `STRING_LITERAL` },
    { regex: /^true|^false/, tokenType: `BOOLEAN_LITERAL` },
    { regex: /^null/, tokenType: `NULL_LITERAL` },
];

const getTokens = (json: Record<string, unknown> | string, options: ColorizeOptions = {}) => {
    let input: string;

    if (options.pretty) {
        const inputObj = typeof json === `string` ? JSON.parse(json) : json;
        input = JSON.stringify(inputObj, null, 2);
    } else {
        input = typeof json === `string` ? json : JSON.stringify(json);
    }
    const ogInputLength = input.length;

    let tokens: Token[] = [];
    let foundToken: boolean;

    do {
        foundToken = false;
        for (let i = 0; i < tokenTypes.length; i++) {
            const match = tokenTypes[i].regex.exec(input);
            if (match) {
                input = input.substring(match[0].length);
                tokens.push({
                    type: tokenTypes[i].tokenType as Token[`type`],
                    value: match[0],
                    position: ogInputLength - input.length - match[0].length,
                });

                foundToken = true;
                break;
            }
        }
    } while (_allTokensAnalyzed(input, foundToken));

    return tokens;
};

/**
 * @author Willian Magalhães Gonçalves
 * @description Are all tokens analyzed?
 * @param {*} input - Input
 * @param {*} foundToken - Found token
 * @returns {boolean} checkResult - Check result
 * @private
 */
const _allTokensAnalyzed = (input: any, foundToken: any): boolean => {
    const safeInput = input || {};

    const inputLength = safeInput.length;
    return inputLength > 0 && foundToken;
};
