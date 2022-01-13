import fs from "fs/promises";
import path from "path";
import { ExtendedPektinApiClient } from "../index.js";
import { PektinClientCredentials, PektinConfig } from "../types";
import { createSingleScript } from "../utils.js";

const dir = "/pektin-compose/";

export const pektinComposeFirstStart = async (recursive: any) => {
    const pektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, "pektin-config.json"), "utf-8")
    ) as PektinConfig;

    const adminCreds: PektinClientCredentials = JSON.parse(
        await fs.readFile(path.join(dir, "secrets", "admin-access.json"), "utf-8")
    );

    if (pektinConfig.autoConfigureMainDomain) {
        const pc = new ExtendedPektinApiClient({
            confidantPassword: adminCreds.confidantPassword,
            vaultEndpoint: "http://pektin-vault:8200",
            username: adminCreds.username,
            override: {
                pektinApiEndpoint: "http://pektin-api:80"
            }
        });

        await pc.setupMainDomain();
    }
    pektinConfig.nameServers.forEach(async (ns, i) => {
        if (i === 0) return;
        if (ns.createSingleScript && ns.createSingleScript.system) {
            await createSingleScript(
                path.join(dir, "arbeiter", ns.subDomain),
                path.join(dir, "arbeiter", `${ns.subDomain}.sh`),
                ns,
                recursive
            );
        }
    });
};
