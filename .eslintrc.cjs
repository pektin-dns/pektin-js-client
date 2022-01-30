module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [`google`, `prettier`],
    parser: `@typescript-eslint/parser`,
    parserOptions: {
        ecmaVersion: `latest`,
        sourceType: `module`,
    },
    plugins: [`@typescript-eslint`, `jsdoc`],
    rules: {
        quotes: [`error`, `backtick`],
        "no-unused-vars": [`warn`],
        "@typescript-eslint/no-unused-vars": [`warn`],
    },
};
