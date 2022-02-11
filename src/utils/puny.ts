/*@ts-ignore*/
import punycode from "punycode/punycode.js";

export const toASCII = punycode.encode;

export const toUnicode = punycode.decode;

export const emailToASCII = (email: string) => {
    // TODO this is not fully compliant
    const [local, domain] = email.split(`@`);
    return `${local}@${toASCII(domain)}`;
};
