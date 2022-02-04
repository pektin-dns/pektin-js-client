import { DomainName, PektinConfig } from "@pektin/config/src/config-types";
import { absoluteName, colors, ResourceRecord } from "./index.js";

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
    ApiSearchRequestBody,
    ApiSetRequestBody,
    ConfidantPassword,
    DeleteResponse,
    DeleteResponseSuccess,
    GetResponse,
    GetResponseSuccess,
    GetZoneRecordsResponse,
    GetZoneRecordsResponseSuccess,
    HealthResponse,
    HealthResponseSuccess,
    SearchResponse,
    SearchResponseSuccess,
    SetResponse,
    SetResponseSuccess,
} from "./types.js";
import { getVaultValue } from "./vault/vault.js";

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

export const getMainNode = (pektinConfig: PektinConfig) => {
    return pektinConfig.nodes.filter((node) => node.main === true)[0];
};

export const defaultLocalPorts = {
    api: `3001`,
    vault: `8200`,
    ui: `8080`,
    recursor: `80`,
};

// get the pektin api endpoint from  the pektin config
export const getPektinEndpoint = (
    pektinConfig: PektinConfig,
    endpointType: `api` | `vault` | `ui` | `recursor`,
    ports = defaultLocalPorts
): string => {
    const devmode = pektinConfig.devmode.enabled;
    const protocol = devmode ? `http://` : `https://`;
    let endpoint = ``;
    if (devmode) {
        if (pektinConfig.devmode.type === `local`) {
            endpoint = `127.0.0.1:${ports[endpointType]}`;
        } else {
            const mainNode = getMainNode(pektinConfig);
            if (mainNode.ips?.length) {
                endpoint = `[${mainNode.ips[0]}]`;
            } else if (mainNode.legacyIps?.length) {
                endpoint = mainNode.legacyIps[0];
            } else {
                throw Error(`Main node has no ips or legacy ips`);
            }
        }
    } else {
        `${pektinConfig[endpointType].subDomain}.${pektinConfig[endpointType].domain}`;
    }

    return protocol + endpoint;
};

export const getRecursorAuth = async (vaultEndpoint: string, vaultToken: string) => {
    const res = await getVaultValue(vaultEndpoint, vaultToken, `recursor-auth`, `pektin-kv`);
    if (!res || !res.basicAuth) throw Error(`Couldnt obtain recursor auth`);
    return res.basicAuth as string;
};

export const getNodesNameservers = (pektinConfig: PektinConfig, nodeName: string) => {
    if (!pektinConfig.nameservers) return false;
    return pektinConfig.nameservers.filter((ns) => ns.node === nodeName);
};

// get the pektin config
export const getPektinConfig = async (vaultEndpoint: string, vaultToken: string) =>
    (await getVaultValue(vaultEndpoint, vaultToken, `pektin-config`, `pektin-kv`)) as PektinConfig;

// get records from the api/redis based on their key
export const get = async (
    apiEndpoint: string,
    body: ApiGetRequestBody,
    throwErrors?: boolean
): Promise<GetResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `get`, body, throwErrors);
    // TODO FIX TYPESCRIPT TYPES conditional types needed
    if (throwErrors) return res as GetResponseSuccess;
    return res as GetResponse;
};

// set records via the api in redis
export const set = async (
    apiEndpoint: string,
    body: ApiSetRequestBody,
    throwErrors?: boolean
): Promise<SetResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `set`, body, throwErrors);
    if (throwErrors) return res as SetResponseSuccess;
    return res as SetResponse;
};

// search for records in redis by providing a glob search string
export const search = async (
    apiEndpoint: string,
    body: ApiSearchRequestBody,
    throwErrors?: boolean
): Promise<SearchResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `search`, body, throwErrors);
    if (throwErrors) return res as SearchResponseSuccess;
    return res as SearchResponse;
};

// delete records based on their keys
export const deleteRecords = async (
    apiEndpoint: string,
    body: ApiDeleteRequestBody,
    throwErrors?: boolean
): Promise<DeleteResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `delete`, body, throwErrors);
    if (throwErrors) return res as DeleteResponseSuccess;
    return res as DeleteResponse;
};

// get api health status
export const health = async (
    apiEndpoint: string,
    body: ApiHealthRequestBody,
    throwErrors?: boolean
): Promise<HealthResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `health`, body, throwErrors);
    if (throwErrors) return res as HealthResponseSuccess;
    return res as HealthResponse;
};

// get all records for zones
export const getZoneRecords = async (
    apiEndpoint: string,
    body: ApiGetZoneRecordsRequestBody,
    throwErrors?: boolean
): Promise<GetZoneRecordsResponse> => {
    const res = await pektinApiRequest(apiEndpoint, `get-zone-records`, body, throwErrors);
    if (throwErrors) return res as GetZoneRecordsResponseSuccess;
    return res as GetZoneRecordsResponse;
};

// send any request to the pektin api
export const pektinApiRequest = async (
    apiEndpoint: string,
    method: ApiMethod,
    body: ApiRequestBody,
    throwErrors = true
): Promise<ApiResponseBody> => {
    if (!apiEndpoint) throw Error(`Pektin API details weren't obtained yet`);
    const tStart = performance.now();
    const res = await f(`${apiEndpoint}/${method}`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: JSON.stringify(body),
    }).catch((e: Error) => {
        throw Error(`Couldn't fetch: ` + e);
    });
    const tEnd = performance.now();
    const text = await res.text();
    let json;
    // TODO add coloring
    try {
        json = JSON.parse(text);
        json.time = tEnd - tStart;
    } catch (e) {
        body.client_username = `<REDACTED>`;
        if (body.confidant_password) body.confidant_password = `<REDACTED>` as ConfidantPassword;
        throw Error(
            `${colors.boldRed}Pektin client couldn't parse JSON response from API${colors.reset}\n
Pektin-API returned this body:\n
${text}\n
while client was trying to ${method} the following body:\n 
${JSON.stringify(body, null, `    `)}${colors.reset}`
        );
    }
    if (json.type === `error` && throwErrors) {
        body.client_username = `<REDACTED>`;
        if (body.confidant_password) body.confidant_password = `<REDACTED>` as ConfidantPassword;

        throw Error(
            `${colors.boldRed}API Error:${colors.reset}\n 
${JSON.stringify(json, null, `    `)}\n 
${colors.bold}while client was trying to ${method} the following body: ${colors.reset}\n
${JSON.stringify(body, null, `    `)}${colors.reset}`
        );
    }
    if (throwErrors) return json as ApiResponseBody;
    return json as ApiResponseBody;
};
