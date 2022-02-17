import yaml from "yaml";
import { PC3 } from "../types.js";
import { installVault } from "./install-vault.js";
import { chownRecursive, configToCertbotIni } from "./utils.js";
import { promises as fs } from "fs";
import path from "path";
import { chmod } from "./utils.js";

export const installK8s = async (dir: string = `/base/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const secrets = yaml.parse(
        await fs.readFile(path.join(dir, `secrets.yml`), {
            encoding: `utf-8`,
        })
    );
    const pektinConfig = yaml.parse(
        await fs.readFile(path.join(dir, `pektin-config.yml`), {
            encoding: `utf-8`,
        })
    );

    const { pektinAdminConnectionConfig, vaultTokens, acmeClientConnectionConfig } =
        await installVault({
            pektinConfig,
            secrets: secrets.secrets,
            k8s: true,
            internalVaultUrl: `http://127.0.0.1:8200`,
        });

    await fs.mkdir(path.join(dir, `secrets`), { recursive: true });
    await fs.writeFile(
        path.join(dir, `secrets`, `server-admin.pc3.json`),
        JSON.stringify(pektinAdminConnectionConfig)
    );
    await fs.writeFile(path.join(dir, `secrets`, `vault-tokens.json`), JSON.stringify(vaultTokens));
    await fs.writeFile(
        path.join(dir, `secrets`, `acme-client.pc3.json`),
        JSON.stringify(acmeClientConnectionConfig)
    );
    await fs.writeFile(
        path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`),
        configToCertbotIni(acmeClientConnectionConfig as PC3)
    );

    await chownRecursive(path.join(dir, `secrets`), process.env.UID, process.env.GID);

    await chmod(path.join(dir, `secrets`), `700`);
    await chmod(path.join(dir, `secrets`, `acme-client.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `server-admin.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `vault-tokens.json`), `600`);
    await chmod(path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`), `600`);
};

export const createSecrets = async () => {};

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
