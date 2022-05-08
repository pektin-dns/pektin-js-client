import { PektinConfig } from "@pektin/config/src/config-types";
import { absoluteName, beautifyJSON, concatDomain, ResourceRecord, shortenTime } from "./index.js";
import c from "chalk";
import _ from "lodash";
import crypto from "crypto";
import f from "cross-fetch";
import {
    ApiDeleteRequestBody,
    ApiGetRequestBody,
    ApiGetZoneRecordsRequestBody,
    ApiHealthRequestBody,
    ApiMethod,
    ApiRecord,
    ApiRequestBody,
    ApiResponseBody,
    ApiResponseType,
    ApiSearchRequestBody,
    ApiSetRequestBody,
    BasicAuthString,
    DeleteResponse,
    DeleteResponseSuccess,
    DomainName,
    GetResponse,
    GetResponseSuccess,
    GetZoneRecordsResponse,
    GetZoneRecordsResponseSuccess,
    HealthResponse,
    HealthResponseSuccess,
    PublicDnssecData,
    SearchResponse,
    SearchResponseSuccess,
    SetResponse,
    SetResponseSuccess,
} from "./types.js";
import { getPubVaultKeys, getVaultValue } from "./vault/vault.js";
import { toASCII } from "./utils/puny.js";
import { deAbsolute } from "./utils/index.js";

export const getPublicDnssecData = async ({
    endpoint,
    token,
    domainName,
}: {
    endpoint: string;
    token: string;
    domainName: string;
}): Promise<PublicDnssecData> => {
    let pubKey = await getPubVaultKeys(endpoint, token, deAbsolute(toASCII(domainName)), `zsk`);
    pubKey = pubKey[`1`].public_key;

    const pubKeyDns = pemToPublicDnsKey(pubKey);

    const ds = calculateDelegateSigner({
        ownerName: domainName,
        publicKey: pubKeyDns,
    });

    return {
        pubKeyPEM: pubKey,
        pubKeyDns,
        coordinates: getCoordinatesFromPublicDnsKey(pubKeyDns),
        algorithm: 13,
        flag: 257,
        digests: {
            sha256: crypto.createHash(`sha256`).update(ds).digest(`hex`),
            sha384: crypto.createHash(`sha384`).update(ds).digest(`hex`),
            sha512: crypto.createHash(`sha512`).update(ds).digest(`hex`),
        },
        keyTag: calculateKeyTag(pubKeyDns),
    };
};

export const getCoordinatesFromPublicDnsKey = (pubKeyDns: string) => {
    const bin = Buffer.from(pubKeyDns, `base64`);
    const x = bin.subarray(0, 32);
    const y = bin.subarray(32);
    return {
        x: bitStringToInteger(x),
        y: bitStringToInteger(y),
    };
};

export const bitStringToInteger = (bitString: Buffer): number => {
    // https://csrc.nist.gov/csrc/media/publications/fips/186/3/archive/2009-06-25/documents/fips_186-3.pdf
    let num = 0;
    for (let i = 1; i <= bitString.length; i++) {
        const b = bitString[i - 1];
        num += b * Math.pow(2, bitString.length - i);
    }
    return num;
};

export const pemToPublicDnsKey = (pem: string): string => {
    const removedHeadersAndNewLines = pem
        .replace(`-----BEGIN PUBLIC KEY-----\n`, ``)
        .replace(`-----END PUBLIC KEY-----`, ``)
        .replace(/\n/g, ``);
    const binKey = Buffer.from(removedHeadersAndNewLines, `base64`);
    const dnsKey = binKey.slice(27).toString(`base64`);
    // trim of the first 27 bytes so that only the raw coordinates remain
    // (the last 64 bit; 32 bit for the x coordinate and 32 bit for the y coordinate)
    // in the bytes before there is the information about the algorithm and the curve
    return dnsKey;
};

export const publicDnsKeyToPem = (dnsKey: string): string => {
    const num13Prefix = `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE`;
    return `-----BEGIN PUBLIC KEY-----
${num13Prefix}${dnsKey}
-----END PUBLIC KEY-----`;
};

