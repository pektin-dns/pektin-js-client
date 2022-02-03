import { Toluol } from "../../../toluol-wasm/index.js";
import { ToluolModule } from "../../../toluol-wasm/types.js";
import { PektinClient } from "../../../main.js";
import { PektinZoneData } from "../../../types.js";
import async from "async";

export const get = async (
    domains: string[],
    pc: PektinClient,
    toluol: ToluolModule,
    limit = 10
): Promise<PektinZoneData> => {
    const t = new Toluol(
        await pc.getPektinEndpoint(`recursor`),
        await pc.getRecursorAuth(),
        toluol
    );
    const out: PektinZoneData = {};
    await async.forEach(domains, async (domain) => {
        const walked = await t.walk(domain, limit);
        const records = walked.map(t.toluolToApiRecord);
        /*@ts-ignore*/
        out[domain] = records;
    });
    return out;
};
