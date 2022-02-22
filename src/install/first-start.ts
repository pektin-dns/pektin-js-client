import { PektinConfig } from "@pektin/config/src/config-types.js";
import fs from "fs/promises";
import path from "path";
import { PektinClient, PC3 } from "../index.js";
import { ApiRecord, PektinRRType } from "../index.js";
import { chmod, chown, createSingleScript } from "./utils.js";
import { absoluteName, concatDomain } from "../index.js";
import { getFirstMainNameServer, getMainNode, getPektinEndpoint } from "../pureFunctions.js";
import { Chalk } from "chalk";

const c = new Chalk({ level: 3 });

export const pektinComposeFirstStart = async (dir = `/pektin-compose/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const pektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, `pektin-config.json`), `utf-8`)
    ) as PektinConfig;

    const adminCreds: PC3 = JSON.parse(
        await fs.readFile(path.join(dir, `secrets`, `server-admin.pc3.json`), `utf-8`)
    );

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinSetupClient({
            ...adminCreds,
            internal: true,
        });

        await pc.setup(pektinConfig);
    }
    for (let i = 1; i < pektinConfig.nodes.length; i++) {
        const node = pektinConfig.nodes[i];
        if (node.setup && node.setup.system) {
            await createSingleScript(
                path.join(dir, `arbeiter`, node.name),
                path.join(dir, `arbeiter`, `${node.name}.sh`),
                node
            );
        }
    }
    const infos = getInfos(pektinConfig);
    console.log(infos);

    await fs.writeFile(
        path.join(dir, `your-infos.md`),
        infos.replaceAll(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ``
        )
    );
    await chmod(path.join(dir, `your-infos.md`), `600`);
    await chown(path.join(dir, `your-infos.md`), process.env.UID, process.env.GID);
};

export const getInfos = (pektinConfig: PektinConfig) => {
    return `
Endpoints:

💻 ${c.bold(`UI`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `ui`))}
🤖 ${c.bold(`API`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `api`))}
You can find the admin credentials at ${c.bold.cyan(`./secrets/server-admin.pc3.json`)}

🔐 ${c.bold(`Vault`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `vault`))}
Vault key and root token can be found here (V_KEY,V_ROOT_TOKEN): ${c.bold.cyan(`./secrets/.env`)}

🌳 ${c.bold(`Recursor`)}: ${c.bold.cyan(getPektinEndpoint(pektinConfig, `recursor`))}
The recursor basic auth username and password can be found in Vault at\n${c.bold.cyan(
        `${getPektinEndpoint(pektinConfig, `vault`)}/ui/vault/secrets/pektin-kv/show/recursor-auth`
    )}
`;
};

const getEmojiForServiceName = (name: string) => {
    const map = { api: `🤖`, ui: `💻`, vault: `🔐`, recursor: `🌳` };
    /*@ts-ignore*/
    return map[name];
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
            const match = pektinConfig.nameservers.some((ns) => {
                return s.enabled && absoluteName(s.domain) !== absoluteName(ns.domain);
            });
            if (match) {
                const mainNameserver = getFirstMainNameServer(pektinConfig);
                records.push({
                    name: absoluteName(s.domain),
                    rr_type: PektinRRType.SOA,
                    rr_set: [
                        {
                            ttl: 60,
                            mname: absoluteName(
                                concatDomain(mainNameserver.domain, mainNameserver.subDomain)
                            ),
                            rname: absoluteName(`hostmaster.` + mainNameserver.domain),
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
                this.createServiceSoaIfDifferentDomain(pektinConfig, records);

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