export const calculateDelegateSigner = ({
    ownerName,
    publicKey,
    algorithm = 13,
}: {
    ownerName: string;
    publicKey: string;
    algorithm?: number;
}) => {
    ownerName = toASCII(absoluteName(ownerName));

    const ownerNameBinary = toDnsName(ownerName);

    const flags = new Uint8Array([1, 1]);
    const protocol = new Uint8Array([3]); // has to always be 3
    const algorithmBin = new Uint8Array([algorithm]); // 13/ECDSA_P256_SHA256 15/ED25519
    const publicKeyBinary = Buffer.from(publicKey, `base64`);

    const ds = Buffer.from([
        ...ownerNameBinary,
        ...flags,
        ...protocol,
        ...algorithmBin,
        ...publicKeyBinary,
    ]);

    return ds;
};

export const toDnsName = (name: string) => {
    const parts = name.split(`.`);
    let p: number[] = [];
    parts.forEach((label) => {
        p = [...p, label.length, ...new Uint8Array(Buffer.from(label))];
    });
    return p;
};

export const calculateKeyTag = (pubKey: string, algorithm = 13) => {
    const key = [
        ...new Uint8Array([1, 1]),
        ...new Uint8Array([3]),
        ...new Uint8Array([algorithm]),
        ...Buffer.from(pubKey, `base64`),
    ];

    let ac = 0;
    for (let i = 0; i < key.length; i++) {
        ac += i & 1 ? key[i] : key[i] << 8;
    }

    ac += (ac >> 16) & 0xffff;
    return ac & 0xffff;
};

export const replaceNameInRrSet = (
    rr_set: ResourceRecord[],
    replace: DomainName,
    replaceWith: DomainName
): ResourceRecord[] => {
    return replaceAnyValueInRrSet(rr_set, absoluteName(replace), absoluteName(replaceWith));
};
export const replaceAnyValueInRrSet = (
    rr_set: ResourceRecord[],
    replace: string,
    replaceWith: string
) => {
    return JSON.parse(JSON.stringify(rr_set).replaceAll(replace, replaceWith));
};

export const duplicateZoneConversion = (
    zoneToDuplicate: DomainName,
    newZone: DomainName,
    apiRecords: ApiRecord[],
    replaceValues = false
) => {
    return apiRecords.map((record) => {
        record.name = record.name.replace(absoluteName(zoneToDuplicate), absoluteName(newZone));
        if (replaceValues) {
            /*@ts-ignore*/
            record.rr_set = replaceNameInRrSet(record.rr_set, zoneToDuplicate, newZone);
        }
        return record;
    });
};

export const supportedMethods = [`get`, `get-zone-records`, `set`, `delete`, `search`, `health`];

export const methodToFunctionName = (method: string) => {
    switch (method) {
        case `get-zone-records`:
            return `getZoneRecords`;
        case `delete`:
            return `deleteRecords`;
        default:
            return method;
    }
};

export const isKnownApiMethod = (method: string) => {
    return supportedMethods.includes(method);
};

export const clampTTL = (ttl: number | string) => {
    if (typeof ttl === `string`) ttl = parseInt(ttl);
    return Math.min(Math.max(ttl, 0), 4294967295);
};

export const getEmojiForServiceName = (name: string) => {
    const map = { api: `🤖`, ui: `💻`, vault: `🔐`, tnt: `🌳` };
    /*@ts-ignore*/
    return map[name];
};

export const getMainNode = (pektinConfig: PektinConfig) => {
    return pektinConfig.nodes.filter((node) => node.main === true)[0];
};
export const getMainNameServers = (pektinConfig: PektinConfig) => {
    return pektinConfig.nameservers.filter((ns) => ns.main === true);
};

export const getNameServersByDomain = (pektinConfig: PektinConfig, domain: string) => {
    return pektinConfig.nameservers.filter(
        (ns) => absoluteName(ns.domain) === absoluteName(domain)
    );
};

export const isNameServer = (pektinConfig: PektinConfig, domain: string) => {
    return !!pektinConfig.nameservers.filter(
        (ns) => absoluteName(ns.domain) === absoluteName(domain)
    ).length;
};

