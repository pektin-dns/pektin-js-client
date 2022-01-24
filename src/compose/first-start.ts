import { PektinConfig } from "@pektin/config/src/types";
import fs from "fs/promises";
import path from "path";
import { PektinComposeClient } from "../index.js";
import { PektinClientConnectionConfigOverride } from "../types";
import { createSingleScript } from "../utils.js";

const dir = "/pektin-compose/";

export const pektinComposeFirstStart = async (recursive: any) => {
    const pektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, "pektin-config.json"), "utf-8")
    ) as PektinConfig;

    const adminCreds: PektinClientConnectionConfigOverride = JSON.parse(
        await fs.readFile(path.join(dir, "secrets", "server-admin-connection-config.json"), "utf-8")
    );

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinComposeClient({
            confidantPassword: adminCreds.confidantPassword,
            vaultEndpoint: "http://pektin-vault:8200",
            username: adminCreds.username,
            override: {
                pektinApiEndpoint: "http://pektin-api:80"
            }
        });

        await pc.setup();
    }
    pektinConfig.nodes.forEach(async (node, i) => {
        if (i === 0) return;
        if (node.setup && node.setup.system) {
            await createSingleScript(
                path.join(dir, "arbeiter", node.name),
                path.join(dir, "arbeiter", `${node.name}.sh`),
                node,
                recursive
            );
        }
    });
};
