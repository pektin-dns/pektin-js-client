import f from "cross-fetch";
import { TntAnswer, TntQuery, TntQueryConnectionType } from "./types.js";
export const queryTnt = async (endpoint: string, auth: string, query: TntQuery) => {
    if (query.port === undefined) query.port = 53;
    if (query.connection_type === undefined) query.connection_type = TntQueryConnectionType.udp;
    if (query.fetch_dnssec === undefined) query.fetch_dnssec = false;

    const res = await f(endpoint, {
        headers: {
            Authorization: auth,
            "Content-Type": `application/json`,
        },
        body: JSON.stringify(query),
        method: `POST`,
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        throw Error(text);
    }

    return json as TntAnswer[];
};