// get the pektin endpoints from the pektin config
export const getPektinEndpoint = (
    c: PektinConfig,
    endpointType: `api` | `vault` | `ui` | `tnt` | `proxy`,
    useInternal = false
): string => {
    if (useInternal) {
        if (endpointType === `api`) return `http://pektin-api`;
        if (endpointType === `vault`) return `http://pektin-vault`;
        if (endpointType === `ui`) return `http://pektin-ui`;
        if (endpointType === `tnt`) return `http://pektin-tnt`;
    }
    let domain = ``;

    if (endpointType === `proxy`) {
        domain = concatDomain(c.reverseProxy.external.domain, c.reverseProxy.external.subDomain);
    } else {
        domain = concatDomain(c.services[endpointType].domain, c.services[endpointType].subDomain);
    }
    const protocol = c.reverseProxy.tls ? `https` : `http`;
    let host = ``;
    if (c.reverseProxy.routing === `local`) {
        host = concatDomain(`localhost`, domain);
    } else if (c.reverseProxy.routing === `minikube`) {
        host = concatDomain(`minikube`, domain);
    } else if (c.reverseProxy.routing === `domain`) {
        host = domain;
    }

    return `${protocol}://${host}`;
};

export const getAuth = async (
    vaultEndpoint: string,
    vaultToken: string,
    service: `tnt` | `proxy`,
    hashed = false
) => {
    const res = await getVaultValue(vaultEndpoint, vaultToken, `${service}-auth`, `pektin-kv`);
    if (!res) throw Error(`Couldn't obtain ${service} auth`);
    if (hashed) return res.hashedAuth as string;
    return res.basicAuth as string;
};

export const getNodesNameservers = (
    pektinConfig: PektinConfig,
    nodeName: string
): PektinConfig[`nameservers`] | false => {
    if (!pektinConfig.nameservers) return false;
    return pektinConfig.nameservers.filter(
        (ns) => ns.node === nodeName
    ) as PektinConfig[`nameservers`];
};

// get the pektin config
export const getPektinConfig = async (vaultEndpoint: string, vaultToken: string) =>
    (await getVaultValue(vaultEndpoint, vaultToken, `pektin-config`, `pektin-kv`)) as PektinConfig;

// get records from the api/redis based on their key
export const get = async (
    apiEndpoint: string,
    body: ApiGetRequestBody,
    perimeterAuth: BasicAuthString,

    throwErrors?: boolean
): Promise<GetResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `get`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as GetResponseSuccess;
    return res as GetResponse;
};

// set records via the api in redis
export const set = async (
    apiEndpoint: string,
    body: ApiSetRequestBody,
    perimeterAuth: BasicAuthString,

    throwErrors?: boolean
): Promise<SetResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `set`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as SetResponseSuccess;
    return res as SetResponse;
};

// search for records in redis by providing a glob search string
export const search = async (
    apiEndpoint: string,
    body: ApiSearchRequestBody,
    perimeterAuth: BasicAuthString,

    throwErrors?: boolean
): Promise<SearchResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `search`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as SearchResponseSuccess;
    return res as SearchResponse;
};

// delete records based on their keys
export const deleteRecords = async (
    apiEndpoint: string,
    body: ApiDeleteRequestBody,
    perimeterAuth: BasicAuthString,

    throwErrors?: boolean
): Promise<DeleteResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `delete`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as DeleteResponseSuccess;
    return res as DeleteResponse;
};

// get api health status
export const health = async (
    apiEndpoint: string,
    body: ApiHealthRequestBody,
    perimeterAuth: BasicAuthString,

    throwErrors?: boolean
): Promise<HealthResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `health`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as HealthResponseSuccess;
    return res as HealthResponse;
};

// get all records for zones
export const getZoneRecords = async (
    apiEndpoint: string,
    body: ApiGetZoneRecordsRequestBody,
    perimeterAuth: BasicAuthString,
    throwErrors?: boolean
): Promise<GetZoneRecordsResponse> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: `get-zone-records`,
        body,
        throwErrors,
        perimeterAuth,
    });
    if (throwErrors) return res as GetZoneRecordsResponseSuccess;
    return res as GetZoneRecordsResponse;
};

