import { PektinRRType } from "../index.js";
import {
    MXRecord,
    SOARecord,
    SRVRecord,
    CAARecord,
    TLSARecord,
    ResourceRecord,
    ConfidantPassword,
    ManagerPassword,
} from "../index.js";
import { colorizeJson, ColorizeOptions } from "./colorize-json.js";
import f from "cross-fetch";

const defaultColorizeOptions: ColorizeOptions = {
    colors: {
        BRACE: `#bbbbbb`,
        BRACKET: `#bbbbbb`,
        COLON: `#bbbbbb`,
        COMMA: `#bbbbbb`,
        STRING_KEY: `#ef596f`,
        STRING_LITERAL: `#89ca78`,
        NUMBER_LITERAL: `#d8985f`,
        BOOLEAN_LITERAL: `#d8985f`,
        NULL_LITERAL: `#d8985f`,
    },
    brackets: true,
};

export const toBase64 = (input: string) => Buffer.from(input).toString(`base64`);
export const fromBase64 = (input: string) => Buffer.from(input, `base64`).toString(`utf8`);

export const simpleBeautify = (s: string, indent = 4) => {
    return JSON.stringify(s, null, indentSpaces(indent));
};

export const beautifyJSON = ({
    obj,
    deserializeError = false,
    indent = 4,
    colorizeOptions = defaultColorizeOptions,
    answer,
}: {
    obj: any;
    deserializeError?: boolean;
    indent?: number;
    colorizeOptions?: any;
    answer?: string;
}) => {
    //const sog = JSON.stringify(obj);

    //let uLength, confLength;
    const rw = `<REDACTED>`;
    if (obj.client_username) {
        //uLength = obj.client_username.length;
        obj.client_username = rw;
    }
    if (obj.confidant_password) {
        //confLength = obj.confidant_password.length;
        obj.confidant_password = rw;
    }

    const s = JSON.stringify(obj, null, indentSpaces(indent));
    /*
    if (deserializeError && answer && answer.includes(`at line`)) {
        const { line, column } = getLineAndColumn(answer);
        if (line !== undefined && column !== undefined) {
            let realCount = 1 + uLength + confLength - 2 * rw.length;
            for (let i = 0; i < s.length; i++) {
                const char = s[i];
                if (char !== ` ` && char !== `\n`) {
                    realCount += 1;
                }
            }
            //console.log(sog);

            return colorizeJson(s, colorizeOptions);
        }
    }*/
    return colorizeJson(s, colorizeOptions);
};

const getLineAndColumn = (s: string) => {
    const line = getNumberAfterString(s, `line`);
    const column = getNumberAfterString(s, `column`);
    return { line, column };
};

const getNumberAfterString = (s: string, search: string) => {
    const a = s.substring(s.indexOf(search) + search.length + 1);
    const b = a.match(/[0-9]*/);
    if (b && b.length) return parseInt(b[0]);
    return false;
};

export const indentSpaces = (indent: number) => indentChracters(indent, ` `);

export const indentChracters = (indent: number, character: string) => {
    let a = ``;
    for (let i = 0; i < indent; i++) {
        a += character;
    }
    return a;
};

export const concatDomain = (domain: string, subDomain?: string) => {
    if (subDomain === undefined) return domain;
    return `${deAbsolute(subDomain)}.${domain}`;
};

export const absoluteName = (name: string) => {
    if (name === undefined) {
        throw Error(
            `Input was undefined. This error indicates an upstream undefined value. Check if all the keys have the right names or use TS.`
        );
    }
    if (typeof name !== `string`) return name;
    if (name.endsWith(`.`)) {
        return name;
    }
    return name + `.`;
};

export const isAbsolute = (name: string): boolean => name.endsWith(`.`);

export const deAbsolute = (name: string) => {
    if (name.endsWith(`.`)) {
        return name.substring(0, name.length - 1);
    }
    return name;
};

