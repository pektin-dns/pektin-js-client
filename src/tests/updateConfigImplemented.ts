import { promises as fs } from "fs";
import { schemaHasAllMeta, propChainDots } from "@pektin/config/dist/js/utils/index.js";

(async () => {
    const metas: any[] = [];
    const uc = await fs.readFile(`./src/compose/updateConfig.ts`, {
        encoding: `utf8`,
    });
    const schema = JSON.parse(
        await fs.readFile(`./node_modules/@pektin/config/pektin-config.schema.json`, {
            encoding: `utf8`,
        })
    );
    schemaHasAllMeta({ schema, metas });

    const impl = uc
        .match(/^.*\/\/.*$/gm)
        ?.filter((e) => e.includes(`impl`))
        .map((l) => l.replaceAll(` `, ``).replaceAll(`//impl`, ``));

    const toBeImpl: string[] = [];

    metas
        .filter((m) => m.meta.updatable)
        .forEach((m) => {
            if (m.meta.use && m.meta.use.length) {
                m.meta.use.forEach((use: any) => {
                    toBeImpl.push(propChainDots([...m.propChain, ...use.place]));
                });
            }
        });

    const notImplemented = toBeImpl.filter((tbi) => {
        return !impl?.filter((im) => tbi.match(im)).length;
    });

    console.log(notImplemented);
    console.log(notImplemented.length);
})();
