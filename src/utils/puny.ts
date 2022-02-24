/*@ts-ignore*/
import punycode from "punycode/punycode.js";

export const toASCII = punycode.toASCII;

export const toUnicode = punycode.toUnicode;

export const emailToASCII = (email: string) => {
    // TODO this is not fully compliant
    const [local, domain] = email.split(`@`);
    return `${local}@${toASCII(domain)}`;
};
