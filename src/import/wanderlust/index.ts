import { Toluol } from "../../toluol-wasm/index.js";
import { ToluolModule } from "../../toluol-wasm/types.js";
import { PektinClient } from "../../main.js";
import { PektinZoneData } from "../../types.js";

export const importByZoneWalking = async (
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
    for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];

        const walked = await t.walk(domain, limit);
        if (!walked) throw Error(`Could not walk zone. Is the zone using NSEC records/chaining?`);
        const records = walked.map(t.toluolToApiRecord);
        /*@ts-ignore*/
        out[domain] = records;
    }
    return out;
};