// execute any query
export const any = async (
    apiEndpoint: string,
    apiPath: string,
    body: any,
    perimeterAuth: BasicAuthString,
    throwErrors?: boolean
): Promise<any> => {
    const res = await pektinApiRequest({
        apiEndpoint,
        method: apiPath as ApiMethod,
        body,
        throwErrors,
        perimeterAuth,
    });
    return res as any;
};

// send any request to the pektin api
export const pektinApiRequest = async ({
    apiEndpoint,
    method,
    body,
    perimeterAuth,
    throwErrors = true,
}: {
    apiEndpoint: string;
    method: ApiMethod;
    body: ApiRequestBody;
    perimeterAuth: BasicAuthString;
    throwErrors?: boolean;
}): Promise<ApiResponseBody> => {
    if (!apiEndpoint) throw Error(`Pektin API details weren't obtained yet`);
    const tStart = performance.now();
    const res = await f(`${apiEndpoint}/${method}`, {
        method: `POST`,
        headers: {
            "content-type": `application/json`,
            ...(perimeterAuth && { Authorization: perimeterAuth }),
        },
        body: JSON.stringify(body),
    }).catch((e: Error) => {
        throw Error(`Couldn't fetch: ` + e);
    });
    const tEnd = performance.now();
    const text = await res.text();
    let json;

    try {
        json = JSON.parse(text);
        json.time = shortenTime(tEnd - tStart);
    } catch (e) {
        if (throwErrors) err({ type: `ERR_PARSE_JSON`, body, method, text });
        json = {
            type: ApiResponseType.Error,
            message: `Pektin client couldn't parse response from API as JSON. The response was: ${text}`,
            time: shortenTime(tEnd - tStart),
            data: [],
            status: res.status,
            statusText: res.statusText,
        };
    }

    if (json.type === `error` && throwErrors) {
        err({ type: `ERR_API`, body, method, text, json });
    }

    return json as ApiResponseBody;
};

export const crtFormatQuery = (domain: string) => {
    return `?q=${domain}&output=json`;
};

export const fetchProxy = ({
    proxyEndpoint,
    name,
    path,
    proxyAuth,
    fetchOptions,
}: {
    proxyEndpoint: string;
    name: string;
    path?: string;
    proxyAuth: string;
    fetchOptions: any;
}) => {
    const fetchPath = `${proxyEndpoint}/proxy-${name}${path ?? `/`}`;
    console.log(fetchPath);

    return f(
        fetchPath,
        _.merge(
            {
                headers: {
                    Authorization: proxyAuth || ``,
                },
            },
            fetchOptions
        )
    );
};

export const err = ({
    type,
    body,
    text,
    method,
    json,
}: {
    type: `ERR_PARSE_JSON` | `ERR_API`;
    body: ApiRequestBody;
    text: string;
    method: string;
    json?: ApiResponseBody;
}) => {
    let e = ``;
    if (type === `ERR_PARSE_JSON`) {
        e =
            c.bold.red(`Pektin client couldn't parse JSON response from API\n`) +
            `Pektin-API returned this body:\n` +
            `${text}\n` +
            `while client was trying to ${method} with the following body:\n` +
            beautifyJSON({ obj: body });
    } else if (type === `ERR_API` && json !== undefined) {
        const deserializeError = JSON.stringify(text).includes(`Json deserialize error`);

        e =
            c.bold.red(`API Error:\n`) +
            `${beautifyJSON({ obj: json })}\n` +
            c.bold.red(
                `while client was trying to ${c.yellow.bold(method)} the following body: \n`
            ) +
            `${beautifyJSON({ obj: body, deserializeError, answer: text })}\n`;
    }

    if (window === undefined) throw new Error(e);
    throw new Error(
        e.replaceAll(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ``
        )
    );
    /*
    if (typeof window === `undefined`) {
        console.log(e);
        exit(1);
    } else {
        throw new Error(e);
    }
    */
};
