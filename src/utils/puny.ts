import { domainToASCII, domainToUnicode } from "url";

export const toASCII = domainToASCII;

export const toUnicode = domainToUnicode;

export const emailToASCII = (email: string) => {
    // TODO this is not fully compliant
    const [local, domain] = email.split(`@`);
    return `${local}@${toASCII(domain)}`;
};
