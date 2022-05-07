import f from "cross-fetch";
import { PektinRRType, ResourceRecord } from "../types.js";
import { absoluteName, deAbsolute, isSupportedRecordType, textToRRValue } from "../utils/index.js";
import { ToluolModule, ToluolResponse } from "./types.js";

export class Toluol {
    trinitrotoluol: string;
    trinitrotoluolAuth: string;
    toluol: ToluolModule;
    reactState: any;
    constructor(
        trinitrotoluol: string,
        trinitrotoluolAuth: string,
        toluol: ToluolModule,
        reactState?: any
    ) {
        this.trinitrotoluol = trinitrotoluol;
        this.trinitrotoluolAuth = trinitrotoluolAuth;
        this.toluol = toluol;
        this.reactState = reactState;
        this.toluol.init_panic_hook();
    }

    post = async (q: Uint8Array) => {
        const res = await f(`${this.trinitrotoluol}/dns-query`, {
            headers: {
                "content-type": `application/dns-message`,
                Authorization: this.trinitrotoluolAuth || ``,
            },
            credentials: `omit`,
            method: `POST`,
            body: q,
        });
        return new Uint8Array(await res.arrayBuffer());
    };

    get = async (q: Uint8Array) => {
        const s = Buffer.from(q).toString(`base64`).replace(/\+/g, `-`).replace(/\//g, `_`);

        const res = await f(`${this.trinitrotoluol}/dns-query?dns=${s.replace(/=/g, ``)}`, {
            headers: {
                accept: `application/dns-message`,
                Authorization: this.trinitrotoluolAuth || ``,
            },
            credentials: `omit`,
        });
        return new Uint8Array(await res.arrayBuffer());
    };

    query = async (
        name: string,
        type: string,
        httpMethod: string = `post`
    ): Promise<ToluolResponse> => {
        const query = this.toluol.new_query(deAbsolute(name), type);
        const res = httpMethod === `post` ? await this.post(query) : await this.get(query);
        const jsonRes = JSON.parse(this.toluol.parse_answer(res));
        return jsonRes;
    };
    toluolToApiRecord = (response: ToluolResponse) => {
        if (!response?.answers || !response?.answers.length) return false;
        const firstAnswer = response?.answers[0]?.NONOPT;
        if (!firstAnswer) return false;
        if (!isSupportedRecordType(firstAnswer.atype)) return false;

        const rr_set = response?.answers.map((e) => {
            const answer = e.NONOPT;
            const rdata = e.NONOPT?.rdata;
            return textToRRValue(rdata.join(` `), answer.atype as PektinRRType, answer.ttl);
        }) as ResourceRecord[];

        return {
            name: firstAnswer.name,
            rr_type: firstAnswer.atype as PektinRRType,
            rr_set,
        };
    };
    walk = async (name: string, limit: number = 50) => {
        const parseData = (n: string[]) => {
            n = n.filter((e: string) => {
                if (e === `NSEC` || e === `RRSIG`) return false;
                return true;
            });

            return n;
        };
        const ogName = absoluteName(name);
        let currentName = ogName;
        const allRecordsRequests: Array<Promise<any>> = [];
        const allTypes: string[] = [];
        for (let i = 0; i < limit; i++) {
            const newNameRes = await this.query(currentName, `NSEC`);

            if (!newNameRes) return false;
            if (newNameRes.answers.length > 1) {
                //newNameRes.answers = newNameRes.answers.filter((a) => a.NONOPT.atype === "NSEC");
            }
            if (!newNameRes?.answers[0]?.NONOPT?.rdata[1]) {
                return false;
            }

            const newNameData = newNameRes.answers[0].NONOPT.rdata[1].split(` `);

            //if (newNameRes.typeId !== 47) break;
            /*eslint no-loop-func: "off"*/

            parseData(newNameData).forEach((coveredRecord) => {
                allTypes.push(coveredRecord);
                allRecordsRequests.push(this.query(currentName, coveredRecord));
            });
            if (this.reactState) this.reactState.setState({ console: currentName });

            currentName = newNameRes.answers[0].NONOPT.rdata[0];

            if (currentName === ogName && i > 0) break;
        }
        const allRecords = await Promise.all(allRecordsRequests);
        return allRecords;
    };
}