export const textToRRValue = (
    val: string,
    recordType: PektinRRType,
    ttl: number
): ResourceRecord => {
    const t = val.split(` `);
    switch (recordType) {
        case `SOA`: {
            const r: SOARecord = {
                mname: t[0],
                rname: t[1],
                serial: parseInt(t[2]),
                refresh: parseInt(t[3]),
                retry: parseInt(t[4]),
                expire: parseInt(t[5]),
                minimum: parseInt(t[6]),
            };
            return r;
        }
        case `MX`: {
            const r: MXRecord = {
                preference: parseInt(t[0]),
                exchange: t[1],
            };
            return r;
        }
        case `SRV`: {
            const r: SRVRecord = {
                priority: parseInt(t[0]),
                weight: parseInt(t[1]),
                port: parseInt(t[2]),
                target: t[3],
            };
            return r;
        }
        case `CAA`: {
            const r: CAARecord = {
                /*@ts-ignore*/
                tag: t[1] as string,
                value: t[2].replaceAll(`"`, ``),
                issuer_critical: !!t[0],
            };
            return r;
        }
        case `TLSA`: {
            const r: TLSARecord = {
                cert_usage: parseInt(t[0]) as 0 | 1 | 2 | 3,
                selector: parseInt(t[1]) as 0 | 1,
                matching: parseInt(t[2]) as 0 | 1 | 2,
                cert_data: t[3],
            };
            return r;
        }
        default:
            return { value: val };
    }
};

export const shortenTime = (t: number) => {
    return parseInt(t.toFixed());
};

export const checkConfidantPassword = (
    input: string | undefined
): ConfidantPassword | undefined => {
    if (input === undefined) return undefined;
    if (typeof input !== `string`) throw Error(`confidantPassword is not a string`);

    if (input.startsWith(`c.`)) return input as ConfidantPassword;
    throw Error(`Passed confidantPassword is not a confidant password`);
};

export const checkManagerPassword = (input: string | undefined): ManagerPassword | undefined => {
    if (input === undefined) return undefined;

    if (typeof input !== `string`) throw Error(`managerPassword is not a string`);
    if (input.startsWith(`m.`)) return input as ManagerPassword;
    throw Error(`Passed managerPassword is not a manager password`);
};

export const isSupportedRecordType = (type: string) => {
    if (Object.values(supportedRecordTypesArray).includes(type as PektinRRType)) return true;
    return false;
};

export const isReady = async (url: string): Promise<any> => {
    return await f(url)
        .then(async (res) => {
            if (res.status >= 500) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                console.log(`Target: ${url} is not reachable. Retrying...`);

                return await isReady(url);
            }
            //console.log(`Reached target ${url}`);
        })
        .catch(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            console.log(`Target: ${url} is not reachable. Retrying...`);

            await isReady(url);
        });
};

export const supportedRecordTypesArray = [
    `A`,
    `AAAA`,
    `NS`,
    `CNAME`,
    `SOA`,
    `MX`,
    `TXT`,
    `SRV`,
    `CAA`,
    `OPENPGPKEY`,
    `TLSA`,
];

export const getObjDiff = (
    a: Record<string, any>,
    b: Record<string, any>,
    depth = 10,
    iteration = 0
) => {
    if (iteration === depth - 1) throw new Error(`Max depth reached`);
    iteration++;
    const diff: Record<string, any> = {};
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length === 0 && bKeys.length === 0) return false;
    // check for all keys that dont exist on the other object
    let commonKeys: any[] = [];
    aKeys.forEach((key) => {
        if (!b.hasOwnProperty(key)) {
            diff[key] = true;
        } else {
            commonKeys.push(key);
        }
    });
    bKeys.forEach((key) => {
        if (!a.hasOwnProperty(key)) {
            diff[key] = true;
        }
    });
    commonKeys.forEach((key) => {
        diff[key] = compare(a[key], b[key], iteration, depth);
    });

    return diff;
};

export const compare = (a: any, b: any, iteration = 0, depth = 10): any => {
    if (iteration === depth - 1) throw new Error(`Max depth reached`);
    if (typeof a !== typeof b) {
        // if they dont have the same type they are not equal
        return true;
    } else if (
        typeof a !== `object` &&
        typeof b !== `object` &&
        typeof a !== `function` &&
        typeof b !== `function`
    ) {
        //if they are simple values
        return !(a === b);
    } else if (Array.isArray(a) !== Array.isArray(b) || a instanceof Set !== b instanceof Set) {
        // if one is of type array but the other is not OR if one is a set but the other is not
        // note that typeof tells us only that they are both of type object
        return true;
    } else if ((Array.isArray(a) && Array.isArray(b)) || (a instanceof Set && b instanceof Set)) {
        // if both are arrays or sets compare each element;
        if (a instanceof Set) {
            a = Array.from(a);
            b = Array.from(b);
        }
        if (a.length === 0 && b.length === 0) {
            return false;
        }
        iteration++;
        const diff = [];
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            diff[i] = compare(a[i], b[i], depth, iteration);
        }
        return diff;
    } else {
        // has to be a object
        return getObjDiff(a, b, depth, iteration);
    }
};
