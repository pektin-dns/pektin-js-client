import { PektinConfig } from "@pektin/config/src/config-types.js";
import fs from "fs/promises";
import path from "path";
import { PektinClient, PC3 } from "../index.js";
import { ApiRecord, PektinRRType } from "../index.js";
import { chmod, chown, createSingleScript } from "./utils.js";
import { absoluteName, concatDomain } from "../index.js";
import { getMainNameServers, getMainNode, getPektinEndpoint } from "../pureFunctions.js";
import { Chalk } from "chalk";
import yaml from "yaml";

const c = new Chalk({ level: 3 });

export const pektinComposeFirstStart = async (
    dir = `/pektin-compose/`,
    setupType: `k8s` | `compose` = `compose`
) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const pektinConfig =
        setupType === `compose`
            ? (JSON.parse(
                  await fs.readFile(path.join(dir, `pektin-config.json`), `utf-8`)
              ) as PektinConfig)
            : yaml.parse(await fs.readFile(path.join(dir, `pektin-config.yml`), `utf-8`));

    const adminCreds: PC3 = JSON.parse(
        await fs.readFile(path.join(dir, `secrets`, `server-admin.pc3.json`), `utf-8`)
    );

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinSetupClient({
            ...adminCreds,
            ...(setupType === `compose` && { internal: true }),
            ...(setupType === `k8s` && { vaultEndpoint: `http://127.0.0.1:8200` }),
            ...(setupType === `k8s` && {
                override: { pektinApiEndpoint: `http://127.0.0.1:3333` },
            }),
        });

        await pc.setup(pektinConfig);
    }
    if (setupType === `compose`) {
        for (let i = 0; i < pektinConfig.nodes.length; i++) {
            const node = pektinConfig.nodes[i];
            if (node.setup && node.setup.system) {
                await createSingleScript(
                    path.join(dir, `arbeiter`, node.name),
                    path.join(dir, `arbeiter`, `${node.name}.sh`),
                    node
                );
            }
        }
    }
    const infos = getInfos(pektinConfig, setupType);
    console.log(infos);
    console.log(
        `These infos are also available in the just created file ${c.bold.cyan(`./your-infos.md`)}`
    );

    await fs.writeFile(
        path.join(dir, `your-infos.md`),
        // this is to uncolor chalk
        infos.replaceAll(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ``
        )
    );
    await chmod(path.join(dir, `your-infos.md`), `600`);
    await chown(path.join(dir, `your-infos.md`), process.env.UID, process.env.GID);
};

export const getInfos = (pektinConfig: PektinConfig, setupType: `k8s` | `compose`) => {
    return `
💻 ${c.bold(`UI`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `ui`))}
🤖 ${c.bold(`API`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `api`))}
You can find the admin credentials at ${c.bold.cyan(`./secrets/server-admin.pc3.json`)}

🔐 ${c.bold(`Vault`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `vault`))}
Vault key and root token can be found here: ${c.bold.cyan(
        setupType === `compose` ? `./secrets/.env` : `./secrets/vault-tokens.json`
    )}

🌳 ${c.bold(`Recursor`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `recursor`))}
The recursor basic auth username and password can be found in Vault at\n${c.bold.cyan(
        `${getPektinEndpoint(pektinConfig, `vault`)}/ui/vault/secrets/pektin-kv/show/recursor-auth`
    )}
`;
};

export class PektinSetupClient extends PektinClient {
    public setup = async (pektinConfig: PektinConfig) => {
        await this.createNameserverDNS(pektinConfig);
        await this.createPektinServiceEndpointsDNS(pektinConfig);
        // setup at the registrar
    };

