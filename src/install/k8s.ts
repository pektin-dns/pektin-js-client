import { PektinConfig } from "@pektin/config/src/config-types";
import yaml from "yaml";
import { beautifyJSON, fromBase64 } from "../index.js";
import { PC3 } from "../types.js";
import { createSh } from "../utils/fs-sh.js";
import { installVault } from "./install-vault.js";
import { configToCertbotIni } from "./utils.js";
import { promises as fs } from "fs";
import path from "path";

export const installK8s = async (pektinConfigYamlB64: string, secretsYamlB64: string) => {
    if (!pektinConfigYamlB64 || !secretsYamlB64) {
        throw Error(`install needs a pektin config and the secrets`);
    }
    const pektinConfigYaml = fromBase64(pektinConfigYamlB64);
    const secretsYaml = fromBase64(secretsYamlB64);

    let pektinConfig, secrets;
    try {
        pektinConfig = yaml.parse(pektinConfigYaml);
        secrets = yaml.parse(secretsYaml) as K8sSecrets;
    } catch (error: any) {
        throw Error(`Failed to parse yaml: ${error?.message}`);
    }

    const { pektinAdminConnectionConfig, vaultTokens, acmeClientConnectionConfig } =
        await installVault({ pektinConfig, secrets });
    console.log(`-----`);

    console.log(
        JSON.stringify({
            pektinAdminConnectionConfig,
            vaultTokens,
            acmeClientConnectionConfig,
        })
    );
};

export const createSecrets = async (baseDir = `/base/`) => {
    let log = await fs.readFile(path.join(baseDir, `.secrets.tmp`), { encoding: `utf-8` });
    log = log.substring(log.indexOf(`-----`) + 5);

    const j = JSON.parse(log);

    await fs.mkdir(path.join(baseDir, `secrets`), { recursive: true });
    await fs.writeFile(
        path.join(baseDir, `secrets`, `server-admin.pc3.json`),
        JSON.stringify(j.pektinAdminConnectionConfig)
    );
    await fs.writeFile(
        path.join(baseDir, `secrets`, `vault-tokens.json`),
        JSON.stringify(j.vaultTokens)
    );
    await fs.writeFile(
        path.join(baseDir, `secrets`, `acme-client.pc3.json`),
        JSON.stringify(j.acmeClientConnectionConfig)
    );
    await fs.writeFile(
        path.join(baseDir, `secrets`, `certbot-acme-client.pc3.ini`),
        configToCertbotIni(j.acmeClientConnectionConfig)
    );
    await fs.unlink(path.join(baseDir, `.secrets.tmp`));
};

export interface K8sSecrets {
    nameserverSignerPasswords?: {
        [name: string]: string;
    };
    V_PEKTIN_API_PASSWORD?: string;
    adminClientInfo?: {
        confidant?: string;
        manager?: string;
        username?: string;
    };
    acmeClientInfo?: {
        confidant?: string;
        username?: string;
    };
    recursorAuth?: {
        username?: string;
        password?: string;
    };
    proxyAuth?: {
        username?: string;
        password?: string;
    };
}
