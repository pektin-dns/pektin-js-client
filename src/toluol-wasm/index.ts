import f from "cross-fetch";
import { deAbsolute } from "../index.js";
import { ToluolModule, ToluolResponse } from "./types";
import * as tm from "@pektin/toluol-wasm";

export class Toluol {
    resolver: string;
    resolverAuth: string;
    toluol: ToluolModule;
    constructor(resolver: string, recursorAuth: string, toluol?: ToluolModule) {
        this.resolver = resolver;
        this.resolverAuth = recursorAuth;
        this.toluol = toluol === undefined ? tm : toluol;
        this.toluol.init_panic_hook();
    }

    post = async (q: Uint8Array) => {
        const res = await f(`${this.resolver}/dns-query`, {
            headers: {
                "content-type": "application/dns-message",
                Authorization: this.resolverAuth || ""
            },
            credentials: "omit",
            method: "POST",
            body: q
        });
        return new Uint8Array(await res.arrayBuffer());
    };

    get = async (q: Uint8Array) => {
        const s = Buffer.from(q).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

        const res = await f(`${this.resolver}/dns-query?dns=${s.replace(/=/g, "")}`, {
            headers: {
                accept: "application/dns-message",
                Authorization: this.resolverAuth || ""
            },
            credentials: "omit"
        });
        return new Uint8Array(await res.arrayBuffer());
    };

    query = async (
        name: string,
        type: string,
        httpMethod: string = "post"
    ): Promise<ToluolResponse> => {
        const query = this.toluol.new_query(deAbsolute(name), type);
        const res = httpMethod === "post" ? await this.post(query) : await this.get(query);
        const jsonRes = JSON.parse(this.toluol.parse_answer(res));
        return jsonRes;
    };
}