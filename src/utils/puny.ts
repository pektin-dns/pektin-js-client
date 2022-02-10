import { decode, encode } from "punycode/";

export const toASCII = encode;

export const toUnicode = decode;

export const emailToASCII = (email: string) => {
    // TODO this is not fully compliant
    const [local, domain] = email.split(`@`);
    return `${local}@${toASCII(domain)}`;
};
