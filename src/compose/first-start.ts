import { PektinConfig } from "@pektin/config/src/config-types.js";
import fs from "fs/promises";
import path from "path";
import { PektinClient } from "../index.js";
import { ApiRecord, PektinClientConnectionConfigOverride, PektinRRType } from "../index.js";
import { createSingleScript } from "./utils.js";
import { absoluteName, concatDomain } from "../index.js";
import { Logg } from "../logg/index.js";

const dir = `/pektin-compose/`;

new Logg({ categories: [0], callNames: { x: { name: `X-Function` } } });
/*@ts-ignore*/
const l = global.l as Logg;

export const pektinComposeFirstStart = async (recursive: any) => {
    const pektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, `pektin-config.json`), `utf-8`)
    ) as PektinConfig;

    const adminCreds: PektinClientConnectionConfigOverride = JSON.parse(
        await fs.readFile(path.join(dir, `secrets`, `server-admin-connection-config.json`), `utf-8`)
    );

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinComposeClient({
            confidantPassword: adminCreds.confidantPassword,
            vaultEndpoint: `http://pektin-vault:8200`,
            username: adminCreds.username,
            override: {
                pektinApiEndpoint: `http://pektin-api:80`,
            },
        });

        await pc.setup(pektinConfig);
    }
    for (let i = 1; i < pektinConfig.nodes.length; i++) {
        const node = pektinConfig.nodes[i];
        if (node.setup && node.setup.system) {
            await createSingleScript(
                path.join(dir, `arbeiter`, node.name),
                path.join(dir, `arbeiter`, `${node.name}.sh`),
                node,
                recursive
            );
        }
    }
};

export class PektinComposeClient extends PektinClient {
    public setup = async (pektinConfig: PektinConfig) => {
        await this.createNameserverDNS(pektinConfig);
        await this.createPektinServiceEndpointsDNS(pektinConfig);
        // setup at the registrar
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
        const mainNode = pektinConfig.nodes.filter((node) => node.main === true)[0];

        const enabledServices = [
            pektinConfig.ui,
            pektinConfig.api,
            pektinConfig.vault,
            pektinConfig.recursor,
        ].filter((s) => s.enabled);
        const records: ApiRecord[] = [];

        enabledServices.forEach((s) => {
            if (mainNode.ips) {
                records.push({
                    name: absoluteName(concatDomain(s.domain, s.subDomain)),
                    rr_type: PektinRRType.AAAA,
                    rr_set: mainNode.ips.map((ip) => ({ ttl: 60, value: ip })),
                });
            }
            if (mainNode.legacyIps) {
                records.push({
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