    private createServiceSoaIfDifferentDomain = (
        pektinConfig: PektinConfig,
        records: ApiRecord[]
    ) => {
        Object.keys(pektinConfig.services).forEach((service) => {
            /*@ts-ignore*/
            const s = pektinConfig.services[service];
            if (!s.domain) return;
            if (s.enabled === false) {
                return;
            }

            const match = pektinConfig.nameservers.every((ns) => {
                return absoluteName(s.domain) !== absoluteName(ns.domain);
            });

            if (match) {
                const mainNameserver = getMainNameServers(pektinConfig);
                const mname = absoluteName(
                    concatDomain(mainNameserver[0].domain, mainNameserver[0].subDomain)
                );

                if (mainNameserver.length > 1) {
                    console.warn(
                        `${c.yellow.bold(
                            `\nWARNING`
                        )}: Multiple main nameservers are set but none of their SOA records\nis matching up with your set service domain ${c.bold.red(
                            s.domain
                        )} for the service ${c.bold.red(
                            service
                        )}\nWe are asuming that you want to use the nameserver at index 0: ${c.bold.red(
                            mname
                        )}`
                    );
                }
                records.push({
                    name: absoluteName(s.domain),
                    rr_type: PektinRRType.SOA,
                    rr_set: [
                        {
                            ttl: 60,
                            mname,
                            rname: absoluteName(`hostmaster.` + mainNameserver[0].domain),
                            serial: 0,
                            refresh: 0,
                            retry: 0,
                            expire: 0,
                            minimum: 0,
                        },
                    ],
                });
            }
        });
    };

    private createNameserverDNS = async (pektinConfig: PektinConfig) => {
        const records: ApiRecord[] = [];
        this.createServiceSoaIfDifferentDomain(pektinConfig, records);
        pektinConfig.nameservers.forEach((ns) => {
            if (ns.main) {
                records.push({
                    name: absoluteName(ns.domain),
                    rr_type: PektinRRType.SOA,
                    rr_set: [
                        {
                            ttl: 60,
                            mname: absoluteName(concatDomain(ns.domain, ns.subDomain)),
                            rname: absoluteName(`hostmaster.` + ns.domain),
                            serial: 0,
                            refresh: 0,
                            retry: 0,
                            expire: 0,
                            minimum: 0,
                        },
                    ],
                });

                const rr_set: { ttl: number; value: string }[] = [];
                pektinConfig.nameservers.forEach((ns2) => {
                    if (ns2.domain === ns.domain) {
                        rr_set.push({
                            ttl: 60,
                            value: absoluteName(concatDomain(ns.domain, ns.subDomain)),
                        });
                    }
                });
                records.push({
                    name: absoluteName(ns.domain),
                    rr_type: PektinRRType.NS,
                    rr_set,
                });
            }
            const currentNode = pektinConfig.nodes.filter((node) => node.name === ns.node)[0];

            if (currentNode.ips) {
                records.push({
                    name: absoluteName(concatDomain(ns.domain, ns.subDomain)),
                    rr_type: PektinRRType.AAAA,
                    rr_set: currentNode.ips.map((ip) => ({
                        ttl: 60,
                        value: ip,
                    })),
                });
            }
            if (currentNode.legacyIps) {
                records.push({
                    name: absoluteName(concatDomain(ns.domain, ns.subDomain)),
                    rr_type: PektinRRType.A,
                    rr_set: currentNode.legacyIps.map((legacyIp) => ({
                        ttl: 60,
                        value: legacyIp,
                    })),
                });
            }
        });
        return await this.set(records);
    };

    // create AAAA and A records for endabled service endpoints
    private createPektinServiceEndpointsDNS = async (pektinConfig: PektinConfig) => {
        const mainNode = getMainNode(pektinConfig);

        const enabledServices = Object.values(pektinConfig.services).filter(
            /*@ts-ignore*/
            (s) => s.enabled !== false && s.hasOwnProperty(`domain`)
        );
        const records: ApiRecord[] = [];

        enabledServices.forEach((s) => {
            if (mainNode.ips) {
                records.push({
                    /*@ts-ignore*/
                    name: absoluteName(concatDomain(s.domain, s.subDomain)),
                    rr_type: PektinRRType.AAAA,
                    rr_set: mainNode.ips.map((ip) => ({ ttl: 60, value: ip })),
                });
            }
            if (mainNode.legacyIps) {
                records.push({
                    /*@ts-ignore*/
                    name: absoluteName(concatDomain(s.domain, s.subDomain)),
                    rr_type: PektinRRType.A,
                    rr_set: mainNode.legacyIps.map((legacyIp) => ({
                        ttl: 60,
                        value: legacyIp,
                    })),
                });
            }
        });
        return await this.set(records);
    };
}
